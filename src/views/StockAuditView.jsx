import React, { useState } from 'react';
import {
  Layers,
  Search,
  Camera,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RotateCcw,
  Scale,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { CameraScannerModal } from '../components/CameraScannerModal';
import { ProductThumbnail } from '../components/ProductThumbnail';
import { playScanBeep, playClickSound, playCashRegisterChime } from '../utils/sound';

export function StockAuditView() {
  const { products, adjustStock } = useStore();

  const [search, setSearch] = useState('');
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  const [countedQtyInput, setCountedQtyInput] = useState('');
  const [reasonInput, setReasonInput] = useState('นับผิดพลาดในรอบก่อน');
  const [customNote, setCustomNote] = useState('');

  const [successMessage, setSuccessMessage] = useState('');

  const handleSelectProduct = (prod) => {
    playClickSound();
    setSelectedProduct(prod);
    setCountedQtyInput(String(prod.stock));
    setSearch('');
  };

  const handleBarcodeScanned = (code) => {
    const matched = products.find((p) => String(p.barcode).trim() === String(code).trim());
    if (matched) {
      playScanBeep();
      handleSelectProduct(matched);
      setIsCameraOpen(false);
    } else {
      alert(`ไม่พบสินค้าบาร์โค้ด: ${code}`);
    }
  };

  const currentSystemStock = selectedProduct ? selectedProduct.stock : 0;
  const countedNum = parseFloat(countedQtyInput) || 0;
  const difference = selectedProduct
    ? Number((countedNum - currentSystemStock).toFixed(3))
    : 0;

  const handleConfirmAdjust = (e) => {
    e.preventDefault();
    if (!selectedProduct) return;

    adjustStock({
      productId: selectedProduct.id,
      countedStock: countedNum,
      reason: `${reasonInput}${customNote ? ` (${customNote})` : ''}`,
    });

    playCashRegisterChime();
    setSuccessMessage(`ปรับยอดสินค้า ${selectedProduct.name} เป็น ${countedNum} ${selectedProduct.unit} สำเร็จ (ส่วนต่าง ${difference > 0 ? `+${difference}` : difference})`);
    setSelectedProduct(null);
    setCountedQtyInput('');
    setCustomNote('');
    setTimeout(() => setSuccessMessage(''), 4000);
  };

  return (
    <div className="audit-layout animate-fade-in">
      <div className="section-header">
        <div>
          <h2>📋 ตรวจนับสต็อกบนชั้น (Physical Stock Audit)</h2>
          <p className="section-subtitle">
            เดินสแกนของจริงบนชั้นวาง นับจำนวนจริง แล้วระบบจะคำนวณส่วนต่างและปรับยอดให้ตรง
          </p>
        </div>
      </div>

      {successMessage && (
        <div className="alert-banner alert-success animate-slide-up mb-4">
          <CheckCircle2 size={20} />
          <span>{successMessage}</span>
        </div>
      )}

      <div className="audit-grid">
        {/* Step 1: Scan / Search Item */}
        <div className="audit-panel">
          <div className="pos-card-box">
            <h3 className="card-box-title">
              <Search size={20} className="text-primary" />
              <span>1. เลือกหรือสแกนสินค้าที่กำลังตรวจนับ</span>
            </h3>

            <div className="flex gap-2 mb-3">
              <div className="search-input-wrapper flex-1">
                <Search size={18} className="input-icon" />
                <input
                  type="text"
                  className="form-control"
                  placeholder="พิมพ์ชื่อสินค้า หรือบาร์โค้ด..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <button
                type="button"
                className="btn btn-outline-primary"
                onClick={() => setIsCameraOpen(true)}
                title="เปิดกล้องสแกน"
              >
                <Camera size={20} />
                <span>เปิดกล้อง</span>
              </button>
            </div>

            {/* Product selection list */}
            <div className="audit-selection-scroll max-h-80 overflow-y-auto">
              {products
                .filter(
                  (p) =>
                    !search ||
                    p.name.toLowerCase().includes(search.toLowerCase()) ||
                    (p.barcode && p.barcode.includes(search))
                )
                .slice(0, 10)
                .map((p) => (
                  <div
                    key={p.id}
                    className={`audit-pick-row ${selectedProduct?.id === p.id ? 'active' : ''}`}
                    onClick={() => handleSelectProduct(p)}
                  >
                    <ProductThumbnail product={p} size={36} className="mr-2" />
                    <div className="flex-1">
                      <strong className="block">{p.name}</strong>
                      <span className="text-xs text-muted font-mono">{p.barcode || 'ไม่มีบาร์โค้ด'}</span>
                    </div>
                    <div className="text-right">
                      <span className="badge-tag tag-discrete">
                        ในระบบ: {p.isWeighted ? p.stock.toFixed(3) : p.stock} {p.unit}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* Step 2: Compare & Adjust */}
        <div className="audit-panel">
          <div className="pos-card-box">
            <h3 className="card-box-title">
              <Layers size={20} className="text-warning" />
              <span>2. กรอกจำนวนที่นับได้จริง</span>
            </h3>

            {selectedProduct ? (
              <form onSubmit={handleConfirmAdjust} className="animate-scale-up">
                <div className="selected-product-banner mb-3 flex items-center">
                  <ProductThumbnail product={selectedProduct} size={50} className="mr-3" />
                  <div>
                    <h4 className="font-bold">{selectedProduct.name}</h4>
                    <p className="text-xs text-muted">
                      หน่วย: {selectedProduct.unit} {selectedProduct.isWeighted ? '(ชั่งน้ำหนัก)' : ''}
                    </p>
                  </div>
                </div>

                <div className="audit-diff-card mb-4">
                  <div className="diff-col">
                    <span className="diff-lbl">ตัวเลขในระบบ:</span>
                    <span className="diff-val text-muted">
                      {selectedProduct.isWeighted ? selectedProduct.stock.toFixed(3) : selectedProduct.stock} {selectedProduct.unit}
                    </span>
                  </div>
                  <div className="diff-col highlight">
                    <span className="diff-lbl">ตรวจนับได้จริง:</span>
                    <span className="diff-val text-primary font-bold">
                      {countedNum} {selectedProduct.unit}
                    </span>
                  </div>
                  <div className="diff-col">
                    <span className="diff-lbl">ส่วนต่าง (Diff):</span>
                    <span className={`diff-val font-bold ${difference === 0 ? 'text-success' : difference > 0 ? 'text-info' : 'text-danger'}`}>
                      {difference > 0 ? `+${difference}` : difference} {selectedProduct.unit}
                    </span>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">กรอกจำนวนที่นับได้จริงบนชั้น *:</label>
                  <input
                    type="number"
                    step={selectedProduct.isWeighted ? '0.001' : '1'}
                    min="0"
                    className="form-control big-number-input highlight-cash"
                    value={countedQtyInput}
                    onChange={(e) => setCountedQtyInput(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">เหตุผลที่ตัวเลขไม่ตรง:</label>
                  <select
                    className="form-control"
                    value={reasonInput}
                    onChange={(e) => setReasonInput(e.target.value)}
                  >
                    <option value="นับผิดพลาดในรอบก่อน">นับผิดพลาดในรอบก่อน</option>
                    <option value="สินค้าเสียหาย / แตกหัก / เสื่อมสภาพ">สินค้าเสียหาย / แตกหัก / เสื่อมสภาพ</option>
                    <option value="สินค้าหมดอายุต้องทิ้ง">สินค้าหมดอายุต้องทิ้ง</option>
                    <option value="ของแถมจากเซลล์">ของแถมจากเซลล์</option>
                    <option value="สูญหาย / หาของไม่เจอ">สูญหาย / หาของไม่เจอ</option>
                    <option value="อื่นๆ">อื่นๆ</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">หมายเหตุเพิ่มเติม (ถ้ามี):</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="เช่น กล่องบุบจากการขนส่ง"
                    value={customNote}
                    onChange={(e) => setCustomNote(e.target.value)}
                  />
                </div>

                <button type="submit" className="btn btn-warning btn-large w-full font-bold">
                  <CheckCircle2 size={20} />
                  <span>ยืนยันปรับสต็อก (แก้ไขยอดคงเหลือ)</span>
                </button>
              </form>
            ) : (
              <div className="empty-catalog-message py-12">
                <Layers size={40} className="text-muted" />
                <p>กรุณาเลือกหรือสแกนสินค้าทางซ้าย</p>
                <small className="text-muted">เพื่อเริ่มต้นตรวจสอบยอดคงเหลือจริง</small>
              </div>
            )}
          </div>
        </div>
      </div>

      <CameraScannerModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onDetected={handleBarcodeScanned}
      />
    </div>
  );
}
