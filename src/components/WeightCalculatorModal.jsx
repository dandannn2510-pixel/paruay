import React, { useState, useEffect } from 'react';
import { Scale, Banknote, Plus, Check, X, Calculator, ArrowRightLeft } from 'lucide-react';
import { playClickSound } from '../utils/sound';

export function WeightCalculatorModal({ product, isOpen, onClose, onConfirm }) {
  if (!isOpen || !product) return null;

  // Modes: 'weight' (ระบุตามน้ำหนัก กก.) | 'price' (ระบุตามจำนวนเงิน บาท)
  const [mode, setMode] = useState('weight');
  
  // Weight input in kg (or grams converted to kg)
  const [weightKg, setWeightKg] = useState('0.500');
  
  // Target Price input in Baht
  const [targetPrice, setTargetPrice] = useState(
    product.sellPrice ? String(Math.round(product.sellPrice * 0.5)) : '50'
  );

  // Sync calculations whenever inputs change
  const pricePerKg = Number(product.sellPrice) || 0;

  // When in 'weight' mode, computed price = weight × pricePerKg
  const currentWeightNum = parseFloat(weightKg) || 0;
  const computedPriceFromWeight = Number((currentWeightNum * pricePerKg).toFixed(2));

  // When in 'price' mode, computed weight = targetPrice ÷ pricePerKg
  const currentPriceNum = parseFloat(targetPrice) || 0;
  const computedWeightFromPrice = pricePerKg > 0 ? Number((currentPriceNum / pricePerKg).toFixed(3)) : 0;

  // Common quick chips
  const quickWeights = [
    { label: '+100g', add: 0.1 },
    { label: '+250g', add: 0.25 },
    { label: '+500g', add: 0.5 },
    { label: '+1 กก.', add: 1.0 },
    { label: '+2 กก.', add: 2.0 },
  ];

  const quickMoney = [
    { label: '10฿', val: 10 },
    { label: '20฿', val: 20 },
    { label: '30฿', val: 30 },
    { label: '50฿', val: 50 },
    { label: '100฿', val: 100 },
    { label: '150฿', val: 150 },
    { label: '200฿', val: 200 },
  ];

  const handleAddWeight = (delta) => {
    playClickSound();
    const nextVal = Math.max(0.01, Number((currentWeightNum + delta).toFixed(3)));
    setWeightKg(String(nextVal));
  };

  const handleSetQuickPrice = (val) => {
    playClickSound();
    setTargetPrice(String(val));
  };

  const handleConfirm = () => {
    playClickSound();
    if (mode === 'weight') {
      if (currentWeightNum <= 0) return;
      onConfirm({
        product,
        weightInKg: currentWeightNum,
        priceTarget: null,
      });
    } else {
      if (currentPriceNum <= 0) return;
      onConfirm({
        product,
        weightInKg: computedWeightFromPrice,
        priceTarget: currentPriceNum,
      });
    }
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content weight-modal animate-scale-up" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="header-info">
            {product.image && (product.image.startsWith('http') || product.image.startsWith('/')) ? (
              <img src={product.image} alt={product.name} className="product-modal-thumb" />
            ) : (
              <span className="product-icon">🥩</span>
            )}
            <div>
              <h3 className="modal-title">{product.name}</h3>
              <p className="modal-subtitle">
                ราคาต่อหน่วย: <strong className="text-primary">{pricePerKg.toLocaleString('th-TH', { minimumFractionDigits: 2 })} ฿/กก.</strong>
              </p>
            </div>
          </div>
          <button className="icon-btn close-btn" onClick={onClose} title="ปิด">
            <X size={20} />
          </button>
        </div>

        {/* Mode Switch Tabs */}
        <div className="mode-toggle-group">
          <button
            type="button"
            className={`mode-btn ${mode === 'weight' ? 'active' : ''}`}
            onClick={() => {
              playClickSound();
              setMode('weight');
            }}
          >
            <Scale size={18} />
            <span>1. ระบุตามน้ำหนัก (ชั่ง กก.)</span>
          </button>
          <button
            type="button"
            className={`mode-btn ${mode === 'price' ? 'active' : ''}`}
            onClick={() => {
              playClickSound();
              setMode('price');
            }}
          >
            <Banknote size={18} />
            <span>2. ระบุเป็นจำนวนเงิน (ซื้อเป็นราคา)</span>
          </button>
        </div>

        {/* Mode 1: Specify Weight */}
        {mode === 'weight' && (
          <div className="calc-body">
            <div className="input-row">
              <label className="input-label">ใส่น้ำหนักจริง (กิโลกรัม):</label>
              <div className="big-input-wrapper">
                <input
                  type="number"
                  step="0.001"
                  min="0.001"
                  className="big-number-input"
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                  autoFocus
                />
                <span className="unit-badge">กก. ({Math.round(currentWeightNum * 1000)} กรัม)</span>
              </div>
            </div>

            {/* Quick Weight Chips */}
            <div className="chips-container">
              <span className="chip-label">บวกเพิ่มเร็ว:</span>
              <div className="chip-list">
                {quickWeights.map((w, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="quick-chip"
                    onClick={() => handleAddWeight(w.add)}
                  >
                    {w.label}
                  </button>
                ))}
                <button
                  type="button"
                  className="quick-chip clear-chip"
                  onClick={() => {
                    playClickSound();
                    setWeightKg('0.100');
                  }}
                >
                  เริ่มใหม่ (100g)
                </button>
              </div>
            </div>

            {/* Calculated Result Card */}
            <div className="result-highlight-card weight-result">
              <div className="result-row">
                <span className="result-label">น้ำหนักที่ตัดสต็อก:</span>
                <span className="result-value text-accent">{currentWeightNum.toFixed(3)} กก.</span>
              </div>
              <div className="result-row main-total">
                <span className="result-label">รวมเป็นเงิน:</span>
                <span className="result-value text-success text-giant">
                  {computedPriceFromWeight.toLocaleString('th-TH', { minimumFractionDigits: 2 })} <small>บาท</small>
                </span>
              </div>
              <p className="formula-text">
                ({currentWeightNum.toFixed(3)} กก. × {pricePerKg.toFixed(2)} บาท/กก.)
              </p>
            </div>
          </div>
        )}

        {/* Mode 2: Specify Budget / Target Price (Reverse calculate weight) */}
        {mode === 'price' && (
          <div className="calc-body">
            <div className="notice-banner">
              <ArrowRightLeft size={16} />
              <span>ลูกค้าบอกจำนวนเงิน เช่น "ขอ 50 บาท" ระบบจะคำนวณน้ำหนักให้ทันที</span>
            </div>

            <div className="input-row">
              <label className="input-label">ระบุจำนวนเงินที่ต้องการซื้อ (บาท):</label>
              <div className="big-input-wrapper">
                <input
                  type="number"
                  step="1"
                  min="1"
                  className="big-number-input highlight-cash"
                  value={targetPrice}
                  onChange={(e) => setTargetPrice(e.target.value)}
                  autoFocus
                />
                <span className="unit-badge">บาท</span>
              </div>
            </div>

            {/* Quick Money Chips */}
            <div className="chips-container">
              <span className="chip-label">ปุ่มเงินด่วน:</span>
              <div className="chip-list">
                {quickMoney.map((m, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={`quick-chip ${targetPrice === String(m.val) ? 'active' : ''}`}
                    onClick={() => handleSetQuickPrice(m.val)}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Reverse Calculated Weight Card */}
            <div className="result-highlight-card price-reverse-result">
              <div className="result-row">
                <span className="result-label">ยอดเงินที่คิดลูกค้า:</span>
                <span className="result-value text-success">
                  {currentPriceNum.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท
                </span>
              </div>
              <div className="result-row main-total">
                <span className="result-label">คำนวณเป็นน้ำหนักได้:</span>
                <span className="result-value text-accent text-giant">
                  {computedWeightFromPrice.toFixed(3)} <small>กก.</small>
                </span>
              </div>
              <p className="formula-text">
                (เทียบเท่าประมาณ {Math.round(computedWeightFromPrice * 1000)} กรัม — ตัดสต็อก {computedWeightFromPrice.toFixed(3)} กก.)
              </p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            ยกเลิก
          </button>
          <button
            type="button"
            className="btn btn-primary btn-large flex-1"
            onClick={handleConfirm}
            disabled={mode === 'weight' ? currentWeightNum <= 0 : currentPriceNum <= 0}
          >
            <Check size={20} />
            <span>
              ยืนยันใส่ลงบิล (
              {mode === 'weight'
                ? `${computedPriceFromWeight.toFixed(2)} ฿`
                : `${currentPriceNum.toFixed(2)} ฿`}
              )
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
