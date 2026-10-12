import React, { useState, useRef } from 'react';
import {
  Settings,
  Store,
  QrCode,
  Shield,
  Volume2,
  Database,
  CheckCircle2,
  Save,
  RotateCcw,
  Upload,
  Image,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { playClickSound, playCashRegisterChime } from '../utils/sound';

export function SettingsView() {
  const { settings, setSettings } = useStore();

  const [shopName, setShopName] = useState(settings.shopName || 'พารวย');
  const [shopTagline, setShopTagline] = useState(settings.shopTagline || 'ร้านนี้ดี ค้าขาย ร่ำรวย');
  const [shopPhone, setShopPhone] = useState(settings.shopPhone || '081-987-6543');
  const [permanentQrImage, setPermanentQrImage] = useState(settings.permanentQrImage || '/qr-promptpay.png');
  const [adminPin, setAdminPin] = useState(settings.adminPin || '1234');
  const [soundEnabled, setSoundEnabled] = useState(settings.soundEnabled ?? true);

  const [savedSuccess, setSavedSuccess] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result;
        if (base64) {
          setPermanentQrImage(base64);
          playClickSound();
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = (e) => {
    e.preventDefault();
    playClickSound();

    setSettings({
      ...settings,
      shopName: shopName.trim(),
      shopTagline: shopTagline.trim(),
      shopPhone: shopPhone.trim(),
      permanentQrImage,
      adminPin: adminPin.trim(),
      soundEnabled,
    });

    playCashRegisterChime();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleResetData = () => {
    if (confirm('คุณต้องการรีเซ็ตข้อมูลสินค้าและประวัติกลับเป็นข้อมูลตัวอย่างตั้งต้นใช่หรือไม่?')) {
      playClickSound();
      localStorage.clear();
      window.location.reload();
    }
  };

  return (
    <div className="settings-layout animate-fade-in">
      <div className="section-header">
        <div>
          <h2>⚙️ ตั้งค่าระบบร้านค้า (Settings)</h2>
          <p className="section-subtitle">
            จัดการข้อมูลร้าน, ป้ายคิวอาร์โค้ดถาวรสำหรับรับเงิน, และรหัส PIN
          </p>
        </div>
      </div>

      {savedSuccess && (
        <div className="alert-banner alert-success animate-slide-up mb-4">
          <CheckCircle2 size={20} />
          <span>บันทึกการตั้งค่าเรียบร้อยแล้ว!</span>
        </div>
      )}

      <form onSubmit={handleSave} className="settings-cards-grid">
        {/* Card 1: Shop Profile */}
        <div className="pos-card-box">
          <h3 className="card-box-title">
            <Store size={20} className="text-primary" />
            <span>ข้อมูลร้านค้าและโลโก้</span>
          </h3>

          <div className="flex items-center gap-3 mb-4 p-3 bg-card rounded">
            <img src="/logo.png" alt="โลโก้ร้าน" className="w-16 h-16 rounded-full border-2 border-red-500 shadow" />
            <div>
              <strong className="block text-base">โลโก้ร้านพารวย</strong>
              <span className="text-xs text-muted">ตราสัญลักษณ์ร้านค้า "ร้านนี้ดี ค้าขาย ร่ำรวย"</span>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">ชื่อร้านค้า *:</label>
            <input
              type="text"
              className="form-control"
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">สโลแกน / คำขวัญร้าน:</label>
            <input
              type="text"
              className="form-control"
              value={shopTagline}
              onChange={(e) => setShopTagline(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">เบอร์โทรศัพท์ร้าน:</label>
            <input
              type="text"
              className="form-control"
              value={shopPhone}
              onChange={(e) => setShopPhone(e.target.value)}
            />
          </div>
        </div>

        {/* Card 2: Permanent QR Code */}
        <div className="pos-card-box">
          <h3 className="card-box-title">
            <QrCode size={20} className="text-accent" />
            <span>ป้าย QR Code ถาวรของร้าน (สแกนจ่ายเงิน)</span>
          </h3>

          <div className="flex flex-col items-center justify-center p-3 bg-card rounded mb-3">
            <div className="permanent-qr-preview-box">
              <img
                src={permanentQrImage}
                alt="ป้าย QR โค้ดของร้าน"
                className="w-48 h-48 object-contain bg-white rounded p-2 shadow"
                onError={(e) => {
                  e.currentTarget.src = '/qr-promptpay.png';
                }}
              />
            </div>
            <span className="text-xs text-muted mt-2">
              รูปภาพป้าย QR Code ที่แสดงให้ลูกค้าสแกนตอนคิดเงิน
            </span>
          </div>

          <div className="form-group">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFileUpload}
            />
            <button
              type="button"
              className="btn btn-outline-primary w-full"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={18} />
              <span>เลือกไฟล์รูปภาพป้าย QR จากเครื่อง</span>
            </button>
          </div>

          <div className="form-group">
            <label className="form-label">หรือใส่ลิงก์รูปภาพ QR (URL):</label>
            <input
              type="text"
              className="form-control text-xs"
              placeholder="/qr-promptpay.png หรือ https://..."
              value={permanentQrImage}
              onChange={(e) => setPermanentQrImage(e.target.value)}
            />
          </div>
        </div>

        {/* Card 3: Security & Audio Preferences */}
        <div className="pos-card-box">
          <h3 className="card-box-title">
            <Shield size={20} className="text-warning" />
            <span>รหัส PIN & ระบบเสียง</span>
          </h3>

          <div className="form-group">
            <label className="form-label">รหัส PIN เจ้าของร้าน (4 หลัก) *:</label>
            <input
              type="password"
              maxLength="4"
              className="form-control font-mono font-bold text-center w-36"
              value={adminPin}
              onChange={(e) => setAdminPin(e.target.value)}
              required
            />
            <p className="text-xs text-muted mt-1">
              ใช้สำหรับอนุมัติการให้ส่วนลดท้ายบิล หรือปลดล็อกโหมดแคชเชียร์ (ค่าเริ่มต้น 1234)
            </p>
          </div>

          <div className="form-group mt-4">
            <label className="toggle-switch-label">
              <input
                type="checkbox"
                checked={soundEnabled}
                onChange={(e) => setSoundEnabled(e.target.checked)}
              />
              <span className="toggle-slider"></span>
              <span className="toggle-text flex items-center gap-2">
                <Volume2 size={18} />
                <span>เปิดเสียงเอฟเฟกต์ (เสียงปี๊บสแกน และเสียงคิดเงิน)</span>
              </span>
            </label>
          </div>
        </div>

        {/* Card 4: Reset & Local Storage */}
        <div className="pos-card-box">
          <h3 className="card-box-title">
            <Database size={20} className="text-info" />
            <span>จัดการฐานข้อมูล</span>
          </h3>

          <p className="text-sm text-muted mb-4">
            ข้อมูลทั้งหมดถูกบันทึกในอุปกรณ์นี้แบบ Local-first สามารถใช้งานต่อได้แม้ออฟไลน์
          </p>

          <button
            type="button"
            className="btn btn-outline-danger w-full"
            onClick={handleResetData}
          >
            <RotateCcw size={16} />
            <span>รีเซ็ตข้อมูลเริ่มต้น (โหลดสินค้าตัวอย่างพร้อมรูปภาพจริง)</span>
          </button>
        </div>

        {/* Save button footer */}
        <div className="settings-footer-actions">
          <button type="submit" className="btn btn-primary btn-large font-bold px-8">
            <Save size={20} />
            <span>บันทึกการตั้งค่าทั้งหมด</span>
          </button>
        </div>
      </form>
    </div>
  );
}
