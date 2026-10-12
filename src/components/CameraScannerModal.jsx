import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import {
  Camera,
  X,
  RefreshCw,
  Zap,
  Volume2,
  CheckCircle2,
  Search,
  Upload,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { scanBarcodeFromImageFile } from '../utils/barcodeScanner';
import { playScanBeep, playClickSound } from '../utils/sound';

export function CameraScannerModal({ isOpen, onClose, onDetected }) {
  if (!isOpen) return null;

  const [scannerState, setScannerState] = useState('initializing'); // 'initializing' | 'scanning' | 'error'
  const [continuousMode, setContinuousMode] = useState(true);
  const [lastScannedCode, setLastScannedCode] = useState(null);
  const [manualCode, setManualCode] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [cameras, setCameras] = useState([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
  const [torchOn, setTorchOn] = useState(false);
  const [isTorchSupported, setIsTorchSupported] = useState(false);
  const [isScanningFile, setIsScanningFile] = useState(false);

  const scannerRef = useRef(null);
  const containerIdRef = useRef(`qr-reader-${Date.now()}`);
  const lastScannedRef = useRef({ code: '', time: 0 });
  const continuousModeRef = useRef(continuousMode);
  const isMountedRef = useRef(true);
  const fileInputRef = useRef(null);

  continuousModeRef.current = continuousMode;

  const handleScanSuccess = useCallback(
    (decodedText) => {
      const now = Date.now();
      // Debounce same barcode within 1.4 seconds in continuous mode
      if (
        decodedText === lastScannedRef.current.code &&
        now - lastScannedRef.current.time < 1400
      ) {
        return;
      }

      lastScannedRef.current = { code: decodedText, time: now };
      playScanBeep();

      if (navigator.vibrate) {
        try {
          navigator.vibrate([70]);
        } catch {
          // ignore
        }
      }

      setLastScannedCode(decodedText);
      onDetected(decodedText);

      if (!continuousModeRef.current) {
        setTimeout(() => {
          onClose();
        }, 350);
      }
    },
    [onDetected, onClose]
  );

  // Stop scanner safely
  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (err) {
        console.warn('Error stopping scanner:', err);
      } finally {
        scannerRef.current = null;
      }
    }
  }, []);

  // Start scanner with specific camera or default environment camera
  const startScanner = useCallback(
    async (cameraIdOrConfig) => {
      const elementId = containerIdRef.current;
      const element = document.getElementById(elementId);
      if (!element) return;

      setScannerState('initializing');
      setErrorMessage('');

      await stopScanner();

      try {
        const formatsToSupport = [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.ITF,
        ];

        const html5QrCode = new Html5Qrcode(elementId, {
          formatsToSupport,
          verbose: false,
        });

        scannerRef.current = html5QrCode;

        // Dynamic wide rectangle box for barcodes
        const config = {
          fps: 20,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const width = Math.min(Math.floor(viewfinderWidth * 0.88), 340);
            const height = Math.min(
              Math.floor(width * 0.55),
              Math.floor(viewfinderHeight * 0.75)
            );
            return {
              width: Math.max(width, 180),
              height: Math.max(height, 90),
            };
          },
          videoConstraints: {
            facingMode: { ideal: 'environment' },
            width: { min: 640, ideal: 1280, max: 1920 },
            height: { min: 480, ideal: 720, max: 1080 },
          },
        };

        await html5QrCode.start(
          cameraIdOrConfig || { facingMode: 'environment' },
          config,
          handleScanSuccess,
          () => {
            // Frame Miss (normal, ignore)
          }
        );

        if (isMountedRef.current) {
          setScannerState('scanning');

          // Check if torch/flashlight is supported
          try {
            const capabilities = html5QrCode.getRunningTrackCameraCapabilities();
            if (capabilities && capabilities.torchFeature && capabilities.torchFeature().isSupported()) {
              setIsTorchSupported(true);
            }
          } catch {
            setIsTorchSupported(false);
          }
        }
      } catch (err) {
        console.error('Camera start failed:', err);
        if (isMountedRef.current) {
          setScannerState('error');
          const isSecure = window.isSecureContext !== false;
          if (!isSecure && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
            setErrorMessage('เบราว์เซอร์ต้องการ HTTPS เพื่อเปิดกล้อง กรุณาเปิดผ่าน https:// หรือพิมพ์รหัสบาร์โค้ด');
          } else if (err?.name === 'NotAllowedError' || String(err).includes('Permission')) {
            setErrorMessage('ไม่อนุญาตสิทธิ์การใช้งานกล้อง กรุณาอนุญาตสิทธิ์กล้องในเบราว์เซอร์');
          } else if (err?.name === 'NotFoundError' || String(err).includes('device')) {
            setErrorMessage('ไม่พบอุปกรณ์กล้องบนอุปกรณ์นี้ สามารถพิมพ์รหัสหรือถ่ายรูปเพื่อสแกนได้');
          } else {
            setErrorMessage(`ไม่สามารถเปิดกล้องได้ (${err.message || 'โปรดตรวจสอบกล้อง'}) สามารถพิมพ์รหัสหรือถ่ายรูปได้`);
          }
        }
      }
    },
    [handleScanSuccess, stopScanner]
  );

  // Initialize camera and get camera list on mount
  useEffect(() => {
    isMountedRef.current = true;
    lastScannedRef.current = { code: '', time: 0 };
    setLastScannedCode(null);

    const init = async () => {
      // Delay slightly to let React render the DOM element
      await new Promise((r) => setTimeout(r, 80));
      if (!isMountedRef.current) return;

      try {
        const devices = await Html5Qrcode.getCameras();
        if (isMountedRef.current && devices && devices.length > 0) {
          setCameras(devices);
          // Find back camera if available
          const backCamIdx = devices.findIndex((d) =>
            /back|rear|environment|0/i.test(d.label)
          );
          const selectedIdx = backCamIdx !== -1 ? backCamIdx : 0;
          setCurrentCameraIndex(selectedIdx);
          await startScanner(devices[selectedIdx].id);
          return;
        }
      } catch (deviceErr) {
        console.warn('Could not enumerate cameras, falling back to facingMode:', deviceErr);
      }

      // Fallback to standard environment facing mode
      if (isMountedRef.current) {
        await startScanner({ facingMode: 'environment' });
      }
    };

    init();

    return () => {
      isMountedRef.current = false;
      stopScanner();
    };
  }, [startScanner, stopScanner]);

  // Switch to next camera
  const handleSwitchCamera = async () => {
    playClickSound();
    if (cameras.length <= 1) {
      // If no list, toggle between environment and user
      const nextFacing = currentCameraIndex === 0 ? 'user' : 'environment';
      setCurrentCameraIndex(currentCameraIndex === 0 ? 1 : 0);
      await startScanner({ facingMode: nextFacing });
      return;
    }
    const nextIdx = (currentCameraIndex + 1) % cameras.length;
    setCurrentCameraIndex(nextIdx);
    await startScanner(cameras[nextIdx].id);
  };

  // Toggle Torch/Flashlight
  const handleToggleTorch = async () => {
    playClickSound();
    if (scannerRef.current) {
      try {
        const capabilities = scannerRef.current.getRunningTrackCameraCapabilities();
        if (capabilities?.torchFeature) {
          const nextState = !torchOn;
          await capabilities.torchFeature().apply(nextState);
          setTorchOn(nextState);
        }
      } catch (err) {
        console.warn('Torch toggle failed', err);
      }
    }
  };

  // Scan from photo / snap file using multi-angle scanner
  const handleFileScan = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanningFile(true);
    playClickSound();

    try {
      const decodedText = await scanBarcodeFromImageFile(file);
      if (decodedText) {
        handleScanSuccess(decodedText);
      }
    } catch (err) {
      console.warn('File barcode scan failed', err);
      alert('ไม่พบบาร์โค้ดในรูปภาพที่เลือก กรุณาลองถ่ายใหม่อีกครั้ง หรือพิมพ์รหัสบาร์โค้ด');
    } finally {
      setIsScanningFile(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleClose = () => {
    playClickSound();
    onClose();
    stopScanner();
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    playScanBeep();
    onDetected(manualCode.trim());
    setManualCode('');
    if (!continuousMode) handleClose();
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div
        className="modal-content scanner-modal animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="modal-header">
          <div className="header-info">
            <Camera className="text-primary" size={24} />
            <div>
              <h3 className="modal-title">สแกนบาร์โค้ดด้วยกล้อง</h3>
              <p className="modal-subtitle">
                {scannerState === 'scanning'
                  ? 'หันกล้องไปที่บาร์โค้ด หรือคิวอาร์โค้ด'
                  : 'กำลังเชื่อมต่อกล้อง...'}
              </p>
            </div>
          </div>
          <button className="icon-btn close-btn" onClick={handleClose} title="ปิด">
            <X size={20} />
          </button>
        </div>

        {/* Viewport Area */}
        <div className="scanner-container">
          {/* html5-qrcode target box */}
          <div id={containerIdRef.current} className="scanner-video-box"></div>

          {/* Aim Overlay with Laser Line */}
          {scannerState === 'scanning' && (
            <div className="scan-aim-overlay">
              <div className="laser-line"></div>
              <div className="aim-corner top-left"></div>
              <div className="aim-corner top-right"></div>
              <div className="aim-corner bottom-left"></div>
              <div className="aim-corner bottom-right"></div>
              <span className="scan-guide-text">วางบาร์โค้ดให้อยู่ในกรอบ</span>
            </div>
          )}

          {/* Initializing Spinner */}
          {scannerState === 'initializing' && (
            <div className="scanner-loading-overlay">
              <RefreshCw className="animate-spin text-primary mb-2" size={32} />
              <p className="text-sm font-medium">กำลังเปิดกล้อง...</p>
            </div>
          )}

          {/* Error Banner */}
          {scannerState === 'error' && (
            <div className="scanner-error-overlay">
              <AlertCircle size={36} className="text-danger mb-2" />
              <h4 className="font-bold text-danger text-base">ไม่สามารถใช้งานกล้องสดได้</h4>
              <p className="text-xs text-muted max-w-xs text-center mt-1 mb-3">
                {errorMessage}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => startScanner({ facingMode: 'environment' })}
                >
                  <RefreshCw size={14} /> ลองเปิดกล้องอีกครั้ง
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Camera size={14} /> ถ่ายภาพนิ่งแทน
                </button>
              </div>
            </div>
          )}

          {/* Scanned Success Badge */}
          {lastScannedCode && (
            <div className="scanned-feedback-toast animate-slide-up">
              <CheckCircle2 size={18} className="text-success" />
              <span>
                ยิงติด: <strong className="font-mono">{lastScannedCode}</strong>
              </span>
            </div>
          )}
        </div>

        {/* Action Toolbar: Switch camera, Flash, Snap Photo */}
        <div className="scanner-action-toolbar">
          {cameras.length > 1 && (
            <button
              type="button"
              className="btn btn-secondary btn-sm flex-1"
              onClick={handleSwitchCamera}
              title="สลับเลนส์กล้อง (หน้า/หลัง/มุมกว้าง)"
            >
              <RefreshCw size={15} />
              <span>สลับกล้อง ({currentCameraIndex + 1}/{cameras.length})</span>
            </button>
          )}

          {isTorchSupported && (
            <button
              type="button"
              className={`btn btn-sm ${torchOn ? 'btn-accent' : 'btn-secondary'}`}
              onClick={handleToggleTorch}
              title="เปิดไฟฉายช่วยส่องบาร์โค้ด"
            >
              <Zap size={15} />
              <span>{torchOn ? 'ปิดไฟ' : 'เปิดไฟ'}</span>
            </button>
          )}

          {/* Hidden File Input for Native Camera Snap */}
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
            title="ถ่ายรูปบาร์โค้ดด้วยกล้องมือถือโดยตรง ชัดและโฟกัสง่าย 100%"
          >
            <Upload size={15} />
            <span>{isScanningFile ? 'กำลังวิเคราะห์...' : '📸 ถ่ายรูป/เลือกภาพสแกน'}</span>
          </button>
        </div>

        {/* Continuous Mode Toggle */}
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
            <span className="toggle-slider"></span>
            <span className="toggle-text">ยิงต่อเนื่องหลายชิ้น (ไม่ต้องกดเปิดกล้องใหม่)</span>
          </label>
        </div>

        {/* Manual Barcode Input Fallback */}
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
