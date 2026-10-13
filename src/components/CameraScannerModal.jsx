import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Camera,
  X,
  RefreshCw,
  RotateCw,
  Zap,
  CheckCircle2,
  Search,
  AlertCircle,
  Image as ImageIcon,
  ArrowLeft,
  Sparkles,
} from 'lucide-react';
import { scanBarcodeFromImageFile, getBrowserBarcodeReader } from '../utils/barcodeScanner';
import { playScanBeep, playClickSound, playErrorBuzz } from '../utils/sound';

export function CameraScannerModal({ isOpen, onClose, onDetected }) {
  if (!isOpen) return null;

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const scanLoopRef = useRef(null);
  const isMountedRef = useRef(true);
  const lastScannedRef = useRef({ code: '', time: 0 });
  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);

  const [status, setStatus] = useState('starting'); // 'starting' | 'scanning' | 'error'
  const [errorMsg, setErrorMsg] = useState('');
  const [lastCode, setLastCode] = useState(null);
  const [continuousMode, setContinuousMode] = useState(true);
  const [manualCode, setManualCode] = useState('');
  const [cameras, setCameras] = useState([]);
  const [cameraIdx, setCameraIdx] = useState(0);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [rotation, setRotation] = useState(0); // 0, 90, 180, 270

  // Photo Scan State (prevents black screen when user snaps photo)
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoStatus, setPhotoStatus] = useState(null); // null | 'analyzing' | 'success' | 'failed'
  const [photoErrorMsg, setPhotoErrorMsg] = useState('');

  const continuousModeRef = useRef(continuousMode);
  continuousModeRef.current = continuousMode;
  const rotationRef = useRef(rotation);
  rotationRef.current = rotation;

  // ──────────────────────────────────────────────────────────────────────────
  // STOP helpers
  // ──────────────────────────────────────────────────────────────────────────
  const stopScanLoop = useCallback(() => {
    if (scanLoopRef.current) {
      clearTimeout(scanLoopRef.current);
      scanLoopRef.current = null;
    }
  }, []);

  const stopStream = useCallback(() => {
    stopScanLoop();
    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach((t) => t.stop());
      } catch { /* ignore */ }
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [stopScanLoop]);

  // ──────────────────────────────────────────────────────────────────────────
  // Decode frame from video
  // ──────────────────────────────────────────────────────────────────────────
  const decodeFrame = useCallback(async (video) => {
    if (!video || !isMountedRef.current) return null;
    if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) return null;

    const canvas = canvasRef.current;
    if (!canvas) return null;

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const rot = rotationRef.current;
    const swap = rot === 90 || rot === 270;

    canvas.width = swap ? vh : vw;
    canvas.height = swap ? vw : vh;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    if (rot === 0) {
      ctx.drawImage(video, 0, 0, vw, vh);
    } else {
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rot * Math.PI) / 180);
      ctx.drawImage(video, -vw / 2, -vh / 2);
      ctx.restore();
    }

    // 1. Try Hardware BarcodeDetector API (Android Chrome / desktop)
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      try {
        const bd = new window.BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'qr_code', 'itf'],
        });
        const results = await bd.detect(canvas);
        if (results && results.length > 0 && results[0].rawValue) {
          return results[0].rawValue.trim();
        }
      } catch { /* fallback to ZXing */ }
    }

    // 2. ZXing BrowserMultiFormatReader decode from canvas
    try {
      const reader = getBrowserBarcodeReader();
      const result = reader.decodeFromCanvas(canvas);
      if (result && result.getText()) {
        return result.getText().trim();
      }
    } catch { /* NotFoundException is normal when frame has no barcode */ }

    // 3. Fallback: Quick 90° flip for vertical barcodes (bottles/cans) if rotation was 0
    if (rot === 0) {
      try {
        const altCanvas = document.createElement('canvas');
        altCanvas.width = vh;
        altCanvas.height = vw;
        const altCtx = altCanvas.getContext('2d', { willReadFrequently: true });
        if (altCtx) {
          altCtx.translate(vh / 2, vw / 2);
          altCtx.rotate(Math.PI / 2);
          altCtx.drawImage(video, -vw / 2, -vh / 2);
          const reader = getBrowserBarcodeReader();
          const altResult = reader.decodeFromCanvas(altCanvas);
          if (altResult && altResult.getText()) {
            return altResult.getText().trim();
          }
        }
      } catch { /* not found */ }
    }

    return null;
  }, []);

  // ──────────────────────────────────────────────────────────────────────────
  // Scan Loop (throttled ~80ms to keep mobile cool)
  // ──────────────────────────────────────────────────────────────────────────
  const handleDetected = useCallback(
    (code) => {
      const now = Date.now();
      if (code === lastScannedRef.current.code && now - lastScannedRef.current.time < 1500) return;
      lastScannedRef.current = { code, time: now };

      playScanBeep();
      if (navigator.vibrate) {
        try { navigator.vibrate([60]); } catch { /* ignore */ }
      }

      setLastCode(code);
      onDetected(code);

      if (!continuousModeRef.current) {
        setTimeout(() => {
          if (isMountedRef.current) onClose();
        }, 400);
      }
    },
    [onDetected, onClose]
  );

  const startScanLoop = useCallback(() => {
    stopScanLoop();
    let isProcessing = false;

    const tick = async () => {
      if (!isMountedRef.current || !videoRef.current || photoPreview) {
        scanLoopRef.current = setTimeout(tick, 200);
        return;
      }

      if (!isProcessing) {
        isProcessing = true;
        try {
          const code = await decodeFrame(videoRef.current);
          if (code) {
            handleDetected(code);
          }
        } catch (err) {
          console.warn('[scanner] loop error:', err);
        } finally {
          isProcessing = false;
        }
      }

      if (isMountedRef.current) {
        scanLoopRef.current = setTimeout(tick, 80);
      }
    };

    scanLoopRef.current = setTimeout(tick, 100);
  }, [decodeFrame, handleDetected, stopScanLoop, photoPreview]);

  // ──────────────────────────────────────────────────────────────────────────
  // Start Camera Stream
  // ──────────────────────────────────────────────────────────────────────────
  const startCamera = useCallback(async (deviceId) => {
    if (!isMountedRef.current) return;
    stopStream();
    setStatus('starting');
    setErrorMsg('');
    setLastCode(null);

    try {
      // Natural mobile orientation constraints without forcing widescreen 1280x720
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const constraints = {
        video: deviceId
          ? {
              deviceId: { exact: deviceId },
              width: isMobile ? { ideal: 1080 } : { ideal: 1280 },
              height: isMobile ? { ideal: 1920 } : { ideal: 720 },
            }
          : {
              facingMode: { ideal: 'environment' },
              width: isMobile ? { ideal: 1080 } : { ideal: 1280 },
              height: isMobile ? { ideal: 1920 } : { ideal: 720 },
            },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (!isMountedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        video.setAttribute('playsinline', 'true');
        video.setAttribute('autoplay', 'true');
        video.muted = true;
        await video.play().catch(() => {});
      }

      // Check torch capability
      const track = stream.getVideoTracks()[0];
      if (track) {
        const caps = track.getCapabilities?.() || {};
        setTorchSupported(Boolean(caps.torch));
      }

      if (isMountedRef.current) {
        setStatus('scanning');
        startScanLoop();
      }
    } catch (err) {
      console.error('Camera startup error:', err);
      if (!isMountedRef.current) return;
      setStatus('error');
      if (err.name === 'NotAllowedError' || String(err).includes('Permission')) {
        setErrorMsg('กรุณาอนุญาตสิทธิ์กล้องในเบราว์เซอร์ แล้วแตะ "ลองใหม่"');
      } else if (err.name === 'NotFoundError') {
        setErrorMsg('ไม่พบกล้องบนอุปกรณ์นี้ สามารถถ่ายรูปหรือพิมพ์รหัสได้');
      } else if (!window.isSecureContext) {
        setErrorMsg('ต้องเปิดผ่าน HTTPS เพื่อเข้าถึงกล้อง');
      } else {
        setErrorMsg(`เปิดกล้องไม่สำเร็จ: ${err.message || err.name}`);
      }
    }
  }, [stopStream, startScanLoop]);

  // ──────────────────────────────────────────────────────────────────────────
  // Mount / Unmount & Visibility Auto-recovery
  // ──────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    isMountedRef.current = true;
    lastScannedRef.current = { code: '', time: 0 };

    const init = async () => {
      try {
        if (navigator.mediaDevices?.enumerateDevices) {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const cams = devices.filter((d) => d.kind === 'videoinput');
          if (cams.length > 0) {
            setCameras(cams);
            // Default to back/rear/environment lens
            const backIdx = cams.findIndex((c) =>
              /back|rear|environment/i.test(c.label)
            );
            const chosen = backIdx >= 0 ? backIdx : cams.length - 1;
            setCameraIdx(chosen);
            await startCamera(cams[chosen].deviceId);
            return;
          }
        }
      } catch { /* fallback to default */ }

      await startCamera(null);
    };

    init();

    // Auto-revive camera when returning from photo picker / background tab
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isMountedRef.current) {
        const video = videoRef.current;
        const stream = streamRef.current;
        const isTrackEnded = stream?.getVideoTracks().some((t) => t.readyState === 'ended');
        if (!stream || isTrackEnded || video?.paused) {
          console.log('[scanner] Reviving camera stream on page visibility restore');
          startCamera(cameras[cameraIdx]?.deviceId ?? null);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      isMountedRef.current = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
      stopStream();
    };
  }, []); // mount only

  // ──────────────────────────────────────────────────────────────────────────
  // Controls: Switch Camera, Torch, Rotate View
  // ──────────────────────────────────────────────────────────────────────────
  const handleSwitchCamera = async () => {
    playClickSound();
    if (cameras.length > 1) {
      const nextIdx = (cameraIdx + 1) % cameras.length;
      setCameraIdx(nextIdx);
      await startCamera(cameras[nextIdx].deviceId);
    } else {
      await startCamera(null);
    }
  };

  const handleToggleTorch = async () => {
    playClickSound();
    const track = streamRef.current?.getVideoTracks()[0];
    if (track && track.applyConstraints) {
      try {
        await track.applyConstraints({ advanced: [{ torch: !torchOn }] });
        setTorchOn((prev) => !prev);
      } catch (err) {
        console.warn('Torch toggle failed:', err);
      }
    }
  };

  const handleRotate = () => {
    playClickSound();
    setRotation((prev) => (prev + 90) % 360);
  };

  // ──────────────────────────────────────────────────────────────────────────
  // Photo Barcode Scan (Fixes black screen completely)
  // ──────────────────────────────────────────────────────────────────────────
  const handleFileScan = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    playClickSound();
    const previewUrl = URL.createObjectURL(file);
    setPhotoPreview(previewUrl);
    setPhotoStatus('analyzing');
    setPhotoErrorMsg('');

    try {
      const code = await scanBarcodeFromImageFile(file);
      if (code) {
        setPhotoStatus('success');
        handleDetected(code);
        setTimeout(() => {
          if (isMountedRef.current) {
            setPhotoPreview(null);
            setPhotoStatus(null);
            if (!continuousModeRef.current) onClose();
          }
        }, 1200);
      } else {
        throw new Error('No barcode found');
      }
    } catch (err) {
      console.warn('Photo barcode scan error:', err);
      playErrorBuzz();
      setPhotoStatus('failed');
      setPhotoErrorMsg('ไม่พบบาร์โค้ดในภาพ กรุณาถ่ายใหม่ให้บาร์โค้ดชัดเจนและไม่สะท้อนแสง');
      // Revive live camera so user never gets stuck with a black screen
      if (!streamRef.current || videoRef.current?.paused) {
        startCamera(cameras[cameraIdx]?.deviceId ?? null);
      }
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  const handleClearPhotoPreview = () => {
    playClickSound();
    if (photoPreview) {
      try { URL.revokeObjectURL(photoPreview); } catch { /* ignore */ }
    }
    setPhotoPreview(null);
    setPhotoStatus(null);
    setPhotoErrorMsg('');
    // Ensure camera is active
    if (!streamRef.current || videoRef.current?.paused) {
      startCamera(cameras[cameraIdx]?.deviceId ?? null);
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // Close & Manual Submit
  // ──────────────────────────────────────────────────────────────────────────
  const handleClose = () => {
    playClickSound();
    stopStream();
    if (photoPreview) {
      try { URL.revokeObjectURL(photoPreview); } catch { /* ignore */ }
    }
    onClose();
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    const code = manualCode.trim();
    if (!code) return;
    playScanBeep();
    onDetected(code);
    setManualCode('');
    if (!continuousMode) handleClose();
  };

  // ──────────────────────────────────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────────────────────────────────
  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div
        className="modal-content scanner-modal animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <div className="header-info">
            <div className="brand-logo-wrap" style={{ width: 36, height: 36 }}>
              <Camera size={20} className="text-white" />
            </div>
            <div>
              <h3 className="modal-title">สแกนบาร์โค้ดสินค้า</h3>
              <p className="modal-subtitle">
                {photoPreview
                  ? 'กำลังวิเคราะห์ภาพถ่ายบาร์โค้ด'
                  : status === 'scanning'
                  ? 'หันกล้องไปที่บาร์โค้ด หรือแตะถ่ายรูป'
                  : status === 'error'
                  ? 'เปิดกล้องไม่สำเร็จ'
                  : 'กำลังเชื่อมต่อกล้อง...'}
              </p>
            </div>
          </div>
          <button className="icon-btn close-btn" onClick={handleClose} title="ปิด">
            <X size={20} />
          </button>
        </div>

        {/* Viewport Box */}
        <div className="scanner-container">
          <canvas ref={canvasRef} style={{ display: 'none' }} />

          {/* Photo Preview Mode (When user snapped/selected a photo) */}
          {photoPreview ? (
            <div className="photo-scan-preview-box">
              <img src={photoPreview} alt="ภาพที่ถ่ายเพื่อสแกน" className="photo-preview-image" />
              {photoStatus === 'analyzing' && (
                <div className="photo-scan-overlay analyzing">
                  <RefreshCw className="animate-spin text-primary mb-2" size={36} />
                  <p className="font-bold text-white text-sm">กำลังวิเคราะห์บาร์โค้ดจากภาพ...</p>
                  <p className="text-xs text-muted mt-1">หมุนภาพและปรับคอนทราสต์อัตโนมัติ</p>
                </div>
              )}
              {photoStatus === 'success' && (
                <div className="photo-scan-overlay success">
                  <CheckCircle2 size={44} className="text-success mb-2 animate-bounce" />
                  <p className="font-bold text-white text-base">สแกนสำเร็จ!</p>
                  <span className="font-mono text-sm bg-black/60 px-3 py-1 rounded-full text-emerald-300 mt-1">
                    {lastCode}
                  </span>
                </div>
              )}
              {photoStatus === 'failed' && (
                <div className="photo-scan-overlay failed">
                  <AlertCircle size={38} className="text-danger mb-2" />
                  <p className="font-bold text-white text-sm text-center px-4">{photoErrorMsg}</p>
                  <div className="flex gap-2 mt-3">
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Camera size={14} /> ถ่ายใหม่อีกครั้ง
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={handleClearPhotoPreview}
                    >
                      <ArrowLeft size={14} /> กลับไปกล้องสด
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Live Camera Mode */
            <>
              <video
                ref={videoRef}
                className="scanner-native-video"
                style={{
                  transform: rotation ? `rotate(${rotation}deg)` : 'none',
                }}
                playsInline
                muted
                autoPlay
              />

              {status === 'scanning' && (
                <div className="scan-aim-overlay">
                  <div className="laser-line" />
                  <div className="aim-corner top-left" />
                  <div className="aim-corner top-right" />
                  <div className="aim-corner bottom-left" />
                  <div className="aim-corner bottom-right" />
                  <span className="scan-guide-text">วางบาร์โค้ดให้อยู่ในกรอบ</span>
                </div>
              )}

              {status === 'starting' && (
                <div className="scanner-loading-overlay">
                  <RefreshCw className="animate-spin text-primary mb-2" size={32} />
                  <p className="text-sm font-medium">กำลังเปิดกล้อง...</p>
                </div>
              )}

              {status === 'error' && (
                <div className="scanner-error-overlay">
                  <AlertCircle size={36} className="text-danger mb-2" />
                  <h4 className="font-bold text-danger text-base">เปิดกล้องไม่ได้</h4>
                  <p className="text-xs text-muted max-w-xs text-center mt-1 mb-3">{errorMsg}</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => startCamera(cameras[cameraIdx]?.deviceId ?? null)}
                    >
                      <RefreshCw size={14} /> ลองใหม่
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Camera size={14} /> ถ่ายรูปแทน
                    </button>
                  </div>
                </div>
              )}

              {/* Scanned Feedback Toast */}
              {lastCode && (
                <div className="scanned-feedback-toast animate-slide-up">
                  <CheckCircle2 size={18} className="text-success" />
                  <span>
                    ยิงติด: <strong className="font-mono">{lastCode}</strong>
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Action Toolbar */}
        <div className="scanner-action-toolbar">
          {/* Rotate View Angle Button (Solves rotated/sideways phone feeds 100%) */}
          <button
            type="button"
            className={`btn btn-sm ${rotation !== 0 ? 'btn-primary' : 'btn-secondary'}`}
            onClick={handleRotate}
            title="แตะเพื่อหมุนมุมกล้อง หากภาพตะแคงหรือกลับหัว"
          >
            <RotateCw size={15} />
            <span>หมุนกล้อง ({rotation}°)</span>
          </button>

          {cameras.length > 1 && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleSwitchCamera}
              title="สลับเลนส์กล้องมือถือ"
            >
              <RefreshCw size={15} />
              <span>เลนส์ {cameraIdx + 1}/{cameras.length}</span>
            </button>
          )}

          {torchSupported && (
            <button
              type="button"
              className={`btn btn-sm ${torchOn ? 'btn-accent' : 'btn-secondary'}`}
              onClick={handleToggleTorch}
              title="เปิดไฟแฟลชช่วยส่องในที่มืด"
            >
              <Zap size={15} />
              <span>{torchOn ? 'ปิดไฟ' : 'เปิดไฟ'}</span>
            </button>
          )}

          {/* Hidden file input for photo snap */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={handleFileScan}
          />
          <button
            type="button"
            className="btn btn-outline-primary btn-sm flex-1 font-bold"
            onClick={() => fileInputRef.current?.click()}
          >
            <ImageIcon size={15} />
            <span>📸 ถ่ายรูปสแกน</span>
          </button>
        </div>

        {/* Continuous mode toggle */}
        <div className="scanner-controls">
          <label className="toggle-switch-label">
            <input
              type="checkbox"
              checked={continuousMode}
              onChange={(e) => {
                playClickSound();
                setContinuousMode(e.target.checked);
              }}
            />
            <span className="toggle-slider" />
            <span className="toggle-text">ยิงต่อเนื่องหลายชิ้น (ไม่ต้องกดเปิดกล้องใหม่)</span>
          </label>
        </div>

        {/* Manual Barcode Input Form */}
        <form onSubmit={handleManualSubmit} className="manual-barcode-form">
          <div className="search-input-wrapper">
            <Search size={18} className="input-icon" />
            <input
              type="text"
              className="form-control font-mono"
              placeholder="พิมพ์รหัสบาร์โค้ดเอง (เช่น 885...)"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
            />
            <button type="submit" className="btn btn-primary btn-sm font-bold">
              เพิ่มลงบิล
            </button>
          </div>
        </form>

        <div className="modal-actions">
          <button type="button" className="btn btn-secondary w-full" onClick={handleClose}>
            ปิดหน้าต่างกล้อง
          </button>
        </div>
      </div>
    </div>
  );
}
