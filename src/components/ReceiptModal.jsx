import React, { useRef } from 'react';
import { Printer, Copy, Check, X, Share2 } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { playClickSound } from '../utils/sound';

export function ReceiptModal({ sale, isOpen, onClose }) {
  if (!isOpen || !sale) return null;

  const { settings } = useStore();
  const [copied, setCopied] = React.useState(false);
  const printAreaRef = useRef(null);

  const formattedDate = new Date(sale.createdAt).toLocaleString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const handlePrint = () => {
    playClickSound();
    window.print();
  };

  const handleCopyText = () => {
    playClickSound();
    let text = `=== ${settings.shopName} ===\n`;
    text += `${settings.shopAddress}\n`;
    text += `โทร: ${settings.shopPhone}\n`;
    text += `--------------------------------\n`;
    text += `เลขที่บิล: ${sale.billNumber}\n`;
    text += `วันที่: ${formattedDate}\n`;
    text += `แคชเชียร์: ${sale.cashierName}\n`;
    text += `--------------------------------\n`;
    sale.items.forEach((item) => {
      if (item.isWeighted) {
        text += `${item.name}\n  ${item.qty.toFixed(3)} กก. x ${item.sellPrice.toFixed(2)} = ${item.subtotal.toFixed(2)} บ.\n`;
      } else {
        text += `${item.name}\n  ${item.qty} ${item.unit} x ${item.sellPrice.toFixed(2)} = ${item.subtotal.toFixed(2)} บ.\n`;
      }
    });
    text += `--------------------------------\n`;
    if (sale.discount > 0) {
      text += `ส่วนลด: -${sale.discount.toFixed(2)} บ.\n`;
    }
    text += `ยอดรวมสุทธิ: ${sale.total.toFixed(2)} บ.\n`;
    text += `ชำระโดย: ${sale.paymentMethod === 'cash' ? 'เงินสด' : 'พร้อมเพย์'}\n`;
    if (sale.paymentMethod === 'cash') {
      text += `รับเงินมา: ${sale.cashReceived.toFixed(2)} บ.\n`;
      text += `เงินทอน: ${sale.change.toFixed(2)} บ.\n`;
    }
    text += `================================\n`;
    text += `${settings.receiptFooter || 'ขอบคุณที่อุดหนุน'}\n`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content receipt-modal animate-scale-up" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="header-info">
            <Printer className="text-primary" size={24} />
            <div>
              <h3 className="modal-title">ใบเสร็จรับเงิน</h3>
              <p className="modal-subtitle">เลขที่ {sale.billNumber}</p>
            </div>
          </div>
          <button className="icon-btn close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Realistic Thermal Receipt Slip */}
        <div className="thermal-slip-wrapper">
          <div className="thermal-slip" ref={printAreaRef} id="printable-receipt">
            <div className="slip-header">
              <h4 className="slip-shop-name">{settings.shopName}</h4>
              <p className="slip-meta">{settings.shopAddress}</p>
              <p className="slip-meta">โทร. {settings.shopPhone}</p>
              <p className="slip-meta">พร้อมเพย์: {settings.promptpayId}</p>
              <div className="slip-divider dashed"></div>
              <div className="slip-meta-row">
                <span>บิล: {sale.billNumber}</span>
                <span>{formattedDate}</span>
              </div>
              <div className="slip-meta-row">
                <span>แคชเชียร์: {sale.cashierName}</span>
                <span>สถานะ: ชำระแล้ว</span>
              </div>
              <div className="slip-divider dashed"></div>
            </div>

            {/* Items List */}
            <div className="slip-items">
              <div className="slip-item-header">
                <span className="col-desc">รายการ</span>
                <span className="col-qty">จำนวน</span>
                <span className="col-price">รวม</span>
              </div>
              {sale.items.map((item, idx) => (
                <div key={idx} className="slip-item-row">
                  <div className="item-name-line">
                    <span className="item-title">{item.name}</span>
                  </div>
                  <div className="item-detail-line">
                    <span className="col-desc text-muted">
                      @{item.sellPrice.toFixed(2)}
                    </span>
                    <span className="col-qty">
                      {item.isWeighted ? `${item.qty.toFixed(3)} กก.` : `${item.qty} ${item.unit}`}
                    </span>
                    <span className="col-price">{item.subtotal.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="slip-divider dashed"></div>

            {/* Totals */}
            <div className="slip-totals">
              <div className="slip-total-row">
                <span>ยอดรวมสินค้า:</span>
                <span>{sale.subtotal.toFixed(2)} ฿</span>
              </div>
              {sale.discount > 0 && (
                <div className="slip-total-row text-danger">
                  <span>ส่วนลด:</span>
                  <span>-{sale.discount.toFixed(2)} ฿</span>
                </div>
              )}
              <div className="slip-total-row grand-total">
                <strong>ยอดสุทธิ:</strong>
                <strong>{sale.total.toFixed(2)} ฿</strong>
              </div>
              <div className="slip-total-row">
                <span>วิธีชำระ:</span>
                <span>{sale.paymentMethod === 'cash' ? 'เงินสด' : 'QR พร้อมเพย์'}</span>
              </div>
              {sale.paymentMethod === 'cash' && (
                <>
                  <div className="slip-total-row">
                    <span>รับเงินมา:</span>
                    <span>{sale.cashReceived.toFixed(2)} ฿</span>
                  </div>
                  <div className="slip-total-row">
                    <span>เงินทอน:</span>
                    <span>{sale.change.toFixed(2)} ฿</span>
                  </div>
                </>
              )}
            </div>

            <div className="slip-divider dashed"></div>

            <div className="slip-footer">
              <p>{settings.receiptHeader || 'ยินดีต้อนรับ'}</p>
              <p>{settings.receiptFooter || 'ขอบคุณที่อุดหนุน'}</p>
              <p className="slip-barcode font-mono">*{sale.billNumber}*</p>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={handleCopyText}>
            {copied ? <Check size={18} className="text-success" /> : <Copy size={18} />}
            <span>{copied ? 'คัดลอกแล้ว!' : 'คัดลอกข้อความ'}</span>
          </button>
          <button type="button" className="btn btn-primary btn-large flex-1" onClick={handlePrint}>
            <Printer size={18} />
            <span>พิมพ์ใบเสร็จ (Print Slip)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
