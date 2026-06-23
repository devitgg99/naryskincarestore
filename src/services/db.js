// Unified DB Service supporting Supabase and localStorage fallback
import { createClient } from '@supabase/supabase-js';
import { initialProducts, initialSuppliers, initialSupplierPrices, initialCustomers, initialOrders, initialOrderItems } from './mockData';

export const initialBrands = [
  { id: 'b_1', name: 'EL', created_at: '2026-01-01T00:00:00.000Z' },
  { id: 'b_2', name: 'Detox Bio', created_at: '2026-01-02T00:00:00.000Z' },
  { id: 'b_3', name: 'Mr Slim', created_at: '2026-01-03T00:00:00.000Z' },
  { id: 'b_4', name: 'Yasaka', created_at: '2026-01-04T00:00:00.000Z' },
  { id: 'b_5', name: 'Kiss', created_at: '2026-01-05T00:00:00.000Z' }
];

// Storage helper functions
const getLocal = (key, fallback) => {
  const val = localStorage.getItem(key);
  if (!val) {
    localStorage.setItem(key, JSON.stringify(fallback));
    return fallback;
  }
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
};

const setLocal = (key, data) => {
  localStorage.setItem(key, JSON.stringify(data));
};

// Initialize LocalStorage Mock Data if needed
const initMockDB = () => {
  getLocal('wsp_brands', initialBrands);
  
  // Seed initial product brand associations for mock fallback
  const products = getLocal('wsp_products', initialProducts);
  let updated = false;
  products.forEach(p => {
    if (!p.brand_id) {
      if (p.name_en && p.name_en.includes('EL')) {
        p.brand_id = 'b_1';
        updated = true;
      } else if (p.name_en && p.name_en.includes('Detox')) {
        p.brand_id = 'b_2';
        updated = true;
      } else if (p.name_en && p.name_en.includes('Slim')) {
        p.brand_id = 'b_3';
        updated = true;
      } else if (p.name_en && p.name_en.includes('Yasaka')) {
        p.brand_id = 'b_4';
        updated = true;
      } else if (p.name_en && p.name_en.includes('Kiss')) {
        p.brand_id = 'b_5';
        updated = true;
      }
    }
  });
  if (updated) {
    setLocal('wsp_products', products);
  }

  getLocal('wsp_suppliers', initialSuppliers);
  getLocal('wsp_supplier_prices', initialSupplierPrices);
  getLocal('wsp_customers', initialCustomers);
  getLocal('wsp_orders', initialOrders);
  getLocal('wsp_order_items', initialOrderItems);
};

initMockDB();

// Connection settings
export const getSupabaseConfig = () => {
  const url = localStorage.getItem('wsp_supabase_url') || import.meta.env.VITE_SUPABASE_URL || '';
  const key = localStorage.getItem('wsp_supabase_key') || import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  const localActive = localStorage.getItem('wsp_supabase_active');
  const active = localActive === 'true' || (localActive === null && !!url && !!key);
  return { url, key, active };
};

export const saveSupabaseConfig = (url, key, active) => {
  localStorage.setItem('wsp_supabase_url', url || '');
  localStorage.setItem('wsp_supabase_key', key || '');
  localStorage.setItem('wsp_supabase_active', active ? 'true' : 'false');
};

// Global DB instance switcher
let supabase = null;
const getClient = () => {
  const config = getSupabaseConfig();
  if (config.active && config.url && config.key) {
    if (!supabase) {
      try {
        supabase = createClient(config.url, config.key);
      } catch (e) {
        console.error("Failed to initialize Supabase client", e);
        return null;
      }
    }
    return supabase;
  }
  return null;
};

// DB Service Interface
export const db = {
  // Reset Mock Data to Default
  resetMockData: () => {
    localStorage.removeItem('wsp_brands');
    localStorage.removeItem('wsp_products');
    localStorage.removeItem('wsp_suppliers');
    localStorage.removeItem('wsp_supplier_prices');
    localStorage.removeItem('wsp_customers');
    localStorage.removeItem('wsp_orders');
    localStorage.removeItem('wsp_order_items');
    initMockDB();
  },

  // Products
  getProducts: async () => {
    const client = getClient();
    if (client) {
      const { data, error } = await client.from('products').select('*').order('name_en', { ascending: true });
      if (!error) return data;
      console.error(error);
    }
    // Fallback
    return getLocal('wsp_products', initialProducts).sort((a, b) => a.name_en.localeCompare(b.name_en));
  },
  
  saveProduct: async (product) => {
    const client = getClient();
    if (client) {
      const { data, error } = await client.from('products').upsert(product).select();
      if (!error) return data[0];
      throw error;
    }
    
    // Fallback
    const products = getLocal('wsp_products', initialProducts);
    if (product.id) {
      const idx = products.findIndex(p => p.id === product.id);
      if (idx !== -1) {
        products[idx] = { ...products[idx], ...product };
        setLocal('wsp_products', products);
        return products[idx];
      }
      throw new Error("Product not found");
    } else {
      const newProduct = { ...product, id: 'p_' + Date.now().toString(), created_at: new Date().toISOString() };
      products.push(newProduct);
      setLocal('wsp_products', products);
      return newProduct;
    }
  },

  deleteProduct: async (id) => {
    const client = getClient();
    if (client) {
      const { error } = await client.from('products').delete().eq('id', id);
      if (error) throw error;
      return true;
    }
    // Fallback: check if product is used in orders
    const orderItems = getLocal('wsp_order_items', initialOrderItems);
    const isUsed = orderItems.some(item => item.product_id === id);
    if (isUsed) {
      const err = new Error("Product is used in orders");
      err.code = '23503';
      throw err;
    }

    const products = getLocal('wsp_products', initialProducts);
    const updatedProducts = products.filter(p => p.id !== id);
    setLocal('wsp_products', updatedProducts);

    // Cascade delete local supplier prices
    const prices = getLocal('wsp_supplier_prices', initialSupplierPrices);
    const updatedPrices = prices.filter(sp => sp.product_id !== id);
    setLocal('wsp_supplier_prices', updatedPrices);

    return true;
  },

  // Suppliers
  getSuppliers: async () => {
    const client = getClient();
    if (client) {
      const { data, error } = await client.from('suppliers').select('*').order('name', { ascending: true });
      if (!error) return data;
      console.error(error);
    }
    return getLocal('wsp_suppliers', initialSuppliers).sort((a, b) => a.name.localeCompare(b.name));
  },

  saveSupplier: async (supplier) => {
    const client = getClient();
    if (client) {
      const { data, error } = await client.from('suppliers').upsert(supplier).select();
      if (!error) return data[0];
      throw error;
    }
    const suppliers = getLocal('wsp_suppliers', initialSuppliers);
    if (supplier.id) {
      const idx = suppliers.findIndex(s => s.id === supplier.id);
      if (idx !== -1) {
        suppliers[idx] = { ...suppliers[idx], ...supplier };
        setLocal('wsp_suppliers', suppliers);
        return suppliers[idx];
      }
      throw new Error("Supplier not found");
    } else {
      const newSupplier = { ...supplier, id: 's_' + Date.now().toString(), created_at: new Date().toISOString() };
      suppliers.push(newSupplier);
      setLocal('wsp_suppliers', suppliers);
      return newSupplier;
    }
  },

  // Supplier Prices
  getSupplierPrices: async () => {
    const client = getClient();
    if (client) {
      const { data, error } = await client.from('supplier_prices').select('*');
      if (!error) return data;
      console.error(error);
    }
    return getLocal('wsp_supplier_prices', initialSupplierPrices);
  },

  updateSupplierPrice: async (priceObj) => {
    const client = getClient();
    const updatedPriceObj = {
      ...priceObj,
      updated_at: new Date().toISOString()
    };
    if (client) {
      const { data, error } = await client.from('supplier_prices').upsert(updatedPriceObj).select();
      if (!error) return data[0];
      throw error;
    }
    const prices = getLocal('wsp_supplier_prices', initialSupplierPrices);
    const idx = prices.findIndex(sp => sp.product_id === priceObj.product_id && sp.supplier_id === priceObj.supplier_id);
    if (idx !== -1) {
      prices[idx] = { ...prices[idx], ...updatedPriceObj };
      setLocal('wsp_supplier_prices', prices);
      return prices[idx];
    } else {
      const newPrice = { ...updatedPriceObj, id: 'sp_' + Date.now().toString() };
      prices.push(newPrice);
      setLocal('wsp_supplier_prices', prices);
      return newPrice;
    }
  },

  deleteSupplierPrice: async (productId, supplierId) => {
    const client = getClient();
    if (client) {
      const { error } = await client
        .from('supplier_prices')
        .delete()
        .eq('product_id', productId)
        .eq('supplier_id', supplierId);
      if (error) throw error;
      return true;
    }
    const prices = getLocal('wsp_supplier_prices', initialSupplierPrices);
    const updated = prices.filter(sp => !(sp.product_id === productId && sp.supplier_id === supplierId));
    setLocal('wsp_supplier_prices', updated);
    return true;
  },

  // Customers
  getCustomers: async () => {
    const client = getClient();
    if (client) {
      const { data, error } = await client.from('customers').select('*').order('name', { ascending: true });
      if (!error) return data;
      console.error(error);
    }
    return getLocal('wsp_customers', initialCustomers).sort((a, b) => a.name.localeCompare(b.name));
  },

  saveCustomer: async (customer) => {
    const client = getClient();
    if (client) {
      const { data, error } = await client.from('customers').upsert(customer).select();
      if (!error) return data[0];
      throw error;
    }
    const customers = getLocal('wsp_customers', initialCustomers);
    if (customer.id) {
      const idx = customers.findIndex(c => c.id === customer.id);
      if (idx !== -1) {
        customers[idx] = { ...customers[idx], ...customer };
        setLocal('wsp_customers', customers);
        return customers[idx];
      }
      throw new Error("Customer not found");
    } else {
      const newCustomer = { ...customer, id: 'c_' + Date.now().toString(), created_at: new Date().toISOString() };
      customers.push(newCustomer);
      setLocal('wsp_customers', customers);
      return newCustomer;
    }
  },

  deleteCustomer: async (id) => {
    const client = getClient();
    if (client) {
      const { error } = await client.from('customers').delete().eq('id', id);
      if (error) throw error;
      return true;
    }
    const customers = getLocal('wsp_customers', initialCustomers);
    const updated = customers.filter(c => c.id !== id);
    setLocal('wsp_customers', updated);
    return true;
  },

  deleteSupplier: async (id) => {
    const client = getClient();
    if (client) {
      const { error } = await client.from('suppliers').delete().eq('id', id);
      if (error) throw error;
      return true;
    }
    const suppliers = getLocal('wsp_suppliers', initialSuppliers);
    const updated = suppliers.filter(s => s.id !== id);
    setLocal('wsp_suppliers', updated);
    
    // Also clean up local supplier prices to mirror cascade behavior
    const prices = getLocal('wsp_supplier_prices', initialSupplierPrices);
    const updatedPrices = prices.filter(sp => sp.supplier_id !== id);
    setLocal('wsp_supplier_prices', updatedPrices);
    
    return true;
  },

  // Orders & Order Items
  getOrders: async () => {
    const client = getClient();
    if (client) {
      const { data, error } = await client.from('orders').select('*').order('ordered_at', { ascending: false });
      if (!error) return data;
      console.error(error);
    }
    return getLocal('wsp_orders', initialOrders).sort((a, b) => new Date(b.ordered_at) - new Date(a.ordered_at));
  },

  getOrderItems: async () => {
    const client = getClient();
    if (client) {
      const { data, error } = await client.from('order_items').select('*');
      if (!error) return data;
      console.error(error);
    }
    return getLocal('wsp_order_items', initialOrderItems);
  },

  createOrder: async (orderObj, items) => {
    const client = getClient();
    if (client) {
      // Create order
      const { data: orderData, error: orderErr } = await client.from('orders').insert({
        customer_id: orderObj.customer_id,
        delivery_fee: orderObj.delivery_fee,
        total_amount: orderObj.total_amount,
        status: orderObj.status || 'pending',
        ordered_at: new Date().toISOString()
      }).select();
      
      if (orderErr) throw orderErr;
      const newOrder = orderData[0];

      // Create order items
      const itemsToInsert = items.map(item => ({
        order_id: newOrder.id,
        product_id: item.product_id,
        supplier_id: item.supplier_id || null,
        supplier_price: Number(item.supplier_price || 0),
        unit_price: Number(item.unit_price),
        quantity: Number(item.quantity),
        subtotal: Number(item.subtotal)
      }));

      const { error: itemsErr } = await client.from('order_items').insert(itemsToInsert);
      if (itemsErr) {
        // cleanup order
        await client.from('orders').delete().eq('id', newOrder.id);
        throw itemsErr;
      }

      // Decrement stocks in supplier_prices
      for (const item of items) {
        if (item.supplier_id) {
          const { data: spData } = await client.from('supplier_prices')
            .select('stock_qty, stock_unit')
            .eq('product_id', item.product_id)
            .eq('supplier_id', item.supplier_id)
            .single();
          
          if (spData) {
            const newStock = Math.max(0, spData.stock_qty - item.quantity);
            await client.from('supplier_prices')
              .update({ stock_qty: newStock })
              .eq('product_id', item.product_id)
              .eq('supplier_id', item.supplier_id);
          }
        }
      }
      return newOrder;
    }

    // LocalStorage fallback
    const orders = getLocal('wsp_orders', initialOrders);
    const orderItems = getLocal('wsp_order_items', initialOrderItems);
    const supplierPrices = getLocal('wsp_supplier_prices', initialSupplierPrices);

    const orderId = 'o_' + Date.now().toString();
    const newOrder = {
      id: orderId,
      customer_id: orderObj.customer_id,
      delivery_fee: Number(orderObj.delivery_fee),
      total_amount: Number(orderObj.total_amount),
      status: orderObj.status || 'pending',
      ordered_at: new Date().toISOString(),
    };

    orders.push(newOrder);
    setLocal('wsp_orders', orders);

    items.forEach((item, idx) => {
      const newItem = {
        id: `oi_${Date.now()}_${idx}`,
        order_id: orderId,
        product_id: item.product_id,
        supplier_id: item.supplier_id || null,
        supplier_price: Number(item.supplier_price || 0),
        unit_price: Number(item.unit_price),
        quantity: Number(item.quantity),
        subtotal: Number(item.subtotal),
      };
      orderItems.push(newItem);

      // Decrement local stock
      if (item.supplier_id) {
        const spIdx = supplierPrices.findIndex(sp => sp.product_id === item.product_id && sp.supplier_id === item.supplier_id);
        if (spIdx !== -1) {
          supplierPrices[spIdx].stock_qty = Math.max(0, supplierPrices[spIdx].stock_qty - item.quantity);
        }
      }
    });

    setLocal('wsp_order_items', orderItems);
    setLocal('wsp_supplier_prices', supplierPrices);

    return newOrder;
  },

  updateOrderStatus: async (orderId, newStatus) => {
    const client = getClient();
    if (client) {
      const { data, error } = await client.from('orders').update({ status: newStatus }).eq('id', orderId).select();
      if (!error) return data[0];
      throw error;
    }
    const orders = getLocal('wsp_orders', initialOrders);
    const idx = orders.findIndex(o => o.id === orderId);
    if (idx !== -1) {
      orders[idx].status = newStatus;
      setLocal('wsp_orders', orders);
      return orders[idx];
    }
    throw new Error("Order not found");
  },

  deleteOrder: async (orderId) => {
    const client = getClient();
    if (client) {
      const { error } = await client.from('orders').delete().eq('id', orderId);
      if (error) throw error;
      return true;
    }
    const orders = getLocal('wsp_orders', initialOrders);
    const orderItems = getLocal('wsp_order_items', initialOrderItems);

    const updatedOrders = orders.filter(o => o.id !== orderId);
    const updatedItems = orderItems.filter(oi => oi.order_id !== orderId);

    setLocal('wsp_orders', updatedOrders);
    setLocal('wsp_order_items', updatedItems);
    return true;
  },

  // Brands
  getBrands: async () => {
    const client = getClient();
    if (client) {
      const { data, error } = await client.from('brands').select('*').order('name', { ascending: true });
      if (!error) return data;
      console.error(error);
    }
    return getLocal('wsp_brands', initialBrands).sort((a, b) => a.name.localeCompare(b.name));
  },

  saveBrand: async (brand) => {
    const client = getClient();
    if (client) {
      const { data, error } = await client.from('brands').upsert(brand).select();
      if (!error) return data[0];
      throw error;
    }
    const brands = getLocal('wsp_brands', initialBrands);
    if (brand.id) {
      const idx = brands.findIndex(b => b.id === brand.id);
      if (idx !== -1) {
        brands[idx] = { ...brands[idx], ...brand };
        setLocal('wsp_brands', brands);
        return brands[idx];
      }
      throw new Error("Brand not found");
    } else {
      const newBrand = { ...brand, id: 'b_' + Date.now().toString(), created_at: new Date().toISOString() };
      brands.push(newBrand);
      setLocal('wsp_brands', brands);
      return newBrand;
    }
  },

  deleteBrand: async (id) => {
    const client = getClient();
    if (client) {
      const { error } = await client.from('brands').delete().eq('id', id);
      if (error) throw error;
      return true;
    }
    const brands = getLocal('wsp_brands', initialBrands);
    const updatedBrands = brands.filter(b => b.id !== id);
    setLocal('wsp_brands', updatedBrands);

    const products = getLocal('wsp_products', initialProducts);
    const updatedProducts = products.map(p => p.brand_id === id ? { ...p, brand_id: null } : p);
    setLocal('wsp_products', updatedProducts);
    return true;
  },

  associateProductsWithBrand: async (brandId, productIds) => {
    const client = getClient();
    if (client) {
      // Dissociate old
      const { error: err1 } = await client.from('products').update({ brand_id: null }).eq('brand_id', brandId);
      if (err1) throw err1;
      
      // Associate new (only if there are products selected)
      if (productIds && productIds.length > 0) {
        const { error: err2 } = await client.from('products').update({ brand_id: brandId }).in('id', productIds);
        if (err2) throw err2;
      }
      return true;
    }
    // Fallback
    const products = getLocal('wsp_products', initialProducts);
    const updatedProducts = products.map(p => {
      if (p.brand_id === brandId) {
        return { ...p, brand_id: null };
      }
      return p;
    });

    productIds.forEach(pid => {
      const idx = updatedProducts.findIndex(p => p.id === pid);
      if (idx !== -1) {
        updatedProducts[idx].brand_id = brandId;
      }
    });

    setLocal('wsp_products', updatedProducts);
    return true;
  }
};
