import React, { createContext, useContext, useState, useEffect } from 'react';
import { INITIAL_CATEGORIES, INITIAL_PRODUCTS, INITIAL_SETTINGS, INITIAL_SUPPLIERS } from '../data/initialData';
import { playScanBeep, playErrorBuzz, playCashRegisterChime } from '../utils/sound';

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  // LocalStorage keys
  const LS_PREFIX = 'paruay_pos_';

  // 1. Products
  const [products, setProducts] = useState(() => {
    try {
      const saved = localStorage.getItem(LS_PREFIX + 'products');
      if (saved) {
        const parsed = JSON.parse(saved);
        // If saved products still have emojis as image, upgrade with realistic photos
        if (parsed.length > 0 && (!parsed[0].image || !parsed[0].image.startsWith('http'))) {
          return INITIAL_PRODUCTS;
        }
        return parsed;
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
      // Auto-create initial default shift
      const initialShift = {
        id: 'shift_' + Date.now(),
        cashierName: 'เจ้าของร้าน / แอดมิน',
        openedAt: new Date().toISOString(),
        startCash: 1000,
        status: 'open',
        totalSales: 0,
        cashSales: 0,
        promptpaySales: 0,
        billCount: 0,
      };
      return initialShift;
    } catch {
      return null;
    }
  });

  // 7. Cart
  const [cart, setCart] = useState(() => {
    try {
      const saved = localStorage.getItem(LS_PREFIX + 'cart');
      return saved ? JSON.parse(saved) : [];
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

  // Sync state to LocalStorage
  useEffect(() => {
    localStorage.setItem(LS_PREFIX + 'products', JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem(LS_PREFIX + 'settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem(LS_PREFIX + 'user_role', userRole);
  }, [userRole]);

  useEffect(() => {
    localStorage.setItem(LS_PREFIX + 'active_shift', JSON.stringify(activeShift));
  }, [activeShift]);

  useEffect(() => {
    localStorage.setItem(LS_PREFIX + 'cart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    localStorage.setItem(LS_PREFIX + 'parked_bills', JSON.stringify(parkedBills));
  }, [parkedBills]);

  useEffect(() => {
    localStorage.setItem(LS_PREFIX + 'sales_history', JSON.stringify(salesHistory));
  }, [salesHistory]);

  useEffect(() => {
    localStorage.setItem(LS_PREFIX + 'stock_movements', JSON.stringify(stockMovements));
  }, [stockMovements]);

  useEffect(() => {
    localStorage.setItem(LS_PREFIX + 'price_history', JSON.stringify(priceHistory));
  }, [priceHistory]);

  // ---------- CART OPERATIONS ----------

  /**
   * Add a product to current cart
   * Supports:
   * - standard discrete items (qty += 1)
   * - fresh/meat weighted items (custom weightInKg or custom price converted to weightInKg)
   * - unregistered on-the-fly items
   */
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

        if (priceTarget !== null && priceTarget !== undefined && priceTarget > 0) {
          // MODE B: Specified target price (e.g. 50฿) -> calculate weight
          // weight = price / (price/kg)
          finalSubtotal = Number(priceTarget);
          finalWeight = Number((finalSubtotal / product.sellPrice).toFixed(3));
        } else if (weightInKg !== null && weightInKg !== undefined && weightInKg > 0) {
          // MODE A: Specified weight in kg -> calculate price
          finalWeight = Number(Number(weightInKg).toFixed(3));
          finalSubtotal = Number((finalWeight * product.sellPrice).toFixed(2));
        } else {
          // Default 1 kg if not specified
          finalWeight = 1.0;
          finalSubtotal = product.sellPrice;
        }

        const weightedItem = {
          cartItemId: 'item_' + Date.now() + Math.random().toString(36).substr(2, 4),
          productId: product.id,
          name: product.name,
          sellPrice: product.sellPrice,
          costPrice: product.costPrice || 0,
          qty: finalWeight, // Represented as weight
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

      // 3. Standard packaged item (นับชิ้น)
      const existingIndex = prevCart.findIndex(
        (item) => item.productId === product.id && !item.isWeighted && !item.isUnregistered
      );

      if (existingIndex > -1) {
        // Increment quantity
        const updated = [...prevCart];
        const currentItem = updated[existingIndex];
        const newQty = currentItem.qty + (Number(quantity) || 1);
        updated[existingIndex] = {
          ...currentItem,
          qty: newQty,
          subtotal: Number((newQty * currentItem.sellPrice).toFixed(2)),
        };
        if (settings.soundEnabled) playScanBeep();
        return updated;
      } else {
        // Add new discrete row
        const newItem = {
          cartItemId: 'item_' + Date.now() + Math.random().toString(36).substr(2, 4),
          productId: product.id,
          name: product.name,
          sellPrice: product.sellPrice,
          costPrice: product.costPrice || 0,
          qty: Number(quantity) || 1,
          unit: product.unit || 'ชิ้น',
          isWeighted: false,
          isUnregistered: false,
          barcode: product.barcode,
          image: product.image,
          subtotal: Number(((Number(quantity) || 1) * product.sellPrice).toFixed(2)),
        };
        if (settings.soundEnabled) playScanBeep();
        return [...prevCart, newItem];
      }
    });
  };

  /**
   * Update cart item qty or weight
   */
  const updateCartItemQty = (cartItemId, newQty) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.cartItemId === cartItemId) {
            const parsed = parseFloat(newQty);
            if (isNaN(parsed) || parsed <= 0) return null; // remove if 0
            const qty = item.isWeighted ? Number(parsed.toFixed(3)) : Math.round(parsed);
            return {
              ...item,
              qty,
              weightInKg: item.isWeighted ? qty : undefined,
              subtotal: Number((qty * item.sellPrice).toFixed(2)),
            };
          }
          return item;
        })
        .filter(Boolean)
    );
  };

  /**
   * Remove item from cart
   */
  const removeFromCart = (cartItemId) => {
    setCart((prev) => prev.filter((item) => item.cartItemId !== cartItemId));
  };

  /**
   * Clear entire cart
   */
  const clearCart = () => {
    setCart([]);
  };

  /**
   * Park current cart bill
   */
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

  /**
   * Restore a parked bill
   */
  const restoreParkedBill = (parkedId) => {
    const target = parkedBills.find((b) => b.id === parkedId);
    if (!target) return false;
    setCart(target.items);
    setParkedBills((prev) => prev.filter((b) => b.id !== parkedId));
    return true;
  };

  /**
   * Delete a parked bill
   */
  const deleteParkedBill = (parkedId) => {
    setParkedBills((prev) => prev.filter((b) => b.id !== parkedId));
  };

  /**
   * Checkout & Complete Sale
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

    // Generate Bill Number: INV-YYYYMMDD-XXXX
    const now = new Date();
    const dateStr = now.getFullYear().toString() +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0');
    const randomSeq = String(salesHistory.length + 1).padStart(4, '0');
    const billNumber = `INV-${dateStr}-${randomSeq}`;

    const newSale = {
      id: 'sale_' + Date.now(),
      billNumber,
      createdAt: now.toISOString(),
      cashierName,
      items: [...cart],
      itemCount: cart.length,
      subtotal,
      discount: Number(discount) || 0,
      total: finalTotal,
      paymentMethod,
      cashReceived: Number(cashReceived) || finalTotal,
      change: Number(change) || 0,
      status: 'completed',
    };

    // 1. Deduct Stock for registered items
    const newMovements = [];
    setProducts((prevProducts) => {
      const nextProducts = [...prevProducts];
      cart.forEach((cartItem) => {
        if (cartItem.productId && !cartItem.isUnregistered) {
          const pIndex = nextProducts.findIndex((p) => p.id === cartItem.productId);
          if (pIndex > -1) {
            const current = nextProducts[pIndex];
            const deductQty = cartItem.qty;
            const newStockVal = Number((current.stock - deductQty).toFixed(3));
            nextProducts[pIndex] = {
              ...current,
              stock: newStockVal,
            };

            // Log stock movement
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

    // 2. Append to Sales History
    setSalesHistory((prev) => [newSale, ...prev]);

    // 3. Update Shift stats
    if (activeShift) {
      setActiveShift((prev) => ({
        ...prev,
        totalSales: Number((prev.totalSales + finalTotal).toFixed(2)),
        cashSales: paymentMethod === 'cash' ? Number((prev.cashSales + finalTotal).toFixed(2)) : prev.cashSales,
        promptpaySales: paymentMethod === 'promptpay' ? Number((prev.promptpaySales + finalTotal).toFixed(2)) : prev.promptpaySales,
        billCount: prev.billCount + 1,
      }));
    }

    // 4. Play audio and clear cart
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

    setProducts((prev) =>
      prev.map((prod) => {
        if (prod.id === productId) {
          const updatedStock = Number((prod.stock + numQty).toFixed(3));
          const updated = {
            ...prod,
            stock: updatedStock,
            costPrice: costPrice ? parseFloat(costPrice) : prod.costPrice,
          };
          if (newSellPrice && parseFloat(newSellPrice) > 0) {
            // Price changed
            const oldPrice = prod.sellPrice;
            const nextPrice = parseFloat(newSellPrice);
            updated.sellPrice = nextPrice;
            setPriceHistory((ph) => [
              {
                id: 'ph_' + Date.now(),
                productId: prod.id,
                productName: prod.name,
                oldPrice,
                newPrice: nextPrice,
                changedBy: performedBy,
                timestamp: new Date().toISOString(),
              },
              ...ph,
            ]);
          }
          return updated;
        }
        return prod;
      })
    );

    // Record stock movement
    const targetProduct = products.find((p) => p.id === productId);
    setStockMovements((prev) => [
      {
        id: 'mov_' + Date.now(),
        productId,
        productName: targetProduct ? targetProduct.name : 'สินค้า',
        type: 'restock',
        qty: numQty,
        unit: targetProduct ? targetProduct.unit : 'ชิ้น',
        costPrice: costPrice ? parseFloat(costPrice) : 0,
        lotNumber: lotNumber || '-',
        expiryDate: expiryDate || '-',
        supplier: supplier || '-',
        reason: 'รับสินค้าเข้าสต็อก',
        performedBy,
        timestamp: new Date().toISOString(),
      },
      ...prev,
    ]);

    return true;
  };

  /**
   * Stock Count & Adjustment (นับสต็อก/ปรับยอดสต็อก)
   */
  const adjustStock = ({
    productId,
    countedStock,
    reason = 'ตรวจนับสต็อกประจำงวด',
    performedBy = 'เจ้าของร้าน',
  }) => {
    const parsedCounted = parseFloat(countedStock);
    if (isNaN(parsedCounted)) return false;

    const targetProduct = products.find((p) => p.id === productId);
    if (!targetProduct) return false;

    const diff = Number((parsedCounted - targetProduct.stock).toFixed(3));

    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, stock: parsedCounted } : p))
    );

    setStockMovements((prev) => [
      {
        id: 'mov_' + Date.now(),
        productId,
        productName: targetProduct.name,
        type: 'adjust',
        qty: diff, // + or -
        unit: targetProduct.unit,
        reason: reason || 'ปรับปรุงยอดสต็อก',
        performedBy,
        timestamp: new Date().toISOString(),
      },
      ...prev,
    ]);

    return true;
  };

  /**
   * Fast sell price adjustment (e.g. for fresh produce)
   */
  const updateProductPrice = (productId, newPrice, changedBy = 'เจ้าของร้าน') => {
    const parsed = parseFloat(newPrice);
    if (isNaN(parsed) || parsed < 0) return false;

    setProducts((prev) =>
      prev.map((p) => {
        if (p.id === productId) {
          const oldPrice = p.sellPrice;
          setPriceHistory((ph) => [
            {
              id: 'ph_' + Date.now(),
              productId: p.id,
              productName: p.name,
              oldPrice,
              newPrice: parsed,
              changedBy,
              timestamp: new Date().toISOString(),
            },
            ...ph,
          ]);
          return { ...p, sellPrice: parsed };
        }
        return p;
      })
    );
    return true;
  };

  /**
   * Add new product to catalog
   */
  const addProduct = (productData) => {
    const newProduct = {
      id: 'prod_' + Date.now(),
      active: true,
      ...productData,
      sellPrice: parseFloat(productData.sellPrice) || 0,
      costPrice: parseFloat(productData.costPrice) || 0,
      stock: parseFloat(productData.stock) || 0,
      minStockAlert: parseFloat(productData.minStockAlert) || 0,
      expiryDaysAlert: parseFloat(productData.expiryDaysAlert) || 0,
    };
    setProducts((prev) => [newProduct, ...prev]);

    // Initial stock movement
    if (newProduct.stock > 0) {
      setStockMovements((prev) => [
        {
          id: 'mov_' + Date.now(),
          productId: newProduct.id,
          productName: newProduct.name,
          type: 'restock',
          qty: newProduct.stock,
          unit: newProduct.unit,
          reason: 'เพิ่มสินค้าใหม่เข้าระบบ',
          performedBy: 'เจ้าของร้าน',
          timestamp: new Date().toISOString(),
        },
        ...prev,
      ]);
    }

    return newProduct;
  };

  /**
   * Update existing product
   */
  const updateProduct = (productId, updates) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, ...updates } : p))
    );
  };

  /**
   * Delete product
   */
  const deleteProduct = (productId) => {
    setProducts((prev) => prev.filter((p) => p.id !== productId));
  };

  /**
   * Shift Management: Open & Close
   */
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

  /**
   * PIN verification for owner actions
   */
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
