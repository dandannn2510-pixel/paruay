import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  Camera,
  Barcode,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  PauseCircle,
  PlayCircle,
  CheckCircle2,
  Scale,
  Sparkles,
  ArrowRight,
  RotateCcw,
  UserCheck,
  Menu,
  DollarSign,
  Edit,
  Smartphone,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { useHardwareScanner } from '../hooks/useHardwareScanner';
import { WeightCalculatorModal } from '../components/WeightCalculatorModal';
import { CameraScannerModal } from '../components/CameraScannerModal';
import { RemoteScannerPairModal } from '../components/RemoteScannerPairModal';
import { UnregisteredItemModal } from '../components/UnregisteredItemModal';
import { PaymentModal } from '../components/PaymentModal';
import { ParkedBillsModal } from '../components/ParkedBillsModal';
import { EasyAddProductModal } from '../components/EasyAddProductModal';
import { TwoShotAddProductModal } from '../components/TwoShotAddProductModal';
import { QuickPriceModal } from '../components/QuickPriceModal';
import { getProductPhotoUrl, handleImageFallback } from '../utils/imageUtils';
import { playScanBeep, playErrorBuzz, playClickSound, playCashRegisterChime } from '../utils/sound';
import {
  getOrCreatePairCode,
  generateNewPairCode,
  createScannerHost,
} from '../services/remoteScannerService';

export function PosView({ onOpenMenu }) {
  const {
    products,
    categories,
    cart,
    parkedBills,
    userRole,
    settings,
    setUserRole,
    addToCart,
    updateCartItemQty,
    removeFromCart,
    clearCart,
    parkBill,
    checkoutSale,
    addProduct,
  } = useStore();

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const searchInputRef = useRef(null);

  // Modals state
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isWeightModalOpen, setIsWeightModalOpen] = useState(false);
  const [selectedWeightProduct, setSelectedWeightProduct] = useState(null);

  const [isUnregisteredModalOpen, setIsUnregisteredModalOpen] = useState(false);
  const [unregisteredBarcode, setUnregisteredBarcode] = useState('');

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isParkedModalOpen, setIsParkedModalOpen] = useState(false);
  const [isEasyAddOpen, setIsEasyAddOpen] = useState(false);
  const [isTwoShotOpen, setIsTwoShotOpen] = useState(false);
  const [editingPriceProduct, setEditingPriceProduct] = useState(null);

  // Cheerful checkout success toast (replaces receipt modal)
  const [checkoutSuccessToast, setCheckoutSuccessToast] = useState(null);

  // Remote Handheld Scanner Bridge
  const [pairCode, setPairCode] = useState(getOrCreatePairCode);
  const [isRemotePairModalOpen, setIsRemotePairModalOpen] = useState(false);
  const [remoteClientStatus, setRemoteClientStatus] = useState({ connected: false });
  const [recentRemoteScans, setRecentRemoteScans] = useState([]);
  const hostServiceRef = useRef(null);

  // Mobile cart drawer expand state
  const [isMobileCartExpanded, setIsMobileCartExpanded] = useState(false);

  // Cart totals
  const cartSubtotal = cart.reduce((sum, item) => sum + (Number(item?.subtotal) || 0), 0);
  const cartTotalItems = cart.reduce((sum, item) => sum + (item?.isWeighted ? 1 : (Number(item?.qty) || 1)), 0);

  // Handle scanned barcode (from Camera or Hardware Scanner)
  const handleBarcodeScanned = (scannedCode) => {
    if (!scannedCode) return;
    const cleanCode = String(scannedCode).trim();

    const matched = products.find(
      (p) => p.active && String(p.barcode).trim() === cleanCode
    );

    if (matched) {
      if (matched.isWeighted || matched.type === 'fresh' || matched.type === 'raw_bulk') {
        setSelectedWeightProduct(matched);
        setIsWeightModalOpen(true);
      } else {
        addToCart(matched, { quantity: 1 });
      }
    } else {
      playErrorBuzz();
      setUnregisteredBarcode(cleanCode);
      setIsUnregisteredModalOpen(true);
    }
  };

  // Initialize Remote Scanner Host Bridge (Supabase Realtime)
  useEffect(() => {
    const host = createScannerHost({
      pairCode,
      onClientStatusChange: (status) => {
        setRemoteClientStatus(status);
      },
      onBarcodeReceived: (scannedCode) => {
        const clean = String(scannedCode).trim();
        const matched = products.find((p) => p.active && String(p.barcode).trim() === clean);
        handleBarcodeScanned(clean);

        const timeStr = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
        setRecentRemoteScans((prev) => [
          {
            barcode: clean,
            productName: matched?.name || 'สินค้าใหม่',
            price: matched?.sellPrice || 0,
            time: timeStr,
          },
          ...prev.slice(0, 19),
        ]);

        return {
          productName: matched?.name || 'รับรหัสแล้ว',
          price: matched?.sellPrice || 0,
          cartCount: cartTotalItems + 1,
        };
      },
    });

    hostServiceRef.current = host;
    return () => {
      if (hostServiceRef.current) {
        hostServiceRef.current.destroy();
        hostServiceRef.current = null;
      }
    };
  }, [pairCode, products, cartTotalItems]);

  const handleGenerateNewPairCode = () => {
    const newCode = generateNewPairCode();
    setPairCode(newCode);
  };

  // Hardware Barcode Scanner listener (USB / Bluetooth gun)
  useHardwareScanner((code) => {
    handleBarcodeScanned(code);
  });

  // Handle user tapping on product card
  const handleProductClick = (product) => {
    playClickSound();
    if (product.isWeighted || product.type === 'fresh' || product.type === 'raw_bulk') {
      setSelectedWeightProduct(product);
      setIsWeightModalOpen(true);
    } else {
      addToCart(product, { quantity: 1 });
    }
  };

  // Filter products by category and search
  const filteredProducts = products.filter((p) => {
    if (!p.active) return false;
    const matchesCategory =
      selectedCategory === 'all' || p.categoryId === selectedCategory;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      (p.barcode && p.barcode.toLowerCase().includes(q));
    return matchesCategory && matchesSearch;
  });

  // Quick sale of unregistered item
  const handleQuickUnregisteredSale = (saleData) => {
    addToCart(null, {
      isUnregistered: true,
      customName: saleData.customName,
      customPrice: saleData.customPrice,
      customCost: saleData.customCost,
      quantity: saleData.quantity,
      barcode: saleData.barcode,
    });
  };

  // Register brand new product from unregistered modal
  const handleRegisterNewProduct = (productData) => {
    const newProd = addProduct(productData);
    addToCart(newProd, { quantity: 1 });
  };

  // Complete checkout (receipt modal removed per user instruction)
  const handleCompleteSale = (paymentData) => {
    try {
      const saleResult = checkoutSale(paymentData);
      if (saleResult) {
        playCashRegisterChime();
        setCheckoutSuccessToast({
          billNumber: saleResult.billNumber,
          total: Number(saleResult.total) || 0,
          paymentMethod: saleResult.paymentMethod,
          change: Number(saleResult.change) || 0,
        });
        setIsMobileCartExpanded(false);
        setTimeout(() => {
          setCheckoutSuccessToast(null);
        }, 4000);
      }
      return saleResult;
    } catch (err) {
      console.error('Checkout error:', err);
      alert('เกิดข้อผิดพลาดในการบันทึกบิล กรุณาลองใหม่อีกครั้ง');
      return null;
    }
  };

  // Quick parking of current bill
  const handleParkBill = () => {
    if (cart.length === 0) return;
    playClickSound();
    const success = parkBill();
    if (success) {
      setIsMobileCartExpanded(false);
    }
  };

  return (
    <div className="pos-layout">
      {/* Toast Alert when Sale Completes */}
      {checkoutSuccessToast && (
        <div className="floating-sale-toast animate-slide-up">
          <CheckCircle2 size={24} className="text-white" />
          <div className="toast-content">
            <h4 className="font-bold">ชำระเงินเรียบร้อยแล้ว!</h4>
            <p className="text-xs">
              ยอด {(Number(checkoutSuccessToast.total) || 0).toFixed(2)} บาท{' '}
              {checkoutSuccessToast.change > 0 && `(เงินทอน ${(Number(checkoutSuccessToast.change) || 0).toFixed(2)} ฿)`}
            </p>
          </div>
        </div>
      )}

      {/* LEFT/MAIN: Catalog & Scanner View */}
      <div className="pos-catalog-panel">
        {/* Top Action Bar */}
        <div className="pos-top-bar">
          <div className="search-and-scan-group">
            {onOpenMenu && (
              <button
                type="button"
                className="btn-menu-drawer"
                onClick={onOpenMenu}
                title="เปิดเมนูร้านค้า"
              >
                <Menu size={22} />
              </button>
            )}

            <div className="pos-search-wrapper">
              <Search className="search-icon" size={18} />
              <input
                ref={searchInputRef}
                type="text"
                className="pos-search-input"
                placeholder="ค้นหาชื่อ หรือยิงบาร์โค้ด..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchQuery.trim()) {
                    handleBarcodeScanned(searchQuery.trim());
                    setSearchQuery('');
                  }
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="clear-search-btn"
                  onClick={() => setSearchQuery('')}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Live Camera Scanner Button */}
            <button
              type="button"
              className="btn btn-camera-scanner"
              onClick={() => {
                playClickSound();
                setIsCameraOpen(true);
              }}
              title="เปิดกล้องสแกนบาร์โค้ดบนเครื่องนี้"
            >
              <Camera size={18} />
              <span className="btn-text-responsive">เปิดกล้อง</span>
            </button>

            {/* Remote Phone Scanner Pair Button */}
            <button
              type="button"
              className={`btn btn-remote-scanner ${remoteClientStatus.connected ? 'is-connected' : ''}`}
              onClick={() => {
                playClickSound();
                setIsRemotePairModalOpen(true);
              }}
              title="เชื่อมต่อมือถือเป็นปืนสแกนเนอร์ไร้สาย (ข้อมูลจะเด้งมาที่หน้านี้ทันที)"
            >
              <Smartphone size={18} className={remoteClientStatus.connected ? 'text-emerald-400' : ''} />
              <span className="btn-text-responsive">
                {remoteClientStatus.connected ? 'มือถือเชื่อมแล้ว' : 'ต่อมือถือสแกน'}
              </span>
              {remoteClientStatus.connected && <span className="status-dot-pulse bg-emerald-400" />}
            </button>

            {/* Quick Add Product Button */}
            <button
              type="button"
              className="btn btn-primary btn-sm font-bold"
              onClick={() => {
                playClickSound();
                setIsEasyAddOpen(true);
              }}
              title="เพิ่มสินค้าใหม่เข้าร้านทันที"
            >
              <Plus size={18} />
              <span className="btn-text-responsive">+ สินค้า</span>
            </button>

            {/* 2-Shot AI Add Product Button */}
            <button
              type="button"
              className="btn btn-two-shot-trigger"
              onClick={() => {
                playClickSound();
                setIsTwoShotOpen(true);
              }}
              title="ถ่าย 2 รูปเพิ่มสินค้า (1. รูปฉลากเพื่อเอาชื่อ + 2. รูปบาร์โค้ดเพื่อเอารหัส)"
            >
              <Sparkles size={17} className="two-shot-sparkle-icon" />
              <span className="btn-text-responsive">ถ่าย 2 รูป</span>
            </button>
          </div>

          {/* Parked bills badge bar */}
          {parkedBills.length > 0 && (
            <div className="pos-header-badges">
              <button
                type="button"
                className="badge-btn badge-parked"
                onClick={() => setIsParkedModalOpen(true)}
              >
                <PauseCircle size={15} />
                <span>บิลพัก ({parkedBills.length})</span>
              </button>
            </div>
          )}
        </div>

        {/* Categories Bar */}
        <div className="category-scroll-bar">
          <button
            type="button"
            className={`cat-pill ${selectedCategory === 'all' ? 'active' : ''}`}
            onClick={() => {
              playClickSound();
              setSelectedCategory('all');
            }}
          >
            ทั้งหมด ({products.length})
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={`cat-pill ${selectedCategory === cat.id ? 'active' : ''}`}
              onClick={() => {
                playClickSound();
                setSelectedCategory(cat.id);
              }}
            >
              {cat.icon} {cat.name}
            </button>
          ))}
        </div>

        {/* Product Cards Grid with Real Product Photos */}
        <div className="product-grid-container">
          {filteredProducts.length === 0 ? (
            <div className="empty-catalog-message">
              <Barcode size={44} className="text-muted" />
              <p>ไม่พบสินค้าที่ตรงกับการค้นหา "{searchQuery}"</p>
              <button
                type="button"
                className="btn btn-primary btn-sm mt-2"
                onClick={() => {
                  setUnregisteredBarcode(searchQuery);
                  setIsUnregisteredModalOpen(true);
                }}
              >
                + ขายรายการนี้เป็นสินค้านอกคลัง
              </button>
            </div>
          ) : (
            <div className="product-cards-grid">
              {filteredProducts.map((p) => {
                const isFresh = p.isWeighted || p.type === 'fresh' || p.type === 'raw_bulk';
                const isLowStock = p.stock <= p.minStockAlert;
                const isOutOfStock = p.stock <= 0;

                return (
                  <div
                    key={p.id}
                    className={`product-pos-card ${isOutOfStock ? 'out-of-stock' : ''}`}
                    onClick={() => handleProductClick(p)}
                  >
                    <div className="card-image-wrap">
                      <img
                        src={getProductPhotoUrl(p)}
                        alt={p.name}
                        className="product-card-photo"
                        loading="lazy"
                        onError={(e) => handleImageFallback(e, p.categoryId)}
                      />

                      <div className="badge-group-overlay">
                        {isFresh && (
                          <span className="badge-tag tag-scale">
                            <Scale size={11} /> ชั่ง นน.
                          </span>
                        )}
                        {isOutOfStock ? (
                          <span className="badge-tag tag-out">หมด</span>
                        ) : isLowStock ? (
                          <span className="badge-tag tag-low">ใกล้หมด</span>
                        ) : null}
                      </div>
                    </div>

                    <div className="card-info">
                      <h4 className="prod-name" title={p.name}>
                        {p.name}
                      </h4>
                      <div className="prod-price-row">
                        <span className="prod-price">
                          {(Number(p.sellPrice) || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                          <small className="unit-label"> ฿/{p.unit}</small>
                        </span>
                        <button
                          type="button"
                          className="btn-quick-price-edit"
                          title="ปรับราคาด่วน"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingPriceProduct(p);
                          }}
                        >
                          <Edit size={11} />
                        </button>
                      </div>
                      <span className="prod-stock-hint">
                        เหลือ: {p.isWeighted ? (Number(p.stock) || 0).toFixed(3) : (Number(p.stock) || 0)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT/BOTTOM: Cart & Checkout Panel */}
      <div className={`pos-cart-panel ${isMobileCartExpanded ? 'mobile-expanded' : ''}`}>
        {/* Cart Header */}
        <div className="cart-header">
          <div className="cart-header-title">
            <ShoppingCart size={20} className="text-primary" />
            <h3>รายการในบิล ({cart.length})</h3>
          </div>
          <div className="cart-header-actions">
            {cart.length > 0 && (
              <>
                <button
                  type="button"
                  className="cart-mini-action text-warning"
                  onClick={handleParkBill}
                  title="พักบิลนี้ไว้ก่อน"
                >
                  <PauseCircle size={16} />
                  <span>พักบิล</span>
                </button>
                <button
                  type="button"
                  className="cart-mini-action text-danger"
                  onClick={() => {
                    if (confirm('ต้องการล้างรายการในบิลทั้งหมดใช่หรือไม่?')) {
                      clearCart();
                    }
                  }}
                  title="ล้างรายการ"
                >
                  <RotateCcw size={16} />
                  <span>ล้าง</span>
                </button>
              </>
            )}
            <button
              type="button"
              className="mobile-cart-toggle-btn"
              onClick={() => setIsMobileCartExpanded(!isMobileCartExpanded)}
            >
              {isMobileCartExpanded ? '▼ ปิดดูบิล' : '▲ ดูรายการ'}
            </button>
          </div>
        </div>

        {/* Cart Items List */}
        <div className="cart-items-scroll">
          {cart.length === 0 ? (
            <div className="cart-empty-state">
              <ShoppingCart size={40} className="text-muted" />
              <p>ยังไม่มีสินค้าในบิล</p>
              <small className="text-muted">แตะที่สินค้า หรือเปิดกล้องยิงบาร์โค้ดได้เลย</small>
            </div>
          ) : (
            <div className="cart-items-list">
              {cart.map((item) => (
                <div key={item.cartItemId} className="cart-row-item">
                  <div className="cart-row-info">
                    <div className="cart-item-title-line">
                      <span className="item-name font-medium">{item.name}</span>
                      {item.isUnregistered && (
                        <span className="badge-tag tag-unreg">นอกคลัง</span>
                      )}
                      {item.isWeighted && (
                        <span className="badge-tag tag-scale">ชั่ง นน.</span>
                      )}
                    </div>
                    <div className="cart-item-price-unit text-muted">
                      @{(Number(item?.sellPrice) || 0).toFixed(2)} บาท/{item?.unit || 'ชิ้น'}
                    </div>
                  </div>

                  {/* Quantity & Weight Controls */}
                  <div className="cart-row-controls">
                    {item?.isWeighted ? (
                      <div className="weighted-control-box">
                        <span className="weighted-qty font-bold text-accent">
                          {(Number(item?.qty) || 0).toFixed(3)} {item?.unit || 'กก.'}
                        </span>
                      </div>
                    ) : (
                      <div className="discrete-qty-stepper">
                        <button
                          type="button"
                          className="qty-btn"
                          onClick={() => {
                            playClickSound();
                            updateCartItemQty(item.cartItemId, item.qty - 1);
                          }}
                        >
                          <Minus size={13} />
                        </button>
                        <span className="qty-number font-bold">{item.qty}</span>
                        <button
                          type="button"
                          className="qty-btn"
                          onClick={() => {
                            playClickSound();
                            updateCartItemQty(item.cartItemId, item.qty + 1);
                          }}
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                    )}

                    <div className="cart-row-subtotal">
                      <span className="subtotal-amount font-bold">
                        {(Number(item?.subtotal) || 0).toFixed(2)} ฿
                      </span>
                    </div>

                    <button
                      type="button"
                      className="cart-item-delete-btn"
                      onClick={() => {
                        playClickSound();
                        removeFromCart(item.cartItemId);
                      }}
                      title="ลบรายการ"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cart Bottom Summary & Checkout Button */}
        <div className="cart-checkout-footer">
          <div className="cart-summary-line">
            <span className="summary-label">ยอดรวม:</span>
            <div className="summary-total-val">
              <span className="amount-highlight">
                {(Number(cartSubtotal) || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="curr"> บาท</span>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-checkout-giant"
            disabled={cart.length === 0}
            onClick={() => {
              playClickSound();
              setIsPaymentModalOpen(true);
            }}
          >
            <span>คิดเงิน / ชำระ</span>
            <span className="checkout-total-pill">
              {(Number(cartSubtotal) || 0).toFixed(2)} ฿
            </span>
            <ArrowRight size={22} />
          </button>
        </div>
      </div>

      {/* --- MODALS --- */}

      {/* 1. Weight & Price Calculator Modal */}
      <WeightCalculatorModal
        product={selectedWeightProduct}
        isOpen={isWeightModalOpen}
        onClose={() => {
          setIsWeightModalOpen(false);
          setSelectedWeightProduct(null);
        }}
        onConfirm={(payload) => {
          addToCart(payload.product, {
            weightInKg: payload.weightInKg,
            priceTarget: payload.priceTarget,
          });
        }}
      />

      {/* 2. Mobile Camera Barcode Scanner Modal */}
      <CameraScannerModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onDetected={(code) => {
          handleBarcodeScanned(code);
        }}
      />

      {/* 3. Unregistered Item Modal */}
      <UnregisteredItemModal
        isOpen={isUnregisteredModalOpen}
        barcode={unregisteredBarcode}
        onClose={() => {
          setIsUnregisteredModalOpen(false);
          setUnregisteredBarcode('');
        }}
        onQuickSale={handleQuickUnregisteredSale}
        onRegisterNew={handleRegisterNewProduct}
      />

      {/* 4. Payment Modal */}
      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        onCompleteSale={handleCompleteSale}
      />

      {/* 5. Parked Bills Modal */}
      <ParkedBillsModal
        isOpen={isParkedModalOpen}
        onClose={() => setIsParkedModalOpen(false)}
      />

      {/* 6. Easy Add Product Modal */}
      <EasyAddProductModal
        isOpen={isEasyAddOpen}
        onClose={() => setIsEasyAddOpen(false)}
        onOpenTwoShot={() => setIsTwoShotOpen(true)}
      />

      {/* 6.5. Two-Shot AI Add Product Modal */}
      <TwoShotAddProductModal
        isOpen={isTwoShotOpen}
        onClose={() => setIsTwoShotOpen(false)}
        onProductCreated={(newProd) => {
          if (newProd && !newProd.isWeighted) {
            addToCart(newProd, { quantity: 1 });
          }
        }}
      />

      {/* 7. Quick Price Modal */}
      <QuickPriceModal
        product={editingPriceProduct}
        isOpen={Boolean(editingPriceProduct)}
        onClose={() => setEditingPriceProduct(null)}
      />

      {/* 8. Remote Scanner Phone Pairing Modal */}
      <RemoteScannerPairModal
        isOpen={isRemotePairModalOpen}
        onClose={() => setIsRemotePairModalOpen(false)}
        pairCode={pairCode}
        onGenerateNewCode={handleGenerateNewPairCode}
        clientStatus={remoteClientStatus}
        recentRemoteScans={recentRemoteScans}
      />
    </div>
  );
}
