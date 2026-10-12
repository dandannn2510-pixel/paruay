import React, { useState } from 'react';
import {
  PlusCircle,
  Camera,
  Search,
  CheckCircle2,
  Trash2,
  Calendar,
  Truck,
  ArrowRight,
  PackageCheck,
  RefreshCw,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { CameraScannerModal } from '../components/CameraScannerModal';
import { ProductThumbnail } from '../components/ProductThumbnail';
import { playScanBeep, playClickSound, playCashRegisterChime } from '../utils/sound';

export function RestockView({ onNavigate }) {
  const { products, suppliers, restockProduct } = useStore();

  const [selectedProductId, setSelectedProductId] = useState('');
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Restock form fields
  const [qtyInput, setQtyInput] = useState('10');
  const [unitMultiplier, setUnitMultiplier] = useState(1); // 1 = base unit, e.g. 25 for sack, 12 for pack
  const [costPriceInput, setCostPriceInput] = useState('');
  const [newSellPriceInput, setNewSellPriceInput] = useState('');
  const [supplierInput, setSupplierInput] = useState(suppliers[0]?.name || '');
  const [lotNumberInput, setLotNumberInput] = useState(`LOT-${Date.now().toString().slice(-6)}`);
  const [expiryDateInput, setExpiryDateInput] = useState('');

  // Pending batch items
  const [pendingBatch, setPendingBatch] = useState([]);
  const [successToast, setSuccessToast] = useState(false);

  const selectedProduct = products.find((p) => p.id === selectedProductId);

  // When product changes, prefill current cost & sell price
  const handleSelectProduct = (product) => {
    playClickSound();
    setSelectedProductId(product.id);
    setCostPriceInput(product.costPrice ? String(product.costPrice) : '');
    setNewSellPriceInput(String(product.sellPrice));
    setSearchQuery(product.name);
  };

  const handleBarcodeScanned = (code) => {
    const matched = products.find((p) => String(p.barcode).trim() === String(code).trim());
    if (matched) {
      playScanBeep();
      handleSelectProduct(matched);
      setIsCameraOpen(false);
    } else {
      alert(`ไม่พบสินค้าที่มีบาร์โค้ด: ${code} ในระบบ`);
    }
  };

  const handleAddToBatch = (e) => {
    e.preventDefault();
    if (!selectedProduct) {
      alert('กรุณาเลือกสินค้าก่อน');
      return;
    }
    const rawQty = parseFloat(qtyInput);
    if (isNaN(rawQty) || rawQty <= 0) {
      alert('กรุณาระบุจำนวนที่ถูกต้อง');
      return;
    }

    const totalUnitsAdded = Number((rawQty * unitMultiplier).toFixed(3));

    const item = {
      batchId: 'batch_' + Date.now() + Math.random().toString(36).substr(2, 4),
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      baseUnit: selectedProduct.unit,
      qty: totalUnitsAdded,
      costPrice: costPriceInput ? parseFloat(costPriceInput) : selectedProduct.costPrice,
      newSellPrice: newSellPriceInput ? parseFloat(newSellPriceInput) : null,
      supplier: supplierInput,
      lotNumber: lotNumberInput,
      expiryDate: expiryDateInput,
    };

    setPendingBatch((prev) => [...prev, item]);
    playClickSound();

    // Reset inputs for next scan
    setSelectedProductId('');
    setSearchQuery('');
    setQtyInput('10');
    setUnitMultiplier(1);
  };

  const handleRemoveFromBatch = (batchId) => {
    setPendingBatch((prev) => prev.filter((b) => b.batchId !== batchId));
  };

  const handleConfirmAllRestock = () => {
    if (pendingBatch.length === 0) return;

    pendingBatch.forEach((item) => {
      restockProduct({
        productId: item.productId,
        qty: item.qty,
        costPrice: item.costPrice,
        newSellPrice: item.newSellPrice,
        supplier: item.supplier,
        lotNumber: item.lotNumber,
        expiryDate: item.expiryDate,
      });
    });

    playCashRegisterChime();
    setPendingBatch([]);
    setSuccessToast(true);
    setTimeout(() => setSuccessToast(false), 3000);
  };

  return (
    <div className="restock-layout animate-fade-in">
      <div className="section-header">
        <div>
          <h2>📥 รับสินค้าเข้าสต็อก (Restock Inward)</h2>
          <p className="section-subtitle">
            สแกนหรือเลือกสินค้า ระบุจำนวน ราคาทุน และวันหมดอายุเพื่อเติมของเข้าคลัง
          </p>
        </div>
      </div>

      {successToast && (
        <div className="alert-banner alert-success animate-slide-up mb-4">
          <CheckCircle2 size={20} />
          <span>บันทึกรับของเข้าคลังเรียบร้อยแล้ว สต็อกถูกปรับเพิ่มทันที!</span>
        </div>
      )}

      <div className="restock-grid">
        {/* Left Form: Add item to batch */}
        <div className="restock-form-panel">
          <form onSubmit={handleAddToBatch} className="pos-card-box">
            <h3 className="card-box-title">
              <PlusCircle size={20} className="text-primary" />
              <span>ข้อมูลการรับของเข้า</span>
            </h3>

            {/* Select product & camera scan */}
            <div className="form-group">
              <label className="form-label">ค้นหาสินค้า หรือยิงบาร์โค้ด *:</label>
              <div className="flex gap-2">
                <div className="search-input-wrapper flex-1">
                  <Search size={18} className="input-icon" />
                  <input
                    type="text"
                    className="form-control"
                    placeholder="พิมพ์ชื่อสินค้า หรือบาร์โค้ด..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  className="btn btn-outline-primary"
                  onClick={() => setIsCameraOpen(true)}
                  title="เปิดกล้องสแกน"
                >
                  <Camera size={20} />
                </button>
              </div>

              {/* Suggestions dropdown */}
              {searchQuery && !selectedProduct && (
                <div className="suggestions-list-box">
                  {products
                    .filter(
                      (p) =>
                        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        (p.barcode && p.barcode.includes(searchQuery))
                    )
                    .slice(0, 5)
                    .map((p) => (
                      <div
                        key={p.id}
                        className="suggestion-item"
                        onClick={() => handleSelectProduct(p)}
                      >
                        <ProductThumbnail product={p} size={32} className="mr-2" />
                        <strong className="flex-1">{p.name}</strong>
                        <span className="text-xs text-muted font-mono">{p.barcode}</span>
                        <span className="badge-tag tag-discrete ml-2">คงเหลือ {p.stock}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {selectedProduct && (
              <div className="selected-product-banner mb-3 animate-fade-in flex items-center">
                <ProductThumbnail product={selectedProduct} size={50} className="mr-3" />
                <div>
                  <h4 className="font-bold">{selectedProduct.name}</h4>
                  <p className="text-xs text-muted">
                    คงเหลือปัจจุบัน: <strong>{selectedProduct.stock} {selectedProduct.unit}</strong> | ทุนเดิม:{' '}
                    <strong>{(selectedProduct.costPrice || 0).toFixed(2)} ฿</strong>
                  </p>
                </div>
              </div>
            )}

            {/* Qty & Unit Conversion */}
            <div className="form-row">
              <div className="form-group flex-1">
                <label className="form-label">จำนวนรับเข้า *:</label>
                <input
                  type="number"
                  step="0.001"
                  min="0.001"
                  className="form-control highlight-cash"
                  value={qtyInput}
                  onChange={(e) => setQtyInput(e.target.value)}
                  required
                />
              </div>

              {/* Unit multiplier (e.g. 1 กระสอบ = 25 กก., 1 ลัง = 24 ขวด) */}
              <div className="form-group" style={{ width: '180px' }}>
                <label className="form-label">หน่วยบรรจุ:</label>
                <select
                  className="form-control"
                  value={unitMultiplier}
                  onChange={(e) => setUnitMultiplier(parseFloat(e.target.value))}
                >
                  <option value={1}>หน่วยเดี่ยว ({selectedProduct?.unit || 'ชิ้น'})</option>
                  <option value={6}>แพ็ค 6</option>
                  <option value={10}>แพ็ค 10</option>
                  <option value={12}>โหล 12</option>
                  <option value={24}>ลัง 24</option>
                  <option value={25}>กระสอบ 25 {selectedProduct?.unit || 'กก.'}</option>
                  <option value={50}>กระสอบใหญ่ 50 {selectedProduct?.unit || 'กก.'}</option>
                </select>
              </div>
            </div>

            {unitMultiplier > 1 && (
              <p className="text-xs text-accent mb-3">
                ⚡ ระบบจะแปลงเป็น: <strong>{Number((parseFloat(qtyInput || 0) * unitMultiplier).toFixed(3))} {selectedProduct?.unit}</strong> เข้าสต็อก
              </p>
            )}

            {/* Cost Price & Selling Price Adjustment */}
            <div className="form-row">
              <div className="form-group flex-1">
                <label className="form-label">ราคาทุนต่อหน่วย (บาท):</label>
                <input
                  type="number"
                  step="0.25"
                  min="0"
                  className="form-control"
                  value={costPriceInput}
                  onChange={(e) => setCostPriceInput(e.target.value)}
                  placeholder="เช่น 45.00"
                />
              </div>
              <div className="form-group flex-1">
                <label className="form-label">ราคาขายใหม่ (ถ้าต้องการปรับ):</label>
                <input
                  type="number"
                  step="0.25"
                  min="0"
                  className="form-control"
                  value={newSellPriceInput}
                  onChange={(e) => setNewSellPriceInput(e.target.value)}
                  placeholder="ราคาเดิมถ้าไม่แก้"
                />
              </div>
            </div>

            {/* Supplier & Expiry */}
            <div className="form-row">
              <div className="form-group flex-1">
                <label className="form-label">ผู้จัดจำหน่าย / แหล่งซื้อ:</label>
                <input
                  type="text"
                  className="form-control"
                  value={supplierInput}
                  onChange={(e) => setSupplierInput(e.target.value)}
                  placeholder="เช่น ตลาดสด, แม็คโคร"
                />
              </div>
              <div className="form-group flex-1">
                <label className="form-label">วันหมดอายุ (ถ้ามี):</label>
                <input
                  type="date"
                  className="form-control"
                  value={expiryDateInput}
                  onChange={(e) => setExpiryDateInput(e.target.value)}
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary w-full btn-large font-bold mt-2">
              <PlusCircle size={20} />
              <span>เพิ่มลงชุดรายการรับเข้า</span>
            </button>
          </form>
        </div>

        {/* Right Panel: Pending Batch Review */}
        <div className="restock-batch-panel">
          <div className="pos-card-box">
            <div className="card-box-header flex justify-between items-center mb-3">
              <h3 className="card-box-title">
                <PackageCheck size={20} className="text-success" />
                <span>รายการรอรับเข้า ({pendingBatch.length} รายการ)</span>
              </h3>
              {pendingBatch.length > 0 && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm text-danger"
                  onClick={() => setPendingBatch([])}
                >
                  ล้างรายการ
                </button>
              )}
            </div>

            <div className="batch-items-list min-h-64">
              {pendingBatch.length === 0 ? (
                <div className="empty-catalog-message py-10">
                  <PackageCheck size={40} className="text-muted" />
                  <p>ยังไม่มีรายการที่เพิ่มในชุดนี้</p>
                  <small className="text-muted">กรอกข้อมูลทางซ้ายแล้วกดเพิ่มรายการ</small>
                </div>
              ) : (
                pendingBatch.map((item) => (
                  <div key={item.batchId} className="batch-item-card">
                    <div className="flex-1">
                      <h4 className="font-bold">{item.productName}</h4>
                      <p className="text-xs text-muted">
                        รับเข้า: <strong className="text-success">+{item.qty} {item.baseUnit}</strong> | ทุน: {item.costPrice.toFixed(2)} ฿
                        {item.newSellPrice && ` | ปรับราคาขายเป็น: ${item.newSellPrice.toFixed(2)} ฿`}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="icon-btn text-danger"
                      onClick={() => handleRemoveFromBatch(item.batchId)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 pt-3 border-t">
              <button
                type="button"
                className="btn btn-success btn-large w-full font-bold"
                disabled={pendingBatch.length === 0}
                onClick={handleConfirmAllRestock}
              >
                <CheckCircle2 size={20} />
                <span>ยืนยันรับของเข้าสต็อกทั้งชุด ({pendingBatch.length} รายการ)</span>
              </button>
            </div>
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
