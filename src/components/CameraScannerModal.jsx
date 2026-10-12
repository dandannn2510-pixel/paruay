import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, X, RefreshCw, Zap, Volume2, CheckCircle2, Search } from 'lucide-react';
import { playScanBeep, playClickSound } from '../utils/sound';

export function CameraScannerModal({ isOpen, onClose, onDetected }) {
  const [scannerStarted, setScannerStarted] = useState(false);
  const [continuousMode, setContinuousMode] = useState(true);
  const [lastScannedCode, setLastScannedCode] = useState(null);
  const [manualCode, setManualCode] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const scannerRef = useRef(null);
  const readerIdRef = useRef('html5qr-code-full-region');

  useEffect(() => {
    let html5QrCode = null;

    if (isOpen) {
      setLastScannedCode(null);
      setErrorMessage('');

      // Formats to detect: EAN-13, EAN-8, UPC, Code 128, QR Code, Code 39
      const formatsToSupport = [
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.QR_CODE,
      ];

      html5QrCode = new Html5Qrcode(readerIdRef.current, {
        formatsToSupport,
        verbose: false,
      });
      scannerRef.current = html5QrCode;

      const config = {
        fps: 15,
        qrbox: { width: 280, height: 160 },
        aspectRatio: 1.0,
      };

      const qrCodeSuccessCallback = (decodedText) => {
        // Debounce if same code within 1.2s in continuous mode
        if (continuousMode && decodedText === lastScannedCode) {
          return;
        }

        playScanBeep();
        setLastScannedCode(decodedText);
        onDetected(decodedText);

        if (!continuousMode) {
          // Single scan mode: close scanner
          setTimeout(() => {
            onClose();
          }, 300);
        }
      };

      // Start camera with environment (rear) camera
      html5QrCode
        .start(
          { facingMode: 'environment' },
          config,
          qrCodeSuccessCallback,
          () => {
            // Ignore scan parse frame misses
          }
        )
        .then(() => {
          setScannerStarted(true);
        })
        .catch((err) => {
          console.warn('Unable to start camera with environment, trying fallback', err);
          // Try user camera fallback or show manual input
          html5QrCode
            .start(
              { facingMode: 'user' },
              config,
              qrCodeSuccessCallback,
              () => {}
            )
            .then(() => {
              setScannerStarted(true);
            })
            .catch((fallbackErr) => {
              console.error('Camera start failed', fallbackErr);
              setErrorMessage('ไม่สามารถเปิดกล้องได้ (กรุณาอนุญาตสิทธิ์การใช้กล้อง หรือใช้พิมพ์รหัสแทน)');
            });
        });
    }

    return () => {
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode
          .stop()
          .catch((err) => console.log('Error stopping scanner:', err))
          .finally(() => {
            html5QrCode.clear();
          });
      }
    };
  }, [isOpen, continuousMode, lastScannedCode]);

  if (!isOpen) return null;

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    playScanBeep();
    onDetected(manualCode.trim());
    setManualCode('');
    if (!continuousMode) onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content scanner-modal animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="modal-header">
          <div className="header-info">
            <Camera className="text-primary" size={24} />
            <div>
              <h3 className="modal-title">สแกนบาร์โค้ดด้วยกล้องมือถือ</h3>
              <p className="modal-subtitle">หันกล้องไปที่บาร์โค้ดหรือคิวอาร์โค้ดของสินค้า</p>
            </div>
          </div>
          <button className="icon-btn close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Camera Viewport Area */}
        <div className="scanner-container">
          <div id={readerIdRef.current} className="scanner-video-box"></div>

          {/* Aim Overlay Animation */}
          <div className="scan-aim-overlay">
            <div className="laser-line"></div>
            <div className="aim-corner top-left"></div>
            <div className="aim-corner top-right"></div>
            <div className="aim-corner bottom-left"></div>
            <div className="aim-corner bottom-right"></div>
          </div>

          {/* Feedback banner if scanned */}
          {lastScannedCode && (
            <div className="scanned-feedback-toast animate-slide-up">
              <CheckCircle2 size={18} />
              <span>ยิงติด: <strong>{lastScannedCode}</strong></span>
            </div>
          )}

          {errorMessage && (
            <div className="scanner-error-box">
              <p>{errorMessage}</p>
            </div>
          )}
        </div>

        {/* Controls Bar */}
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
            <span className="toggle-text">ยิงต่อเนื่องหลายชิ้น (ไม่ปิดกล้อง)</span>
          </label>
        </div>

        {/* Manual Barcode Input Fallback */}
        <form onSubmit={handleManualSubmit} className="manual-barcode-form">
          <div className="search-input-wrapper">
            <Search size={18} className="input-icon" />
            <input
              type="text"
              className="form-control"
              placeholder="พิมพ์รหัสบาร์โค้ดเอง (กรณีกล้องสแกนไม่ติด)..."
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
            />
            <button type="submit" className="btn btn-primary btn-sm">
              เพิ่ม
            </button>
          </div>
        </form>

        <div className="modal-actions">
          <button type="button" className="btn btn-secondary w-full" onClick={onClose}>
            ปิดหน้าต่างกล้อง
          </button>
        </div>
      </div>
    </div>
  );
}
