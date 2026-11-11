import { useState, useEffect, useCallback, useRef } from 'react';
import { db } from '../services/db';

/**
 * Merges standalone order items with any line items embedded directly on order objects.
 */
function consolidateOrderItems(orders, items) {
  const combinedMap = new Map();
  (items || []).forEach((item) => {
    const key = item.id || `${item.order_id}_${item.product_id || item.custom_name}_${item.quantity}`;
    combinedMap.set(key, item);
  });

  (orders || []).forEach((order) => {
    const embedded = order.order_items || order.items || order.line_items;
    if (Array.isArray(embedded)) {
      embedded.forEach((item, idx) => {
        const key = item.id || `${order.id}_${item.product_id || item.custom_name || idx}_${item.quantity}`;
        if (!combinedMap.has(key)) {
          combinedMap.set(key, { ...item, order_id: item.order_id || order.id });
        }
      });
    }
  });

  return Array.from(combinedMap.values());
}

/**
 * usePortalData — Loads and refreshes global store datasets, with a scoped
 * pricing refresh path so single-cell price edits skip unrelated order history.
 */
export function usePortalData() {
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [prices, setPrices] = useState([]);
  const [orders, setOrders] = useState([]);
  const [orderItems, setOrderItems] = useState([]);
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [configVersion, setConfigVersion] = useState(0);

  const hasLoadedRef = useRef(false);

  const loadData = useCallback(async () => {
    if (!hasLoadedRef.current) {
      setLoading(true);
    } else {
      setSyncing(true);
    }

    try {
      const [prods, sups, custs, prs, ords, items, bnds, cats] = await Promise.all([
        db.getProducts(),
        db.getSuppliers(),
        db.getCustomers(),
        db.getSupplierPrices(),
        db.getOrders(),
        db.getOrderItems(),
        db.getBrands(),
        db.getCategories(),
      ]);

      setProducts(prods || []);
      setSuppliers(sups || []);
      setCustomers(custs || []);
      setPrices(prs || []);
      setOrders(ords || []);
      setOrderItems(consolidateOrderItems(ords, items));
      setBrands(bnds || []);
      setCategories(cats || []);
      hasLoadedRef.current = true;
    } catch (e) {
      console.error('Error loading database records:', e);
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      if (active) {
        await loadData();
      }
    })();
    return () => {
      active = false;
    };
  }, [configVersion, loadData]);

  // Scoped refresh for PricingTable — skips customers, orders, and order_items
  // so a single price edit doesn't re-download the entire database.
  const refreshPricingData = useCallback(async () => {
    setSyncing(true);
    try {
      const [prods, sups, prs, bnds, cats] = await Promise.all([
        db.getProducts(),
        db.getSuppliers(),
        db.getSupplierPrices(),
        db.getBrands(),
        db.getCategories(),
      ]);
      setProducts(prods || []);
      setSuppliers(sups || []);
      setPrices(prs || []);
      setBrands(bnds || []);
      setCategories(cats || []);
    } catch (e) {
      console.error('Error refreshing pricing data:', e);
    } finally {
      setSyncing(false);
    }
  }, []);

  const triggerReload = useCallback(() => {
    setConfigVersion((prev) => prev + 1);
  }, []);

  return {
    products,
    suppliers,
    customers,
    prices,
    orders,
    orderItems,
    brands,
    categories,
    loading,
    syncing,
    loadData,
    refreshPricingData,
    triggerReload,
  };
}

