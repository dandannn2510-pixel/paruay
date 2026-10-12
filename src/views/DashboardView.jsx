import React, { useState } from 'react';
import {
  TrendingUp,
  AlertTriangle,
  PackageX,
  Clock,
  ShoppingCart,
  PlusCircle,
  FileText,
  Copy,
  Check,
  ArrowRight,
  Sparkles,
  Layers,
  Banknote,
  QrCode,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { playClickSound } from '../utils/sound';

export function DashboardView({ onNavigate }) {
  const { products, salesHistory, activeShift } = useStore();
  const [copiedPo, setCopiedPo] = useState(false);

  // Today's sales calculation
  const todayStr = new Date().toISOString().slice(0, 10);
  const todaySales = salesHistory.filter((s) => s.createdAt.slice(0, 10) === todayStr);

  const todayRevenue = todaySales.reduce((sum, s) => sum + s.total, 0);
  const todayCash = todaySales
    .filter((s) => s.paymentMethod === 'cash')
    .reduce((sum, s) => sum + s.total, 0);
  const todayPromptpay = todaySales
    .filter((s) => s.paymentMethod === 'promptpay')
    .reduce((sum, s) => sum + s.total, 0);
  const todayBillCount = todaySales.length;

  // Inventory alert status
  const outOfStockProducts = products.filter((p) => p.active && p.stock <= 0);
  const lowStockProducts = products.filter(
    (p) => p.active && p.stock > 0 && p.stock <= p.minStockAlert
  );
  const freshProduceProducts = products.filter(
    (p) => p.active && (p.type === 'fresh' || p.isWeighted)
  );

  // Generate Purchase Order list text to copy for wholesale store
  const handleCopyPoList = () => {
    playClickSound();
    const needed = [...outOfStockProducts, ...lowStockProducts];
    if (needed.length === 0) {
      alert('ยินดีด้วย! ไม่มีสินค้าที่ต้องสั่งซื้อเพิ่มเติมในขณะนี้');
      return;
    }

    let poText = `📋 รายการสั่งซื้อของเข้าร้าน (${new Date().toLocaleDateString('th-TH')})\n`;
    poText += `------------------------------------\n`;
    needed.forEach((item, index) => {
      const status = item.stock <= 0 ? 'หมดสต็อก' : `เหลือ ${item.stock} ${item.unit}`;
      poText += `${index + 1}. ${item.name} (${status}) [บาร์โค้ด: ${item.barcode || '-'}]\n`;
    });
    poText += `------------------------------------\n`;
    poText += `รวมทั้งหมด ${needed.length} รายการ`;

    navigator.clipboard.writeText(poText);
    setCopiedPo(true);
    setTimeout(() => setCopiedPo(false), 2000);
  };

  return (
    <div className="dashboard-layout animate-fade-in">
      {/* Top Welcome & Shift Banner */}
      <div className="dashboard-hero">
        <div className="hero-text">
          <h2>📊 ภาพรวมร้านและการแจ้งเตือนสต็อก</h2>
          <p className="hero-subtitle">
            {activeShift
              ? `กะเปิดอยู่โดย ${activeShift.cashierName} (เงินทอนตั้งต้น ${activeShift.startCash} บาท)`
              : 'สถานะ: ยังไม่ได้เปิดกะ'}
          </p>
        </div>
        <div className="hero-actions">
          <button
            type="button"
            className="btn btn-primary btn-large font-bold"
            onClick={() => onNavigate('pos')}
          >
            <ShoppingCart size={20} />
            <span>ไปที่หน้าขาย (POS)</span>
          </button>
        </div>
      </div>

      {/* Sales Summary Metric Cards */}
      <div className="metrics-grid">
        <div className="metric-card card-revenue">
          <div className="metric-icon-wrap">
            <TrendingUp size={24} />
          </div>
          <div className="metric-info">
            <span className="metric-label">ยอดขายวันนี้</span>
            <h3 className="metric-number">
              {todayRevenue.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
              <small> บาท</small>
            </h3>
            <span className="metric-meta">จำนวน {todayBillCount} บิล</span>
          </div>
        </div>

        <div className="metric-card card-cash">
          <div className="metric-icon-wrap">
            <Banknote size={24} />
          </div>
          <div className="metric-info">
            <span className="metric-label">เงินสดรับวันนี้</span>
            <h3 className="metric-number">
              {todayCash.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
              <small> บาท</small>
            </h3>
            <span className="metric-meta">ในลิ้นชักคิดเงิน</span>
          </div>
        </div>

        <div className="metric-card card-promptpay">
          <div className="metric-icon-wrap">
            <QrCode size={24} />
          </div>
          <div className="metric-info">
            <span className="metric-label">โอนพร้อมเพย์</span>
            <h3 className="metric-number">
              {todayPromptpay.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
              <small> บาท</small>
            </h3>
            <span className="metric-meta">เข้าบัญชีธนาคาร</span>
          </div>
        </div>

        <div className="metric-card card-alerts">
          <div className="metric-icon-wrap">
            <AlertTriangle size={24} />
          </div>
          <div className="metric-info">
            <span className="metric-label">สินค้าเตือนสต็อก</span>
            <h3 className="metric-number text-danger">
              {outOfStockProducts.length + lowStockProducts.length}
              <small> รายการ</small>
            </h3>
            <span className="metric-meta">
              (หมด {outOfStockProducts.length} / ใกล้หมด {lowStockProducts.length})
            </span>
          </div>
        </div>
      </div>

      {/* Stock Alerts & Quick Order Section */}
      <div className="dashboard-sections-grid">
        {/* Out of Stock & Low Stock Items */}
        <div className="dashboard-panel alert-panel">
          <div className="panel-header">
            <div className="flex items-center gap-2">
              <PackageX className="text-danger" size={22} />
              <h3>รายการสินค้าที่หมดและใกล้หมดสต็อก</h3>
            </div>
            <button
              type="button"
              className="btn btn-outline-primary btn-sm"
              onClick={handleCopyPoList}
              title="คัดลอกรายการสำหรับส่งสั่งของที่แม็คโครหรือตลาดสด"
            >
              {copiedPo ? <Check size={16} className="text-success" /> : <Copy size={16} />}
              <span>{copiedPo ? 'คัดลอกเรียบร้อย!' : 'สร้างรายการสั่งของ'}</span>
            </button>
          </div>

          <div className="panel-body">
            {outOfStockProducts.length === 0 && lowStockProducts.length === 0 ? (
              <div className="empty-alert-message">
                <Check size={32} className="text-success" />
                <p>สินค้าในร้านเพียงพอ ไม่มีรายการหมดหรือใกล้หมดสต็อก</p>
              </div>
            ) : (
              <div className="alert-items-list">
                {/* Out of Stock (Red) */}
                {outOfStockProducts.map((p) => (
                  <div key={p.id} className="alert-item-card out-of-stock-border">
                    <div className="alert-item-title">
                      <span className="emoji-chip">{p.image || '📦'}</span>
                      <div>
                        <strong>{p.name}</strong>
                        <div className="text-muted text-xs font-mono">{p.barcode || 'ไม่มีบาร์โค้ด'}</div>
                      </div>
                    </div>
                    <div className="alert-item-badge">
                      <span className="badge-tag tag-out">หมดสต็อก (0 {p.unit})</span>
                      <button
                        type="button"
                        className="btn btn-sm btn-primary ml-2"
                        onClick={() => onNavigate('restock')}
                      >
                        รับเข้า
                      </button>
                    </div>
                  </div>
                ))}

                {/* Low Stock (Yellow) */}
                {lowStockProducts.map((p) => (
                  <div key={p.id} className="alert-item-card low-stock-border">
                    <div className="alert-item-title">
                      <span className="emoji-chip">{p.image || '📦'}</span>
                      <div>
                        <strong>{p.name}</strong>
                        <div className="text-muted text-xs font-mono">{p.barcode || 'ไม่มีบาร์โค้ด'}</div>
                      </div>
                    </div>
                    <div className="alert-item-badge">
                      <span className="badge-tag tag-low">
                        เหลือ {p.isWeighted ? p.stock.toFixed(3) : p.stock} {p.unit} (จุดเตือน {p.minStockAlert})
                      </span>
                      <button
                        type="button"
                        className="btn btn-sm btn-primary ml-2"
                        onClick={() => onNavigate('restock')}
                      >
                        รับเข้า
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Fresh Produce & Meat Monitor */}
        <div className="dashboard-panel fresh-panel">
          <div className="panel-header">
            <div className="flex items-center gap-2">
              <Sparkles className="text-accent" size={22} />
              <h3>ของสด & เนื้อสัตว์ & ผัก (ตรวจสอบความสด)</h3>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => onNavigate('inventory')}
            >
              ดูสต็อกทั้งหมด <ArrowRight size={16} />
            </button>
          </div>

          <div className="panel-body">
            <div className="fresh-items-list">
              {freshProduceProducts.slice(0, 6).map((item) => (
                <div key={item.id} className="fresh-item-card">
                  <div className="flex items-center gap-3">
                    <span className="fresh-emoji">{item.image || '🥩'}</span>
                    <div>
                      <h4 className="font-medium">{item.name}</h4>
                      <p className="text-xs text-muted">
                        ราคาขาย: <strong>{item.sellPrice.toFixed(2)} ฿/{item.unit}</strong>
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-accent">
                      {item.isWeighted ? `${item.stock.toFixed(3)} กก.` : `${item.stock} ${item.unit}`}
                    </span>
                    <p className="text-xs text-muted">
                      เตือนหมดอายุ: {item.expiryDaysAlert || 2} วัน
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Navigation Action Grid */}
      <div className="dashboard-shortcuts-grid">
        <button
          type="button"
          className="shortcut-card"
          onClick={() => onNavigate('pos')}
        >
          <ShoppingCart size={24} className="text-primary" />
          <span className="shortcut-title">หน้าขาย (POS)</span>
          <span className="shortcut-desc">ยิงบาร์โค้ด & ชั่งน้ำหนัก</span>
        </button>

        <button
          type="button"
          className="shortcut-card"
          onClick={() => onNavigate('restock')}
        >
          <PlusCircle size={24} className="text-success" />
          <span className="shortcut-title">รับของเข้าสต็อก</span>
          <span className="shortcut-desc">เติมสินค้า & ปรับราคาทุน</span>
        </button>

        <button
          type="button"
          className="shortcut-card"
          onClick={() => onNavigate('stockAudit')}
        >
          <Layers size={24} className="text-warning" />
          <span className="shortcut-title">นับสต็อกบนชั้น</span>
          <span className="shortcut-desc">ตรวจนับของจริง & ปรับยอด</span>
        </button>

        <button
          type="button"
          className="shortcut-card"
          onClick={() => onNavigate('reports')}
        >
          <FileText size={24} className="text-info" />
          <span className="shortcut-title">รายงาน & ปิดกะ</span>
          <span className="shortcut-desc">นับเงินลิ้นชัก & ตรวจยอด</span>
        </button>
      </div>
    </div>
  );
}
