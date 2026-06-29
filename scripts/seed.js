import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { 
  initialProducts, 
  initialSuppliers, 
  initialSupplierPrices, 
  initialCustomers, 
  initialOrders, 
  initialOrderItems 
} from '../src/services/mockData.js';

export const initialBrands = [
  { id: 'b_1', name: 'EL', created_at: '2026-01-01T00:00:00.000Z' },
  { id: 'b_2', name: 'Detox Bio', created_at: '2026-01-02T00:00:00.000Z' },
  { id: 'b_3', name: 'Mr Slim', created_at: '2026-01-03T00:00:00.000Z' },
  { id: 'b_4', name: 'Yasaka', created_at: '2026-01-04T00:00:00.000Z' },
  { id: 'b_5', name: 'Kiss', created_at: '2026-01-05T00:00:00.000Z' }
];

export const initialCategories = [
  { id: 'c_1', name: 'Lotion', created_at: '2026-01-01T00:00:00.000Z' },
  { id: 'c_2', name: 'Night Cream', created_at: '2026-01-02T00:00:00.000Z' },
  { id: 'c_3', name: 'Mask', created_at: '2026-01-03T00:00:00.000Z' },
  { id: 'c_4', name: 'Serum', created_at: '2026-01-04T00:00:00.000Z' }
];

// Parse .env manually
const envPath = path.resolve(process.cwd(), '.env');
if (!fs.existsSync(envPath)) {
  console.error("Error: .env file not found. Please create it first.");
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    const key = match[1];
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.substring(1, value.length - 1);
    }
    env[key] = value.trim();
  }
});

const url = env.NEXT_PUBLIC_SUPABASE_URL || env.VITE_SUPABASE_URL;
const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;

if (!url || !key || url.includes('YOUR_SUPABASE_PROJECT_URL')) {
  console.error("Error: Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env file.");
  process.exit(1);
}

console.log(`Connecting to Supabase at: ${url}...`);
const supabase = createClient(url, key);

// Generate UUID mapping dictionaries to preserve relations
const brandUuidMap = {};
const categoryUuidMap = {};
const productUuidMap = {};
const supplierUuidMap = {};
const customerUuidMap = {};
const orderUuidMap = {};

// 1. Prepare brands data
const brandsToInsert = initialBrands.map(b => {
  const uuid = crypto.randomUUID();
  brandUuidMap[b.id] = uuid;
  return {
    id: uuid,
    name: b.name,
    created_at: b.created_at
  };
});

// 2. Prepare categories data
const categoriesToInsert = initialCategories.map(c => {
  const uuid = crypto.randomUUID();
  categoryUuidMap[c.id] = uuid;
  return {
    id: uuid,
    name: c.name,
    created_at: c.created_at
  };
});

// Helper for mapping brands and categories
function getProductBrandId(nameEn) {
  const name = (nameEn || '').toLowerCase();
  if (name.includes('el')) return brandUuidMap['b_1'];
  if (name.includes('detox')) return brandUuidMap['b_2'];
  if (name.includes('slim')) return brandUuidMap['b_3'];
  if (name.includes('yasaka')) return brandUuidMap['b_4'];
  if (name.includes('kiss')) return brandUuidMap['b_5'];
  return null;
}

function getProductCategoryId(nameEn, nameKh) {
  const en = (nameEn || '').toLowerCase();
  const kh = (nameKh || '').toLowerCase();
  if (en.includes('lotion') || kh.includes('ឡេ')) return categoryUuidMap['c_1'];
  if (en.includes('night') || kh.includes('យប់')) return categoryUuidMap['c_2'];
  if (en.includes('mask') || kh.includes('ម៉ាស')) return categoryUuidMap['c_3'];
  if (en.includes('serum') || kh.includes('សេរ៉ូម')) return categoryUuidMap['c_4'];
  return null;
}

// 3. Prepare products data
const productsToInsert = initialProducts.map(p => {
  const uuid = crypto.randomUUID();
  productUuidMap[p.id] = uuid;
  return {
    id: uuid,
    name_kh: p.name_kh,
    name_en: p.name_en,
    image_url: p.image_url || null,
    base_price: Number(p.base_price),
    selling_price: p.selling_price ? Number(p.selling_price) : null,
    brand_id: getProductBrandId(p.name_en),
    category_id: getProductCategoryId(p.name_en, p.name_kh),
    created_at: p.created_at
  };
});

// 4. Prepare suppliers data
const suppliersToInsert = initialSuppliers.map(s => {
  const uuid = crypto.randomUUID();
  supplierUuidMap[s.id] = uuid;
  return {
    id: uuid,
    name: s.name,
    contact_phone: s.contact_phone || null,
    created_at: s.created_at
  };
});

// 5. Prepare customers data
const customersToInsert = initialCustomers.map(c => {
  const uuid = crypto.randomUUID();
  customerUuidMap[c.id] = uuid;
  return {
    id: uuid,
    name: c.name,
    phone: c.phone || null,
    map_url: c.map_url || null,
    location_note: c.location_note || null,
    created_at: c.created_at
  };
});

async function seed() {
  try {
    console.log("Seeding tables in order...");

    // Clear old tables (if any exist) to avoid foreign key or unique key conflicts
    console.log("Cleaning existing database data...");
    await supabase.from('order_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('orders').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('supplier_prices').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('customers').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('suppliers').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('products').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('brands').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('categories').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // Insert Brands
    console.log(`Inserting ${brandsToInsert.length} brands...`);
    const { error: brandErr } = await supabase.from('brands').insert(brandsToInsert);
    if (brandErr) throw brandErr;

    // Insert Categories
    console.log(`Inserting ${categoriesToInsert.length} categories...`);
    const { error: catErr } = await supabase.from('categories').insert(categoriesToInsert);
    if (catErr) throw catErr;

    // Insert Products
    console.log(`Inserting ${productsToInsert.length} products...`);
    const { error: prodErr } = await supabase.from('products').insert(productsToInsert);
    if (prodErr) throw prodErr;

    // Insert Suppliers
    console.log(`Inserting ${suppliersToInsert.length} suppliers...`);
    const { error: supErr } = await supabase.from('suppliers').insert(suppliersToInsert);
    if (supErr) throw supErr;

    // Insert Customers
    console.log(`Inserting ${customersToInsert.length} customers...`);
    const { error: custErr } = await supabase.from('customers').insert(customersToInsert);
    if (custErr) throw custErr;

    // 6. Prepare & insert supplier prices
    const pricesToInsert = initialSupplierPrices.map(sp => ({
      product_id: productUuidMap[sp.product_id],
      supplier_id: supplierUuidMap[sp.supplier_id],
      price: Number(sp.price),
      stock_qty: Number(sp.stock_qty),
      stock_unit: sp.stock_unit,
      updated_at: sp.updated_at
    }));

    console.log(`Inserting ${pricesToInsert.length} supplier price entries...`);
    const { error: priceErr } = await supabase.from('supplier_prices').insert(pricesToInsert);
    if (priceErr) throw priceErr;

    // 7. Prepare & insert orders
    const ordersToInsert = initialOrders.map(o => {
      const uuid = crypto.randomUUID();
      orderUuidMap[o.id] = uuid;
      return {
        id: uuid,
        customer_id: customerUuidMap[o.customer_id],
        delivery_fee: Number(o.delivery_fee),
        total_amount: Number(o.total_amount),
        status: o.status,
        ordered_at: o.ordered_at
      };
    });

    console.log(`Inserting ${ordersToInsert.length} orders...`);
    const { error: orderErr } = await supabase.from('orders').insert(ordersToInsert);
    if (orderErr) throw orderErr;

    // 8. Prepare & insert order items
    const itemsToInsert = initialOrderItems.map(oi => ({
      order_id: orderUuidMap[oi.order_id],
      product_id: productUuidMap[oi.product_id],
      supplier_id: supplierUuidMap[oi.supplier_id] || null,
      supplier_price: Number(oi.supplier_price || 0),
      unit_price: Number(oi.unit_price),
      quantity: Number(oi.quantity),
      subtotal: Number(oi.subtotal)
    }));

    console.log(`Inserting ${itemsToInsert.length} order line items...`);
    const { error: itemsErr } = await supabase.from('order_items').insert(itemsToInsert);
    if (itemsErr) throw itemsErr;

    console.log("🎉 Database seeding completed successfully!");
  } catch (error) {
    console.error("❌ Seeding failed with error:", error);
    process.exit(1);
  }
}

seed();
