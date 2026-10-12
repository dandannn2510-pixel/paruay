import React, { useEffect, useRef, useState, useCallback } from 'react';
import { BrowserMultiFormatReader, DecodeHintType, BarcodeFormat } from '@zxing/library';
import {
  Camera,
  X,
  RefreshCw,
  Zap,
  CheckCircle2,
  Search,
  AlertCircle,
  Image as ImageIcon,
} from 'lucide-react';
import { scanBarcodeFromImageFile } from '../utils/barcodeScanner';
import { playScanBeep, playClickSound } from '../utils/sound';

export function CameraScannerModal({ isOpen, onClose, onDetected }) {
  if (!isOpen) return null;

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const readerRef = useRef(null);
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
  const [isScanningFile, setIsScanningFile] = useState(false);
  const [cameras, setCameras] = useState([]);
  const [cameraIdx, setCameraIdx] = useState(0);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);

  const continuousModeRef = useRef(continuousMode);
  continuousModeRef.current = continuousMode;

  // ──────────────────────────────────────────────────────────────────────────
  // STOP helpers
  // ──────────────────────────────────────────────────────────────────────────
  const stopScanLoop = useCallback(() => {
    if (scanLoopRef.current) {
      cancelAnimationFrame(scanLoopRef.current);
      scanLoopRef.current = null;
    }
  }, []);

  const stopStream = useCallback(() => {
    stopScanLoop();
    if (readerRef.current) {
      try { readerRef.current.reset(); } catch { /* ignore */ }
      readerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [stopScanLoop]);

  // ──────────────────────────────────────────────────────────────────────────
  // Decode one canvas frame with ZXing
  // ──────────────────────────────────────────────────────────────────────────
  const decodeFrame = useCallback(async (video) => {
    if (!video || !isMountedRef.current) return null;
    if (video.readyState < 2) return null;

    const canvas = canvasRef.current;
    if (!canvas) return null;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(video, 0, 0);

    // 1. Try Native BarcodeDetector (Android Chrome) — fastest
    if ('BarcodeDetector' in window) {
      try {
        const bd = new window.BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'qr_code', 'itf'],
        });
        const results = await bd.detect(canvas);
        if (results.length > 0) return results[0].rawValue;
      } catch { /* fallthrough to ZXing */ }
    }

    // 2. ZXing decode from canvas ImageData
    try {
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.CODE_128,
        BarcodeFormat.CODE_39,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
        BarcodeFormat.QR_CODE,
        BarcodeFormat.ITF,
        BarcodeFormat.CODE_93,
      ]);
      hints.set(DecodeHintType.TRY_HARDER, true);
      if (!readerRef.current) {
        readerRef.current = new BrowserMultiFormatReader(hints);
      }
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const result = readerRef.current.decodeFromImageData(imgData);
      if (result) return result.getText();
    } catch { /* NotFoundException is normal, just no barcode this frame */ }

    return null;
  }, []);

  // ──────────────────────────────────────────────────────────────────────────
  // Scan loop — runs every animation frame while camera is open
  // ──────────────────────────────────────────────────────────────────────────
  const handleDetected = useCallback(
    (code) => {
      const now = Date.now();
      if (code === lastScannedRef.current.code && now - lastScannedRef.current.time < 1500) return;
      lastScannedRef.current = { code, time: now };

      playScanBeep();
      if (navigator.vibrate) try { navigator.vibrate([60]); } catch { /* ignore */ }

      setLastCode(code);
      onDetected(code);

      if (!continuousModeRef.current) {
        setTimeout(() => { if (isMountedRef.current) onClose(); }, 350);
      }
    },
    [onDetected, onClose]
  );

  const startScanLoop = useCallback(() => {
    stopScanLoop();
    const loop = async () => {
      if (!isMountedRef.current || !videoRef.current) return;
      const code = await decodeFrame(videoRef.current);
      if (code) handleDetected(code);
      scanLoopRef.current = requestAnimationFrame(loop);
    };
    scanLoopRef.current = requestAnimationFrame(loop);
  }, [decodeFrame, handleDetected, stopScanLoop]);

  // ──────────────────────────────────────────────────────────────────────────
  // Start camera stream
  // ──────────────────────────────────────────────────────────────────────────
  const startCamera = useCallback(async (deviceId) => {
    if (!isMountedRef.current) return;
    stopStream();
    setStatus('starting');
    setErrorMsg('');
    setLastCode(null);

    try {
      const constraints = {
        video: deviceId
          ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (!isMountedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;
      const video = videoRef.current;
      video.srcObject = stream;
      video.setAttribute('playsinline', 'true');
      video.setAttribute('autoplay', 'true');
      video.muted = true;
      await video.play();

      // Check torch support
      const track = stream.getVideoTracks()[0];
      if (track) {
        const caps = track.getCapabilities?.() || {};
        setTorchSupported(!!caps.torch);
      }

      if (isMountedRef.current) {
        setStatus('scanning');
        startScanLoop();
      }
    } catch (err) {
      console.error('Camera error:', err);
      if (!isMountedRef.current) return;
      setStatus('error');
      if (err.name === 'NotAllowedError' || String(err).includes('Permission')) {
        setErrorMsg('กรุณาอนุญาตสิทธิ์กล้องในเบราว์เซอร์ แล้วลองใหม่');
      } else if (err.name === 'NotFoundError') {
        setErrorMsg('ไม่พบกล้องบนอุปกรณ์นี้ สามารถถ่ายรูปหรือพิมพ์รหัสได้');
      } else if (!window.isSecureContext) {
        setErrorMsg('ต้องเปิดผ่าน HTTPS เพื่อใช้งานกล้อง');
      } else {
        setErrorMsg(`เปิดกล้องไม่ได้: ${err.message || err.name}`);
      }
    }
  }, [stopStream, startScanLoop]);

  // ──────────────────────────────────────────────────────────────────────────
  // Mount / unmount
  // ──────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    isMountedRef.current = true;
    lastScannedRef.current = { code: '', time: 0 };

    const init = async () => {
      // Enumerate cameras
      try {
        // Request permission first so labels are populated
        const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
        tempStream.getTracks().forEach((t) => t.stop());
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cams = devices.filter((d) => d.kind === 'videoinput');
        if (cams.length > 0) {
          setCameras(cams);
          // Prefer back/environment camera
          const backIdx = cams.findIndex((c) =>
            /back|rear|environment/i.test(c.label) || cams.indexOf(c) === cams.length - 1
          );
          const idx = backIdx >= 0 ? backIdx : cams.length - 1;
          setCameraIdx(idx);
          await startCamera(cams[idx].deviceId);
          return;
        }
      } catch { /* fallthrough */ }
      await startCamera(null); // fallback facingMode
    };

    init();

    return () => {
      isMountedRef.current = false;
      stopStream();
    };
  }, []); // only on mount

  // ──────────────────────────────────────────────────────────────────────────
  // Switch camera
  // ──────────────────────────────────────────────────────────────────────────
  const handleSwitchCamera = async () => {
    playClickSound();
    if (cameras.length > 1) {
      const nextIdx = (cameraIdx + 1) % cameras.length;
      setCameraIdx(nextIdx);
      await startCamera(cameras[nextIdx].deviceId);
    } else {
      // toggle front/back by facingMode
      const stream = streamRef.current;
      const track = stream?.getVideoTracks()[0];
      const settings = track?.getSettings?.() || {};
      const isFront = settings.facingMode === 'user';
      await startCamera(null); // restart with opposite
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // Torch toggle
  // ──────────────────────────────────────────────────────────────────────────
  const handleToggleTorch = async () => {
    playClickSound();
    const track = streamRef.current?.getVideoTracks()[0];
    if (track && track.applyConstraints) {
      try {
        await track.applyConstraints({ advanced: [{ torch: !torchOn }] });
        setTorchOn((prev) => !prev);
      } catch (err) {
        console.warn('Torch failed:', err);
      }
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // Photo scan (file input)
  // ──────────────────────────────────────────────────────────────────────────
  const handleFileScan = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsScanningFile(true);
    playClickSound();
    try {
      const code = await scanBarcodeFromImageFile(file);
      if (code) {
        handleDetected(code);
      } else {
        alert('ไม่พบบาร์โค้ดในรูปภาพ กรุณาถ่ายให้บาร์โค้ดชัดเจนและอยู่ตรงกลางภาพ');
      }
    } catch (err) {
      console.warn('File scan error:', err);
      alert('ไม่พบบาร์โค้ดในรูปภาพ กรุณาถ่ายใหม่ให้บาร์โค้ดชัดเจน');
    } finally {
      setIsScanningFile(false);
      if (e.target) e.target.value = '';
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // Close
  // ──────────────────────────────────────────────────────────────────────────
  const handleClose = () => {
    playClickSound();
    stopStream();
    onClose();
  };

  // ──────────────────────────────────────────────────────────────────────────
  // Manual input
  // ──────────────────────────────────────────────────────────────────────────
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
            <Camera className="text-primary" size={24} />
            <div>
              <h3 className="modal-title">สแกนบาร์โค้ดด้วยกล้อง</h3>
              <p className="modal-subtitle">
                {status === 'scanning'
                  ? 'หันกล้องไปที่บาร์โค้ด หรือคิวอาร์โค้ด'
                  : status === 'error'
                  ? 'ไม่สามารถเปิดกล้องได้'
                  : 'กำลังเชื่อมต่อกล้อง...'}
              </p>
            </div>
          </div>
          <button className="icon-btn close-btn" onClick={handleClose} title="ปิด">
            <X size={20} />
          </button>
        </div>

        {/* Camera Viewport */}
        <div className="scanner-container">
          {/* Hidden offscreen canvas for ZXing */}
          <canvas ref={canvasRef} style={{ display: 'none' }} />

          {/* Video element — we control it directly */}
          <video
            ref={videoRef}
            className="scanner-native-video"
            playsInline
            muted
            autoPlay
          />

          {/* Scan aim overlay */}
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

          {/* Starting spinner */}
          {status === 'starting' && (
            <div className="scanner-loading-overlay">
              <RefreshCw className="animate-spin text-primary mb-2" size={32} />
              <p className="text-sm font-medium">กำลังเปิดกล้อง...</p>
            </div>
          )}

          {/* Error */}
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

          {/* Success toast */}
          {lastCode && (
            <div className="scanned-feedback-toast animate-slide-up">
              <CheckCircle2 size={18} className="text-success" />
              <span>
                ยิงติด: <strong className="font-mono">{lastCode}</strong>
              </span>
            </div>
          )}
        </div>

        {/* Action toolbar */}
        <div className="scanner-action-toolbar">
          {cameras.length > 1 && (
            <button
              type="button"
              className="btn btn-secondary btn-sm flex-1"
              onClick={handleSwitchCamera}
            >
              <RefreshCw size={15} />
              <span>สลับกล้อง ({cameraIdx + 1}/{cameras.length})</span>
            </button>
          )}

          {torchSupported && (
            <button
              type="button"
              className={`btn btn-sm ${torchOn ? 'btn-accent' : 'btn-secondary'}`}
              onClick={handleToggleTorch}
            >
              <Zap size={15} />
              <span>{torchOn ? 'ปิดไฟ' : 'เปิดไฟ'}</span>
            </button>
          )}

          {/* Hidden file input — triggers native camera on mobile */}
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
            className="btn btn-outline-primary btn-sm flex-1"
            onClick={() => fileInputRef.current?.click()}
            disabled={isScanningFile}
          >
            <ImageIcon size={15} />
            <span>{isScanningFile ? 'กำลังวิเคราะห์...' : '📸 ถ่ายรูป/เลือกภาพสแกน'}</span>
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

        {/* Manual barcode input */}
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
