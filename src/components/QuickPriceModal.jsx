import React, { useState, useEffect } from 'react';
import { DollarSign, X, Check, TrendingUp, Sparkles, Plus, Minus } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { ProductThumbnail } from './ProductThumbnail';
import { playClickSound, playCashRegisterChime } from '../utils/sound';

export function QuickPriceModal({ product, isOpen, onClose }) {
  if (!isOpen || !product) return null;

  const { updateProductPrice } = useStore();

  const [newPrice, setNewPrice] = useState(String(product.sellPrice || ''));
  const [newCost, setNewCost] = useState(product.costPrice ? String(product.costPrice) : '');
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (product) {
      setNewPrice(String(product.sellPrice || ''));
      setNewCost(product.costPrice ? String(product.costPrice) : '');
      setSaveSuccess(false);
    }
  }, [product]);

  const currentPriceNum = Number(product.sellPrice) || 0;
  const targetPriceNum = parseFloat(newPrice) || 0;
  const costNum = parseFloat(newCost) || 0;
  const profit = targetPriceNum - costNum;
  const marginPct = targetPriceNum > 0 ? ((profit / targetPriceNum) * 100).toFixed(0) : 0;

  const handleAdjustDelta = (delta) => {
    playClickSound();
    const curr = parseFloat(newPrice) || currentPriceNum;
    const next = Math.max(0.25, Number((curr + delta).toFixed(2)));
    setNewPrice(String(next));
  };

  const handleSetRoundNumber = (target) => {
    playClickSound();
    setNewPrice(String(target));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (targetPriceNum <= 0) return;

    playClickSound();
    const success = updateProductPrice(product.id, targetPriceNum, costNum > 0 ? costNum : null);

    if (success) {
      playCashRegisterChime();
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 700);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content quick-price-modal animate-scale-up"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 440 }}
      >
        {/* Header */}
        <div className="modal-header">
          <div className="header-info">
            <div className="brand-logo-wrap" style={{ width: 36, height: 36, background: '#10b981' }}>
              <DollarSign size={20} className="text-white" />
            </div>
            <div>
              <h3 className="modal-title">ปรับราคาขายสินค้า</h3>
              <p className="modal-subtitle">บันทึกแล้วอัปเดตทุกหน้าจอทันที</p>
            </div>
          </div>
          <button className="icon-btn close-btn" onClick={onClose} title="ปิด">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form-body">
          {/* Product Banner */}
          <div className="quick-price-product-card flex items-center gap-3 p-3 mb-3 rounded-lg" style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-color)' }}>
            <ProductThumbnail product={product} size={54} />
            <div className="flex-1 min-w-0">
              <strong className="block text-base truncate">{product.name}</strong>
              <div className="text-xs text-muted font-mono">{product.barcode || 'ไม่มีบาร์โค้ด'}</div>
              <div className="text-xs mt-1">
                ราคาปัจจุบัน: <strong className="text-muted line-through mr-1">{currentPriceNum.toFixed(2)} ฿</strong>
                <span className="text-xs text-muted">/{product.unit}</span>
              </div>
            </div>
          </div>

          {/* New Selling Price Input */}
          <div className="form-group mb-3">
            <label className="form-label font-bold text-base flex justify-between items-center">
              <span>ราคาขายใหม่ (บาท /{product.unit}) *:</span>
              {targetPriceNum !== currentPriceNum && (
                <span className={`text-xs font-bold ${targetPriceNum > currentPriceNum ? 'text-success' : 'text-warning'}`}>
                  {targetPriceNum > currentPriceNum ? `+${(targetPriceNum - currentPriceNum).toFixed(2)} ฿` : `${(targetPriceNum - currentPriceNum).toFixed(2)} ฿`}
                </span>
              )}
            </label>
            <input
              type="number"
              step="0.25"
              min="0.25"
              className="form-control big-number-input highlight-cash text-center"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              placeholder="0.00"
              autoFocus
              required
            />
          </div>

          {/* Quick Delta Adjust Buttons */}
          <div className="quick-price-buttons-grid grid grid-cols-5 gap-1 mb-3">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleAdjustDelta(-10)}>
              -10
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleAdjustDelta(-5)}>
              -5
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleAdjustDelta(-1)}>
              -1
            </button>
            <button type="button" className="btn btn-secondary btn-sm text-primary font-bold" onClick={() => handleAdjustDelta(+1)}>
              +1
            </button>
            <button type="button" className="btn btn-secondary btn-sm text-primary font-bold" onClick={() => handleAdjustDelta(+5)}>
              +5
            </button>
          </div>

          <div className="quick-price-buttons-grid grid grid-cols-4 gap-1 mb-3">
            <button type="button" className="btn btn-secondary btn-sm font-bold text-primary" onClick={() => handleAdjustDelta(+10)}>
              +10 ฿
            </button>
            <button type="button" className="btn btn-secondary btn-sm font-bold text-primary" onClick={() => handleAdjustDelta(+20)}>
              +20 ฿
            </button>
            <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => handleSetRoundNumber(Math.ceil(targetPriceNum / 10) * 10)}>
              ปัดสิบ
            </button>
            <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => handleSetRoundNumber(Math.ceil(targetPriceNum / 5) * 5)}>
              ปัดห้า
            </button>
          </div>

          {/* Optional Cost & Profit Display */}
          <div className="form-row mb-3">
            <div className="form-group flex-1">
              <label className="form-label text-xs">ราคาทุนต่อหน่วย (บาท):</label>
              <input
                type="number"
                step="0.25"
                min="0"
                className="form-control"
                value={newCost}
                onChange={(e) => setNewCost(e.target.value)}
                placeholder="ต้นทุน (ถ้ามี)"
              />
            </div>

            <div className="form-group flex-1 flex flex-col justify-end">
              <div className="p-2 rounded border border-border text-center" style={{ background: 'var(--bg-surface)' }}>
                <span className="text-xs text-muted block">กำไรคาดการณ์:</span>
                <strong className={`text-sm ${profit >= 0 ? 'text-success' : 'text-danger'}`}>
                  {profit >= 0 ? `+${profit.toFixed(2)}` : profit.toFixed(2)} ฿ ({marginPct}%)
                </strong>
              </div>
            </div>
          </div>

          {/* Success Banner */}
          {saveSuccess && (
            <div className="alert-banner alert-success animate-slide-up mb-2">
              <Check size={18} />
              <span>บันทึกราคาใหม่เรียบร้อยแล้ว!</span>
            </div>
          )}

          {/* Actions */}
          <div className="modal-actions" style={{ margin: '-1.15rem', marginTop: '1rem' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              ยกเลิก
            </button>
            <button type="submit" className="btn btn-primary btn-large flex-1 font-bold">
              <Check size={20} />
              <span>บันทึกราคาใหม่</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
