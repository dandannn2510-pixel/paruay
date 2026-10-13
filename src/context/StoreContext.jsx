import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { INITIAL_CATEGORIES, INITIAL_PRODUCTS, INITIAL_SETTINGS, INITIAL_SUPPLIERS } from '../data/initialData';
import { playScanBeep, playErrorBuzz, playCashRegisterChime } from '../utils/sound';
import { getSupabaseClient, testSupabaseConnection } from '../utils/supabase';

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const LS_PREFIX = 'paruay_pos_';

  // 1. Products
  const [products, setProducts] = useState(() => {
    try {
      const saved = localStorage.getItem(LS_PREFIX + 'products');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          if (!parsed[0].image || (!parsed[0].image.startsWith('http') && !parsed[0].image.startsWith('data:') && !parsed[0].image.startsWith('/'))) {
            return INITIAL_PRODUCTS;
          }
          return parsed.map((p) => ({
            ...p,
            sellPrice: Number(p.sellPrice) || 0,
            costPrice: Number(p.costPrice) || 0,
            stock: Number(p.stock) || 0,
            minStockAlert: Number(p.minStockAlert) || 0,
          }));
        }
      }
      return INITIAL_PRODUCTS;
    } catch {
      return INITIAL_PRODUCTS;
    }
  });

  // 2. Categories
  const [categories] = useState(() => {
    try {
      const saved = localStorage.getItem(LS_PREFIX + 'categories');
      return saved ? JSON.parse(saved) : INITIAL_CATEGORIES;
    } catch {
      return INITIAL_CATEGORIES;
    }
  });

  // 3. Suppliers
  const [suppliers, setSuppliers] = useState(() => {
    try {
      const saved = localStorage.getItem(LS_PREFIX + 'suppliers');
      return saved ? JSON.parse(saved) : INITIAL_SUPPLIERS;
    } catch {
      return INITIAL_SUPPLIERS;
    }
  });

  // 4. Settings
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem(LS_PREFIX + 'settings');
      return saved ? { ...INITIAL_SETTINGS, ...JSON.parse(saved) } : INITIAL_SETTINGS;
    } catch {
      return INITIAL_SETTINGS;
    }
  });

  // 5. Active User Role: 'owner' | 'cashier'
  const [userRole, setUserRole] = useState(() => {
    try {
      return localStorage.getItem(LS_PREFIX + 'user_role') || 'owner';
    } catch {
      return 'owner';
    }
  });

  // 6. Current Shift
  const [activeShift, setActiveShift] = useState(() => {
    try {
      const saved = localStorage.getItem(LS_PREFIX + 'active_shift');
      if (saved) return JSON.parse(saved);
      return {
        id: 'shift_' + Date.now(),
        cashierName: 'เจ้าของร้าน',
        openedAt: new Date().toISOString(),
        startCash: 1000,
        status: 'open',
        totalSales: 0,
        cashSales: 0,
        promptpaySales: 0,
        billCount: 0,
      };
    } catch {
      return null;
    }
  });

  // 7. Cart
  const [cart, setCart] = useState(() => {
    try {
      const saved = localStorage.getItem(LS_PREFIX + 'cart');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.map((item) => ({
            ...item,
            sellPrice: Number(item.sellPrice) || 0,
            costPrice: Number(item.costPrice) || 0,
            qty: Number(item.qty) || 1,
            subtotal: Number(item.subtotal) || ((Number(item.qty) || 1) * (Number(item.sellPrice) || 0)),
          }));
        }
      }
      return [];
    } catch {
      return [];
    }
  });

  // 8. Parked Bills
  const [parkedBills, setParkedBills] = useState(() => {
    try {
      const saved = localStorage.getItem(LS_PREFIX + 'parked_bills');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // 9. Sales History
  const [salesHistory, setSalesHistory] = useState(() => {
    try {
      const saved = localStorage.getItem(LS_PREFIX + 'sales_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // 10. Stock Movements History
  const [stockMovements, setStockMovements] = useState(() => {
    try {
      const saved = localStorage.getItem(LS_PREFIX + 'stock_movements');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // 11. Price Change History
  const [priceHistory, setPriceHistory] = useState(() => {
    try {
      const saved = localStorage.getItem(LS_PREFIX + 'price_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Cloud Sync State
  const [isCloudConnected, setIsCloudConnected] = useState(false);
  const [cloudSyncStatus, setCloudSyncStatus] = useState('offline'); // 'offline' | 'connected' | 'syncing'
  const isSyncingRef = useRef(false);

  // Safe localStorage helper to prevent quota crash (e.g. QuotaExceededError)
  const safeSetItem = (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch (err) {
      console.warn(`LocalStorage quota error for ${key}:`, err);
      if (key.includes('sales_history') || key.includes('stock_movements')) {
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed)) {
            // Keep only latest 30 records to free space
            localStorage.setItem(key, JSON.stringify(parsed.slice(0, 30)));
          }
        } catch (_) {}
      }
    }
  };

  // Sync state to LocalStorage safely
  useEffect(() => {
    safeSetItem(LS_PREFIX + 'products', JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    safeSetItem(LS_PREFIX + 'settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    safeSetItem(LS_PREFIX + 'user_role', userRole);
  }, [userRole]);

  useEffect(() => {
    safeSetItem(LS_PREFIX + 'active_shift', JSON.stringify(activeShift));
  }, [activeShift]);

  useEffect(() => {
    safeSetItem(LS_PREFIX + 'cart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    safeSetItem(LS_PREFIX + 'parked_bills', JSON.stringify(parkedBills));
  }, [parkedBills]);

  useEffect(() => {
    safeSetItem(LS_PREFIX + 'sales_history', JSON.stringify(salesHistory));
  }, [salesHistory]);

  useEffect(() => {
    safeSetItem(LS_PREFIX + 'stock_movements', JSON.stringify(stockMovements));
  }, [stockMovements]);

  // ---------- CLOUD SYNC & REALTIME SUBSCRIPTION ----------
  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setIsCloudConnected(false);
      setCloudSyncStatus('offline');
      return;
    }

    let isMounted = true;

    async function initCloud() {
      try {
        setCloudSyncStatus('syncing');
        // Fetch products from cloud
        const { data: cloudProds, error } = await supabase.from('products').select('*');
        if (error) {
          console.warn('Cloud fetch warning:', error.message);
          setCloudSyncStatus('offline');
          return;
        }

        if (isMounted) {
          setIsCloudConnected(true);
          setCloudSyncStatus('connected');

          if (cloudProds && cloudProds.length > 0) {
            // Map db snake_case to frontend camelCase
            const mapped = cloudProds.map((cp) => ({
              id: cp.id,
              name: cp.name,
              type: cp.type || 'packaged',
              categoryId: cp.category_id,
              costPrice: parseFloat(cp.cost_price) || 0,
              sellPrice: parseFloat(cp.sell_price) || 0,
              unit: cp.unit,
              isWeighted: Boolean(cp.is_weighted),
              minStockAlert: parseFloat(cp.min_stock_alert) || 0,
              stock: parseFloat(cp.stock) || 0,
              barcode: cp.barcode,
              image: cp.image,
              active: cp.active !== false,
            }));
            setProducts(mapped);
          } else {
            // Auto-seed Supabase with initial realistic products
            console.log('Seeding initial products to Supabase...');
            const seedRows = INITIAL_PRODUCTS.map((p) => ({
              id: p.id,
              name: p.name,
              type: p.type,
              category_id: p.categoryId,
              cost_price: p.costPrice,
              sell_price: p.sellPrice,
              unit: p.unit,
              is_weighted: p.isWeighted,
              min_stock_alert: p.minStockAlert,
              stock: p.stock,
              barcode: p.barcode,
              image: p.image,
              active: true,
            }));
            await supabase.from('products').insert(seedRows);
          }
        }
      } catch (err) {
        console.error('Cloud init error:', err);
        setCloudSyncStatus('offline');
      }
    }

    initCloud();

    // Subscribe to Realtime product stock changes across all devices!
    const channel = supabase
      .channel('public:products')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        (payload) => {
          if (!isMounted) return;
          console.log('Realtime product change from another device:', payload);
          if (payload.eventType === 'UPDATE' && payload.new) {
            const updated = payload.new;
            setProducts((prev) =>
              prev.map((p) =>
                p.id === updated.id
                  ? {
                      ...p,
                      name: updated.name || p.name,
                      sellPrice: updated.sell_price !== undefined ? (parseFloat(updated.sell_price) || 0) : p.sellPrice,
                      costPrice: updated.cost_price !== undefined ? (parseFloat(updated.cost_price) || 0) : p.costPrice,
                      stock: updated.stock !== undefined ? (parseFloat(updated.stock) || 0) : p.stock,
                    }
                  : p
              )
            );
          } else if (payload.eventType === 'INSERT' && payload.new) {
            const n = payload.new;
            setProducts((prev) => {
              if (prev.some((p) => p.id === n.id)) return prev;
              return [
                {
                  id: n.id,
                  name: n.name,
                  type: n.type,
                  categoryId: n.category_id,
                  costPrice: parseFloat(n.cost_price),
                  sellPrice: parseFloat(n.sell_price),
                  unit: n.unit,
                  isWeighted: Boolean(n.is_weighted),
                  minStockAlert: parseFloat(n.min_stock_alert),
                  stock: parseFloat(n.stock),
                  barcode: n.barcode,
                  image: n.image,
                  active: n.active !== false,
                },
                ...prev,
              ];
            });
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  /**
   * Connect to Supabase Cloud Database
   */
  const connectSupabase = async (url, key) => {
    const test = await testSupabaseConnection(url, key);
    if (!test.success) {
      return { success: false, message: test.message };
    }
    localStorage.setItem('paruay_supabase_url', url);
    localStorage.setItem('paruay_supabase_anon_key', key);
    setIsCloudConnected(true);
    setCloudSyncStatus('connected');
    window.location.reload();
    return { success: true };
  };

  /**
   * Disconnect from Cloud Database
   */
  const disconnectSupabase = () => {
    localStorage.removeItem('paruay_supabase_url');
    localStorage.removeItem('paruay_supabase_anon_key');
    setIsCloudConnected(false);
    setCloudSyncStatus('offline');
    window.location.reload();
  };

  // ---------- CART OPERATIONS ----------

  const addToCart = (product, options = {}) => {
    const {
      weightInKg = null,
      priceTarget = null,
      quantity = 1,
      isUnregistered = false,
      customName = '',
      customPrice = 0,
      customCost = 0,
    } = options;

    setCart((prevCart) => {
      // 1. Unregistered item
      if (isUnregistered) {
        const newItem = {
          cartItemId: 'item_' + Date.now() + Math.random().toString(36).substr(2, 4),
          productId: null,
          name: customName || 'สินค้านอกคลัง',
          sellPrice: Number(customPrice) || 0,
          costPrice: Number(customCost) || 0,
          qty: Number(quantity) || 1,
          unit: 'ชิ้น',
          isWeighted: false,
          isUnregistered: true,
          barcode: options.barcode || 'N/A',
          subtotal: (Number(customPrice) || 0) * (Number(quantity) || 1),
        };
        if (settings.soundEnabled) playScanBeep();
        return [...prevCart, newItem];
      }

      // 2. Weighted item (ผัก, ผลไม้, เนื้อสัตว์ ฯลฯ)
      if (product.isWeighted || product.type === 'fresh' || product.type === 'raw_bulk') {
        let finalWeight = 0;
        let finalSubtotal = 0;

        const prodSellPrice = Number(product.sellPrice) || 0;
        const prodCostPrice = Number(product.costPrice) || 0;

        if (priceTarget !== null && priceTarget !== undefined && priceTarget > 0) {
          finalSubtotal = Number(priceTarget);
          finalWeight = prodSellPrice > 0 ? Number((finalSubtotal / prodSellPrice).toFixed(3)) : 0;
        } else if (weightInKg !== null && weightInKg !== undefined && weightInKg > 0) {
          finalWeight = Number(Number(weightInKg).toFixed(3));
          finalSubtotal = Number((finalWeight * prodSellPrice).toFixed(2));
        } else {
          finalWeight = 1.0;
          finalSubtotal = prodSellPrice;
        }

        const weightedItem = {
          cartItemId: 'item_' + Date.now() + Math.random().toString(36).substr(2, 4),
          productId: product.id,
          name: product.name,
          sellPrice: prodSellPrice,
          costPrice: prodCostPrice,
          qty: finalWeight,
          weightInKg: finalWeight,
          unit: product.unit || 'กก.',
          isWeighted: true,
          isUnregistered: false,
          barcode: product.barcode,
          image: product.image,
          subtotal: finalSubtotal,
        };

        if (settings.soundEnabled) playScanBeep();
        return [...prevCart, weightedItem];
      }

      // 3. Packaged item
      const prodSellPrice = Number(product.sellPrice) || 0;
      const prodCostPrice = Number(product.costPrice) || 0;
      const addQty = Number(quantity) || 1;

      const existingIndex = prevCart.findIndex(
        (item) => item.productId === product.id && !item.isWeighted && !item.isUnregistered
      );

      if (existingIndex > -1) {
        const updated = [...prevCart];
        const currentItem = updated[existingIndex];
        const newQty = (Number(currentItem.qty) || 0) + addQty;
        const itemPrice = Number(currentItem.sellPrice) || prodSellPrice;
        updated[existingIndex] = {
          ...currentItem,
          sellPrice: itemPrice,
          qty: newQty,
          subtotal: Number((newQty * itemPrice).toFixed(2)),
        };
        if (settings.soundEnabled) playScanBeep();
        return updated;
      } else {
        const newItem = {
          cartItemId: 'item_' + Date.now() + Math.random().toString(36).substr(2, 4),
          productId: product.id,
          name: product.name,
          sellPrice: prodSellPrice,
          costPrice: prodCostPrice,
          qty: addQty,
          unit: product.unit || 'ชิ้น',
          isWeighted: false,
          isUnregistered: false,
          barcode: product.barcode,
          image: product.image,
          subtotal: Number((addQty * prodSellPrice).toFixed(2)),
        };
        if (settings.soundEnabled) playScanBeep();
        return [...prevCart, newItem];
      }
    });
  };

  const updateCartItemQty = (cartItemId, newQty) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.cartItemId === cartItemId) {
            const parsed = parseFloat(newQty);
            if (isNaN(parsed) || parsed <= 0) return null;
            const qty = item.isWeighted ? Number(parsed.toFixed(3)) : Math.round(parsed);
            return {
              ...item,
              qty,
              weightInKg: item.isWeighted ? qty : undefined,
              subtotal: Number((qty * (Number(item.sellPrice) || 0)).toFixed(2)),
            };
          }
          return item;
        })
        .filter(Boolean)
    );
  };

  const removeFromCart = (cartItemId) => {
    setCart((prev) => prev.filter((item) => item.cartItemId !== cartItemId));
  };

  const clearCart = () => {
    setCart([]);
  };

  const parkBill = (note = '') => {
    if (cart.length === 0) return false;
    const parked = {
      id: 'park_' + Date.now(),
      createdAt: new Date().toISOString(),
      note: note || `บิลพัก #${parkedBills.length + 1} (${cart.length} รายการ)`,
      items: [...cart],
      total: cart.reduce((sum, item) => sum + item.subtotal, 0),
    };
    setParkedBills((prev) => [parked, ...prev]);
    setCart([]);
    return true;
  };

  const restoreParkedBill = (parkedId) => {
    const target = parkedBills.find((b) => b.id === parkedId);
    if (!target) return false;
    setCart(target.items);
    setParkedBills((prev) => prev.filter((b) => b.id !== parkedId));
    return true;
  };

  const deleteParkedBill = (parkedId) => {
    setParkedBills((prev) => prev.filter((b) => b.id !== parkedId));
  };

  /**
   * Checkout & Complete Sale (Deducts stock locally and syncs to Supabase Cloud)
   */
  const checkoutSale = ({
    paymentMethod = 'cash',
    cashReceived = 0,
    change = 0,
    discount = 0,
    cashierName = 'เจ้าของร้าน',
  }) => {
    if (cart.length === 0) return null;

    const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
    const finalTotal = Math.max(0, subtotal - (Number(discount) || 0));

    const now = new Date();
    const dateStr = now.getFullYear().toString() +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0');
    const randomSeq = String(salesHistory.length + 1).padStart(4, '0');
    const billNumber = `INV-${dateStr}-${randomSeq}`;

    // Lightweight items representation (omits heavy base64 images to avoid quota and payload crashes)
    const sanitizedItems = cart.map((item) => ({
      cartItemId: item.cartItemId,
      productId: item.productId,
      name: item.name || 'สินค้า',
      sellPrice: Number(item.sellPrice) || 0,
      costPrice: Number(item.costPrice) || 0,
      qty: Number(item.qty) || 1,
      unit: item.unit || 'ชิ้น',
      subtotal: Number(item.subtotal) || 0,
      isWeighted: Boolean(item.isWeighted),
      isUnregistered: Boolean(item.isUnregistered),
      barcode: item.barcode || 'N/A',
    }));

    const newSale = {
      id: 'sale_' + Date.now(),
      billNumber,
      createdAt: now.toISOString(),
      cashierName,
      items: sanitizedItems,
      itemCount: sanitizedItems.length,
      subtotal,
      discount: Number(discount) || 0,
      total: finalTotal,
      paymentMethod,
      cashReceived: Number(cashReceived) || finalTotal,
      change: Number(change) || 0,
      status: 'completed',
    };

    // 1. Deduct Stock Locally
    const newMovements = [];
    const stockUpdatesForCloud = [];

    setProducts((prevProducts) => {
      const nextProducts = [...prevProducts];
      cart.forEach((cartItem) => {
        if (cartItem.productId && !cartItem.isUnregistered) {
          const pIndex = nextProducts.findIndex((p) => p.id === cartItem.productId);
          if (pIndex > -1) {
            const current = nextProducts[pIndex];
            const deductQty = Number(cartItem.qty) || 0;
            const currentStock = Number(current.stock) || 0;
            const newStockVal = Number((currentStock - deductQty).toFixed(3));
            nextProducts[pIndex] = {
              ...current,
              stock: newStockVal,
            };

            stockUpdatesForCloud.push({ id: current.id, newStock: newStockVal });

            newMovements.push({
              id: 'mov_' + Date.now() + Math.random().toString(36).substr(2, 4),
              productId: current.id,
              productName: current.name,
              type: 'sale',
              qty: -deductQty,
              unit: current.unit,
              reason: 'ขายสินค้าหน้าร้าน',
              performedBy: cashierName,
              timestamp: now.toISOString(),
              billRef: billNumber,
            });
          }
        }
      });
      return nextProducts;
    });

    if (newMovements.length > 0) {
      setStockMovements((prev) => [...newMovements, ...prev]);
    }

    setSalesHistory((prev) => [newSale, ...prev]);

    if (activeShift) {
      setActiveShift((prev) => {
        if (!prev) return prev;
        const curTotal = Number(prev.totalSales) || 0;
        const curCash = Number(prev.cashSales) || 0;
        const curPrompt = Number(prev.promptpaySales) || 0;
        const curBills = Number(prev.billCount) || 0;
        return {
          ...prev,
          totalSales: Number((curTotal + finalTotal).toFixed(2)),
          cashSales: paymentMethod === 'cash' ? Number((curCash + finalTotal).toFixed(2)) : curCash,
          promptpaySales: paymentMethod === 'promptpay' ? Number((curPrompt + finalTotal).toFixed(2)) : curPrompt,
          billCount: curBills + 1,
        };
      });
    }

    // 2. Cloud Sync (asynchronous without blocking the cashier)
    const supabase = getSupabaseClient();
    if (supabase) {
      (async () => {
        try {
          // Save sale to cloud
          await supabase.from('sales').insert({
            id: newSale.id,
            bill_number: newSale.billNumber,
            subtotal: newSale.subtotal,
            discount: newSale.discount,
            total: newSale.total,
            payment_method: newSale.paymentMethod,
            cash_received: newSale.cashReceived,
            change: newSale.change,
            cashier_name: newSale.cashierName,
            items: newSale.items,
          });

          // Update stock on cloud
          for (const item of stockUpdatesForCloud) {
            await supabase
              .from('products')
              .update({ stock: item.newStock, updated_at: new Date().toISOString() })
              .eq('id', item.id);
          }
        } catch (err) {
          console.error('Failed to sync sale to cloud:', err);
        }
      })();
    }

    if (settings.soundEnabled) playCashRegisterChime();
    setCart([]);
    return newSale;
  };

  /**
   * Restock product (รับของเข้า)
   */
  const restockProduct = ({
    productId,
    qty,
    costPrice,
    newSellPrice,
    lotNumber,
    expiryDate,
    supplier,
    performedBy = 'เจ้าของร้าน',
  }) => {
    const numQty = parseFloat(qty);
    if (!productId || isNaN(numQty) || numQty <= 0) return false;

    let targetUpdatedStock = 0;
    setProducts((prev) =>
      prev.map((prod) => {
        if (prod.id === productId) {
          const updatedStock = Number((prod.stock + numQty).toFixed(3));
          targetUpdatedStock = updatedStock;
          const updated = {
            ...prod,
            stock: updatedStock,
            costPrice: costPrice ? parseFloat(costPrice) : prod.costPrice,
          };
          if (newSellPrice && parseFloat(newSellPrice) > 0) {
            const nextPrice = parseFloat(newSellPrice);
            updated.sellPrice = nextPrice;
          }
          return updated;
        }
        return prod;
      })
    );

    // Sync to Supabase
    const supabase = getSupabaseClient();
    if (supabase) {
      supabase
        .from('products')
        .update({
          stock: targetUpdatedStock,
          cost_price: costPrice ? parseFloat(costPrice) : undefined,
          sell_price: newSellPrice ? parseFloat(newSellPrice) : undefined,
          updated_at: new Date().toISOString(),
        })
        .eq('id', productId)
        .then();
    }

    return true;
  };

  /**
   * Adjust Stock (นับสต็อกบนชั้น)
   */
  const adjustStock = ({
    productId,
    countedStock,
    reason = 'ตรวจนับสต็อกประจำงวด',
    performedBy = 'เจ้าของร้าน',
  }) => {
    const parsedCounted = parseFloat(countedStock);
    if (isNaN(parsedCounted)) return false;

    let targetProduct = null;
    let oldStock = 0;

    setProducts((prev) =>
      prev.map((p) => {
        if (p.id === productId) {
          targetProduct = p;
          oldStock = Number(p.stock) || 0;
          return { ...p, stock: parsedCounted };
        }
        return p;
      })
    );

    const diff = Number((parsedCounted - oldStock).toFixed(3));
    if (diff !== 0 && targetProduct) {
      setStockMovements((prev) => [
        {
          id: 'mov_' + Date.now() + Math.random().toString(36).substr(2, 4),
          productId,
          productName: targetProduct.name,
          type: diff > 0 ? 'adjustment_in' : 'adjustment_out',
          qty: diff,
          unit: targetProduct.unit,
          reason,
          performedBy,
          timestamp: new Date().toISOString(),
        },
        ...prev,
      ]);
    }

    // Sync to Supabase
    const supabase = getSupabaseClient();
    if (supabase) {
      supabase
        .from('products')
        .update({ stock: parsedCounted, updated_at: new Date().toISOString() })
        .eq('id', productId)
        .then();
    }

    return true;
  };

  const addProduct = (productData) => {
    const newProduct = {
      id: 'prod_' + Date.now(),
      active: true,
      ...productData,
      sellPrice: parseFloat(productData.sellPrice) || 0,
      costPrice: parseFloat(productData.costPrice) || 0,
      stock: parseFloat(productData.stock) || 0,
      minStockAlert: parseFloat(productData.minStockAlert) || 0,
    };
    setProducts((prev) => [newProduct, ...prev]);

    const supabase = getSupabaseClient();
    if (supabase) {
      supabase
        .from('products')
        .insert({
          id: newProduct.id,
          name: newProduct.name,
          type: newProduct.type,
          category_id: newProduct.categoryId,
          cost_price: newProduct.costPrice,
          sell_price: newProduct.sellPrice,
          unit: newProduct.unit,
          is_weighted: newProduct.isWeighted,
          min_stock_alert: newProduct.minStockAlert,
          stock: newProduct.stock,
          barcode: newProduct.barcode,
          image: newProduct.image,
          active: true,
        })
        .then();
    }

    return newProduct;
  };

  const updateProduct = (productId, updates) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, ...updates } : p))
    );

    const supabase = getSupabaseClient();
    if (supabase) {
      const dbUpdates = {
        name: updates.name,
        sell_price: updates.sellPrice !== undefined ? parseFloat(updates.sellPrice) : undefined,
        cost_price: updates.costPrice !== undefined ? parseFloat(updates.costPrice) : undefined,
        stock: updates.stock !== undefined ? parseFloat(updates.stock) : undefined,
        min_stock_alert: updates.minStockAlert !== undefined ? parseFloat(updates.minStockAlert) : undefined,
        barcode: updates.barcode,
        image: updates.image,
        active: updates.active !== undefined ? updates.active : undefined,
        unit: updates.unit,
        category_id: updates.categoryId,
        is_weighted: updates.isWeighted,
        updated_at: new Date().toISOString(),
      };
      Object.keys(dbUpdates).forEach((k) => dbUpdates[k] === undefined && delete dbUpdates[k]);
      supabase.from('products').update(dbUpdates).eq('id', productId).then();
    }
  };

  const toggleProductActive = (productId) => {
    let nextActive = false;
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id === productId) {
          nextActive = p.active === false ? true : false;
          return { ...p, active: nextActive };
        }
        return p;
      })
    );

    const supabase = getSupabaseClient();
    if (supabase) {
      supabase
        .from('products')
        .update({ active: nextActive, updated_at: new Date().toISOString() })
        .eq('id', productId)
        .then();
    }

    return nextActive;
  };

  const updateProductPrice = (productId, newSellPrice, newCostPrice = null) => {
    const parsedSell = parseFloat(newSellPrice);
    if (isNaN(parsedSell) || parsedSell <= 0) return false;

    setProducts((prev) =>
      prev.map((p) => {
        if (p.id === productId) {
          const updated = {
            ...p,
            sellPrice: parsedSell,
            ...(newCostPrice !== null && !isNaN(parseFloat(newCostPrice))
              ? { costPrice: parseFloat(newCostPrice) }
              : {}),
          };
          return updated;
        }
        return p;
      })
    );

    const supabase = getSupabaseClient();
    if (supabase) {
      const updateData = {
        sell_price: parsedSell,
        updated_at: new Date().toISOString(),
      };
      if (newCostPrice !== null && !isNaN(parseFloat(newCostPrice))) {
        updateData.cost_price = parseFloat(newCostPrice);
      }
      supabase
        .from('products')
        .update(updateData)
        .eq('id', productId)
        .then();
    }

    return true;
  };

  const deleteProduct = (productId) => {
    setProducts((prev) => prev.filter((p) => p.id !== productId));
    setCart((prev) => prev.filter((item) => item.productId !== productId));
    const supabase = getSupabaseClient();
    if (supabase) {
      supabase.from('products').delete().eq('id', productId).then();
    }
  };

  const openNewShift = (startCash = 1000, cashierName = 'เจ้าของร้าน') => {
    const newShift = {
      id: 'shift_' + Date.now(),
      cashierName,
      openedAt: new Date().toISOString(),
      startCash: parseFloat(startCash) || 0,
      status: 'open',
      totalSales: 0,
      cashSales: 0,
      promptpaySales: 0,
      billCount: 0,
    };
    setActiveShift(newShift);
    return newShift;
  };

  const closeShift = ({ actualCash = 0, note = '' }) => {
    if (!activeShift) return null;
    const now = new Date().toISOString();
    const expectedCash = activeShift.startCash + activeShift.cashSales;
    const cashDifference = Number((parseFloat(actualCash) - expectedCash).toFixed(2));

    const closed = {
      ...activeShift,
      closedAt: now,
      actualCash: parseFloat(actualCash) || 0,
      expectedCash,
      cashDifference,
      note,
      status: 'closed',
    };

    setActiveShift(null);
    return closed;
  };

  const verifyAdminPin = (enteredPin) => {
    return String(enteredPin) === String(settings.adminPin || '1234');
  };

  return (
    <StoreContext.Provider
      value={{
        products,
        categories,
        suppliers,
        settings,
        userRole,
        activeShift,
        cart,
        parkedBills,
        salesHistory,
        stockMovements,
        priceHistory,
        isCloudConnected,
        cloudSyncStatus,
        connectSupabase,
        disconnectSupabase,
        setUserRole,
        setSettings,
        setSuppliers,
        addToCart,
        updateCartItemQty,
        removeFromCart,
        clearCart,
        parkBill,
        restoreParkedBill,
        deleteParkedBill,
        checkoutSale,
        restockProduct,
        adjustStock,
        updateProductPrice,
        addProduct,
        updateProduct,
        deleteProduct,
        toggleProductActive,
        openNewShift,
        closeShift,
        verifyAdminPin,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within StoreProvider');
  }
  return context;
}
