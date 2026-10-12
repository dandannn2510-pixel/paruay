import React, { useRef } from 'react';
import { Barcode, Printer, X, Download } from 'lucide-react';
import { getEan13BinaryPattern } from '../utils/barcode';
import { useStore } from '../context/StoreContext';
import { playClickSound } from '../utils/sound';

export function BarcodeStickerModal({ product, isOpen, onClose }) {
  if (!isOpen || !product) return null;

  const { settings } = useStore();
  const stickerRef = useRef(null);

  const barcode = product.barcode || '2000000000010';
  const pattern = getEan13BinaryPattern(barcode);

  const handlePrint = () => {
    playClickSound();
    window.print();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content sticker-modal animate-scale-up" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="header-info">
            <Barcode className="text-primary" size={24} />
            <div>
              <h3 className="modal-title">สติกเกอร์บาร์โค้ดภายในร้าน (EAN-13)</h3>
              <p className="modal-subtitle">รหัสขึ้นต้นด้วยเลข 2 สำหรับของสดและสินค้าแบ่งขาย</p>
            </div>
          </div>
          <button className="icon-btn close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Sticker Preview Box */}
        <div className="sticker-preview-wrapper">
          <div className="sticker-label-card" id="printable-sticker" ref={stickerRef}>
            <div className="sticker-shop-name">{settings.shopName}</div>
            <div className="sticker-prod-name">{product.name}</div>
            <div className="sticker-price-tag">
              <span className="price-num">
                {product.sellPrice.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
              </span>
              <span className="price-unit">฿/{product.unit}</span>
            </div>

            {/* Render Barcode Bars */}
            <div className="barcode-bars-container">
              {pattern ? (
                <svg className="barcode-svg" viewBox={`0 0 ${pattern.length * 2} 60`}>
                  {pattern.split('').map((bit, idx) =>
                    bit === '1' ? (
                      <rect
                        key={idx}
                        x={idx * 2}
                        y={0}
                        width={2}
                        height={60}
                        fill="#000000"
                      />
                    ) : null
                  )}
                </svg>
              ) : (
                <div className="barcode-mock-line font-mono">{barcode}</div>
              )}
              <div className="barcode-digits font-mono">{barcode}</div>
            </div>

            <div className="sticker-date">
              พิมพ์เมื่อ {new Date().toLocaleDateString('th-TH')}
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            ปิด
          </button>
          <button type="button" className="btn btn-primary btn-large flex-1 font-bold" onClick={handlePrint}>
            <Printer size={18} />
            <span>พิมพ์สติกเกอร์ (Print Label)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
