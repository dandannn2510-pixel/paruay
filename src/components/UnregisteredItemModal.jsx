import React, { useState, useEffect } from 'react';
import { AlertCircle, ShoppingBag, PlusCircle, X, Check } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { playClickSound } from '../utils/sound';

export function UnregisteredItemModal({ isOpen, barcode, onClose, onQuickSale, onRegisterNew }) {
  if (!isOpen) return null;

  const { categories } = useStore();
  const [activeTab, setActiveTab] = useState('temp'); // 'temp' (ขายชั่วคราว) | 'register' (เพิ่มเข้าคลัง)

  // Fields for Quick Temp Sale
  const [tempName, setTempName] = useState('สินค้าทั่วไป (ไม่มีบาร์โค้ด)');
  const [tempPrice, setTempPrice] = useState('');
  const [tempQty, setTempQty] = useState('1');

  // Fields for Registering as New Product
  const [regName, setRegName] = useState('');
  const [regCategory, setRegCategory] = useState(categories[0]?.id || 'cat_dry_food');
  const [regSellPrice, setRegSellPrice] = useState('');
  const [regCostPrice, setRegCostPrice] = useState('');
  const [regStock, setRegStock] = useState('10');
  const [regUnit, setRegUnit] = useState('ชิ้น');

  useEffect(() => {
    setTempName(`สินค้านอกคลัง [${barcode || 'ชั่วคราว'}]`);
    setRegName('');
    setTempPrice('');
    setRegSellPrice('');
  }, [barcode]);

  const handleTempSubmit = (e) => {
    e.preventDefault();
    if (!tempPrice || parseFloat(tempPrice) <= 0) return;
    playClickSound();

    onQuickSale({
      customName: tempName.trim() || 'สินค้านอกคลัง',
      customPrice: parseFloat(tempPrice),
      customCost: 0,
      quantity: parseFloat(tempQty) || 1,
      barcode: barcode || 'UNREGISTERED',
    });
    onClose();
  };

  const handleRegisterSubmit = (e) => {
    e.preventDefault();
    if (!regName.trim() || !regSellPrice || parseFloat(regSellPrice) <= 0) return;
    playClickSound();

    onRegisterNew({
      name: regName.trim(),
      barcode: barcode || '',
      categoryId: regCategory,
      sellPrice: parseFloat(regSellPrice),
      costPrice: parseFloat(regCostPrice) || 0,
      stock: parseFloat(regStock) || 0,
      unit: regUnit,
      type: 'packaged',
      isWeighted: false,
      minStockAlert: 5,
    });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content unregistered-modal animate-scale-up" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header warning-header">
          <div className="header-info">
            <AlertCircle className="text-warning" size={24} />
            <div>
              <h3 className="modal-title">ไม่พบสินค้าในระบบ!</h3>
              <p className="modal-subtitle">
                รหัสบาร์โค้ด: <strong className="text-primary font-mono">{barcode}</strong>
              </p>
            </div>
          </div>
          <button className="icon-btn close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Tab Switch */}
        <div className="mode-toggle-group">
          <button
            type="button"
            className={`mode-btn ${activeTab === 'temp' ? 'active' : ''}`}
            onClick={() => {
              playClickSound();
              setActiveTab('temp');
            }}
          >
            <ShoppingBag size={18} />
            <span>1. ขายชั่วคราว (ไม่ตัดสต็อก)</span>
          </button>
          <button
            type="button"
            className={`mode-btn ${activeTab === 'register' ? 'active' : ''}`}
            onClick={() => {
              playClickSound();
              setActiveTab('register');
            }}
          >
            <PlusCircle size={18} />
            <span>2. บันทึกเป็นสินค้าใหม่ทันที</span>
          </button>
        </div>

        {/* Tab 1: Quick Temp Sale */}
        {activeTab === 'temp' && (
          <form onSubmit={handleTempSubmit} className="modal-form-body">
            <p className="helper-text text-muted">
              ⚡ คิดเงินและขายต่อได้ทันที โดยไม่ต้องรอคีย์ข้อมูลคลังสินค้ายาวๆ (นับเข้ายอดขายตามปกติ)
            </p>

            <div className="form-group">
              <label className="form-label">ชื่อรายการที่แสดงในบิล:</label>
              <input
                type="text"
                className="form-control"
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                placeholder="เช่น ขนมปังปอนด์, เครื่องดื่มชั่วคราว"
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group flex-1">
                <label className="form-label">ราคาขาย (บาท) *:</label>
                <input
                  type="number"
                  step="0.25"
                  min="0.25"
                  className="form-control big-number-input highlight-cash"
                  value={tempPrice}
                  onChange={(e) => setTempPrice(e.target.value)}
                  placeholder="0.00"
                  autoFocus
                  required
                />
              </div>
              <div className="form-group" style={{ width: '110px' }}>
                <label className="form-label">จำนวน:</label>
                <input
                  type="number"
                  min="1"
                  className="form-control"
                  value={tempQty}
                  onChange={(e) => setTempQty(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                ยกเลิก
              </button>
              <button type="submit" className="btn btn-primary btn-large flex-1">
                <Check size={18} />
                <span>เพิ่มลงบิลทันที</span>
              </button>
            </div>
          </form>
        )}

        {/* Tab 2: Register as New Product */}
        {activeTab === 'register' && (
          <form onSubmit={handleRegisterSubmit} className="modal-form-body">
            <p className="helper-text text-muted">
              ✨ ลงทะเบียนบาร์โค้ดนี้เข้าสู่ระบบคลังทันที ครั้งต่อไปยิงบาร์โค้ดนี้จะจำได้ตลอด
            </p>

            <div className="form-group">
              <label className="form-label">ชื่อสินค้าใหม่ *:</label>
              <input
                type="text"
                className="form-control"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                placeholder="เช่น นมถั่วเหลืองแลคตาซอย 300ml"
                required
                autoFocus
              />
            </div>

            <div className="form-row">
              <div className="form-group flex-1">
                <label className="form-label">หมวดหมู่:</label>
                <select
                  className="form-control"
                  value={regCategory}
                  onChange={(e) => setRegCategory(e.target.value)}
                >
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.icon} {cat.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ width: '120px' }}>
                <label className="form-label">หน่วย:</label>
                <select
                  className="form-control"
                  value={regUnit}
                  onChange={(e) => setRegUnit(e.target.value)}
                >
                  <option value="ชิ้น">ชิ้น</option>
                  <option value="ซอง">ซอง</option>
                  <option value="ขวด">ขวด</option>
                  <option value="กระป๋อง">กระป๋อง</option>
                  <option value="กล่อง">กล่อง</option>
                  <option value="แพ็ค">แพ็ค</option>
                  <option value="ถุง">ถุง</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group flex-1">
                <label className="form-label">ราคาขายหน้าร้าน (บาท) *:</label>
                <input
                  type="number"
                  step="0.25"
                  min="0.25"
                  className="form-control highlight-cash"
                  value={regSellPrice}
                  onChange={(e) => setRegSellPrice(e.target.value)}
                  placeholder="เช่น 15.00"
                  required
                />
              </div>
              <div className="form-group flex-1">
                <label className="form-label">ราคาทุน (บาท):</label>
                <input
                  type="number"
                  step="0.25"
                  min="0"
                  className="form-control"
                  value={regCostPrice}
                  onChange={(e) => setRegCostPrice(e.target.value)}
                  placeholder="เช่น 11.50"
                />
              </div>
              <div className="form-group" style={{ width: '100px' }}>
                <label className="form-label">สต็อกแรกรับ:</label>
                <input
                  type="number"
                  min="0"
                  className="form-control"
                  value={regStock}
                  onChange={(e) => setRegStock(e.target.value)}
                />
              </div>
            </div>

            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                ยกเลิก
              </button>
              <button type="submit" className="btn btn-success btn-large flex-1">
                <Check size={18} />
                <span>บันทึกสินค้า & ใส่ลงบิล</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
