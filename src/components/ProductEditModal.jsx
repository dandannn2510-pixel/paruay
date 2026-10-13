import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Camera,
  Upload,
  Image as ImageIcon,
  Barcode,
  Sparkles,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Package,
  Scale,
  RefreshCw,
  Plus,
  Minus,
  Check,
  EyeOff,
  Eye,
  SlidersHorizontal,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { compressImageFile, getProductPhotoUrl } from '../utils/imageUtils';
import { generateInStoreBarcode } from '../utils/barcode';
import { analyzeProductWithAI } from '../utils/aiVisionScanner';
import { PRODUCT_IMAGE_PRESETS, FALLBACK_IMAGE_BY_CATEGORY } from '../data/productPresets';
import { CameraScannerModal } from './CameraScannerModal';
import {
  playClickSound,
  playScanBeep,
  playCashRegisterChime,
  playErrorBuzz,
} from '../utils/sound';

export function ProductEditModal({ isOpen, product, onClose, onSaveSuccess }) {
  if (!isOpen || !product) return null;

  const { categories, updateProduct, deleteProduct, adjustStock } = useStore();

  // Hidden inputs for Camera Snap and File Upload
  const cameraInputRef = useRef(null);
  const fileInputRef = useRef(null);

  // Form States
  const [name, setName] = useState(product.name || '');
  const [barcode, setBarcode] = useState(product.barcode || '');
  const [categoryId, setCategoryId] = useState(product.categoryId || 'cat_dry_food');
  const [type, setType] = useState(product.type || (product.isWeighted ? 'fresh' : 'packaged'));
  const [isWeighted, setIsWeighted] = useState(Boolean(product.isWeighted));
  const [unit, setUnit] = useState(product.unit || (product.isWeighted ? 'กก.' : 'ชิ้น'));
  const [sellPrice, setSellPrice] = useState(String(product.sellPrice || ''));
  const [costPrice, setCostPrice] = useState(String(product.costPrice || ''));
  const [minStockAlert, setMinStockAlert] = useState(String(product.minStockAlert || '5'));
  const [active, setActive] = useState(product.active !== false);

  // Stock Adjustment States
  const [currentStock, setCurrentStock] = useState(Number(product.stock) || 0);
  const [newStockInput, setNewStockInput] = useState(String(product.stock || 0));
  const [adjustReason, setAdjustReason] = useState('ตรวจนับสต็อกประจำวัน');

  // Photo States
  const [currentImage, setCurrentImage] = useState(product.image || '');
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);
  const [showPresetGallery, setShowPresetGallery] = useState(false);
  const [presetCategory, setPresetCategory] = useState('all');

  // Scanner modal state
  const [isBarcodeScannerOpen, setIsBarcodeScannerOpen] = useState(false);

  // Danger delete confirm dialog state
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  // Sync state when product prop changes
  useEffect(() => {
    if (product) {
      setName(product.name || '');
      setBarcode(product.barcode || '');
      setCategoryId(product.categoryId || 'cat_dry_food');
      setType(product.type || (product.isWeighted ? 'fresh' : 'packaged'));
      setIsWeighted(Boolean(product.isWeighted));
      setUnit(product.unit || (product.isWeighted ? 'กก.' : 'ชิ้น'));
      setSellPrice(String(product.sellPrice || ''));
      setCostPrice(String(product.costPrice || ''));
      setMinStockAlert(String(product.minStockAlert || '5'));
      setActive(product.active !== false);
      setCurrentStock(Number(product.stock) || 0);
      setNewStockInput(String(product.stock || 0));
      setCurrentImage(product.image || '');
      setShowPresetGallery(false);
      setIsConfirmingDelete(false);
    }
  }, [product]);

  // Handle Photo Snap from Camera
  const handleCameraSnap = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    playClickSound();
    setIsUploadingPhoto(true);

    try {
      const compressedDataUrl = await compressImageFile(file, 500, 0.82);
      setCurrentImage(compressedDataUrl);
      playScanBeep();
    } catch (err) {
      console.error('Failed to compress camera photo:', err);
      alert('ไม่สามารถประมวลผลรูปภาพได้ กรุณาลองอีกครั้ง');
      playErrorBuzz();
    } finally {
      setIsUploadingPhoto(false);
      if (e.target) e.target.value = '';
    }
  };

  // Handle Image File Upload
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    playClickSound();
    setIsUploadingPhoto(true);

    try {
      const compressedDataUrl = await compressImageFile(file, 500, 0.82);
      setCurrentImage(compressedDataUrl);
      playScanBeep();
    } catch (err) {
      console.error('Failed to compress uploaded photo:', err);
      alert('ไม่สามารถประมวลผลรูปภาพได้ กรุณาลองอีกครั้ง');
      playErrorBuzz();
    } finally {
      setIsUploadingPhoto(false);
      if (e.target) e.target.value = '';
    }
  };

  // Quick preset photo pick
  const handlePickPreset = (presetUrl) => {
    playClickSound();
    setCurrentImage(presetUrl);
    setShowPresetGallery(false);
  };

  // Clear photo to category default
  const handleResetPhoto = () => {
    playClickSound();
    setCurrentImage('');
  };

  // Trigger AI Recognition to inspect photo and update name/category
  const handleAiRecognizeFromImage = async (imgSource) => {
    const targetImg = imgSource || currentImage;
    if (!targetImg) return;
    playClickSound();
    setIsAiAnalyzing(true);
    try {
      const res = await analyzeProductWithAI(targetImg);
      if (res && res.name) {
        setName(res.name);
        if (res.categoryId) setCategoryId(res.categoryId);
        if (res.unit) setUnit(res.unit);
        if (typeof res.isWeighted === 'boolean') setIsWeighted(res.isWeighted);
        if (res.suggestedPrice && (!sellPrice || parseFloat(sellPrice) === 0)) {
          setSellPrice(String(res.suggestedPrice));
        }
        playScanBeep();
      }
    } catch (err) {
      console.warn('AI recognition error in ProductEditModal:', err);
    } finally {
      setIsAiAnalyzing(false);
    }
  };

  // Quick Stock Step
  const handleQuickStockStep = (delta) => {
    playClickSound();
    const current = parseFloat(newStockInput) || 0;
    const nextVal = Math.max(0, Number((current + delta).toFixed(3)));
    setNewStockInput(String(nextVal));
  };

  // Switch Weighted / Packaged
  const handleTypeToggle = (weighted) => {
    playClickSound();
    setIsWeighted(weighted);
    if (weighted) {
      setType('fresh');
      setUnit('กก.');
    } else {
      setType('packaged');
      setUnit('ชิ้น');
    }
  };

  // Generate In-store Barcode
  const handleGenerateBarcode = () => {
    playClickSound();
    setBarcode(generateInStoreBarcode(Date.now() % 100000000));
  };

  // Discontinue / Re-activate Toggle
  const handleToggleActive = () => {
    playClickSound();
    setActive((prev) => !prev);
  };

  // Permanent Delete Product
  const handlePermanentDelete = async () => {
    playClickSound();
    await deleteProduct(product.id);
    playCashRegisterChime();
    onClose();
    if (onSaveSuccess) onSaveSuccess({ deleted: true, productId: product.id });
  };

  // Submit Product & Stock Changes
  const handleSave = (e) => {
    e.preventDefault();

    if (!name.trim()) {
      alert('กรุณากรอกชื่อสินค้า');
      return;
    }

    if (!sellPrice || parseFloat(sellPrice) <= 0) {
      alert('กรุณาระบุราคาขายที่ถูกต้อง (บาท)');
      return;
    }

    playClickSound();

    const parsedNewStock = parseFloat(newStockInput);
    const hasStockChanged = !isNaN(parsedNewStock) && parsedNewStock !== currentStock;

    // 1. Update basic fields, price, active status, image
    updateProduct(product.id, {
      name: name.trim(),
      barcode: barcode.trim(),
      categoryId,
      type,
      isWeighted,
      unit,
      sellPrice: parseFloat(sellPrice) || 0,
      costPrice: parseFloat(costPrice) || 0,
      minStockAlert: parseFloat(minStockAlert) || 0,
      image: currentImage || null,
      active,
    });

    // 2. Adjust stock with movement record if changed
    if (hasStockChanged) {
      adjustStock({
        productId: product.id,
        countedStock: parsedNewStock,
        reason: adjustReason,
        performedBy: 'เจ้าของร้าน',
      });
    }

    playCashRegisterChime();
    onClose();
    if (onSaveSuccess) onSaveSuccess({ updated: true, productId: product.id });
  };

  // Calculate profit and margin
  const numSell = parseFloat(sellPrice) || 0;
  const numCost = parseFloat(costPrice) || 0;
  const profit = numSell - numCost;
  const marginPct = numSell > 0 ? ((profit / numSell) * 100).toFixed(0) : 0;
  const stockDiff = (parseFloat(newStockInput) || 0) - currentStock;

  // Filtered preset photos
  const filteredPresets =
    presetCategory === 'all'
      ? PRODUCT_IMAGE_PRESETS
      : PRODUCT_IMAGE_PRESETS.filter((p) => p.cat === presetCategory);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content product-edit-modal animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hidden Camera and File Inputs */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={handleCameraSnap}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFileUpload}
        />

        {/* Header */}
        <div className="modal-header">
          <div className="flex items-center gap-2">
            <div className="prod-edit-header-badge">
              <SlidersHorizontal size={20} className="text-white" />
            </div>
            <div>
              <h3 className="modal-title font-bold text-lg">
                จัดการข้อมูลและสต็อกสินค้า
              </h3>
              <p className="modal-subtitle text-xs text-muted">
                {product.name} (รหัส {product.barcode || 'ไม่มีบาร์โค้ด'})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Active / Discontinued Status Badge */}
            <button
              type="button"
              className={`status-pill ${active ? 'status-success' : 'status-error'} cursor-pointer`}
              onClick={handleToggleActive}
              title={active ? 'คลิกเพื่อเลิกขาย/พักจำหน่าย' : 'คลิกเพื่อเปิดขายอีกครั้ง'}
            >
              {active ? (
                <>
                  <CheckCircle2 size={12} />
                  <span>วางขายปกติ</span>
                </>
              ) : (
                <>
                  <EyeOff size={12} />
                  <span>เลิกขาย / พักจำหน่าย</span>
                </>
              )}
            </button>

            <button type="button" className="icon-btn close-btn" onClick={onClose}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <form onSubmit={handleSave} className="product-edit-body">
          {/* Active Status Warning Banner (if inactive) */}
          {!active && (
            <div className="discontinued-banner mb-3 animate-fade-in">
              <div className="flex items-center gap-2">
                <AlertTriangle size={18} className="text-amber-600 flex-shrink-0" />
                <div>
                  <strong className="block text-amber-900 text-xs">
                    สินค้านี้ถูกระบุว่า "เลิกขาย / พักจำหน่าย" แล้ว
                  </strong>
                  <span className="text-xs text-amber-800">
                    จะไม่แสดงในหน้าจอขายแคชเชียร์ แต่ยังเก็บประวัติบิลในอดีตครบถ้วน
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-success font-bold"
                onClick={handleToggleActive}
              >
                เปิดขายอีกครั้ง
              </button>
            </div>
          )}

          {/* SECTION 1: Product Photo (เปลี่ยนรูปภาพสินค้า) */}
          <div className="edit-section-card mb-3">
            <div className="edit-section-header">
              <span className="section-step-num">1</span>
              <strong className="text-sm font-bold text-gray-800">รูปภาพสินค้า (เปลี่ยนรูปภาพ)</strong>
              {isUploadingPhoto && (
                <span className="text-xs text-primary font-medium flex items-center gap-1 ml-auto">
                  <RefreshCw size={12} className="animate-spin" /> กำลังประมวลผลรูปภาพ...
                </span>
              )}
            </div>

            <div className="photo-edit-row mt-2">
              {/* Photo Preview Container */}
              <div className="photo-preview-box">
                <img
                  src={
                    currentImage ||
                    FALLBACK_IMAGE_BY_CATEGORY[categoryId] ||
                    PRODUCT_IMAGE_PRESETS[0].url
                  }
                  alt={name}
                  className="photo-preview-image"
                />
                {currentImage ? (
                  <span className="photo-type-badge custom">รูปกำหนดเอง</span>
                ) : (
                  <span className="photo-type-badge default">รูปตามหมวด</span>
                )}
              </div>

              {/* Photo Action Buttons */}
              <div className="photo-actions-grid flex-1">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm photo-action-btn"
                  onClick={() => cameraInputRef.current?.click()}
                  title="เปิดกล้องมือถือหรือคอมเพื่อถ่ายรูปสินค้าใหม่"
                >
                  <Camera size={16} className="text-primary" />
                  <span>ถ่ายรูปด้วยกล้อง</span>
                </button>

                <button
                  type="button"
                  className="btn btn-secondary btn-sm photo-action-btn"
                  onClick={() => fileInputRef.current?.click()}
                  title="เลือกรูปภาพจากเครื่องเพื่ออัปโหลด"
                >
                  <Upload size={16} className="text-accent" />
                  <span>อัปโหลดรูปจากเครื่อง</span>
                </button>

                <button
                  type="button"
                  className="btn btn-secondary btn-sm photo-action-btn"
                  onClick={() => {
                    playClickSound();
                    setShowPresetGallery((prev) => !prev);
                  }}
                  title="เลือกรูปสำเร็จรูปสวยๆ สำหรับสินค้าในร้าน"
                >
                  <ImageIcon size={16} className="text-purple-600" />
                  <span>{showPresetGallery ? 'ปิดคลังรูปภาพ' : 'เลือกรูปสำเร็จรูป (22+)'}</span>
                </button>

                {currentImage && (
                  <button
                    type="button"
                    className="btn btn-outline-primary btn-sm photo-action-btn font-bold"
                    onClick={() => handleAiRecognizeFromImage()}
                    disabled={isAiAnalyzing}
                    title="ให้ AI ช่วยอ่านฉลากเพื่ออัปเดตชื่อและหมวดหมู่จากรูปนี้"
                  >
                    <Sparkles size={15} />
                    <span>{isAiAnalyzing ? 'AI กำลังอ่านรูป...' : 'ให้ AI ตั้งชื่อจากรูปนี้'}</span>
                  </button>
                )}

                {currentImage && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm text-danger photo-action-btn"
                    onClick={handleResetPhoto}
                    title="ล้างรูปกลับไปเป็นรูปเริ่มต้นตามหมวดหมู่"
                  >
                    <Trash2 size={15} />
                    <span>รีเซ็ตรูปภาพ</span>
                  </button>
                )}
              </div>
            </div>

            {/* Expandable Preset Gallery */}
            {showPresetGallery && (
              <div className="preset-gallery-drawer mt-3 animate-fade-in">
                <div className="preset-cat-tabs mb-2">
                  <button
                    type="button"
                    className={`preset-tab-pill ${presetCategory === 'all' ? 'active' : ''}`}
                    onClick={() => setPresetCategory('all')}
                  >
                    ทั้งหมด
                  </button>
                  <button
                    type="button"
                    className={`preset-tab-pill ${presetCategory === 'cat_fresh' ? 'active' : ''}`}
                    onClick={() => setPresetCategory('cat_fresh')}
                  >
                    🥩 เนื้อสด/ไข่
                  </button>
                  <button
                    type="button"
                    className={`preset-tab-pill ${presetCategory === 'cat_veg' ? 'active' : ''}`}
                    onClick={() => setPresetCategory('cat_veg')}
                  >
                    🥬 ผักสด
                  </button>
                  <button
                    type="button"
                    className={`preset-tab-pill ${presetCategory === 'cat_dry_food' ? 'active' : ''}`}
                    onClick={() => setPresetCategory('cat_dry_food')}
                  >
                    🍜 ของแห้ง/มาม่า
                  </button>
                  <button
                    type="button"
                    className={`preset-tab-pill ${presetCategory === 'cat_beverage' ? 'active' : ''}`}
                    onClick={() => setPresetCategory('cat_beverage')}
                  >
                    🥤 เครื่องดื่ม
                  </button>
                </div>

                <div className="preset-thumbnails-grid">
                  {filteredPresets.map((preset, idx) => (
                    <div
                      key={idx}
                      className={`preset-thumbnail-card ${currentImage === preset.url ? 'is-selected' : ''}`}
                      onClick={() => handlePickPreset(preset.url)}
                      title={`แตะเพื่อเลือกรูป: ${preset.label}`}
                    >
                      <img src={preset.url} alt={preset.label} className="preset-thumb-img" />
                      <span className="preset-thumb-label">{preset.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* SECTION 2: Basic Info (ชื่อ, บาร์โค้ด, หมวดหมู่, หน่วย) */}
          <div className="edit-section-card mb-3">
            <div className="edit-section-header">
              <span className="section-step-num">2</span>
              <strong className="text-sm font-bold text-gray-800">ข้อมูลสินค้าพื้นฐาน</strong>
            </div>

            <div className="form-group mb-2 mt-2">
              <label className="form-label font-bold text-xs">ชื่อสินค้า: *</label>
              <input
                type="text"
                className="form-control"
                placeholder="เช่น มาม่า ต้มยำกุ้งน้ำข้น, หมูสันนอกสด"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="form-row mb-2">
              <div className="form-group flex-1">
                <div className="flex items-center justify-between mb-1">
                  <label className="form-label font-bold text-xs mb-0">รหัสบาร์โค้ด:</label>
                  <button
                    type="button"
                    className="btn-link-action text-xs text-accent"
                    onClick={handleGenerateBarcode}
                  >
                    สุ่มบาร์โค้ดร้านค้า
                  </button>
                </div>
                <div className="input-with-button-wrap">
                  <input
                    type="text"
                    className="form-control font-mono font-bold"
                    placeholder="รหัสบาร์โค้ดสินค้า"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setIsBarcodeScannerOpen(true)}
                    title="เปิดกล้องสแกนบาร์โค้ด"
                  >
                    <Barcode size={15} />
                    <span>สแกน</span>
                  </button>
                </div>
              </div>

              <div className="form-group flex-1">
                <label className="form-label font-bold text-xs">หมวดหมู่สินค้า:</label>
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
            </div>

            <div className="form-row">
              <div className="form-group flex-1">
                <label className="form-label text-xs">ชนิดสินค้า:</label>
                <div className="flex gap-1">
                  <button
                    type="button"
                    className={`btn btn-sm flex-1 ${!isWeighted ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => handleTypeToggle(false)}
                  >
                    <Package size={14} /> นับชิ้น
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm flex-1 ${isWeighted ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => handleTypeToggle(true)}
                  >
                    <Scale size={14} /> ชั่ง นน. (กก.)
                  </button>
                </div>
              </div>

              <div className="form-group flex-1">
                <label className="form-label text-xs">หน่วยนับ:</label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  placeholder="ชิ้น, กก., ซอง, ขวด"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          {/* SECTION 3: Price & Stock Management (ราคา และ สต็อกครบครัน) */}
          <div className="edit-section-card mb-3">
            <div className="edit-section-header">
              <span className="section-step-num">3</span>
              <strong className="text-sm font-bold text-gray-800">ราคาขาย, ทุน และ การจัดการสต็อก</strong>
            </div>

            {/* Price Inputs */}
            <div className="form-row mt-2 mb-3">
              <div className="form-group flex-1">
                <label className="form-label font-bold text-xs">ราคาขายหน้าร้าน (บาท) *:</label>
                <div className="big-input-wrapper">
                  <input
                    type="number"
                    step="0.25"
                    min="0.25"
                    className="form-control big-number-input highlight-cash"
                    placeholder="0.00"
                    value={sellPrice}
                    onChange={(e) => setSellPrice(e.target.value)}
                    required
                  />
                  <span className="unit-badge">บาท</span>
                </div>
              </div>

              <div className="form-group flex-1">
                <label className="form-label text-xs">ราคาทุน (บาท):</label>
                <div className="big-input-wrapper">
                  <input
                    type="number"
                    step="0.25"
                    min="0"
                    className="form-control"
                    placeholder="0.00"
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value)}
                  />
                  <span className="unit-badge">บาท</span>
                </div>
                {numCost > 0 && numSell > 0 && (
                  <div className="text-xs text-success mt-1 font-medium">
                    กำไร {profit.toFixed(2)} บาท/หน่วย ({marginPct}%)
                  </div>
                )}
              </div>
            </div>

            {/* Stock Management Box */}
            <div className="stock-manage-box p-3 rounded-lg" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div className="flex items-center justify-between mb-2">
                <strong className="text-xs font-bold text-gray-700">
                  📦 จำนวนสต็อกคงเหลือในร้าน (ปัจจุบัน: {currentStock} {unit})
                </strong>
                {stockDiff !== 0 && (
                  <span className={`text-xs font-bold ${stockDiff > 0 ? 'text-success' : 'text-danger'}`}>
                    {stockDiff > 0 ? `+${stockDiff}` : stockDiff} {unit}
                  </span>
                )}
              </div>

              {/* Stepper and Number Input */}
              <div className="flex items-center gap-2 mb-2">
                <div className="stock-quick-chips flex gap-1">
                  <button
                    type="button"
                    className="btn btn-secondary btn-xs font-bold"
                    onClick={() => handleQuickStockStep(-5)}
                  >
                    -5
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-xs font-bold"
                    onClick={() => handleQuickStockStep(-1)}
                  >
                    -1
                  </button>
                </div>

                <div className="flex-1 flex items-center gap-1">
                  <input
                    type="number"
                    step={isWeighted ? '0.001' : '1'}
                    min="0"
                    className="form-control font-mono font-bold text-lg text-center"
                    value={newStockInput}
                    onChange={(e) => setNewStockInput(e.target.value)}
                  />
                  <span className="text-xs font-medium text-muted">{unit}</span>
                </div>

                <div className="stock-quick-chips flex gap-1">
                  <button
                    type="button"
                    className="btn btn-secondary btn-xs font-bold"
                    onClick={() => handleQuickStockStep(1)}
                  >
                    +1
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-xs font-bold"
                    onClick={() => handleQuickStockStep(5)}
                  >
                    +5
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-xs font-bold"
                    onClick={() => handleQuickStockStep(10)}
                  >
                    +10
                  </button>
                </div>
              </div>

              {/* Adjustment Reason & Min Alert */}
              <div className="form-row mt-2 pt-2" style={{ borderTop: '1px dashed #cbd5e1' }}>
                <div className="form-group flex-1">
                  <label className="form-label text-xs">เหตุผลการปรับสต็อก:</label>
                  <select
                    className="form-control form-control-sm"
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value)}
                  >
                    <option value="ตรวจนับสต็อกประจำวัน">🔍 ตรวจนับสต็อกประจำวัน</option>
                    <option value="รับสินค้าเพิ่มเข้าร้าน">📦 รับสินค้าเพิ่มเข้าร้าน</option>
                    <option value="สินค้าเสียหาย / แตกหัก">⚠️ สินค้าเสียหาย / แตกหัก</option>
                    <option value="สินค้าหมดอายุ / เสื่อมสภาพ">⌛ สินค้าหมดอายุ / เสื่อมสภาพ</option>
                    <option value="ลูกค้าคืนสินค้า">↩️ ลูกค้าคืนสินค้า</option>
                    <option value="ปรับปรุงยอดสต็อก">✏️ ปรับปรุงยอดสต็อก</option>
                  </select>
                </div>

                <div className="form-group" style={{ width: '130px' }}>
                  <label className="form-label text-xs">จุดเตือนสต็อกต่ำ:</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      className="form-control form-control-sm font-mono"
                      value={minStockAlert}
                      onChange={(e) => setMinStockAlert(e.target.value)}
                    />
                    <span className="text-xs text-muted">{unit}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 4: Danger Zone - Discontinue or Permanent Delete */}
          <div className="danger-zone-box p-3 rounded-lg mb-3">
            <div className="flex items-center justify-between">
              <div>
                <strong className="block text-xs font-bold text-gray-800">
                  {active ? '⏸️ เลิกขายสินค้านี้ (ไม่มีขายแล้ว)' : '▶️ เปิดขายสินค้านี้อีกครั้ง'}
                </strong>
                <span className="text-xs text-muted">
                  {active
                    ? 'ซ่อนออกจากหน้าคิดเงินแคชเชียร์ ไม่ให้ขายผิด แต่เก็บประวัติเดิมไว้'
                    : 'นำกลับมาขายหน้าร้านตามปกติ'}
                </span>
              </div>
              <button
                type="button"
                className={`btn btn-sm ${active ? 'btn-secondary' : 'btn-success'} font-bold`}
                onClick={handleToggleActive}
              >
                {active ? 'เลิกขาย / ซ่อน' : 'เปิดขายอีกครั้ง'}
              </button>
            </div>

            <div className="pt-2 mt-2" style={{ borderTop: '1px dashed #fecaca' }}>
              {!isConfirmingDelete ? (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-danger">
                    ต้องการลบสินค้านี้ออกจากฐานข้อมูลถาวร?
                  </span>
                  <button
                    type="button"
                    className="btn btn-outline-danger btn-xs font-bold"
                    onClick={() => {
                      playClickSound();
                      setIsConfirmingDelete(true);
                    }}
                  >
                    <Trash2 size={13} /> ลบสินค้าถาวร
                  </button>
                </div>
              ) : (
                <div className="delete-confirm-box p-2 rounded bg-red-50 border border-red-200 animate-fade-in">
                  <p className="text-xs font-bold text-danger mb-2">
                    ⚠️ คุณแน่ใจว่าต้องการลบ "{name}" ถาวรหรือไม่? ข้อมูลจะไม่สามารถกู้คืนได้
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="btn btn-secondary btn-xs flex-1"
                      onClick={() => setIsConfirmingDelete(false)}
                    >
                      ยกเลิก
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger btn-xs flex-1 font-bold"
                      onClick={handlePermanentDelete}
                    >
                      ยืนยันลบถาวร
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Modal Actions */}
          <div className="modal-actions pt-2" style={{ borderTop: '1px solid var(--border-color)' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              ยกเลิก
            </button>
            <button
              type="submit"
              className="btn btn-success btn-large flex-1 font-bold"
              disabled={!name.trim() || !sellPrice}
            >
              <CheckCircle2 size={18} />
              <span>บันทึกการแก้ไขสินค้าและสต็อก</span>
            </button>
          </div>
        </form>

        {/* Live Camera Scanner Modal if scanning new barcode */}
        <CameraScannerModal
          isOpen={isBarcodeScannerOpen}
          onClose={() => setIsBarcodeScannerOpen(false)}
          onDetected={(detectedCode) => {
            playScanBeep();
            setBarcode(detectedCode);
            setIsBarcodeScannerOpen(false);
          }}
        />
      </div>
    </div>
  );
}
