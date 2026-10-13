import React, { useState, useRef } from 'react';
import {
  Camera,
  Barcode,
  Tag,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  X,
  RotateCcw,
  Upload,
  Package,
  Scale,
  Check,
  RefreshCw,
  ArrowRight,
  Edit2,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { scanBarcodeFromImageFile } from '../utils/barcodeScanner';
import { analyzeProductWithAI, getActiveGeminiApiKey } from '../utils/aiVisionScanner';
import { AiKeyConfigModal } from './AiKeyConfigModal';
import { compressImageFile } from '../utils/imageUtils';
import { generateInStoreBarcode } from '../utils/barcode';
import { playClickSound, playScanBeep, playCashRegisterChime, playErrorBuzz } from '../utils/sound';

export function TwoShotAddProductModal({ isOpen, onClose, onProductCreated }) {
  if (!isOpen) return null;

  const { products, categories, addProduct } = useStore();

  // AI Configuration Modal state
  const [isAiConfigOpen, setIsAiConfigOpen] = useState(false);
  const [hasGeminiKey, setHasGeminiKey] = useState(() => Boolean(getActiveGeminiApiKey()));
  const [aiEngineUsed, setAiEngineUsed] = useState(''); // 'gemini' | 'local_semantic' | 'local_ocr'

  // Hidden file inputs for snapping photos via device camera or file picker
  const labelInputRef = useRef(null);
  const barcodeInputRef = useRef(null);

  // Photo 1: Label state
  const [labelPhoto, setLabelPhoto] = useState(null);
  const [labelStatus, setLabelStatus] = useState('idle'); // 'idle' | 'processing' | 'success' | 'error'
  const [labelProgressText, setLabelProgressText] = useState('');
  const [labelCandidates, setLabelCandidates] = useState([]);

  // Photo 2: Barcode state
  const [barcodePhoto, setBarcodePhoto] = useState(null);
  const [barcodeStatus, setBarcodeStatus] = useState('idle'); // 'idle' | 'processing' | 'success' | 'error'
  const [barcodeErrorMsg, setBarcodeErrorMsg] = useState('');

  // Form Fields
  const [name, setName] = useState('');
  const [barcode, setBarcode] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [stock, setStock] = useState('10');
  const [unit, setUnit] = useState('ชิ้น');
  const [categoryId, setCategoryId] = useState(categories[0]?.id || 'cat_dry_food');
  const [isWeighted, setIsWeighted] = useState(false);

  // ──────────────────────────────────────────────────────────────────────────
  // Step 1: Handle Photo 1 (Label & Product Name)
  // ──────────────────────────────────────────────────────────────────────────
  const handleLabelCapture = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    playClickSound();
    setLabelStatus('processing');
    setLabelProgressText('กำลังเตรียมรูปภาพสำหรับ AI...');

    try {
      // 1. Compress image to clean, lightweight dataURL for product photo
      const compressedDataUrl = await compressImageFile(file, 600, 0.85);
      setLabelPhoto(compressedDataUrl);

      // 2. Perform AI Recognition (Gemini Multimodal Vision + Thai Semantic Fallback)
      setLabelProgressText('🤖 ส่งให้ AI วิเคราะห์ฉลากและสินค้า...');
      const aiResult = await analyzeProductWithAI(compressedDataUrl, {
        onProgress: (p) => {
          if (p.status) setLabelProgressText(p.status);
        },
      });

      if (aiResult && aiResult.name) {
        setName(aiResult.name);
        setAiEngineUsed(aiResult.aiEngine || 'local_semantic');
        setLabelCandidates(aiResult.candidates || [aiResult.name]);

        // Auto-fill category if detected
        if (aiResult.categoryId) {
          setCategoryId(aiResult.categoryId);
        }

        // Auto-fill unit if detected
        if (aiResult.unit) {
          setUnit(aiResult.unit);
        }

        // Auto-fill weighted status if detected
        if (typeof aiResult.isWeighted === 'boolean') {
          setIsWeighted(aiResult.isWeighted);
        }

        // Auto-fill suggested retail price if detected and not already set
        if (aiResult.suggestedPrice && !sellPrice) {
          setSellPrice(String(aiResult.suggestedPrice));
        }

        // Auto-fill suggested cost if detected and not already set
        if (aiResult.suggestedCost && !costPrice) {
          setCostPrice(String(aiResult.suggestedCost));
        }

        // Auto-fill barcode if detected in the first photo
        if (aiResult.barcode && !barcode) {
          setBarcode(aiResult.barcode);
          setBarcodeStatus('success');
        }

        setLabelStatus('success');
        playScanBeep();
      } else {
        setLabelStatus('success');
        setLabelProgressText('AI อ่านข้อความไม่ชัดเจน กรุณากรอกชื่อสินค้าเพิ่มเติม');
      }
    } catch (err) {
      console.error('AI Product analysis error:', err);
      setLabelStatus('error');
      setLabelProgressText('ไม่สามารถวิเคราะห์รูปได้ กรุณาพิมพ์ชื่อสินค้า');
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // Step 2: Handle Photo 2 (Barcode & Barcode Code)
  // ──────────────────────────────────────────────────────────────────────────
  const handleBarcodeCapture = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    playClickSound();
    setBarcodeStatus('processing');
    setBarcodeErrorMsg('');

    try {
      // 1. Keep preview
      const previewUrl = await compressImageFile(file, 400, 0.7);
      setBarcodePhoto(previewUrl);

      // 2. Scan barcode using multi-angle multi-engine decoder
      const detectedCode = await scanBarcodeFromImageFile(file);
      if (detectedCode) {
        setBarcode(detectedCode);
        setBarcodeStatus('success');
        playScanBeep();
      } else {
        setBarcodeStatus('error');
        setBarcodeErrorMsg('ไม่พบบาร์โค้ดในภาพ กรุณาถ่ายให้เห็นแถบบาร์โค้ดชัดเจน');
        playErrorBuzz();
      }
    } catch (err) {
      console.error('Barcode scan error:', err);
      setBarcodeStatus('error');
      setBarcodeErrorMsg('สแกนบาร์โค้ดไม่สำเร็จ กรุณาลองอีกครั้ง');
      playErrorBuzz();
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  // Quick candidate selection
  const handlePickCandidate = (text) => {
    playClickSound();
    setName(text);
  };

  // Generate internal barcode fallback if item has no barcode
  const handleAutoBarcode = () => {
    playClickSound();
    const newCode = generateInStoreBarcode(products.length + 100);
    setBarcode(newCode);
    setBarcodeStatus('success');
  };

  // Submit product creation
  const handleSaveProduct = (e) => {
    e.preventDefault();

    if (!name.trim()) {
      alert('กรุณาระบุชื่อสินค้า (หรือถ่ายรูปฉลากสินค้า)');
      return;
    }

    if (!sellPrice || parseFloat(sellPrice) <= 0) {
      alert('กรุณากรอกราคาขายสินค้า (บาท)');
      return;
    }

    playClickSound();

    const finalBarcode = barcode.trim() || generateInStoreBarcode(products.length + 1);

    const newProd = addProduct({
      name: name.trim(),
      type: isWeighted ? 'fresh' : 'packaged',
      categoryId,
      unit: isWeighted ? 'กก.' : unit,
      isWeighted,
      sellPrice: parseFloat(sellPrice) || 0,
      costPrice: parseFloat(costPrice) || 0,
      stock: parseFloat(stock) || 0,
      minStockAlert: isWeighted ? 3 : 5,
      barcode: finalBarcode,
      image: labelPhoto || null,
    });

    playCashRegisterChime();

    if (onProductCreated) {
      onProductCreated(newProd);
    }

    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content two-shot-modal animate-scale-up"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '640px' }}
      >
        {/* Hidden Camera File Inputs with capture="environment" for smartphones */}
        <input
          ref={labelInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={handleLabelCapture}
        />
        <input
          ref={barcodeInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={handleBarcodeCapture}
        />

        {/* Modal Header */}
        <div className="modal-header">
          <div className="header-info flex items-center gap-2">
            <div className="two-shot-badge-icon">
              <Sparkles size={20} className="text-white" />
            </div>
            <div>
              <h3 className="modal-title font-bold text-lg">เพิ่มสินค้าด้วยรูป 2 ช็อต (AI อัจฉริยะ)</h3>
              <p className="modal-subtitle text-xs text-muted">
                ถ่าย 1. ฉลาก (AI ดึงชื่อ+หมวดหมู่+ราคา) + 2. บาร์โค้ด (ได้รหัส)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={`btn btn-xs font-bold flex items-center gap-1.5 rounded-full px-2.5 py-1 ${
                hasGeminiKey
                  ? 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100'
                  : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
              }`}
              onClick={() => setIsAiConfigOpen(true)}
              title="คลิกเพื่อตั้งค่า Google Gemini AI ฟรี"
            >
              <Sparkles size={13} className={hasGeminiKey ? 'text-blue-600' : 'text-amber-600'} />
              <span>{hasGeminiKey ? '🤖 Gemini AI พร้อมใช้' : '✨ เชื่อมต่อ Gemini AI ฟรี'}</span>
            </button>
            <button type="button" className="icon-btn close-btn" onClick={onClose}>
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="two-shot-body">
          {/* Tip Banner if Gemini Key is not configured yet */}
          {!hasGeminiKey && (
            <div
              className="p-2.5 mb-3 rounded-xl flex items-center justify-between gap-2 text-xs"
              style={{
                background: 'linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%)',
                border: '1px solid #bfdbfe',
              }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Sparkles size={16} className="text-blue-600 shrink-0" />
                <span className="text-blue-900 font-medium truncate">
                  💡 เชื่อมต่อ Google Gemini AI ฟรี เพื่อให้อ่านชื่อ ฉลาก แบรนด์ และราคาได้แม่นยำ 100%
                </span>
              </div>
              <button
                type="button"
                className="btn btn-primary btn-xs font-bold shrink-0 shadow-sm"
                onClick={() => setIsAiConfigOpen(true)}
              >
                ตั้งค่า AI ฟรี (30 วิ)
              </button>
            </div>
          )}

          {/* Top 2 Photo Cards */}
          <div className="two-shot-grid">
            {/* 1. Label Photo Card */}
            <div className={`shot-card ${labelStatus === 'success' ? 'card-done' : ''}`}>
              <div className="shot-card-header">
                <span className="shot-number-badge">รูปที่ 1</span>
                <span className="shot-title">ฉลาก/ตัวสินค้า (AI ดึงชื่อ+หมวด+ราคา)</span>
              </div>

              <div
                className="shot-preview-area"
                onClick={() => labelInputRef.current?.click()}
                title="กดเพื่อเปิดกล้องถ่ายฉลากสินค้า"
              >
                {labelPhoto ? (
                  <div className="shot-image-wrap">
                    <img src={labelPhoto} alt="ฉลากสินค้า" className="shot-preview-img" />
                    <button
                      type="button"
                      className="btn-retake-photo"
                      onClick={(e) => {
                        e.stopPropagation();
                        labelInputRef.current?.click();
                      }}
                    >
                      <RotateCcw size={13} />
                      <span>ถ่ายใหม่</span>
                    </button>
                  </div>
                ) : (
                  <div className="shot-placeholder">
                    <div className="shot-icon-circle primary">
                      <Camera size={26} />
                    </div>
                    <span className="shot-action-text font-bold">แตะเพื่อถ่ายรูปฉลาก</span>
                    <small className="text-xs text-muted">หน้าซอง / กล่อง เพื่อดึงชื่อสินค้า</small>
                  </div>
                )}
              </div>

              {/* Status footer for Shot 1 */}
              <div className="shot-status-bar">
                {labelStatus === 'processing' && (
                  <div className="status-pill status-loading">
                    <RefreshCw size={13} className="animate-spin" />
                    <span>{labelProgressText || 'กำลังอ่านตัวหนังสือ...'}</span>
                  </div>
                )}
                {labelStatus === 'success' && (
                  <div className="status-pill status-success flex items-center justify-between w-full">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <CheckCircle2 size={13} className="shrink-0" />
                      <span className="truncate">
                        {aiEngineUsed === 'gemini'
                          ? '🤖 Gemini AI ระบุชื่อ หมวดหมู่ และราคาสำเร็จ'
                          : '✨ AI ระบุชื่อและหมวดหมู่สินค้าสำเร็จ'}
                      </span>
                    </div>
                    {!hasGeminiKey && (
                      <button
                        type="button"
                        className="text-xs text-primary underline font-bold shrink-0 ml-1"
                        onClick={() => setIsAiConfigOpen(true)}
                      >
                        เปิดโหมด Gemini AI ฟรี
                      </button>
                    )}
                  </div>
                )}
                {labelStatus === 'error' && (
                  <div className="status-pill status-error">
                    <AlertCircle size={13} />
                    <span>{labelProgressText}</span>
                  </div>
                )}
                {labelStatus === 'idle' && (
                  <span className="text-xs text-muted">รอถ่ายรูปฉลากสินค้า</span>
                )}
              </div>
            </div>

            {/* 2. Barcode Photo Card */}
            <div className={`shot-card ${barcodeStatus === 'success' ? 'card-done' : ''}`}>
              <div className="shot-card-header">
                <span className="shot-number-badge secondary">รูปที่ 2</span>
                <span className="shot-title">บาร์โค้ด (หารหัส)</span>
              </div>

              <div
                className="shot-preview-area"
                onClick={() => barcodeInputRef.current?.click()}
                title="กดเพื่อเปิดกล้องถ่ายแถบบาร์โค้ด"
              >
                {barcodePhoto ? (
                  <div className="shot-image-wrap">
                    <img src={barcodePhoto} alt="บาร์โค้ด" className="shot-preview-img" />
                    <button
                      type="button"
                      className="btn-retake-photo"
                      onClick={(e) => {
                        e.stopPropagation();
                        barcodeInputRef.current?.click();
                      }}
                    >
                      <RotateCcw size={13} />
                      <span>ถ่ายใหม่</span>
                    </button>
                  </div>
                ) : (
                  <div className="shot-placeholder">
                    <div className="shot-icon-circle accent">
                      <Barcode size={26} />
                    </div>
                    <span className="shot-action-text font-bold">แตะเพื่อถ่ายบาร์โค้ด</span>
                    <small className="text-xs text-muted">ส่องแถบบาร์โค้ดเพื่อดึงตัวเลข</small>
                  </div>
                )}
              </div>

              {/* Status footer for Shot 2 */}
              <div className="shot-status-bar">
                {barcodeStatus === 'processing' && (
                  <div className="status-pill status-loading">
                    <RefreshCw size={13} className="animate-spin" />
                    <span>กำลังตรวจจับแถบบาร์โค้ด...</span>
                  </div>
                )}
                {barcodeStatus === 'success' && (
                  <div className="status-pill status-success">
                    <CheckCircle2 size={13} />
                    <span>พบบาร์โค้ด: {barcode}</span>
                  </div>
                )}
                {barcodeStatus === 'error' && (
                  <div className="status-pill status-error">
                    <AlertCircle size={13} />
                    <span>{barcodeErrorMsg}</span>
                  </div>
                )}
                {barcodeStatus === 'idle' && (
                  <span className="text-xs text-muted">รอถ่ายรูปบาร์โค้ด</span>
                )}
              </div>
            </div>
          </div>

          {/* Form Fields Section */}
          <form onSubmit={handleSaveProduct} className="two-shot-form mt-3">
            {/* 1. Product Name Input */}
            <div className="form-group mb-2">
              <div className="flex items-center justify-between mb-1">
                <label className="form-label font-bold text-sm mb-0">
                  1. ชื่อสินค้า (ได้จากรูปที่ 1): *
                </label>
                {name && <span className="text-xs text-success font-medium">✓ มีชื่อแล้ว</span>}
              </div>
              <input
                type="text"
                className="form-control"
                placeholder="ชื่อสินค้า เช่น มาม่า ต้มยำกุ้ง, เลย์ รสโนริสาหร่าย"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />

              {/* Candidate Chips from OCR */}
              {labelCandidates.length > 1 && (
                <div className="ocr-candidates-group mt-1">
                  <span className="candidates-label text-xs text-muted">คำอื่นที่ตรวจพบบนฉลาก:</span>
                  <div className="candidates-chips">
                    {labelCandidates.slice(0, 5).map((cand, idx) => (
                      <button
                        key={idx}
                        type="button"
                        className={`cand-chip ${name === cand ? 'active' : ''}`}
                        onClick={() => handlePickCandidate(cand)}
                      >
                        {cand}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 2. Barcode Field */}
            <div className="form-group mb-2">
              <div className="flex items-center justify-between mb-1">
                <label className="form-label font-bold text-sm mb-0">
                  2. รหัสบาร์โค้ด (ได้จากรูปที่ 2):
                </label>
                <button
                  type="button"
                  className="btn-link-action text-xs text-accent"
                  onClick={handleAutoBarcode}
                >
                  ไม่มีบาร์โค้ด? สุ่มรหัสอัตโนมัติ
                </button>
              </div>
              <div className="input-with-button-wrap">
                <input
                  type="text"
                  className="form-control font-mono font-bold"
                  placeholder="รหัสบาร์โค้ด เช่น 8850123456789"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => barcodeInputRef.current?.click()}
                  title="ถ่ายรูปบาร์โค้ดใหม่"
                >
                  <Camera size={14} />
                  <span>ถ่ายใหม่</span>
                </button>
              </div>
            </div>

            {/* 3. Sell Price & Cost Price */}
            <div className="form-row mb-2">
              <div className="form-group flex-1">
                <label className="form-label font-bold text-sm">3. ราคาขาย (บาท) *:</label>
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
                <label className="form-label font-medium text-sm">ราคาทุน (ถ้ามี):</label>
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
              </div>
            </div>

            {/* 4. Category & Stock */}
            <div className="form-row mb-3">
              <div className="form-group flex-1">
                <label className="form-label text-xs">หมวดหมู่สินค้า:</label>
                <select
                  className="form-control form-control-sm"
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

              <div className="form-group flex-1">
                <label className="form-label text-xs">จำนวนเริ่มต้นในร้าน:</label>
                <div className="flex gap-1 items-center">
                  <input
                    type="number"
                    min="0"
                    className="form-control form-control-sm"
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                  />
                  <span className="text-xs text-muted">{isWeighted ? 'กก.' : 'ชิ้น'}</span>
                </div>
              </div>

              <div className="form-group flex-1">
                <label className="form-label text-xs">ชนิดสินค้า:</label>
                <div className="flex gap-1">
                  <button
                    type="button"
                    className={`btn btn-sm flex-1 ${!isWeighted ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => {
                      setIsWeighted(false);
                      setUnit('ชิ้น');
                    }}
                  >
                    นับชิ้น
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm flex-1 ${isWeighted ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => {
                      setIsWeighted(true);
                      setUnit('กก.');
                    }}
                  >
                    ชั่ง นน.
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="modal-actions mt-3">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                ยกเลิก
              </button>
              <button
                type="submit"
                className="btn btn-success btn-large flex-1 font-bold"
                disabled={!name.trim() || !sellPrice}
              >
                <CheckCircle2 size={20} />
                <span>บันทึกสินค้าใหม่ทันที</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Google Gemini AI Vision Configuration Modal */}
      <AiKeyConfigModal
        isOpen={isAiConfigOpen}
        onClose={() => setIsAiConfigOpen(false)}
        onKeySaved={(k) => setHasGeminiKey(Boolean(k))}
      />
    </div>
  );
}
