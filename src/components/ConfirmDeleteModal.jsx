import React, { useState } from 'react';
import {
  Trash2,
  AlertTriangle,
  X,
  EyeOff,
  Eye,
  CheckCircle2,
  Package,
  Layers,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { ProductThumbnail } from './ProductThumbnail';
import { playClickSound, playCashRegisterChime, playErrorBuzz } from '../utils/sound';

export function ConfirmDeleteModal({
  product,
  isOpen,
  onClose,
  onDeleted,
  onToggledActive,
}) {
  if (!isOpen || !product) return null;

  const { deleteProduct, toggleProductActive, categories } = useStore();
  const [isDeleting, setIsDeleting] = useState(false);

  const stockVal = Number(product.stock) || 0;
  const isDiscontinued = product.active === false;
  const categoryName =
    categories?.find((c) => c.id === product.categoryId)?.name || 'ทั่วไป';

  const handleDiscontinue = () => {
    playClickSound();
    const nextActive = toggleProductActive(product.id);
    if (onToggledActive) {
      onToggledActive(product, nextActive);
    }
    onClose();
  };

  const handlePermanentDelete = async () => {
    try {
      setIsDeleting(true);
      playClickSound();
      const success = await deleteProduct(product.id);
      if (success) {
        playCashRegisterChime();
        if (onDeleted) {
          onDeleted(product);
        }
        onClose();
      }
    } catch (err) {
      console.error('Failed to permanently delete product:', err);
      playErrorBuzz();
      alert('เกิดข้อผิดพลาดในการลบสินค้า กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
      <div
        className="modal-content animate-scale-up"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 520,
          borderRadius: 16,
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          border: '1px solid var(--border-color)',
        }}
      >
        {/* Header with Warning Style */}
        <div
          className="modal-header"
          style={{
            background: 'linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%)',
            borderBottom: '1px solid #fecdd3',
            padding: '16px 20px',
          }}
        >
          <div className="header-info flex items-center gap-3">
            <div
              className="brand-logo-wrap flex items-center justify-center rounded-full"
              style={{
                width: 42,
                height: 42,
                background: '#e11d48',
                color: '#fff',
                boxShadow: '0 4px 10px rgba(225, 29, 72, 0.3)',
              }}
            >
              <Trash2 size={22} />
            </div>
            <div>
              <h3 className="modal-title text-lg font-bold" style={{ color: '#9f1239' }}>
                จัดการหรือลบสินค้าออกจากระบบ
              </h3>
              <p className="modal-subtitle text-xs" style={{ color: '#be123c' }}>
                เลือกระหว่าง "พักการจำหน่าย" หรือ "ลบออกจากระบบถาวร"
              </p>
            </div>
          </div>
          <button
            type="button"
            className="icon-btn close-btn"
            onClick={onClose}
            title="ปิด"
            disabled={isDeleting}
          >
            <X size={20} />
          </button>
        </div>

        <div className="modal-form-body p-4" style={{ background: 'var(--bg-surface)' }}>
          {/* Target Product Summary Card */}
          <div
            className="flex items-center gap-3 p-3 mb-4 rounded-xl"
            style={{
              background: 'var(--bg-surface-elevated, #f8fafc)',
              border: '1px solid var(--border-color, #e2e8f0)',
            }}
          >
            <ProductThumbnail product={product} size={64} style={{ borderRadius: 10 }} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="badge-tag tag-discrete text-xs">{categoryName}</span>
                {isDiscontinued && (
                  <span className="badge-tag status-error text-xs">⏸️ เลิกขายอยู่</span>
                )}
              </div>
              <strong className="block text-base truncate font-bold text-gray-900">
                {product.name}
              </strong>
              <div className="flex items-center gap-3 text-xs text-muted mt-0.5 font-mono">
                <span>บาร์โค้ด: {product.barcode || 'ไม่มี'}</span>
                <span>•</span>
                <span>
                  ราคา: {(Number(product.sellPrice) || 0).toFixed(2)} ฿ / {product.unit}
                </span>
              </div>
            </div>
          </div>

          {/* Stock Warning Notice if Stock > 0 */}
          {stockVal > 0 && (
            <div
              className="p-3 mb-4 rounded-xl flex items-start gap-2.5 text-xs font-medium"
              style={{
                background: '#fffbeb',
                border: '1px solid #fde68a',
                color: '#92400e',
              }}
            >
              <AlertTriangle size={18} className="shrink-0 mt-0.5 text-amber-600" />
              <div>
                <strong className="block font-bold">
                  ยังมีสินค้าคงเหลือในคลัง {product.isWeighted ? stockVal.toFixed(3) : stockVal}{' '}
                  {product.unit}
                </strong>
                <span>
                  หากต้องการระงับการขายชั่วคราว แนะนำให้กด <b>"พักการจำหน่าย"</b>{' '}
                  เพื่อเก็บยอดสต็อกและประวัติการขายเดิมไว้
                </span>
              </div>
            </div>
          )}

          {/* Option 1: Soft Delete / Discontinue (RECOMMENDED) */}
          <div
            className="p-3.5 mb-3 rounded-xl transition-all"
            style={{
              background: '#f8fafc',
              border: '1.5px solid #cbd5e1',
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-gray-800">
                    {isDiscontinued ? '🟢 นำกลับมาเปิดขายใหม่' : '⏸️ พักการจำหน่าย / เลิกขาย'}
                  </span>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-bold"
                    style={{ background: '#dbeafe', color: '#1e40af' }}
                  >
                    แนะนำ
                  </span>
                </div>
                <p className="text-xs text-muted mt-1 leading-relaxed">
                  {isDiscontinued
                    ? 'เปิดสินค้าให้กลับมาแสดงที่หน้าแคชเชียร์ขายหน้าร้านอีกครั้ง'
                    : 'ซ่อนสินค้าจากหน้าแคชเชียร์ขายหน้าร้านทันที ไม่รกสายตา แต่ประวัติบิลเดิมและสต็อกยังอยู่ครบถ้วน'}
                </p>
              </div>
              <button
                type="button"
                className={`btn btn-sm shrink-0 font-bold ${
                  isDiscontinued ? 'btn-success' : 'btn-secondary text-amber-800'
                }`}
                onClick={handleDiscontinue}
                disabled={isDeleting}
              >
                {isDiscontinued ? (
                  <>
                    <Eye size={15} />
                    <span>เปิดขายอีกครั้ง</span>
                  </>
                ) : (
                  <>
                    <EyeOff size={15} />
                    <span>พักการจำหน่าย</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Option 2: Hard Delete Permanently */}
          <div
            className="p-3.5 rounded-xl transition-all"
            style={{
              background: '#fff1f2',
              border: '1.5px solid #fecdd3',
            }}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <span className="font-bold text-sm text-danger flex items-center gap-1.5">
                  <ShieldAlert size={16} /> ลบออกจากระบบถาวร (ลบเด็ดขาด)
                </span>
                <p className="text-xs text-rose-800 mt-1 leading-relaxed">
                  ลบสินค้าออกจากฐานข้อมูล คลังสินค้า และระบบคลาวด์ Supabase ถาวรทันที
                  สินค้าจะหายไปทันทีและไม่สามารถกู้คืนได้
                </p>
              </div>
            </div>
            <div className="pt-2 flex justify-end" style={{ borderTop: '1px dashed #fecdd3' }}>
              <button
                type="button"
                className="btn btn-danger btn-sm font-bold w-full flex items-center justify-center gap-1.5 shadow-sm"
                onClick={handlePermanentDelete}
                disabled={isDeleting}
              >
                <Trash2 size={15} />
                <span>
                  {isDeleting ? 'กำลังลบสินค้า...' : 'ยืนยันลบสินค้าออกจากระบบถาวร'}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div
          className="modal-actions p-3"
          style={{
            borderTop: '1px solid var(--border-color)',
            background: 'var(--bg-surface-elevated, #f8fafc)',
          }}
        >
          <button
            type="button"
            className="btn btn-secondary w-full font-bold"
            onClick={onClose}
            disabled={isDeleting}
          >
            ยกเลิก / ไม่ทำรายการ
          </button>
        </div>
      </div>
    </div>
  );
}
