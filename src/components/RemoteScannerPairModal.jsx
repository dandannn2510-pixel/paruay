import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  Smartphone,
  X,
  RefreshCw,
  Copy,
  Check,
  Wifi,
  WifiOff,
  ExternalLink,
  Sparkles,
  QrCode,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { playClickSound } from '../utils/sound';

export function RemoteScannerPairModal({
  isOpen,
  onClose,
  pairCode,
  onGenerateNewCode,
  clientStatus,
  recentRemoteScans = [],
}) {
  if (!isOpen) return null;

  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copied, setCopied] = useState(false);

  // Direct URL to open mobile scanner gun with auto-pairing
  const scannerUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/?mode=scanner&pair=${pairCode}`
    : '';

  useEffect(() => {
    if (scannerUrl) {
      QRCode.toDataURL(scannerUrl, {
        width: 240,
        margin: 1.5,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error('QR code generation failed:', err));
    }
  }, [scannerUrl]);

  const handleCopyLink = () => {
    playClickSound();
    if (navigator.clipboard && scannerUrl) {
      navigator.clipboard.writeText(scannerUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const isConnected = Boolean(clientStatus?.connected);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content remote-scanner-pair-modal animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <div className="header-info">
            <div className={`brand-logo-wrap ${isConnected ? 'bg-emerald-500' : 'bg-primary'}`} style={{ width: 40, height: 40 }}>
              <Smartphone size={22} className="text-white" />
            </div>
            <div>
              <h3 className="modal-title">เชื่อมต่อมือถือเป็นเครื่องสแกนบาร์โค้ด</h3>
              <p className="modal-subtitle">
                ถือมือถือเดินยิงบาร์โค้ด ข้อมูลจะเด้งมาที่หน้าจอ iPad นี้ทันที
              </p>
            </div>
          </div>
          <button className="icon-btn close-btn" onClick={onClose} title="ปิด">
            <X size={20} />
          </button>
        </div>

        <div className="pair-modal-body">
          {/* Connection Status Banner */}
          <div className={`pair-status-banner ${isConnected ? 'connected' : 'waiting'}`}>
            <div className="status-indicator-dot" />
            <div className="status-text-block">
              {isConnected ? (
                <>
                  <strong className="text-success text-sm flex items-center gap-1">
                    <CheckCircle2 size={16} /> เชื่อมต่อกับมือถือสำเร็จแล้ว!
                  </strong>
                  <span className="text-xs text-muted">
                    {clientStatus?.deviceName || 'สมาร์ทโฟน'} พร้อมยิงบาร์โค้ดเข้า iPad เครื่องนี้
                  </span>
                </>
              ) : (
                <>
                  <strong className="text-warning text-sm flex items-center gap-1">
                    <Wifi size={16} className="animate-pulse" /> รอเชื่อมต่อจากมือถือ...
                  </strong>
                  <span className="text-xs text-muted">
                    เปิดกล้องมือถือส่อง QR Code ด้านล่างนี้ หรือกรอกรหัส PIN 4 ตัว
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="pair-content-grid">
            {/* Left: QR Code Card */}
            <div className="qr-code-card">
              <div className="qr-image-wrapper">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="QR Code สำหรับเชื่อมต่อ" className="qr-display-img" />
                ) : (
                  <div className="qr-loading-box">
                    <RefreshCw className="animate-spin text-primary" size={28} />
                  </div>
                )}
              </div>
              <span className="text-xs font-medium text-center text-muted mt-2">
                📱 สแกนด้วยกล้องมือถือ (iPhone / Android)
              </span>
            </div>

            {/* Right: PIN Code & Details */}
            <div className="pin-code-card">
              <div className="pin-section">
                <span className="pin-label text-xs uppercase tracking-wider text-muted font-bold">
                  รหัสเชื่อมต่อด่วน (Pairing PIN):
                </span>
                <div className="pin-digits-display">
                  {pairCode.split('').map((digit, i) => (
                    <span key={i} className="pin-digit-box">
                      {digit}
                    </span>
                  ))}
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm text-xs text-muted mt-1"
                  onClick={() => {
                    playClickSound();
                    onGenerateNewCode();
                  }}
                  title="เปลี่ยนรหัสใหม่"
                >
                  <RefreshCw size={13} />
                  <span>เปลี่ยนรหัสใหม่</span>
                </button>
              </div>

              {/* Direct Link Share */}
              <div className="share-link-section mt-3">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm w-full font-medium"
                  onClick={handleCopyLink}
                >
                  {copied ? <Check size={15} className="text-success" /> : <Copy size={15} />}
                  <span>{copied ? 'คัดลอกลิงก์สำเร็จแล้ว!' : 'คัดลอกลิงก์ส่งเข้า LINE มือถือ'}</span>
                </button>

                <a
                  href={scannerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-outline-primary btn-sm w-full font-medium mt-2"
                >
                  <ExternalLink size={15} />
                  <span>ทดสอบเปิดหน้าปืนสแกนบนแท็บใหม่</span>
                </a>
              </div>
            </div>
          </div>

          {/* Usage Pro Tips */}
          <div className="scanner-pro-tips-card mt-3">
            <h5 className="text-xs font-bold text-primary flex items-center gap-1 mb-1">
              <Sparkles size={14} /> ทำไมวิธีนี้ถึงดีที่สุดสำหรับร้านค้า:
            </h5>
            <ul className="tips-list text-xs text-muted">
              <li>• ตั้ง iPad จอใหญ่ไว้ที่โต๊ะแคชเชียร์ ดูยอดรวมและรายการง่าย ชัดเจน</li>
              <li>• ถือโทรศัพท์เครื่องเล็กเดินไปยิงสินค้าในตู้แช่ หรือของชิ้นใหญ่ได้ทั่วร้าน</li>
              <li>• เชื่อมต่อผ่านคลาวด์ ไม่ต้องอยู่ใน WiFi วงเดียวกัน (ใช้ 4G/5G ได้ทันที)</li>
            </ul>
          </div>

          {/* Recent Scans Log (Live from Phone) */}
          {recentRemoteScans.length > 0 && (
            <div className="recent-remote-scans-tray mt-3">
              <span className="text-xs font-bold text-muted block mb-1">
                บาร์โค้ดล่าสุดที่ยิงมาจากมือถือ ({recentRemoteScans.length} รายการ):
              </span>
              <div className="recent-scans-pills">
                {recentRemoteScans.slice(0, 5).map((scan, idx) => (
                  <div key={idx} className="remote-scan-pill animate-fade-in">
                    <CheckCircle2 size={14} className="text-success" />
                    <span className="font-mono text-xs">{scan.barcode}</span>
                    {scan.productName && <strong className="text-xs font-normal">({scan.productName})</strong>}
                    <span className="text-[10px] text-muted">{scan.time}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-primary w-full btn-large font-bold"
            onClick={onClose}
          >
            {isConnected ? 'เริ่มใช้งาน (ปิดหน้าต่างนี้)' : 'ปิดหน้าต่าง'}
          </button>
        </div>
      </div>
    </div>
  );
}
