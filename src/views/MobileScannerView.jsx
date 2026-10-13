import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Smartphone,
  Camera,
  Zap,
  RefreshCw,
  RotateCw,
  CheckCircle2,
  AlertCircle,
  Search,
  ArrowLeft,
  Wifi,
  WifiOff,
  Image as ImageIcon,
  Layers,
  ShoppingBag,
} from 'lucide-react';
import { getBrowserBarcodeReader, scanBarcodeFromImageFile } from '../utils/barcodeScanner';
import { createScannerClient } from '../services/remoteScannerService';
import { playScanBeep, playClickSound, playErrorBuzz } from '../utils/sound';

export function MobileScannerView({ initialPairCode = '', onExit }) {
  // Pairing room state
  const [pairCode, setPairCode] = useState(
    initialPairCode || localStorage.getItem('paruay_last_joined_pair') || '8821'
  );
  const [isChangingRoom, setIsChangingRoom] = useState(!initialPairCode && !localStorage.getItem('paruay_last_joined_pair'));
  const [inputRoom, setInputRoom] = useState(pairCode);

  // Connection state
  const [connectionStatus, setConnectionStatus] = useState({ connected: false, hostName: '' });
  const clientRef = useRef(null);

  // Camera state
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);
  const scanLoopRef = useRef(null);
  const isMountedRef = useRef(true);
  const lastScannedRef = useRef({ code: '', time: 0 });
  const fileInputRef = useRef(null);

  const [cameraStatus, setCameraStatus] = useState('starting'); // 'starting' | 'scanning' | 'error'
  const [cameraError, setCameraError] = useState('');
  const [cameras, setCameras] = useState([]);
  const [cameraIdx, setCameraIdx] = useState(0);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [rotation, setRotation] = useState(0);

  // Feedback state
  const [lastAck, setLastAck] = useState(null);
  const [recentScans, setRecentScans] = useState([]);
  const [manualCode, setManualCode] = useState('');
  const [isScanningPhoto, setIsScanningPhoto] = useState(false);

  const rotationRef = useRef(rotation);
  rotationRef.current = rotation;

  // ──────────────────────────────────────────────────────────────────────────
  // Remote Realtime Connection Controller
  // ──────────────────────────────────────────────────────────────────────────
  const connectToRoom = useCallback((targetCode) => {
    if (!targetCode || targetCode.length < 3) return;
    if (clientRef.current) {
      clientRef.current.destroy();
      clientRef.current = null;
    }

    localStorage.setItem('paruay_last_joined_pair', targetCode);
    setPairCode(targetCode);
    setIsChangingRoom(false);

    const isIos = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const deviceName = isIos ? 'iPhone มือถือ' : 'Android มือถือ';

    const client = createScannerClient({
      pairCode: targetCode,
      deviceName,
      onHostStatusChange: (status) => {
        setConnectionStatus(status);
      },
      onScanAck: (ack) => {
        setLastAck(ack);
        setRecentScans((prev) => [
          {
            barcode: ack.barcode,
            productName: ack.productName || 'เพิ่มลงบิลแล้ว',
            price: ack.price || 0,
            cartCount: ack.cartCount || 0,
            time: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          },
          ...prev.slice(0, 19),
        ]);
      },
    });

    clientRef.current = client;
  }, []);

  useEffect(() => {
    if (pairCode && !isChangingRoom) {
      connectToRoom(pairCode);
    }
    return () => {
      if (clientRef.current) {
        clientRef.current.destroy();
        clientRef.current = null;
      }
    };
  }, [pairCode, isChangingRoom, connectToRoom]);

  // ──────────────────────────────────────────────────────────────────────────
  // Dispatch Barcode to iPad Host
  // ──────────────────────────────────────────────────────────────────────────
  const sendBarcodeToHost = useCallback(
    (code) => {
      const cleanCode = String(code).trim();
      if (!cleanCode) return;

      const now = Date.now();
      if (cleanCode === lastScannedRef.current.code && now - lastScannedRef.current.time < 1200) {
        return; // debounce same barcode
      }
      lastScannedRef.current = { code: cleanCode, time: now };

      // Haptic & Sound on phone
      playScanBeep();
      if (navigator.vibrate) {
        try { navigator.vibrate([70]); } catch { /* ignore */ }
      }

      setLastAck({
        barcode: cleanCode,
        productName: 'กำลังส่งข้อมูลเข้า iPad...',
        price: 0,
        pending: true,
      });

      if (clientRef.current) {
        clientRef.current.sendScan(cleanCode);
      } else {
        console.warn('[MobileScanner] No active client connection');
      }
    },
    []
  );

  // ──────────────────────────────────────────────────────────────────────────
  // Camera Stream & Frame Decode
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

    // 1. Hardware BarcodeDetector
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      try {
        const bd = new window.BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'qr_code', 'itf'],
        });
        const hits = await bd.detect(canvas);
        if (hits && hits.length > 0 && hits[0].rawValue) {
          return hits[0].rawValue.trim();
        }
      } catch { /* fallback */ }
    }

    // 2. ZXing BrowserMultiFormatReader
    try {
      const reader = getBrowserBarcodeReader();
      const res = reader.decodeFromCanvas(canvas);
      if (res && res.getText()) {
        return res.getText().trim();
      }
    } catch { /* NotFound */ }

    // 3. Quick 90° flip for vertical barcodes
    if (rot === 0) {
      try {
        const alt = document.createElement('canvas');
        alt.width = vh;
        alt.height = vw;
        const altCtx = alt.getContext('2d', { willReadFrequently: true });
        if (altCtx) {
          altCtx.translate(vh / 2, vw / 2);
          altCtx.rotate(Math.PI / 2);
          altCtx.drawImage(video, -vw / 2, -vh / 2);
          const reader = getBrowserBarcodeReader();
          const altRes = reader.decodeFromCanvas(alt);
          if (altRes && altRes.getText()) {
            return altRes.getText().trim();
          }
        }
      } catch { /* not found */ }
    }

    return null;
  }, []);

  const startScanLoop = useCallback(() => {
    stopScanLoop();
    let isBusy = false;

    const tick = async () => {
      if (!isMountedRef.current || !videoRef.current) {
        scanLoopRef.current = setTimeout(tick, 200);
        return;
      }

      if (!isBusy) {
        isBusy = true;
        try {
          const code = await decodeFrame(videoRef.current);
          if (code) {
            sendBarcodeToHost(code);
          }
        } catch (err) {
          console.warn('[MobileScanner] frame decode error:', err);
        } finally {
          isBusy = false;
        }
      }

      if (isMountedRef.current) {
        scanLoopRef.current = setTimeout(tick, 75);
      }
    };

    scanLoopRef.current = setTimeout(tick, 100);
  }, [decodeFrame, sendBarcodeToHost, stopScanLoop]);

  const startCamera = useCallback(async (deviceId) => {
    if (!isMountedRef.current) return;
    stopStream();
    setCameraStatus('starting');
    setCameraError('');

    try {
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

      const track = stream.getVideoTracks()[0];
      if (track) {
        const caps = track.getCapabilities?.() || {};
        setTorchSupported(Boolean(caps.torch));
      }

      if (isMountedRef.current) {
        setCameraStatus('scanning');
        startScanLoop();
      }
    } catch (err) {
      console.error('[MobileScanner] Camera failed:', err);
      if (!isMountedRef.current) return;
      setCameraStatus('error');
      setCameraError(err.message || 'เปิดกล้องไม่ได้ กรุณาอนุญาตสิทธิ์กล้อง');
    }
  }, [stopStream, startScanLoop]);

  // Mount lifecycle
  useEffect(() => {
    isMountedRef.current = true;

    const init = async () => {
      try {
        if (navigator.mediaDevices?.enumerateDevices) {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const cams = devices.filter((d) => d.kind === 'videoinput');
          if (cams.length > 0) {
            setCameras(cams);
            const backIdx = cams.findIndex((c) => /back|rear|environment/i.test(c.label));
            const chosen = backIdx >= 0 ? backIdx : cams.length - 1;
            setCameraIdx(chosen);
            await startCamera(cams[chosen].deviceId);
            return;
          }
        }
      } catch { /* fallback */ }

      await startCamera(null);
    };

    init();

    // Reconnect on tab focus
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && isMountedRef.current) {
        const video = videoRef.current;
        const stream = streamRef.current;
        const isEnded = stream?.getVideoTracks().some((t) => t.readyState === 'ended');
        if (!stream || isEnded || video?.paused) {
          startCamera(cameras[cameraIdx]?.deviceId ?? null);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);

    return () => {
      isMountedRef.current = false;
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
      stopStream();
    };
  }, []);

  // Controls
  const handleSwitchCamera = async () => {
    playClickSound();
    if (cameras.length > 1) {
      const next = (cameraIdx + 1) % cameras.length;
      setCameraIdx(next);
      await startCamera(cameras[next].deviceId);
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
        console.warn('Torch failed:', err);
      }
    }
  };

  const handleRotate = () => {
    playClickSound();
    setRotation((prev) => (prev + 90) % 360);
  };

  const handlePhotoScan = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsScanningPhoto(true);
    playClickSound();
    try {
      const code = await scanBarcodeFromImageFile(file);
      if (code) {
        sendBarcodeToHost(code);
      } else {
        alert('ไม่พบบาร์โค้ดในภาพ กรุณาถ่ายใหม่ให้ชัดเจน');
      }
    } catch (err) {
      alert('ไม่พบบาร์โค้ดในภาพ กรุณาถ่ายใหม่ให้ชัดเจน');
    } finally {
      setIsScanningPhoto(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    const code = manualCode.trim();
    if (!code) return;
    sendBarcodeToHost(code);
    setManualCode('');
  };

  return (
    <div className="mobile-scanner-view-container animate-fade-in">
      {/* Offscreen Canvas */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Top Floating App Bar */}
      <div className="mobile-scanner-top-bar">
        <div className="flex items-center gap-2">
          {onExit && (
            <button type="button" className="icon-btn text-white" onClick={onExit} title="กลับ">
              <ArrowLeft size={20} />
            </button>
          )}
          <div className="mobile-scanner-title-group">
            <h4 className="text-white font-bold text-sm flex items-center gap-1.5 leading-none">
              <Smartphone size={16} className="text-emerald-400" /> ปืนสแกนเนอร์มือถือ
            </h4>
            <span className="text-[11px] text-slate-300">
              {connectionStatus.connected ? (
                <span className="text-emerald-400 font-medium flex items-center gap-1">
                  <span className="status-dot-pulse bg-emerald-400" /> เชื่อมกับ iPad แล้ว (ห้อง {pairCode})
                </span>
              ) : (
                <span className="text-amber-300 flex items-center gap-1">
                  <Wifi size={11} className="animate-pulse" /> รอเชื่อมต่อ iPad (ห้อง {pairCode})
                </span>
              )}
            </span>
          </div>
        </div>

        {/* Change room button */}
        <button
          type="button"
          className="btn btn-secondary btn-sm text-xs py-1 px-2.5 bg-slate-800/80 border-slate-700 text-white"
          onClick={() => {
            playClickSound();
            setIsChangingRoom(true);
          }}
        >
          <span>ห้อง: <strong>{pairCode}</strong></span>
        </button>
      </div>

      {/* Main Camera Viewfinder Box */}
      <div className="mobile-scanner-viewport">
        <video
          ref={videoRef}
          className="mobile-scanner-video"
          style={{ transform: rotation ? `rotate(${rotation}deg)` : 'none' }}
          playsInline
          muted
          autoPlay
        />

        {/* Laser Aim Box */}
        {cameraStatus === 'scanning' && (
          <div className="scan-aim-overlay">
            <div className="laser-line" />
            <div className="aim-corner top-left" />
            <div className="aim-corner top-right" />
            <div className="aim-corner bottom-left" />
            <div className="aim-corner bottom-right" />
            <span className="scan-guide-text">เล็งบาร์โค้ดให้อยู่ในกรอบ ข้อมูลจะเด้งไป iPad ทันที</span>
          </div>
        )}

        {/* Loading Spinner */}
        {cameraStatus === 'starting' && (
          <div className="scanner-loading-overlay">
            <RefreshCw className="animate-spin text-primary mb-2" size={36} />
            <p className="text-sm font-bold text-white">กำลังเปิดกล้องสแกน...</p>
          </div>
        )}

        {/* Camera Error */}
        {cameraStatus === 'error' && (
          <div className="scanner-error-overlay">
            <AlertCircle size={38} className="text-danger mb-2" />
            <p className="text-xs text-white max-w-xs text-center mb-3">{cameraError}</p>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => startCamera(cameras[cameraIdx]?.deviceId ?? null)}
            >
              <RefreshCw size={14} /> ลองเปิดกล้องใหม่
            </button>
          </div>
        )}

        {/* Live Feedback Card (Sent to iPad) */}
        {lastAck && (
          <div className="mobile-scan-ack-card animate-slide-up">
            <div className="ack-icon-box">
              <CheckCircle2 size={24} className="text-emerald-400" />
            </div>
            <div className="ack-text-box">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-emerald-300">{lastAck.barcode}</span>
                {lastAck.price > 0 && (
                  <span className="text-xs font-bold text-white">{lastAck.price.toFixed(2)} ฿</span>
                )}
              </div>
              <p className="text-xs text-white font-medium truncate mt-0.5">
                {lastAck.productName || 'ส่งเข้า iPad เรียบร้อย ✅'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Camera Toolbar Floating */}
      <div className="mobile-scanner-tools-bar">
        <button
          type="button"
          className="tool-circle-btn"
          onClick={handleRotate}
          title="หมุนมุมกล้อง"
        >
          <RotateCw size={18} />
          <span className="tool-lbl">{rotation}°</span>
        </button>

        {cameras.length > 1 && (
          <button
            type="button"
            className="tool-circle-btn"
            onClick={handleSwitchCamera}
            title="สลับเลนส์"
          >
            <RefreshCw size={18} />
            <span className="tool-lbl">สลับ</span>
          </button>
        )}

        {torchSupported && (
          <button
            type="button"
            className={`tool-circle-btn ${torchOn ? 'active' : ''}`}
            onClick={handleToggleTorch}
            title="เปิด/ปิดไฟ"
          >
            <Zap size={18} />
            <span className="tool-lbl">{torchOn ? 'ปิดไฟ' : 'ไฟ'}</span>
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={handlePhotoScan}
        />
        <button
          type="button"
          className="tool-circle-btn"
          onClick={() => fileInputRef.current?.click()}
          title="ถ่ายรูปสแกน"
        >
          <ImageIcon size={18} />
          <span className="tool-lbl">{isScanningPhoto ? 'อ่าน...' : 'ถ่ายรูป'}</span>
        </button>
      </div>

      {/* Bottom Manual Barcode Form & Recent Scans */}
      <div className="mobile-scanner-bottom-sheet">
        <form onSubmit={handleManualSubmit} className="mobile-manual-input-form">
          <input
            type="text"
            className="form-control font-mono text-sm flex-1"
            placeholder="พิมพ์รหัสบาร์โค้ดเอง (เช่น 885...)"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
          />
          <button type="submit" className="btn btn-primary btn-sm font-bold px-3">
            ส่งเข้า iPad
          </button>
        </form>

        {recentScans.length > 0 && (
          <div className="mobile-recent-scans-summary">
            <span className="text-[11px] text-slate-400 font-bold block mb-1">
              ประวัติยิงรอบนี้ ({recentScans.length} ชิ้น):
            </span>
            <div className="recent-scans-mini-list">
              {recentScans.slice(0, 3).map((item, idx) => (
                <div key={idx} className="recent-scan-mini-item">
                  <span className="font-mono text-xs text-slate-300">{item.barcode}</span>
                  <span className="text-xs text-white truncate flex-1 mx-2">{item.productName}</span>
                  {item.price > 0 && (
                    <span className="text-xs text-emerald-400 font-bold">{item.price.toFixed(2)}฿</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Change Room PIN Modal */}
      {isChangingRoom && (
        <div className="modal-overlay" onClick={() => setIsChangingRoom(false)}>
          <div
            className="modal-content mobile-room-modal animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="font-bold text-base mb-1">กรอกรหัส PIN เชื่อมต่อ iPad</h4>
            <p className="text-xs text-muted mb-3">
              ดูรหัส PIN 4 ตัว ที่แสดงอยู่บนหน้าจอ iPad ของคุณ
            </p>
            <div className="form-group mb-3">
              <input
                type="text"
                pattern="[0-9]*"
                maxLength={6}
                className="form-control text-center font-mono text-2xl font-bold tracking-widest"
                placeholder="เช่น 8821"
                value={inputRoom}
                onChange={(e) => setInputRoom(e.target.value.replace(/\D/g, ''))}
                autoFocus
              />
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsChangingRoom(false)}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                className="btn btn-primary flex-1 font-bold"
                onClick={() => connectToRoom(inputRoom)}
                disabled={inputRoom.length < 3}
              >
                เชื่อมต่อ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
