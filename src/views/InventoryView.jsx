import React, { useState } from 'react';
import {
  Package,
  Search,
  Filter,
  Barcode,
  Printer,
  Edit,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  History,
  Scale,
  ArrowUpDown,
  Plus,
  Minus,
  LayoutGrid,
  List,
  Sparkles,
  Trash2,
  Eye,
  EyeOff,
  SlidersHorizontal,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { BarcodeStickerModal } from '../components/BarcodeStickerModal';
import { EasyAddProductModal } from '../components/EasyAddProductModal';
import { TwoShotAddProductModal } from '../components/TwoShotAddProductModal';
import { QuickPriceModal } from '../components/QuickPriceModal';
import { ProductEditModal } from '../components/ProductEditModal';
import { ProductThumbnail } from '../components/ProductThumbnail';
import { ConfirmDeleteModal } from '../components/ConfirmDeleteModal';
import { playClickSound, playCashRegisterChime } from '../utils/sound';

export function InventoryView({ onNavigate }) {
  const {
    products,
    categories,
    stockMovements,
    updateProductPrice,
    adjustStock,
    deleteProduct,
    toggleProductActive,
    userRole,
  } = useStore();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'normal' | 'low' | 'out' | 'discontinued' | 'all_with_discontinued'
  const [viewMode, setViewMode] = useState('card'); // 'card' | 'table'
  const [isEasyAddOpen, setIsEasyAddOpen] = useState(false);
  const [isTwoShotOpen, setIsTwoShotOpen] = useState(false);

  // Full Product Edit Modal (Change photo, adjust stock, delete/discontinue, edit fields)
  const [editingProduct, setEditingProduct] = useState(null);

  // Barcode Sticker modal
  const [stickerProduct, setStickerProduct] = useState(null);

  // Fast price edit modal
  const [editingPriceProduct, setEditingPriceProduct] = useState(null);

  // Dedicated In-App Confirm Delete Modal
  const [deleteConfirmProduct, setDeleteConfirmProduct] = useState(null);
  const [toastMessage, setToastMessage] = useState('');

  // Stock movement drawer
  const [viewHistoryProduct, setViewHistoryProduct] = useState(null);

  // KPI Calculations
  const totalActive = products.filter((p) => p.active !== false).length;
  const lowOrOutCount = products.filter(
    (p) => p.active !== false && (Number(p.stock) || 0) <= (Number(p.minStockAlert) || 5)
  ).length;
  const totalDiscontinued = products.filter((p) => p.active === false).length;
  const totalStockRetailValue = products
    .filter((p) => p.active !== false)
    .reduce((sum, p) => sum + (Number(p.sellPrice) || 0) * (Number(p.stock) || 0), 0);

  // Filtered Products
  const filteredProducts = products.filter((p) => {
    const q = search.toLowerCase().trim();
    const matchSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      (p.barcode && p.barcode.toLowerCase().includes(q));

    const matchCategory =
      categoryFilter === 'all' || p.categoryId === categoryFilter;

    let matchStatus = true;
    const stockVal = Number(p.stock) || 0;
    const minAlert = Number(p.minStockAlert) || 5;

    if (statusFilter === 'out') {
      matchStatus = p.active !== false && stockVal <= 0;
    } else if (statusFilter === 'low') {
      matchStatus = p.active !== false && stockVal > 0 && stockVal <= minAlert;
    } else if (statusFilter === 'normal') {
      matchStatus = p.active !== false && stockVal > minAlert;
    } else if (statusFilter === 'discontinued') {
      matchStatus = p.active === false;
    } else if (statusFilter === 'all') {
      matchStatus = p.active !== false; // Default: show active products only
    } else if (statusFilter === 'all_with_discontinued') {
      matchStatus = true;
    }

    return matchSearch && matchCategory && matchStatus;
  });

  // Handle Quick Stepper for Stock (+1 / -1)
  const handleQuickStockStep = (p, delta) => {
    playClickSound();
    const current = Number(p.stock) || 0;
    const nextVal = Math.max(0, Number((current + delta).toFixed(3)));
    adjustStock({
      productId: p.id,
      countedStock: nextVal,
      reason: delta > 0 ? 'รับสินค้าเพิ่มด่วน' : 'ปรับลดยอดสต็อกด่วน',
      performedBy: 'เจ้าของร้าน',
    });
  };

  // Handle Discontinue / Reactivate
  const handleToggleActive = (p) => {
    playClickSound();
    const nextActive = toggleProductActive(p.id);
    setToastMessage(
      nextActive
        ? `🟢 เปิดขายสินค้า "${p.name}" อีกครั้งแล้ว`
        : `⏸️ พักการจำหน่ายสินค้า "${p.name}" (ซ่อนจากหน้าขายแล้ว)`
    );
    setTimeout(() => setToastMessage(''), 4000);
  };

  // Handle Delete Product -> Open In-App Confirm Modal
  const handleDeleteProduct = (p) => {
    playClickSound();
    setDeleteConfirmProduct(p);
  };

  const handleProductDeleted = (p) => {
    setToastMessage(`🗑️ ลบสินค้า "${p.name}" ออกจากระบบและคลังสินค้าถาวรเรียบร้อยแล้ว`);
    setTimeout(() => setToastMessage(''), 4000);
  };

  const handleProductToggled = (p, nextActive) => {
    setToastMessage(
      nextActive
        ? `🟢 เปิดขายสินค้า "${p.name}" อีกครั้งแล้ว`
        : `⏸️ พักการจำหน่ายสินค้า "${p.name}" (ซ่อนจากหน้าขายแล้ว)`
    );
    setTimeout(() => setToastMessage(''), 4000);
  };

  const handleOpenPriceModal = (p) => {
    playClickSound();
    setEditingPriceProduct(p);
  };

  return (
    <div className="inventory-layout animate-fade-in">
      {/* Top Header */}
      <div className="section-header">
        <div>
          <h2>📦 จัดการคลังสินค้าและสต็อก (Inventory)</h2>
          <p className="section-subtitle">
            ตรวจสอบจำนวนคงเหลือ, ปรับสต็อก, เปลี่ยนรูปภาพ, และลบสินค้าที่เลิกขาย
          </p>
        </div>
        <div className="header-actions">
          <button
            type="button"
            className="btn btn-outline-primary"
            onClick={() => onNavigate('restock')}
          >
            + รับสินค้าเข้าสต็อก
          </button>
          <button
            type="button"
            className="btn btn-two-shot-trigger font-bold shadow-sm"
            onClick={() => {
              playClickSound();
              setIsTwoShotOpen(true);
            }}
            title="ถ่าย 2 รูปเพิ่มสินค้า (ฉลาก + บาร์โค้ด)"
          >
            <Sparkles size={18} className="two-shot-sparkle-icon" />
            <span>📸 ถ่าย 2 รูปเพิ่มด่วน</span>
          </button>
          <button
            type="button"
            className="btn btn-primary font-bold shadow-sm"
            onClick={() => {
              playClickSound();
              setIsEasyAddOpen(true);
            }}
          >
            <Plus size={18} />
            <span>+ เพิ่มสินค้าใหม่</span>
          </button>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="inventory-kpi-grid">
        <div className="kpi-mini-card">
          <div className="kpi-icon-wrap bg-blue-50 text-blue-600">
            <Package size={20} />
          </div>
          <div>
            <span className="kpi-label">สินค้าที่มีขาย</span>
            <strong className="kpi-val">{totalActive} รายการ</strong>
          </div>
        </div>

        <div className="kpi-mini-card">
          <div className="kpi-icon-wrap bg-amber-50 text-amber-600">
            <AlertTriangle size={20} />
          </div>
          <div>
            <span className="kpi-label">ใกล้หมด / หมดสต็อก</span>
            <strong className={`kpi-val ${lowOrOutCount > 0 ? 'text-danger' : 'text-success'}`}>
              {lowOrOutCount} รายการ
            </strong>
          </div>
        </div>

        <div className="kpi-mini-card">
          <div className="kpi-icon-wrap bg-emerald-50 text-emerald-600">
            <DollarSign size={20} />
          </div>
          <div>
            <span className="kpi-label">มูลค่าสินค้าหน้าร้าน</span>
            <strong className="kpi-val text-success">
              {totalStockRetailValue.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ฿
            </strong>
          </div>
        </div>

        <div className="kpi-mini-card">
          <div className="kpi-icon-wrap bg-gray-100 text-gray-500">
            <EyeOff size={20} />
          </div>
          <div>
            <span className="kpi-label">เลิกขายแล้ว (ไม่มีขาย)</span>
            <strong className="kpi-val text-muted">{totalDiscontinued} รายการ</strong>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
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
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="all">ทุกหมวดหมู่ ({products.length})</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.icon} {c.name}
            </option>
          ))}
        </select>

        <select
          className="form-control select-dropdown"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">ทุกสถานะ (สินค้ามีขาย)</option>
          <option value="normal">🟢 ปกติ (สต็อกพอขาย)</option>
          <option value="low">🟡 ใกล้หมด (ต่ำกว่าจุดสั่ง)</option>
          <option value="out">🔴 หมดสต็อก (0)</option>
          <option value="discontinued">⏸️ เลิกขายแล้ว ({totalDiscontinued})</option>
          <option value="all_with_discontinued">📦 ทั้งหมด (รวมของเลิกขาย)</option>
        </select>

        {/* View Mode Toggle */}
        <div className="flex gap-1 p-1 rounded-md" style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-color)' }}>
          <button
            type="button"
            className={`btn btn-sm ${viewMode === 'card' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => {
              playClickSound();
              setViewMode('card');
            }}
            title="มุมมองการ์ด (เหมาะกับมือถือ)"
          >
            <LayoutGrid size={16} />
            <span>การ์ด</span>
          </button>
          <button
            type="button"
            className={`btn btn-sm ${viewMode === 'table' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => {
              playClickSound();
              setViewMode('table');
            }}
            title="มุมมองตาราง"
          >
            <List size={16} />
            <span>ตาราง</span>
          </button>
        </div>
      </div>

      {/* Products Display (Cards or Table) */}
      {viewMode === 'card' ? (
        <div className="inventory-cards-grid">
          {filteredProducts.length === 0 ? (
            <div className="text-center py-8 text-muted col-span-full">
              ไม่พบสินค้าที่ตรงกับเงื่อนไข
            </div>
          ) : (
            filteredProducts.map((p) => {
              const isDiscontinued = p.active === false;
              const stockVal = Number(p.stock) || 0;
              const minAlert = Number(p.minStockAlert) || 5;
              const isOutOfStock = stockVal <= 0;
              const isLowStock = stockVal > 0 && stockVal <= minAlert;

              return (
                <div
                  key={p.id}
                  className={`inventory-card-item ${isDiscontinued ? 'opacity-70 bg-gray-50 border-dashed' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <ProductThumbnail product={p} size={54} />
                    <div className="flex-1 min-w-0">
                      <strong className="block text-base truncate" style={{ marginBottom: '2px' }} title={p.name}>
                        {p.name}
                      </strong>
                      <span className="block text-xs text-muted font-mono" style={{ marginBottom: '2px' }}>
                        {p.barcode || 'ไม่มีบาร์โค้ด'}
                      </span>
                      <div className="text-xs text-muted">หมวด: {categories.find((c) => c.id === p.categoryId)?.name || '-'}</div>
                    </div>
                    <div>
                      {isDiscontinued ? (
                        <span className="status-pill status-error">⏸️ เลิกขาย</span>
                      ) : isOutOfStock ? (
                        <span className="status-pill status-out">🔴 หมด</span>
                      ) : isLowStock ? (
                        <span className="status-pill status-low">🟡 ใกล้หมด</span>
                      ) : (
                        <span className="status-pill status-normal">🟢 ปกติ</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-2" style={{ borderTop: '1px solid var(--border-color)' }}>
                    <div>
                      <span className="text-xs text-muted block">ราคาขาย / {p.unit}:</span>
                      <div className="flex items-baseline gap-1.5 mt-0.5">
                        <strong className="text-primary text-lg font-bold">
                          {(Number(p.sellPrice) || 0).toFixed(2)} ฿
                        </strong>
                        {p.costPrice > 0 && (
                          <span className="text-xs text-muted">(ทุน {(Number(p.costPrice) || 0).toFixed(2)})</span>
                        )}
                      </div>
                    </div>

                    {/* Stock Count & Quick Stepper (+1 / -1) */}
                    <div className="text-right">
                      <span className="text-xs text-muted block">คงเหลือในคลัง:</span>
                      <div className="flex items-center gap-1 mt-1 justify-end">
                        <button
                          type="button"
                          className="btn btn-secondary btn-xs font-bold"
                          onClick={() => handleQuickStockStep(p, -1)}
                          title="ลดสต็อก 1"
                        >
                          <Minus size={11} />
                        </button>
                        <strong
                          className={`text-base font-mono font-bold px-1 ${
                            isOutOfStock ? 'text-danger' : isLowStock ? 'text-warning' : 'text-success'
                          }`}
                        >
                          {p.isWeighted ? stockVal.toFixed(3) : stockVal} {p.unit}
                        </strong>
                        <button
                          type="button"
                          className="btn btn-secondary btn-xs font-bold"
                          onClick={() => handleQuickStockStep(p, 1)}
                          title="เพิ่มสต็อก 1"
                        >
                          <Plus size={11} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Actions Grid */}
                  <div className="flex items-center gap-1 mt-3 pt-2" style={{ borderTop: '1px solid var(--border-color)' }}>
                    {/* Main Edit & Photo & Stock Button */}
                    <button
                      type="button"
                      className="btn btn-primary btn-sm flex-1 font-bold"
                      onClick={() => {
                        playClickSound();
                        setEditingProduct(p);
                      }}
                      title="แก้ไขข้อมูล, เปลี่ยนรูปภาพ, และปรับสต็อก"
                    >
                      <Edit size={14} />
                      <span>แก้ไข/รูป/สต็อก</span>
                    </button>

                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleOpenPriceModal(p)}
                      title="ปรับราคาขายเร็ว"
                    >
                      <DollarSign size={14} />
                    </button>

                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        playClickSound();
                        setStickerProduct(p);
                      }}
                      title="พิมพ์สติกเกอร์บาร์โค้ด"
                    >
                      <Printer size={14} />
                    </button>

                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        playClickSound();
                        setViewHistoryProduct(p);
                      }}
                      title="ดูประวัติการเคลื่อนไหวสต็อก"
                    >
                      <History size={14} />
                    </button>

                    {/* Discontinue / Reactivate Button */}
                    <button
                      type="button"
                      className={`btn btn-sm ${isDiscontinued ? 'btn-success' : 'btn-ghost text-amber-700'}`}
                      onClick={() => handleToggleActive(p)}
                      title={isDiscontinued ? 'เปิดขายอีกครั้ง' : 'เลิกขายสินค้านี้ (ซ่อนจากหน้าขาย)'}
                    >
                      {isDiscontinued ? <Eye size={14} /> : <EyeOff size={14} />}
                    </button>

                    {/* Permanent Delete Button */}
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm text-danger"
                      onClick={() => handleDeleteProduct(p)}
                      title="ลบสินค้านี้ถาวร"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        <div className="table-responsive-wrapper">
          <table className="pos-table">
            <thead>
              <tr>
                <th>สินค้า</th>
                <th>บาร์โค้ด</th>
                <th>ประเภท</th>
                <th>ราคาทุน</th>
                <th>ราคาขาย</th>
                <th>กำไร/หน่วย</th>
                <th>คงเหลือ</th>
                <th>สถานะ</th>
                <th className="text-center">การจัดการ</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan="9" className="text-center py-6 text-muted">
                    ไม่พบสินค้าที่ตรงกับเงื่อนไข
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const isDiscontinued = p.active === false;
                  const stockVal = Number(p.stock) || 0;
                  const minAlert = Number(p.minStockAlert) || 5;
                  const isOutOfStock = stockVal <= 0;
                  const isLowStock = stockVal > 0 && stockVal <= minAlert;
                  const profit = (Number(p.sellPrice) || 0) - (Number(p.costPrice) || 0);
                  const marginPct = (Number(p.sellPrice) || 0) > 0 ? ((profit / p.sellPrice) * 100).toFixed(0) : 0;

                  return (
                    <tr key={p.id} className={isDiscontinued ? 'opacity-65 bg-gray-50' : ''}>
                      <td>
                        <div className="flex items-center gap-2">
                          <ProductThumbnail product={p} size={42} />
                          <div>
                            <strong className="block">{p.name}</strong>
                            <span className="text-xs text-muted">จุดเตือน: {minAlert} {p.unit}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="font-mono text-sm">{p.barcode || '-'}</span>
                      </td>
                      <td>
                        {p.isWeighted ? (
                          <span className="badge-tag tag-scale">
                            <Scale size={12} /> ชั่ง นน.
                          </span>
                        ) : (
                          <span className="badge-tag tag-discrete">{p.unit}</span>
                        )}
                      </td>
                      <td>{p.costPrice ? `${(Number(p.costPrice) || 0).toFixed(2)} ฿` : '-'}</td>
                      <td>
                        <strong className="text-primary font-bold">
                          {(Number(p.sellPrice) || 0).toFixed(2)} ฿
                        </strong>
                      </td>
                      <td>
                        <span className="text-success text-xs font-medium">
                          +{profit.toFixed(2)} ฿ ({marginPct}%)
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            className="btn btn-secondary btn-xs"
                            onClick={() => handleQuickStockStep(p, -1)}
                            title="ลด 1"
                          >
                            <Minus size={10} />
                          </button>
                          <strong className={`font-mono px-1 ${isOutOfStock ? 'text-danger' : isLowStock ? 'text-warning' : 'text-success'}`}>
                            {p.isWeighted ? stockVal.toFixed(3) : stockVal} {p.unit}
                          </strong>
                          <button
                            type="button"
                            className="btn btn-secondary btn-xs"
                            onClick={() => handleQuickStockStep(p, 1)}
                            title="เพิ่ม 1"
                          >
                            <Plus size={10} />
                          </button>
                        </div>
                      </td>
                      <td>
                        {isDiscontinued ? (
                          <span className="status-pill status-error">⏸️ เลิกขาย</span>
                        ) : isOutOfStock ? (
                          <span className="status-pill status-out">🔴 หมด</span>
                        ) : isLowStock ? (
                          <span className="status-pill status-low">🟡 ใกล้หมด</span>
                        ) : (
                          <span className="status-pill status-normal">🟢 ปกติ</span>
                        )}
                      </td>
                      <td>
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            className="table-action-btn"
                            title="แก้ไขสินค้า / เปลี่ยนรูป / สต็อก"
                            onClick={() => {
                              playClickSound();
                              setEditingProduct(p);
                            }}
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            type="button"
                            className="table-action-btn"
                            title="ปรับราคาขายเร็ว"
                            onClick={() => handleOpenPriceModal(p)}
                          >
                            <DollarSign size={16} />
                          </button>
                          <button
                            type="button"
                            className="table-action-btn"
                            title="พิมพ์สติกเกอร์บาร์โค้ด EAN-13"
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
                            title="ดูประวัติการเคลื่อนไหวสต็อก"
                            onClick={() => {
                              playClickSound();
                              setViewHistoryProduct(p);
                            }}
                          >
                            <History size={16} />
                          </button>
                          <button
                            type="button"
                            className={`table-action-btn ${isDiscontinued ? 'text-success' : 'text-amber-700'}`}
                            title={isDiscontinued ? 'เปิดขายอีกครั้ง' : 'เลิกขายสินค้านี้'}
                            onClick={() => handleToggleActive(p)}
                          >
                            {isDiscontinued ? <Eye size={15} /> : <EyeOff size={15} />}
                          </button>
                          <button
                            type="button"
                            className="table-action-btn text-danger"
                            title="ลบสินค้าถาวร"
                            onClick={() => handleDeleteProduct(p)}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Full Product & Stock & Photo Edit Modal */}
      <ProductEditModal
        product={editingProduct}
        isOpen={Boolean(editingProduct)}
        onClose={() => setEditingProduct(null)}
      />

      {/* Quick Price Edit Modal */}
      <QuickPriceModal
        product={editingPriceProduct}
        isOpen={Boolean(editingPriceProduct)}
        onClose={() => setEditingPriceProduct(null)}
      />

      {/* Barcode Sticker Modal */}
      <BarcodeStickerModal
        product={stickerProduct}
        isOpen={Boolean(stickerProduct)}
        onClose={() => setStickerProduct(null)}
      />

      {/* Stock History Drawer / Modal */}
      {viewHistoryProduct && (
        <div className="modal-overlay" onClick={() => setViewHistoryProduct(null)}>
          <div className="modal-content animate-scale-up" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">ประวัติการเคลื่อนไหวสต็อก</h3>
                <p className="modal-subtitle">{viewHistoryProduct.name}</p>
              </div>
              <button className="icon-btn close-btn" onClick={() => setViewHistoryProduct(null)}>
                ✕
              </button>
            </div>
            <div className="modal-body p-3 max-h-96 overflow-y-auto">
              {stockMovements.filter((m) => m.productId === viewHistoryProduct.id).length === 0 ? (
                <div className="text-center py-6 text-muted">
                  ยังไม่มีประวัติการเคลื่อนไหวสต็อกของสินค้านี้
                </div>
              ) : (
                <table className="pos-table text-sm">
                  <thead>
                    <tr>
                      <th>เวลา</th>
                      <th>ประเภท</th>
                      <th>จำนวน</th>
                      <th>เหตุผล</th>
                      <th>ผู้ทำรายการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockMovements
                      .filter((m) => m.productId === viewHistoryProduct.id)
                      .map((m) => (
                        <tr key={m.id}>
                          <td>{new Date(m.timestamp).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}</td>
                          <td>
                            <span className={`badge-tag ${m.type.includes('sale') ? 'tag-out' : m.qty > 0 ? 'tag-scale' : 'tag-low'}`}>
                              {m.type === 'sale' ? 'ขาย' : m.type.includes('restock') ? 'รับเข้า' : 'ปรับยอด'}
                            </span>
                          </td>
                          <td className={`font-mono font-bold ${m.qty > 0 ? 'text-success' : 'text-danger'}`}>
                            {m.qty > 0 ? `+${m.qty}` : m.qty} {m.unit}
                          </td>
                          <td>{m.reason}</td>
                          <td>{m.performedBy}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary w-full" onClick={() => setViewHistoryProduct(null)}>
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Easy Add Product Modal */}
      <EasyAddProductModal
        isOpen={isEasyAddOpen}
        onClose={() => setIsEasyAddOpen(false)}
        onOpenTwoShot={() => setIsTwoShotOpen(true)}
      />

      {/* Two-Shot AI Add Product Modal */}
      <TwoShotAddProductModal
        isOpen={isTwoShotOpen}
        onClose={() => setIsTwoShotOpen(false)}
      />

      {/* Dedicated In-App Confirm Delete Modal */}
      <ConfirmDeleteModal
        isOpen={Boolean(deleteConfirmProduct)}
        product={deleteConfirmProduct}
        onClose={() => setDeleteConfirmProduct(null)}
        onDeleted={handleProductDeleted}
        onToggledActive={handleProductToggled}
      />

      {/* Instant Action Toast Notification */}
      {toastMessage && (
        <div
          className="fixed bottom-6 right-6 z-50 p-4 rounded-xl shadow-2xl bg-gray-900 text-white text-sm font-bold flex items-center gap-3 animate-fade-in"
          style={{
            maxWidth: 420,
            border: '1px solid rgba(255,255,255,0.15)',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4)',
          }}
        >
          <span>{toastMessage}</span>
          <button
            type="button"
            className="text-gray-400 hover:text-white ml-auto font-bold p-1"
            onClick={() => setToastMessage('')}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
