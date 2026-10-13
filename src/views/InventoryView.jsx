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
  LayoutGrid,
  List,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { BarcodeStickerModal } from '../components/BarcodeStickerModal';
import { EasyAddProductModal } from '../components/EasyAddProductModal';
import { QuickPriceModal } from '../components/QuickPriceModal';
import { ProductThumbnail } from '../components/ProductThumbnail';
import { playClickSound } from '../utils/sound';

export function InventoryView({ onNavigate }) {
  const { products, categories, stockMovements, updateProductPrice, userRole } = useStore();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'normal' | 'low' | 'out'
  const [viewMode, setViewMode] = useState('card'); // 'card' | 'table'
  const [isEasyAddOpen, setIsEasyAddOpen] = useState(false);

  // Sticker modal
  const [stickerProduct, setStickerProduct] = useState(null);

  // Fast price edit modal
  const [editingPriceProduct, setEditingPriceProduct] = useState(null);
  const [newPriceInput, setNewPriceInput] = useState('');

  // Stock movement drawer
  const [viewHistoryProduct, setViewHistoryProduct] = useState(null);

  const filteredProducts = products.filter((p) => {
    const q = search.toLowerCase().trim();
    const matchSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      (p.barcode && p.barcode.toLowerCase().includes(q));

    const matchCategory =
      categoryFilter === 'all' || p.categoryId === categoryFilter;

    let matchStatus = true;
    if (statusFilter === 'out') matchStatus = p.stock <= 0;
    else if (statusFilter === 'low') matchStatus = p.stock > 0 && p.stock <= p.minStockAlert;
    else if (statusFilter === 'normal') matchStatus = p.stock > p.minStockAlert;

    return matchSearch && matchCategory && matchStatus;
  });

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
            ตรวจสอบจำนวนคงเหลือ, ปรับราคาขายสด, และพิมพ์สติกเกอร์บาร์โค้ด
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
          <option value="all">ทุกสถานะสต็อก</option>
          <option value="normal">🟢 ปกติ (สต็อกพอ)</option>
          <option value="low">🟡 ใกล้หมด (ต่ำกว่าจุดสั่ง)</option>
          <option value="out">🔴 หมดสต็อก (0)</option>
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
              const isOutOfStock = p.stock <= 0;
              const isLowStock = p.stock > 0 && p.stock <= p.minStockAlert;

              return (
                <div key={p.id} className="inventory-card-item">
                  <div className="flex items-center gap-3">
                    <ProductThumbnail product={p} size={54} />
                    <div className="flex-1 min-w-0">
                      <strong className="block text-base truncate">{p.name}</strong>
                      <span className="text-xs text-muted font-mono">{p.barcode || 'ไม่มีบาร์โค้ด'}</span>
                      <div className="text-xs text-muted">หมวด: {categories.find((c) => c.id === p.categoryId)?.name || '-'}</div>
                    </div>
                    <div>
                      {isOutOfStock ? (
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
                      <strong className="text-primary text-lg font-bold">
                        {p.sellPrice.toFixed(2)} ฿
                      </strong>
                      {p.costPrice > 0 && (
                        <span className="text-xs text-muted ml-1">(ทุน {(Number(p.costPrice) || 0).toFixed(2)})</span>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-muted block">คงเหลือในคลัง:</span>
                      <strong className={`text-lg font-mono font-bold ${isOutOfStock ? 'text-danger' : isLowStock ? 'text-warning' : 'text-success'}`}>
                        {p.isWeighted ? (Number(p.stock) || 0).toFixed(3) : (Number(p.stock) || 0)} {p.unit}
                      </strong>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-3 pt-2" style={{ borderTop: '1px solid var(--border-color)' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm flex-1"
                      onClick={() => handleOpenPriceModal(p)}
                    >
                      <DollarSign size={15} />
                      <span>ปรับราคา</span>
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm flex-1"
                      onClick={() => {
                        playClickSound();
                        setStickerProduct(p);
                      }}
                    >
                      <Printer size={15} />
                      <span>สติกเกอร์</span>
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
                      <History size={15} />
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
                  const isOutOfStock = p.stock <= 0;
                  const isLowStock = p.stock > 0 && p.stock <= p.minStockAlert;
                  const profit = p.sellPrice - (p.costPrice || 0);
                  const marginPct = p.sellPrice > 0 ? ((profit / p.sellPrice) * 100).toFixed(0) : 0;

                  return (
                    <tr key={p.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <ProductThumbnail product={p} size={42} />
                          <div>
                            <strong className="block">{p.name}</strong>
                            <span className="text-xs text-muted">จุดเตือน: {p.minStockAlert} {p.unit}</span>
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
                      <td>{p.costPrice ? `${p.costPrice.toFixed(2)} ฿` : '-'}</td>
                      <td>
                        <strong className="text-primary font-bold">
                          {p.sellPrice.toFixed(2)} ฿
                        </strong>
                      </td>
                      <td>
                        <span className="text-success text-xs font-medium">
                          +{profit.toFixed(2)} ฿ ({marginPct}%)
                        </span>
                      </td>
                      <td>
                        <strong className={`font-mono ${isOutOfStock ? 'text-danger' : isLowStock ? 'text-warning' : 'text-success'}`}>
                          {p.isWeighted ? (Number(p.stock) || 0).toFixed(3) : (Number(p.stock) || 0)} {p.unit}
                        </strong>
                      </td>
                      <td>
                        {isOutOfStock ? (
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
            <div className="history-list-scroll max-h-96 overflow-y-auto">
              {stockMovements.filter((m) => m.productId === viewHistoryProduct.id).length === 0 ? (
                <p className="text-center text-muted py-6">ยังไม่มีประวัติการเคลื่อนไหวสต็อกของสินค้านี้</p>
              ) : (
                <table className="pos-table text-sm">
                  <thead>
                    <tr>
                      <th>เวลา</th>
                      <th>ประเภท</th>
                      <th>จำนวน</th>
                      <th>เหตุผล</th>
                      <th>ผู้ทำ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockMovements
                      .filter((m) => m.productId === viewHistoryProduct.id)
                      .map((m) => (
                        <tr key={m.id}>
                          <td>{new Date(m.timestamp).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}</td>
                          <td>
                            <span className={`badge-tag ${m.type === 'restock' ? 'tag-low' : m.type === 'sale' ? 'tag-out' : 'tag-discrete'}`}>
                              {m.type === 'sale' ? 'ขาย' : m.type === 'restock' ? 'รับเข้า' : 'ปรับยอด'}
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
      />
    </div>
  );
}
