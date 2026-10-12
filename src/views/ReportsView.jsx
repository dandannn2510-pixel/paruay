import React, { useState } from 'react';
import {
  FileText,
  Calendar,
  DollarSign,
  TrendingUp,
  Download,
  Printer,
  Lock,
  Unlock,
  AlertCircle,
  CheckCircle2,
  Banknote,
  QrCode,
  Layers,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { ReceiptModal } from '../components/ReceiptModal';
import { playClickSound, playCashRegisterChime } from '../utils/sound';

export function ReportsView() {
  const { salesHistory, activeShift, openNewShift, closeShift, userRole } = useStore();

  const [selectedReceiptSale, setSelectedReceiptSale] = useState(null);

  // Shift close state
  const [actualCashInput, setActualCashInput] = useState('');
  const [shiftNote, setShiftNote] = useState('');
  const [closedShiftResult, setClosedShiftResult] = useState(null);

  // Open new shift state
  const [newShiftStartCash, setNewShiftStartCash] = useState('1000');
  const [newShiftCashierName, setNewShiftCashierName] = useState('เจ้าของร้าน');

  // Compute stats
  const totalRevenue = salesHistory.reduce((sum, s) => sum + s.total, 0);
  const totalBills = salesHistory.length;
  const totalCash = salesHistory
    .filter((s) => s.paymentMethod === 'cash')
    .reduce((sum, s) => sum + s.total, 0);
  const totalPromptpay = salesHistory
    .filter((s) => s.paymentMethod === 'promptpay')
    .reduce((sum, s) => sum + s.total, 0);

  // Top Products sold
  const productSalesMap = {};
  salesHistory.forEach((sale) => {
    sale.items.forEach((it) => {
      if (!productSalesMap[it.name]) {
        productSalesMap[it.name] = { name: it.name, qty: 0, revenue: 0, unit: it.unit };
      }
      productSalesMap[it.name].qty += it.qty;
      productSalesMap[it.name].revenue += it.subtotal;
    });
  });
  const topProducts = Object.values(productSalesMap)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  // Export CSV
  const handleExportCSV = () => {
    playClickSound();
    if (salesHistory.length === 0) {
      alert('ไม่มีประวัติการขายให้ส่งออก');
      return;
    }

    let csvContent = 'data:text/csv;charset=utf-8,\uFEFF';
    csvContent += 'เลขที่บิล,วันที่และเวลา,แคชเชียร์,จำนวนรายการ,ยอดรวม(บาท),วิธีชำระ,เงินรับมา(บาท),เงินทอน(บาท)\n';

    salesHistory.forEach((s) => {
      const dateStr = new Date(s.createdAt).toLocaleString('th-TH');
      const method = s.paymentMethod === 'cash' ? 'เงินสด' : 'พร้อมเพย์';
      csvContent += `"${s.billNumber}","${dateStr}","${s.cashierName}","${s.items.length}","${s.total.toFixed(2)}","${method}","${s.cashReceived}","${s.change}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `paruay_sales_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Close active shift
  const handleCloseShift = (e) => {
    e.preventDefault();
    if (!activeShift) return;

    const result = closeShift({
      actualCash: parseFloat(actualCashInput) || 0,
      note: shiftNote,
    });

    playCashRegisterChime();
    setClosedShiftResult(result);
    setActualCashInput('');
  };

  const handleOpenShift = (e) => {
    e.preventDefault();
    openNewShift(newShiftStartCash, newShiftCashierName);
    setClosedShiftResult(null);
  };

  const expectedCashInDrawer = activeShift
    ? activeShift.startCash + activeShift.cashSales
    : 0;
  const countedDiff = actualCashInput
    ? Number((parseFloat(actualCashInput) - expectedCashInDrawer).toFixed(2))
    : 0;

  return (
    <div className="reports-layout animate-fade-in">
      <div className="section-header">
        <div>
          <h2>📈 รายงานยอดขาย & การปิดกะ (Reports & Shifts)</h2>
          <p className="section-subtitle">
            สรุปยอดขายแยกตามวิธีชำระ, สินค้าขายดี, ตรวจนับเงินสดในลิ้นชัก, และส่งออกไฟล์ CSV
          </p>
        </div>
        <button
          type="button"
          className="btn btn-outline-primary"
          onClick={handleExportCSV}
          title="ดาวน์โหลดไฟล์ Excel/CSV สำหรับบัญชี"
        >
          <Download size={18} />
          <span>ส่งออกรายงาน CSV (Excel)</span>
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="metrics-grid mb-6">
        <div className="metric-card card-revenue">
          <div className="metric-icon-wrap">
            <TrendingUp size={24} />
          </div>
          <div className="metric-info">
            <span className="metric-label">ยอดขายสะสมทั้งหมด</span>
            <h3 className="metric-number">
              {totalRevenue.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
              <small> บาท</small>
            </h3>
            <span className="metric-meta">จากทั้งหมด {totalBills} บิล</span>
          </div>
        </div>

        <div className="metric-card card-cash">
          <div className="metric-icon-wrap">
            <Banknote size={24} />
          </div>
          <div className="metric-info">
            <span className="metric-label">ยอดเงินสดรวม</span>
            <h3 className="metric-number">
              {totalCash.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
              <small> บาท</small>
            </h3>
            <span className="metric-meta">{((totalCash / (totalRevenue || 1)) * 100).toFixed(0)}% ของยอดรวม</span>
          </div>
        </div>

        <div className="metric-card card-promptpay">
          <div className="metric-icon-wrap">
            <QrCode size={24} />
          </div>
          <div className="metric-info">
            <span className="metric-label">ยอดพร้อมเพย์รวม</span>
            <h3 className="metric-number">
              {totalPromptpay.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
              <small> บาท</small>
            </h3>
            <span className="metric-meta">{((totalPromptpay / (totalRevenue || 1)) * 100).toFixed(0)}% ของยอดรวม</span>
          </div>
        </div>
      </div>

      <div className="dashboard-sections-grid mb-6">
        {/* Shift Management / Cash Drawer Audit */}
        <div className="dashboard-panel shift-panel">
          <div className="panel-header">
            <div className="flex items-center gap-2">
              <Lock className="text-warning" size={22} />
              <h3>กะการขาย & ปิดกะลิ้นชักคิดเงิน</h3>
            </div>
            {activeShift ? (
              <span className="status-pill status-normal">🟢 กะกำลังเปิดอยู่</span>
            ) : (
              <span className="status-pill status-out">🔴 ปิดกะแล้ว</span>
            )}
          </div>

          <div className="panel-body">
            {activeShift ? (
              <div>
                <div className="shift-stats-box mb-4">
                  <div className="flex justify-between py-1 border-b">
                    <span className="text-muted">ผู้เปิดกะ:</span>
                    <strong>{activeShift.cashierName}</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b">
                    <span className="text-muted">เวลาเปิดกะ:</span>
                    <span>{new Date(activeShift.openedAt).toLocaleTimeString('th-TH')}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b">
                    <span className="text-muted">เงินทอนตั้งต้น:</span>
                    <span>{activeShift.startCash.toFixed(2)} ฿</span>
                  </div>
                  <div className="flex justify-between py-1 border-b">
                    <span className="text-muted">ยอดขายเงินสดในกะนี้:</span>
                    <strong className="text-success">+{activeShift.cashSales.toFixed(2)} ฿</strong>
                  </div>
                  <div className="flex justify-between py-2 font-bold text-lg border-b bg-emerald-50 px-2 rounded">
                    <span>เงินสดที่ควรมีในลิ้นชัก:</span>
                    <span className="text-success">{expectedCashInDrawer.toFixed(2)} ฿</span>
                  </div>
                </div>

                {/* Close Shift Form */}
                <form onSubmit={handleCloseShift} className="border-t pt-3">
                  <h4 className="font-bold mb-2">ปิดกะ (ตรวจนับเงินสดจริง):</h4>
                  <div className="form-group">
                    <label className="form-label">นับเงินสดจริงในลิ้นชัก (บาท) *:</label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      className="form-control big-number-input highlight-cash"
                      placeholder="เช่น 3540"
                      value={actualCashInput}
                      onChange={(e) => setActualCashInput(e.target.value)}
                      required
                    />
                  </div>

                  {actualCashInput && (
                    <div className={`p-3 rounded mb-3 text-center ${countedDiff === 0 ? 'bg-green-100 text-green-800' : countedDiff > 0 ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'}`}>
                      <strong>ผลลัพธ์การนับเงิน: </strong>
                      {countedDiff === 0 ? (
                        <span>ยอดตรงพอดีเป๊ะ! (ไม่มีเงินขาดเกิน)</span>
                      ) : countedDiff > 0 ? (
                        <span>เงินเกินมา +{countedDiff.toFixed(2)} บาท</span>
                      ) : (
                        <span>เงินขาดไป {countedDiff.toFixed(2)} บาท</span>
                      )}
                    </div>
                  )}

                  <div className="form-group">
                    <label className="form-label">หมายเหตุการปิดกะ:</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="เช่น เงินเหรียญครบ ธนบัตรตรง"
                      value={shiftNote}
                      onChange={(e) => setShiftNote(e.target.value)}
                    />
                  </div>

                  <button type="submit" className="btn btn-warning w-full btn-large font-bold">
                    <Lock size={18} />
                    <span>ยืนยันปิดกะและบันทึกผลต่าง</span>
                  </button>
                </form>
              </div>
            ) : (
              <div>
                {closedShiftResult && (
                  <div className="alert-banner alert-success mb-4 animate-slide-up">
                    <CheckCircle2 size={20} />
                    <div>
                      <strong className="block">ปิดกะก่อนหน้าสำเร็จแล้ว</strong>
                      <p className="text-xs">
                        เงินที่ควรมี {closedShiftResult.expectedCash} ฿ | นับได้ {closedShiftResult.actualCash} ฿ (ส่วนต่าง {closedShiftResult.cashDifference} ฿)
                      </p>
                    </div>
                  </div>
                )}

                {/* Open New Shift Form */}
                <form onSubmit={handleOpenShift} className="p-2">
                  <h4 className="font-bold mb-3 flex items-center gap-2">
                    <Unlock className="text-success" size={20} />
                    <span>เปิดกะการขายใหม่</span>
                  </h4>
                  <div className="form-group">
                    <label className="form-label">ชื่อแคชเชียร์ประจำกะ:</label>
                    <input
                      type="text"
                      className="form-control"
                      value={newShiftCashierName}
                      onChange={(e) => setNewShiftCashierName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">เงินทอนตั้งต้น (ใส่ในลิ้นชัก):</label>
                    <input
                      type="number"
                      step="50"
                      min="0"
                      className="form-control highlight-cash"
                      value={newShiftStartCash}
                      onChange={(e) => setNewShiftStartCash(e.target.value)}
                      required
                    />
                  </div>
                  <button type="submit" className="btn btn-success w-full btn-large font-bold">
                    <Unlock size={18} />
                    <span>เปิดกะการขายทันที</span>
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>

        {/* Top 5 Products Leaderboard */}
        <div className="dashboard-panel">
          <div className="panel-header">
            <h3>🏆 5 อันดับสินค้าขายดีที่สุด (Top Sellers)</h3>
          </div>
          <div className="panel-body">
            {topProducts.length === 0 ? (
              <p className="text-muted text-center py-8">ยังไม่มียอดขายสินค้าในระบบ</p>
            ) : (
              <div className="top-products-list">
                {topProducts.map((p, idx) => (
                  <div key={idx} className="top-prod-row">
                    <div className="top-rank-badge font-bold">#{idx + 1}</div>
                    <div className="flex-1">
                      <strong className="block">{p.name}</strong>
                      <span className="text-xs text-muted">
                        ขายไปแล้ว {typeof p.qty === 'number' && p.qty % 1 !== 0 ? p.qty.toFixed(3) : p.qty} {p.unit}
                      </span>
                    </div>
                    <div className="text-right">
                      <strong className="text-primary font-bold">
                        {p.revenue.toLocaleString('th-TH', { minimumFractionDigits: 2 })} ฿
                      </strong>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sales History Table */}
      <div className="dashboard-panel">
        <div className="panel-header">
          <h3>📜 ประวัติรายการบิลขาย ({salesHistory.length} บิล)</h3>
        </div>
        <div className="table-responsive-wrapper">
          <table className="pos-table">
            <thead>
              <tr>
                <th>เลขที่บิล</th>
                <th>เวลา</th>
                <th>แคชเชียร์</th>
                <th>รายการ</th>
                <th>วิธีชำระ</th>
                <th>ยอดรวม</th>
                <th className="text-center">พิมพ์ใบเสร็จ</th>
              </tr>
            </thead>
            <tbody>
              {salesHistory.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-8 text-muted">
                    ยังไม่มีรายการบิลขาย
                  </td>
                </tr>
              ) : (
                salesHistory.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <span className="font-mono font-bold text-sm">{s.billNumber}</span>
                    </td>
                    <td>{new Date(s.createdAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}</td>
                    <td>{s.cashierName}</td>
                    <td>
                      <span className="badge-tag tag-discrete">{s.items.length} รายการ</span>
                    </td>
                    <td>
                      <span className="badge-tag tag-scale">
                        {s.paymentMethod === 'cash' ? '💵 เงินสด' : '📱 พร้อมเพย์'}
                      </span>
                    </td>
                    <td>
                      <strong className="text-primary font-bold">
                        {s.total.toLocaleString('th-TH', { minimumFractionDigits: 2 })} ฿
                      </strong>
                    </td>
                    <td className="text-center font-mono text-xs text-muted">
                      ชำระเสร็จสิ้น
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
