import React from 'react';
import { PauseCircle, PlayCircle, Trash2, X, Clock, ShoppingCart } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { playClickSound } from '../utils/sound';

export function ParkedBillsModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  const { parkedBills, restoreParkedBill, deleteParkedBill } = useStore();

  const handleRestore = (id) => {
    playClickSound();
    restoreParkedBill(id);
    onClose();
  };

  const handleDelete = (id) => {
    if (confirm('ต้องการลบบิลพักนี้ทิ้งใช่หรือไม่?')) {
      playClickSound();
      deleteParkedBill(id);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content parked-modal animate-scale-up" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="header-info">
            <PauseCircle className="text-warning" size={24} />
            <div>
              <h3 className="modal-title">รายการบิลที่พักไว้ ({parkedBills.length} บิล)</h3>
              <p className="modal-subtitle">เลือกลูกค้าที่ต้องการเรียกคืนบิลกลับมาคิดเงินต่อ</p>
            </div>
          </div>
          <button className="icon-btn close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* List */}
        <div className="parked-list-container">
          {parkedBills.length === 0 ? (
            <div className="empty-state">
              <ShoppingCart size={40} className="text-muted" />
              <p>ไม่มีบิลที่พักไว้ในขณะนี้</p>
            </div>
          ) : (
            <div className="parked-cards-grid">
              {parkedBills.map((bill) => {
                const timeStr = new Date(bill.createdAt).toLocaleTimeString('th-TH', {
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <div key={bill.id} className="parked-bill-card">
                    <div className="parked-card-header">
                      <span className="parked-time">
                        <Clock size={14} /> พักเมื่อ {timeStr}
                      </span>
                      <span className="parked-total">{bill.total.toFixed(2)} บาท</span>
                    </div>

                    <div className="parked-note font-medium">{bill.note}</div>

                    <div className="parked-items-preview">
                      {bill.items.slice(0, 3).map((it, idx) => (
                        <span key={idx} className="preview-chip">
                          {it.name} (x{it.qty})
                        </span>
                      ))}
                      {bill.items.length > 3 && (
                        <span className="preview-chip more">+{bill.items.length - 3} อื่นๆ</span>
                      )}
                    </div>

                    <div className="parked-card-actions">
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(bill.id)}
                        title="ลบทิ้ง"
                      >
                        <Trash2 size={16} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-success btn-sm flex-1 font-bold"
                        onClick={() => handleRestore(bill.id)}
                      >
                        <PlayCircle size={16} />
                        <span>เรียกคืนบิลนี้</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn-secondary w-full" onClick={onClose}>
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
}
