import React, { useState, useRef, useEffect } from 'react';
import { Banknote, QrCode, CheckCircle2, X, Upload, Image, AlertTriangle, RotateCcw } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { playClickSound, playCashRegisterChime, playErrorBuzz } from '../utils/sound';

export function PaymentModal({ isOpen, onClose, onCompleteSale }) {
  if (!isOpen) return null;

  const { cart, settings, setSettings, userRole, verifyAdminPin } = useStore();

  // Payment method: 'cash' | 'promptpay'
  const [method, setMethod] = useState('cash');

  // Discount
  const [discount, setDiscount] = useState('');
  const [discountPinPrompt, setDiscountPinPrompt] = useState(false);
  const [adminPinInput, setAdminPinInput] = useState('');
  const [pinError, setPinError] = useState('');

  // Cash calculations
  const rawSubtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const discountVal = parseFloat(discount) || 0;
  const netTotal = Math.max(0, rawSubtotal - discountVal);

  // Default to empty string so user doesn't have to backspace/delete the pre-filled amount!
  const [receivedCash, setReceivedCash] = useState('');
  const receivedCashNum = parseFloat(receivedCash) || 0;
  const change = Math.max(0, Number((receivedCashNum - netTotal).toFixed(2)));

  // Reset fields cleanly whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setReceivedCash('');
      setDiscount('');
      setMethod('cash');
      setDiscountPinPrompt(false);
      setPinError('');
    }
  }, [isOpen]);

  // QR Upload
  const qrFileInputRef = useRef(null);

  // Quick cash buttons
  const quickBills = [
    { label: 'พอดี', val: netTotal, isExact: true },
    { label: '20', val: 20 },
    { label: '50', val: 50 },
    { label: '100', val: 100 },
    { label: '500', val: 500 },
    { label: '1,000', val: 1000 },
  ];

  const handleQuickCash = (val) => {
    playClickSound();
    setReceivedCash(String(val));
  };

  const handleDiscountChange = (val) => {
    if (userRole === 'cashier' && parseFloat(val) > 0 && !discountPinPrompt) {
      setDiscountPinPrompt(true);
      return;
    }
    setDiscount(val);
  };

  const handleVerifyPin = (e) => {
    e.preventDefault();
    if (verifyAdminPin(adminPinInput)) {
      setDiscountPinPrompt(false);
      setPinError('');
      setAdminPinInput('');
    } else {
      playErrorBuzz();
      setPinError('รหัส PIN เจ้าของร้านไม่ถูกต้อง!');
    }
  };

  // Handle uploading custom permanent QR
  const handleQrFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result;
        if (base64) {
          setSettings((prev) => ({
            ...prev,
            permanentQrImage: base64,
          }));
          playClickSound();
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleConfirmPayment = () => {
    if (method === 'cash' && (receivedCashNum < netTotal || receivedCashNum === 0)) {
      playErrorBuzz();
      alert('จำนวนเงินที่รับมาน้อยกว่ายอดชำระ! (กรุณาใส่จำนวนเงิน หรือกดปุ่ม พอดี)');
      return;
    }

    try {
      onCompleteSale({
        paymentMethod: method,
        cashReceived: method === 'cash' ? receivedCashNum : netTotal,
        change: method === 'cash' ? change : 0,
        discount: discountVal,
        cashierName: userRole === 'owner' ? 'เจ้าของร้าน' : 'แคชเชียร์',
      });
    } catch (err) {
      console.error('Complete sale error:', err);
    } finally {
      onClose();
    }
  };

  const currentQrSrc = settings.permanentQrImage || '/qr-promptpay.png';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content payment-modal animate-scale-up" onClick={(e) => e.stopPropagation()}>
        {/* Header with Logo */}
        <div className="modal-header">
          <div className="header-info">
            <img src="/logo.png" alt="พารวย" className="modal-logo-header" />
            <div>
              <h3 className="modal-title">คิดเงิน / รับชำระ</h3>
              <p className="modal-subtitle">รายการทั้งหมด {cart.length} ชิ้น</p>
            </div>
          </div>
          <button className="icon-btn close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Big Net Total Banner */}
        <div className="net-total-display">
          <span className="net-label">ยอดที่ต้องชำระ</span>
          <div className="net-number">
            {netTotal.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            <span className="currency"> บาท</span>
          </div>
          {rawSubtotal !== netTotal && (
            <span className="subtotal-note">
              (ยอดรวม {rawSubtotal.toFixed(2)} บาท - ส่วนลด {discountVal.toFixed(2)} บาท)
            </span>
          )}
        </div>

        {/* Method Switch: Cash or Permanent QR */}
        <div className="mode-toggle-group">
          <button
            type="button"
            className={`mode-btn ${method === 'cash' ? 'active' : ''}`}
            onClick={() => {
              playClickSound();
              setMethod('cash');
            }}
          >
            <Banknote size={20} />
            <span>1. เงินสด (Cash)</span>
          </button>
          <button
            type="button"
            className={`mode-btn ${method === 'promptpay' ? 'active' : ''}`}
            onClick={() => {
              playClickSound();
              setMethod('promptpay');
            }}
          >
            <QrCode size={20} />
            <span>2. สแกนคิวอาร์ (QR ร้าน)</span>
          </button>
        </div>

        {/* Cash Tab Content */}
        {method === 'cash' && (
          <div className="cash-tab-body">
            <div className="form-group">
              <label className="form-label font-medium">เงินที่รับจากลูกค้า (บาท):</label>
              <div className="big-input-wrapper">
                <input
                  type="number"
                  step="any"
                  min="0"
                  inputMode="decimal"
                  placeholder="0.00"
                  className="big-number-input highlight-cash"
                  value={receivedCash}
                  onChange={(e) => setReceivedCash(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && receivedCashNum >= netTotal) {
                      handleConfirmPayment();
                    }
                  }}
                  autoFocus
                />
                <span className="unit-badge">บาท</span>
              </div>
            </div>

            {/* Quick Bill Chips */}
            <div className="chips-container">
              <span className="chip-label">ปุ่มรับเงินด่วน:</span>
              <div className="chip-list">
                {quickBills.map((bill, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={`quick-chip ${bill.isExact ? 'exact-chip' : ''} ${receivedCash === String(bill.val) ? 'active' : ''}`}
                    onClick={() => handleQuickCash(bill.val)}
                  >
                    {bill.label}
                  </button>
                ))}
                <button
                  type="button"
                  className="quick-chip clear-chip"
                  onClick={() => {
                    playClickSound();
                    setReceivedCash('');
                  }}
                  title="ล้างจำนวนเงิน"
                >
                  <RotateCcw size={13} />
                  <span>ล้าง</span>
                </button>
              </div>
            </div>

            {/* Giant Change Display */}
            {(!receivedCash || receivedCashNum === 0) ? (
              <div className="change-display-card waiting">
                <div className="change-label">รอรับเงินจากลูกค้า</div>
                <div className="change-value text-muted">
                  0.00 <small>บาท</small>
                </div>
                <span className="text-xs text-muted">พิมพ์จำนวนเงิน หรือแตะปุ่ม &quot;พอดี&quot; / แบงก์</span>
              </div>
            ) : receivedCashNum < netTotal ? (
              <div className="change-display-card insufficient">
                <div className="change-label">ยังขาดอีก</div>
                <div className="change-value">
                  {(netTotal - receivedCashNum).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                  <small> บาท</small>
                </div>
              </div>
            ) : (
              <div className="change-display-card success">
                <div className="change-label">เงินทอนลูกค้า</div>
                <div className="change-value">
                  {change.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                  <small> บาท</small>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Permanent QR Code Tab */}
        {method === 'promptpay' && (
          <div className="promptpay-tab-body text-center">
            <div className="permanent-qr-display-card animate-scale-up">
              <div className="qr-badge-top">
                <img src="/logo.png" alt="โลโก้" className="qr-badge-logo" />
                <span>คิวอาร์โค้ดร้านพารวย</span>
              </div>

              <div className="qr-image-container">
                <img
                  src={currentQrSrc}
                  alt="คิวอาร์โค้ดร้าน"
                  className="permanent-qr-img"
                  onError={(e) => {
                    e.currentTarget.src = '/qr-promptpay.png';
                  }}
                />
              </div>

              <div className="qr-bottom-amount">
                <span className="text-muted text-xs">ลูกค้าสแกนจ่ายยอด:</span>
                <div className="qr-target-price">
                  {netTotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })} <small>บาท</small>
                </div>
              </div>
            </div>

            {/* Button to replace permanent QR anytime */}
            <div className="qr-upload-tool mt-2">
              <input
                ref={qrFileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleQrFileUpload}
              />
              <button
                type="button"
                className="btn btn-ghost btn-sm text-xs"
                onClick={() => qrFileInputRef.current?.click()}
              >
                <Upload size={14} />
                <span>อัปโหลด / เปลี่ยนรูปป้าย QR ของร้าน</span>
              </button>
            </div>
          </div>
        )}

        {/* Optional Discount Field */}
        <div className="discount-collapsible">
          <div className="form-group inline-flex items-center gap-2">
            <label className="form-label mb-0 text-sm">ส่วนลดท้ายบิล (ถ้ามี):</label>
            <input
              type="number"
              step="1"
              min="0"
              className="form-control form-control-sm"
              style={{ width: '90px' }}
              placeholder="0.00"
              value={discount}
              onChange={(e) => handleDiscountChange(e.target.value)}
            />
            <span className="text-sm">บาท</span>
          </div>
        </div>

        {/* Admin PIN Prompt if Cashier gives discount */}
        {discountPinPrompt && (
          <div className="pin-prompt-box animate-shake">
            <div className="flex items-center gap-2 text-warning mb-2 text-xs">
              <AlertTriangle size={16} />
              <span>ใส่ PIN เจ้าของร้านเพื่ออนุมัติส่วนลด:</span>
            </div>
            <form onSubmit={handleVerifyPin} className="flex gap-2">
              <input
                type="password"
                maxLength="4"
                className="form-control form-control-sm text-center"
                placeholder="PIN 4 หลัก"
                value={adminPinInput}
                onChange={(e) => setAdminPinInput(e.target.value)}
                autoFocus
              />
              <button type="submit" className="btn btn-warning btn-sm">
                ยืนยัน PIN
              </button>
            </form>
            {pinError && <p className="text-danger text-xs mt-1">{pinError}</p>}
          </div>
        )}

        {/* Modal Actions */}
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            ยกเลิก
          </button>
          <button
            type="button"
            className="btn btn-success btn-large flex-1 font-bold"
            onClick={handleConfirmPayment}
            disabled={method === 'cash' && (receivedCashNum < netTotal || receivedCashNum === 0)}
          >
            <CheckCircle2 size={22} />
            <span>
              {method === 'cash' ? 'รับเงินเรียบร้อย (เสร็จสิ้น)' : 'ลูกค้าโอนแล้ว (เสร็จสิ้น)'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
