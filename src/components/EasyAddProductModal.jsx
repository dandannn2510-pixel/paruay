import React, { useState, useRef } from 'react';
import {
  Plus,
  Camera,
  Barcode,
  Image,
  Upload,
  Check,
  X,
  Scale,
  Package,
  Sparkles,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { generateInStoreBarcode } from '../utils/barcode';
import { scanBarcodeFromImageFile } from '../utils/barcodeScanner';
import { CameraScannerModal } from './CameraScannerModal';
import { PRODUCT_IMAGE_PRESETS, FALLBACK_IMAGE_BY_CATEGORY } from '../data/productPresets';
import { playClickSound, playCashRegisterChime, playScanBeep } from '../utils/sound';

export function EasyAddProductModal({ isOpen, onClose, defaultBarcode = '', onOpenTwoShot }) {
  if (!isOpen) return null;

  const { products, categories, addProduct } = useStore();

  // Basic fields
  const [name, setName] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [isWeighted, setIsWeighted] = useState(false);
  const [unit, setUnit] = useState('ชิ้น');
  const [stock, setStock] = useState('10');
  const [categoryId, setCategoryId] = useState('cat_dry_food');
  const [barcode, setBarcode] = useState(defaultBarcode || generateInStoreBarcode(products.length + 1));
  const [image, setImage] = useState(PRODUCT_IMAGE_PRESETS[0].url);

  // File input
  const fileInputRef = useRef(null);
  const barcodeFileInputRef = useRef(null);
  const [showPresetPicker, setShowPresetPicker] = useState(false);
  const [isCameraScannerOpen, setIsCameraScannerOpen] = useState(false);
  const [isScanningBarcodePhoto, setIsScanningBarcodePhoto] = useState(false);

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

  const handleTypeSelect = (weighted) => {
    playClickSound();
    setIsWeighted(weighted);
    if (weighted) {
      setUnit('กก.');
      setCategoryId('cat_fresh');
      setImage(PRODUCT_IMAGE_PRESETS[0].url); // Fresh meat preset
    } else {
      setUnit('ชิ้น');
      setCategoryId('cat_dry_food');
      setImage(PRODUCT_IMAGE_PRESETS[12].url); // Dry food preset
    }
  };

  const handleGenerateBarcode = () => {
    playClickSound();
    setBarcode(generateInStoreBarcode(Date.now() % 100000000));
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result;
        if (base64) {
          setImage(base64);
          playClickSound();
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim() || !sellPrice) {
      alert('กรุณากรอกชื่อสินค้าและราคาขาย');
      return;
    }

    playClickSound();

    const newProd = addProduct({
      name: name.trim(),
      type: isWeighted ? 'fresh' : 'packaged',
      categoryId,
      unit,
      isWeighted,
      sellPrice: parseFloat(sellPrice) || 0,
      costPrice: parseFloat(costPrice) || 0,
      stock: parseFloat(stock) || 0,
      minStockAlert: isWeighted ? 3 : 5,
      barcode: barcode.trim(),
      image: image || FALLBACK_IMAGE_BY_CATEGORY[categoryId] || PRODUCT_IMAGE_PRESETS[0].url,
    });

    playCashRegisterChime();
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content easy-add-modal animate-scale-up" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="header-info">
            <div className="brand-logo-wrap" style={{ width: 36, height: 36 }}>
              <Plus size={20} className="text-white" />
            </div>
            <div>
              <h3 className="modal-title">เพิ่มสินค้าใหม่เข้าร้าน (แบบง่าย)</h3>
              <p className="modal-subtitle">กรอกแค่ชื่อกับราคาก็ขายได้ทันที</p>
            </div>
          </div>
          <button className="icon-btn close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form-body">
          {/* Promo banner to switch to 2-shot photo mode */}
          {onOpenTwoShot && (
            <div
              className="two-shot-promo-banner"
              onClick={() => {
                playClickSound();
                onClose();
                onOpenTwoShot();
              }}
              title="เปลี่ยนไปใช้ระบบถ่ายรูป 2 ช็อต (ถ่าย 1 รูปฉลาก + 1 รูปบาร์โค้ด)"
            >
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-purple-600 animate-pulse" />
                <div>
                  <div className="text-xs font-bold text-gray-800">
                    📸 แนะนำ: ถ่ายรูป 2 ช็อต (AI ด่วน)
                  </div>
                  <div className="text-xs text-gray-500">
                    1. ถ่ายฉลาก (ได้ชื่อ+รูป) + 2. ถ่ายบาร์โค้ด (ได้รหัส)
                  </div>
                </div>
              </div>
              <span className="btn btn-xs btn-primary font-bold">
                เปิดกล้อง ➔
              </span>
            </div>
          )}

          {/* 1. Name & Sell Price (Primary) */}
          <div className="form-group mb-3">
            <label className="form-label font-bold text-base">1. ชื่อสินค้า *:</label>
            <input
              type="text"
              className="form-control"
              placeholder="เช่น หมูสามชั้นสด, นมดัชมิลล์, ผักกาดขาว"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="form-row mb-3">
            <div className="form-group flex-1">
              <label className="form-label font-bold text-base">2. ราคาขายหน้าร้าน (บาท) *:</label>
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
            </div>
            <div className="form-group flex-1">
              <label className="form-label">ราคาทุน (ถ้ามี):</label>
              <input
                type="number"
                step="0.25"
                min="0"
                className="form-control"
                placeholder="ต้นทุน"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
              />
            </div>
          </div>

          {/* 2. Type Selector (Big Thumb-friendly Toggles) */}
          <div className="form-group mb-3">
            <label className="form-label font-bold">3. รูปแบบการขายสินค้า:</label>
            <div className="type-toggle-cards">
              <div
                className={`type-card ${!isWeighted ? 'active' : ''}`}
                onClick={() => handleTypeSelect(false)}
              >
                <Package size={22} />
                <div className="type-card-info">
                  <strong>ขายเป็นชิ้น / ห่อ / ขวด</strong>
                  <small>สินค้าทั่วไป, ขนม, เครื่องดื่ม, ของใช้</small>
                </div>
              </div>

              <div
                className={`type-card ${isWeighted ? 'active' : ''}`}
                onClick={() => handleTypeSelect(true)}
              >
                <Scale size={22} />
                <div className="type-card-info">
                  <strong>ชั่งน้ำหนัก (กิโลกรัม)</strong>
                  <small>เนื้อสัตว์สด, ผัก, ผลไม้, ของตักแบ่งขาย</small>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Product Photo: Presets or Upload */}
          <div className="form-group mb-3">
            <div className="flex items-center justify-between mb-1">
              <label className="form-label font-bold mb-0">4. รูปภาพสินค้า:</label>
              <button
                type="button"
                className="btn btn-ghost btn-sm text-xs text-primary"
                onClick={() => setShowPresetPicker(!showPresetPicker)}
              >
                {showPresetPicker ? 'ซ่อนคลังรูป' : '✨ เลือกรูปสำเร็จรูป'}
              </button>
            </div>

            {/* Selected Image Preview + Upload button */}
            <div className="image-select-row">
              <div className="image-preview-box">
                <img
                  src={image}
                  alt="ภาพสินค้า"
                  className="preview-img-square"
                  onError={(e) => {
                    e.currentTarget.src = PRODUCT_IMAGE_PRESETS[0].url;
                  }}
                />
              </div>

              <div className="flex-1 flex flex-col gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleFileUpload}
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Camera size={16} />
                  <span>ถ่ายรูป / อัปโหลดไฟล์จากเครื่อง</span>
                </button>

                <button
                  type="button"
                  className="btn btn-outline-primary btn-sm"
                  onClick={() => setShowPresetPicker(!showPresetPicker)}
                >
                  <Image size={16} />
                  <span>เลือกรูปจากแคตตาล็อกสินค้า ({PRODUCT_IMAGE_PRESETS.length} รูป)</span>
                </button>
              </div>
            </div>

            {/* Preset Picker Tray */}
            {showPresetPicker && (
              <div className="preset-images-tray animate-fade-in mt-2">
                <span className="text-xs text-muted block mb-1">แตะเพื่อเลือกรูปที่ตรงกับสินค้าของคุณ:</span>
                <div className="preset-grid">
                  {PRODUCT_IMAGE_PRESETS.map((preset, idx) => (
                    <div
                      key={idx}
                      className={`preset-thumb-card ${image === preset.url ? 'active' : ''}`}
                      onClick={() => {
                        playClickSound();
                        setImage(preset.url);
                        setShowPresetPicker(false);
                      }}
                    >
                      <img src={preset.url} alt={preset.label} className="preset-img" />
                      <span className="preset-lbl">{preset.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 4. Barcode & Initial Stock */}
          <div className="form-group mb-4">
            <div className="flex items-center justify-between mb-1">
              <label className="form-label font-bold mb-0">5. รหัสบาร์โค้ดสินค้า:</label>
              <div className="flex gap-1">
                <button
                  type="button"
                  className="btn btn-primary btn-sm text-xs font-bold"
                  onClick={() => {
                    playClickSound();
                    barcodeFileInputRef.current?.click();
                  }}
                  disabled={isScanningBarcodePhoto}
                  title="เปิดกล้องมือถือถ่ายรูปบาร์โค้ด เพื่อดึงรหัสมาใส่ให้อัตโนมัติ"
                >
                  <Camera size={14} />
                  <span>{isScanningBarcodePhoto ? 'กำลังอ่านบาร์โค้ด...' : '📸 ถ่ายรูปบาร์โค้ด'}</span>
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm text-xs"
                  onClick={() => {
                    playClickSound();
                    setIsCameraScannerOpen(true);
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

            <div className="form-row">
              <div className="form-group flex-1">
                <div className="flex gap-1">
                  <input
                    type="text"
                    className="form-control font-mono text-sm"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    placeholder="รหัสบาร์โค้ด (ถ่ายรูป หรือ ยิงใส่)"
                  />
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleGenerateBarcode}
                    title="สร้างรหัสร้านอัตโนมัติ (ขึ้นต้นด้วย 2)"
                  >
                    สร้างรหัส
                  </button>
                </div>
              </div>

              <div className="form-group" style={{ width: '130px' }}>
                <input
                  type="number"
                  step={isWeighted ? '0.1' : '1'}
                  min="0"
                  className="form-control"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  placeholder="สต็อก"
                  title="จำนวนสต็อก"
                />
              </div>
            </div>
            <p className="text-xs text-muted mt-1">
              💡 แตะ <strong>"📸 ถ่ายรูปบาร์โค้ด"</strong> เพื่อถ่ายภาพบาร์โค้ดบนซอง/กล่องสินค้า ระบบจะดึงรหัสมาใส่ให้ทันที ไม่ต้องพิมพ์เอง
            </p>
          </div>

          {/* Actions */}
          <div className="modal-actions" style={{ margin: '-1.15rem', marginTop: '1rem' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              ยกเลิก
            </button>
            <button type="submit" className="btn btn-primary btn-large flex-1 font-bold">
              <Check size={20} />
              <span>บันทึกสินค้าทันที</span>
            </button>
          </div>
        </form>
      </div>

      {/* Live Camera Scanner Modal */}
      <CameraScannerModal
        isOpen={isCameraScannerOpen}
        onClose={() => setIsCameraScannerOpen(false)}
        onDetected={(code) => {
          setBarcode(code);
          setIsCameraScannerOpen(false);
        }}
      />
    </div>
  );
}
