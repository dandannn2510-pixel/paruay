import React, { useState, useRef } from 'react';
import {
  Package,
  Plus,
  Edit,
  Trash2,
  Barcode,
  Printer,
  Sparkles,
  Search,
  Check,
  X,
  Scale,
  RefreshCw,
  Camera,
  Upload,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { generateInStoreBarcode } from '../utils/barcode';
import { scanBarcodeFromImageFile } from '../utils/barcodeScanner';
import { BarcodeStickerModal } from '../components/BarcodeStickerModal';
import { EasyAddProductModal } from '../components/EasyAddProductModal';
import { CameraScannerModal } from '../components/CameraScannerModal';
import { QuickPriceModal } from '../components/QuickPriceModal';
import { ProductThumbnail } from '../components/ProductThumbnail';
import { FALLBACK_IMAGE_BY_CATEGORY, PRODUCT_IMAGE_PRESETS } from '../data/productPresets';
import { playClickSound, playScanBeep } from '../utils/sound';

export function ProductsView() {
  const { products, categories, addProduct, updateProduct, deleteProduct } = useStore();

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isEasyAddOpen, setIsEasyAddOpen] = useState(false);

  // Form Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [quickPriceProduct, setQuickPriceProduct] = useState(null);

  // Sticker Modal
  const [stickerProduct, setStickerProduct] = useState(null);

  // Form Fields
  const [name, setName] = useState('');
  const [type, setType] = useState('packaged'); // 'packaged' | 'fresh' | 'raw_bulk' | 'service'
  const [categoryId, setCategoryId] = useState(categories[0]?.id || 'cat_dry_food');
  const [unit, setUnit] = useState('ชิ้น');
  const [isWeighted, setIsWeighted] = useState(false);
  const [costPrice, setCostPrice] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [stock, setStock] = useState('10');
  const [minStockAlert, setMinStockAlert] = useState('5');
  const [expiryDaysAlert, setExpiryDaysAlert] = useState('3');
  const [barcode, setBarcode] = useState('');
  const [imageEmoji, setImageEmoji] = useState('📦');

  const [isBarcodeScannerOpen, setIsBarcodeScannerOpen] = useState(false);
  const [isScanningBarcodePhoto, setIsScanningBarcodePhoto] = useState(false);
  const barcodeFileInputRef = useRef(null);

  const handleBarcodePhotoSnap = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanningBarcodePhoto(true);
    playClickSound();

    try {
      const code = await scanBarcodeFromImageFile(file);
      if (code) {
        playScanBeep();
        setBarcode(code);
      }
    } catch (err) {
      console.warn('Barcode photo scan failed:', err);
      alert('ไม่พบบาร์โค้ดในรูปภาพที่ถ่าย กรุณาถือกล้องให้นิ่งและให้บาร์โค้ดชัดเจน แล้วลองอีกครั้ง');
    } finally {
      setIsScanningBarcodePhoto(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleOpenAddModal = () => {
    playClickSound();
    setEditingProduct(null);
    setName('');
    setType('packaged');
    setCategoryId(categories[0]?.id || 'cat_dry_food');
    setUnit('ชิ้น');
    setIsWeighted(false);
    setCostPrice('');
    setSellPrice('');
    setStock('10');
    setMinStockAlert('5');
    setExpiryDaysAlert('3');
    setImageEmoji('📦');
    // Auto-generate fresh in-store barcode starting with 2
    const nextBarcode = generateInStoreBarcode(products.length + 1);
    setBarcode(nextBarcode);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (p) => {
    playClickSound();
    setEditingProduct(p);
    setName(p.name);
    setType(p.type || 'packaged');
    setCategoryId(p.categoryId);
    setUnit(p.unit);
    setIsWeighted(p.isWeighted || false);
    setCostPrice(String(p.costPrice || ''));
    setSellPrice(String(p.sellPrice || ''));
    setStock(String(p.stock));
    setMinStockAlert(String(p.minStockAlert || '5'));
    setExpiryDaysAlert(String(p.expiryDaysAlert || '3'));
    setBarcode(p.barcode || '');
    setImageEmoji(p.image || '📦');
    setIsModalOpen(true);
  };

  const handleGenerateBarcode = () => {
    playClickSound();
    const nextCode = generateInStoreBarcode(Date.now() % 100000000);
    setBarcode(nextCode);
  };

  const handleTypeChange = (newType) => {
    setType(newType);
    if (newType === 'fresh') {
      setIsWeighted(true);
      setUnit('กก.');
      setImageEmoji('🥩');
    } else if (newType === 'raw_bulk') {
      setIsWeighted(true);
      setUnit('กก.');
      setImageEmoji('🌾');
    } else if (newType === 'service') {
      setIsWeighted(false);
      setUnit('ครั้ง');
      setImageEmoji('🛍️');
    } else {
      setIsWeighted(false);
      setUnit('ชิ้น');
      setImageEmoji('📦');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim() || !sellPrice) return;
    playClickSound();

    const payload = {
      name: name.trim(),
      type,
      categoryId,
      unit,
      isWeighted,
      costPrice: parseFloat(costPrice) || 0,
      sellPrice: parseFloat(sellPrice) || 0,
      stock: parseFloat(stock) || 0,
      minStockAlert: parseFloat(minStockAlert) || 0,
      expiryDaysAlert: parseFloat(expiryDaysAlert) || 0,
      barcode: barcode.trim(),
      image: imageEmoji,
    };

    if (editingProduct) {
      updateProduct(editingProduct.id, payload);
    } else {
      addProduct(payload);
    }

    setIsModalOpen(false);
  };

  const handleDelete = (p) => {
    if (confirm(`คุณแน่ใจว่าต้องการลบสินค้า "${p.name}" หรือไม่?`)) {
      playClickSound();
      deleteProduct(p.id);
    }
  };

  const filteredProducts = products.filter((p) => {
    const q = search.toLowerCase().trim();
    const matchesSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      (p.barcode && p.barcode.toLowerCase().includes(q));
    const matchesCategory =
      selectedCategory === 'all' || p.categoryId === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="products-layout animate-fade-in">
      <div className="section-header">
        <div>
          <h2>🏷️ จัดการรายการสินค้า (Products Catalog)</h2>
          <p className="section-subtitle">
            เพิ่ม, แก้ไข, ลบข้อมูลสินค้า และสร้างบาร์โค้ด EAN-13 ของสดประจำร้าน
          </p>
        </div>
        <div className="header-actions">
          <button
            type="button"
            className="btn btn-primary btn-large font-bold"
            onClick={() => {
              playClickSound();
              setIsEasyAddOpen(true);
            }}
          >
            <Plus size={20} />
            <span>+ เพิ่มสินค้าใหม่ (ง่ายสุดๆ)</span>
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleOpenAddModal}
            title="สำหรับกรอกข้อมูลละเอียด หรือสินค้าบริการพิเศษ"
          >
            <span>⚙️ แบบละเอียด</span>
          </button>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="filter-controls-bar">
        <div className="search-input-wrapper flex-1">
          <Search size={18} className="input-icon" />
          <input
            type="text"
            className="form-control"
            placeholder="ค้นหาชื่อสินค้า หรือบาร์โค้ด..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          className="form-control select-dropdown"
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
        >
          <option value="all">ทุกหมวดหมู่ ({products.length})</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.icon} {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Products Table */}
      <div className="table-responsive-wrapper">
        <table className="pos-table">
          <thead>
            <tr>
              <th>รูป/ไอคอน</th>
              <th>ชื่อสินค้า</th>
              <th>บาร์โค้ด</th>
              <th>ประเภท</th>
              <th>ราคาทุน</th>
              <th>ราคาขาย</th>
              <th>คงเหลือ</th>
              <th className="text-center">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.map((p) => (
              <tr key={p.id}>
                <td>
                  <ProductThumbnail product={p} size={44} />
                </td>
                <td>
                  <strong className="block">{p.name}</strong>
                  <span className="text-xs text-muted">
                    หมวด: {categories.find((c) => c.id === p.categoryId)?.name || '-'}
                  </span>
                </td>
                <td>
                  <span className="font-mono text-sm">{p.barcode || '-'}</span>
                </td>
                <td>
                  {p.isWeighted ? (
                    <span className="badge-tag tag-scale">
                      <Scale size={12} /> ชั่ง นน. (กก.)
                    </span>
                  ) : (
                    <span className="badge-tag tag-discrete">{p.unit}</span>
                  )}
                </td>
                <td>{p.costPrice ? `${p.costPrice.toFixed(2)} ฿` : '-'}</td>
                <td>
                  <div className="flex items-center gap-1.5">
                    <strong className="text-primary font-bold">
                      {p.sellPrice.toFixed(2)} ฿
                    </strong>
                    <button
                      type="button"
                      className="btn-quick-price-edit"
                      title="ปรับราคาขายด่วน"
                      onClick={() => {
                        playClickSound();
                        setQuickPriceProduct(p);
                      }}
                    >
                      <Edit size={11} />
                      <span>ปรับ</span>
                    </button>
                  </div>
                </td>
                <td>
                  <span className="font-mono font-bold">
                    {p.isWeighted ? p.stock.toFixed(3) : p.stock} {p.unit}
                  </span>
                </td>
                <td>
                  <div className="flex items-center justify-center gap-1">
                    <button
                      type="button"
                      className="table-action-btn"
                      title="พิมพ์สติกเกอร์บาร์โค้ด"
                      onClick={() => {
                        playClickSound();
                        setStickerProduct(p);
                      }}
                    >
                      <Printer size={16} />
                    </button>
                    <button
                      type="button"
                      className="table-action-btn"
                      title="แก้ไขสินค้า"
                      onClick={() => handleOpenEditModal(p)}
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      type="button"
                      className="table-action-btn text-danger"
                      title="ลบสินค้า"
                      onClick={() => handleDelete(p)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Product Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content animate-scale-up" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">
                {editingProduct ? 'แก้ไขข้อมูลสินค้า' : 'เพิ่มสินค้าใหม่ลงคลัง'}
              </h3>
              <button className="icon-btn close-btn" onClick={() => setIsModalOpen(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="modal-form-body">
              {/* Type Switcher */}
              <div className="form-group">
                <label className="form-label">ประเภทสินค้า *:</label>
                <div className="mode-toggle-group">
                  <button
                    type="button"
                    className={`mode-btn ${type === 'packaged' ? 'active' : ''}`}
                    onClick={() => handleTypeChange('packaged')}
                  >
                    📦 ของแห้ง / สำเร็จรูป (นับชิ้น)
                  </button>
                  <button
                    type="button"
                    className={`mode-btn ${type === 'fresh' ? 'active' : ''}`}
                    onClick={() => handleTypeChange('fresh')}
                  >
                    🥩 ของสด / ผัก / เนื้อสัตว์ (ชั่ง กก.)
                  </button>
                  <button
                    type="button"
                    className={`mode-btn ${type === 'raw_bulk' ? 'active' : ''}`}
                    onClick={() => handleTypeChange('raw_bulk')}
                  >
                    🌾 ของดิบ / แบ่งขาย (กก./กรัม)
                  </button>
                </div>
              </div>

              {/* Name & Emoji */}
              <div className="form-row">
                <div className="form-group flex-1">
                  <label className="form-label">ชื่อสินค้า *:</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="เช่น หมูสันนอกสด, มาม่าต้มยำ"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <div className="form-group" style={{ width: '90px' }}>
                  <label className="form-label">ไอคอน:</label>
                  <input
                    type="text"
                    className="form-control text-center text-xl"
                    value={imageEmoji}
                    onChange={(e) => setImageEmoji(e.target.value)}
                  />
                </div>
              </div>

              {/* Category & Unit */}
              <div className="form-row">
                <div className="form-group flex-1">
                  <label className="form-label">หมวดหมู่:</label>
                  <select
                    className="form-control"
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.icon} {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ width: '130px' }}>
                  <label className="form-label">หน่วย:</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="ชิ้น, กก., ซอง"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Price & Cost */}
              <div className="form-row">
                <div className="form-group flex-1">
                  <label className="form-label">ราคาขายหน้าร้าน (บาท) *:</label>
                  <input
                    type="number"
                    step="0.25"
                    min="0.25"
                    className="form-control highlight-cash"
                    placeholder="0.00"
                    value={sellPrice}
                    onChange={(e) => setSellPrice(e.target.value)}
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
                    placeholder="0.00"
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value)}
                  />
                </div>
              </div>

              {/* Stock & Min Stock Alert */}
              <div className="form-row">
                <div className="form-group flex-1">
                  <label className="form-label">จำนวนสต็อกตั้งต้น:</label>
                  <input
                    type="number"
                    step={isWeighted ? '0.001' : '1'}
                    min="0"
                    className="form-control"
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                  />
                </div>
                <div className="form-group flex-1">
                  <label className="form-label">จุดแจ้งเตือนใกล้หมด:</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    className="form-control"
                    value={minStockAlert}
                    onChange={(e) => setMinStockAlert(e.target.value)}
                  />
                </div>
              </div>

              {/* Barcode Field + Auto Generate button */}
              <div className="form-group">
                <div className="flex items-center justify-between mb-1">
                  <label className="form-label mb-0">รหัสบาร์โค้ด (EAN-13 / อื่นๆ):</label>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      className="btn btn-primary btn-sm text-xs font-bold"
                      onClick={() => {
                        playClickSound();
                        barcodeFileInputRef.current?.click();
                      }}
                      disabled={isScanningBarcodePhoto}
                      title="ถ่ายรูปบาร์โค้ดจากกล้องมือถือ เพื่อดึงตัวเลขมาใส่ให้อัตโนมัติ"
                    >
                      <Camera size={14} />
                      <span>{isScanningBarcodePhoto ? 'กำลังอ่าน...' : '📸 ถ่ายรูปบาร์โค้ด'}</span>
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm text-xs"
                      onClick={() => {
                        playClickSound();
                        setIsBarcodeScannerOpen(true);
                      }}
                      title="เปิดกล้องสแกนสด"
                    >
                      <Barcode size={14} />
                      <span>กล้องสแกนสด</span>
                    </button>
                  </div>
                </div>

                <input
                  ref={barcodeFileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  style={{ display: 'none' }}
                  onChange={handleBarcodePhotoSnap}
                />

                <div className="flex gap-2">
                  <input
                    type="text"
                    className="form-control font-mono flex-1"
                    placeholder="ยิงบาร์โค้ด หรือกดสร้างรหัสร้าน"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn btn-outline-primary"
                    onClick={handleGenerateBarcode}
                    title="สร้างบาร์โค้ดภายในร้าน (ขึ้นต้นด้วยเลข 2 ตามมาตรฐาน EAN-13)"
                  >
                    <Barcode size={18} />
                    <span>สร้างรหัสร้าน (ขึ้นต้นด้วย 2)</span>
                  </button>
                </div>
                <p className="text-xs text-muted mt-1">
                  💡 แตะ <strong>"📸 ถ่ายรูปบาร์โค้ด"</strong> เพื่อถ่ายภาพบาร์โค้ดบนสินค้า ระบบจะดึงรหัสมาใส่ให้ทันที ไม่ต้องพิมพ์เอง
                </p>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                  ยกเลิก
                </button>
                <button type="submit" className="btn btn-primary flex-1 btn-large font-bold">
                  <Check size={18} />
                  <span>บันทึกสินค้า</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Barcode Sticker Modal */}
      <BarcodeStickerModal
        product={stickerProduct}
        isOpen={Boolean(stickerProduct)}
        onClose={() => setStickerProduct(null)}
      />

      {/* Easy Add Product Modal */}
      <EasyAddProductModal
        isOpen={isEasyAddOpen}
        onClose={() => setIsEasyAddOpen(false)}
      />

      {/* Camera Live Scanner Modal */}
      <CameraScannerModal
        isOpen={isBarcodeScannerOpen}
        onClose={() => setIsBarcodeScannerOpen(false)}
        onDetected={(code) => {
          setBarcode(code);
          setIsBarcodeScannerOpen(false);
        }}
      />

      {/* Quick Price Modal */}
      <QuickPriceModal
        product={quickPriceProduct}
        isOpen={Boolean(quickPriceProduct)}
        onClose={() => setQuickPriceProduct(null)}
      />
    </div>
  );
}
