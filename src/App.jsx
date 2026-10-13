import React, { useState } from 'react';
import {
  ShoppingCart,
  LayoutDashboard,
  Package,
  PlusCircle,
  Layers,
  Tag,
  FileText,
  Settings,
  Store,
  UserCheck,
  ShieldAlert,
  Volume2,
  VolumeX,
  Menu,
  X,
  ArrowLeft,
  ChevronRight,
  Smartphone,
} from 'lucide-react';
import { useStore } from './context/StoreContext';
import { PosView } from './views/PosView';
import { DashboardView } from './views/DashboardView';
import { InventoryView } from './views/InventoryView';
import { RestockView } from './views/RestockView';
import { StockAuditView } from './views/StockAuditView';
import { ProductsView } from './views/ProductsView';
import { ReportsView } from './views/ReportsView';
import { SettingsView } from './views/SettingsView';
import { MobileScannerView } from './views/MobileScannerView';
import { playClickSound } from './utils/sound';

export default function App() {
  const { settings, setSettings, userRole, setUserRole } = useStore();
  const [currentView, setCurrentView] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('mode') === 'scanner' || params.has('scanner') || params.has('pair')) {
        return 'mobileScanner';
      }
      if (params.get('view')) {
        return params.get('view');
      }
    }
    return 'pos';
  });
  const [isMenuDrawerOpen, setIsMenuDrawerOpen] = useState(false);

  const urlPairCode = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('pair') || ''
    : '';

  // Administrative / Secondary menu items
  const menuItems = [
    { id: 'pos', label: 'หน้าขายสินค้า (POS)', desc: 'ยิงบาร์โค้ด & ชั่งน้ำหนัก', icon: ShoppingCart, isPrimary: true },
    { id: 'mobileScanner', label: '📱 ปืนสแกนมือถือ (ส่งเข้า iPad)', desc: 'ใช้มือถือเป็นเครื่องสแกนไร้สาย', icon: Smartphone },
    { id: 'dashboard', label: 'ภาพรวม & เตือนสต็อก', desc: 'ยอดขายวันนี้ & ของใกล้หมด', icon: LayoutDashboard },
    { id: 'inventory', label: 'คลังสินค้า & ปรับราคา', desc: 'ดูสต็อก & ปรับราคาของสด', icon: Package },
    { id: 'restock', label: 'รับของเข้าสต็อก', desc: 'เติมสินค้า & บันทึกราคาทุน', icon: PlusCircle },
    { id: 'stockAudit', label: 'ตรวจนับสต็อกบนชั้น', desc: 'นับของจริง & บันทึกส่วนต่าง', icon: Layers },
    { id: 'products', label: 'จัดการรายการสินค้า', desc: 'เพิ่ม/แก้ไข & พิมพ์บาร์โค้ด', icon: Tag },
    { id: 'reports', label: 'รายงานยอดขาย & ปิดกะ', desc: 'สรุปยอดเงิน & นับเงินลิ้นชัก', icon: FileText },
    { id: 'settings', label: 'ตั้งค่าร้าน & รูป QR', desc: 'ป้าย QR ถาวร & รหัส PIN', icon: Settings },
  ];

  const handleNavClick = (viewId) => {
    playClickSound();
    setCurrentView(viewId);
    setIsMenuDrawerOpen(false);
  };

  const toggleSound = () => {
    setSettings((prev) => ({
      ...prev,
      soundEnabled: !prev.soundEnabled,
    }));
  };

  const toggleRole = () => {
    playClickSound();
    setUserRole(userRole === 'owner' ? 'cashier' : 'owner');
  };

  return (
    <div className="app-container">
      {/* Top Application Header */}
      <header className="app-header">
        <div className="header-left-group">
          {currentView !== 'pos' ? (
            <button
              type="button"
              className="btn-back-pos"
              onClick={() => handleNavClick('pos')}
              title="กลับไปหน้าขาย"
            >
              <ArrowLeft size={20} />
              <span>หน้าขาย</span>
            </button>
          ) : (
            <div className="header-brand" onClick={() => handleNavClick('pos')}>
              <img src="/logo.png" alt="พารวย" className="brand-logo-img" />
              <div className="brand-titles">
                <h1 className="brand-name">พารวย</h1>
                <span className="brand-tagline">ร้านนี้ดี ค้าขาย ร่ำรวย</span>
              </div>
            </div>
          )}
        </div>

        {/* Current Screen Title if not in POS */}
        {currentView !== 'pos' && (
          <div className="header-screen-indicator">
            <span className="screen-title-text">
              {menuItems.find((m) => m.id === currentView)?.label}
            </span>
          </div>
        )}

        {/* Right Header Controls */}
        <div className="header-right-badges">
          {/* Sound Toggle */}
          <button
            type="button"
            className="icon-tool-btn"
            onClick={toggleSound}
            title={settings.soundEnabled ? 'ปิดเสียง' : 'เปิดเสียง'}
          >
            {settings.soundEnabled ? (
              <Volume2 size={18} className="text-primary" />
            ) : (
              <VolumeX size={18} className="text-muted" />
            )}
          </button>

          {/* User Role Toggle */}
          <button
            type="button"
            className={`role-toggle-pill ${userRole === 'owner' ? 'owner-badge' : 'cashier-badge'}`}
            onClick={toggleRole}
            title="กดเพื่อสลับบทบาท เจ้าของร้าน / แคชเชียร์"
          >
            {userRole === 'owner' ? <ShieldAlert size={14} /> : <UserCheck size={14} />}
            <span className="hide-on-mobile">{userRole === 'owner' ? 'เจ้าของร้าน' : 'แคชเชียร์'}</span>
          </button>

          {/* Drawer Menu Button */}
          <button
            type="button"
            className="btn-header-menu"
            onClick={() => {
              playClickSound();
              setIsMenuDrawerOpen(true);
            }}
            title="เปิดแถบเมนูร้านค้า"
          >
            <Menu size={22} />
            <span className="hide-on-mobile">เมนู</span>
          </button>
        </div>
      </header>

      {/* Main View Area */}
      <main className="app-main-content">
        {currentView === 'pos' && (
          <PosView onOpenMenu={() => setIsMenuDrawerOpen(true)} />
        )}
        {currentView === 'mobileScanner' && (
          <MobileScannerView
            initialPairCode={urlPairCode}
            onExit={() => handleNavClick('pos')}
          />
        )}
        {currentView === 'dashboard' && <DashboardView onNavigate={handleNavClick} />}
        {currentView === 'inventory' && <InventoryView onNavigate={handleNavClick} />}
        {currentView === 'restock' && <RestockView onNavigate={handleNavClick} />}
        {currentView === 'stockAudit' && <StockAuditView />}
        {currentView === 'products' && <ProductsView />}
        {currentView === 'reports' && <ReportsView />}
        {currentView === 'settings' && <SettingsView />}
      </main>

      {/* Slide-out Drawer Menu (แถบเมนูสำหรับจัดการร้าน) */}
      {isMenuDrawerOpen && (
        <div className="drawer-overlay" onClick={() => setIsMenuDrawerOpen(false)}>
          <div
            className="drawer-panel animate-slide-right"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header with Logo */}
            <div className="drawer-header">
              <div className="drawer-brand">
                <img src="/logo.png" alt="พารวย" className="drawer-logo-img" />
                <div>
                  <h3 className="drawer-shop-name">ร้านพารวย</h3>
                  <p className="drawer-tagline">ร้านนี้ดี ค้าขาย ร่ำรวย</p>
                </div>
              </div>
              <button
                type="button"
                className="icon-btn close-drawer-btn"
                onClick={() => setIsMenuDrawerOpen(false)}
              >
                <X size={22} />
              </button>
            </div>

            {/* Drawer Menu Items */}
            <div className="drawer-menu-list">
              <div className="menu-group-label">เมนูหลักหน้าร้าน</div>
              <button
                type="button"
                className={`drawer-menu-item ${currentView === 'pos' ? 'active pos-highlight' : ''}`}
                onClick={() => handleNavClick('pos')}
              >
                <div className="item-icon-wrap primary-wrap">
                  <ShoppingCart size={20} />
                </div>
                <div className="item-text-wrap">
                  <span className="item-title">หน้าขายสินค้า (POS)</span>
                  <span className="item-desc">ยิงบาร์โค้ด & ชั่งน้ำหนักคิดเงิน</span>
                </div>
                <ChevronRight size={18} className="text-muted" />
              </button>

              <div className="menu-group-label mt-3">ระบบจัดการคลัง & การเงิน</div>
              {menuItems
                .filter((item) => item.id !== 'pos')
                .map((item) => {
                  const Icon = item.icon;
                  const isActive = currentView === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`drawer-menu-item ${isActive ? 'active' : ''}`}
                      onClick={() => handleNavClick(item.id)}
                    >
                      <div className="item-icon-wrap">
                        <Icon size={18} />
                      </div>
                      <div className="item-text-wrap">
                        <span className="item-title">{item.label}</span>
                        <span className="item-desc">{item.desc}</span>
                      </div>
                      <ChevronRight size={16} className="text-muted" />
                    </button>
                  );
                })}
            </div>

            {/* Drawer Footer */}
            <div className="drawer-footer">
              <div className="drawer-role-box">
                <span className="text-xs text-muted">สถานะผู้ใช้งาน:</span>
                <strong className={userRole === 'owner' ? 'text-warning' : 'text-accent'}>
                  {userRole === 'owner' ? '👑 เจ้าของร้าน (สิทธิ์เต็ม)' : '👤 แคชเชียร์'}
                </strong>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm w-full"
                onClick={toggleRole}
              >
                สลับเป็น {userRole === 'owner' ? 'แคชเชียร์' : 'เจ้าของร้าน'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
