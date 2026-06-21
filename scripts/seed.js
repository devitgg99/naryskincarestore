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

const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY;

if (!url || !key || url.includes('YOUR_SUPABASE_PROJECT_URL')) {
  console.error("Error: Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.");
  process.exit(1);
}

console.log(`Connecting to Supabase at: ${url}...`);
const supabase = createClient(url, key);

// Generate UUID mapping dictionaries to preserve relations
const productUuidMap = {};
const supplierUuidMap = {};
const customerUuidMap = {};
const orderUuidMap = {};

// 1. Prepare products data
const productsToInsert = initialProducts.map(p => {
  const uuid = crypto.randomUUID();
  productUuidMap[p.id] = uuid;
  return {
    id: uuid,
    name_kh: p.name_kh,
    name_en: p.name_en,
    image_url: p.image_url || null,
    base_price: Number(p.base_price),
    created_at: p.created_at
  };
});

// 2. Prepare suppliers data
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

// 3. Prepare customers data
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

    // Clear old tables (if any exist) to avoid unique key conflicts
    console.log("Cleaning existing database data...");
    await supabase.from('order_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('orders').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('supplier_prices').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('customers').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('suppliers').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('products').delete().neq('id', '00000000-0000-0000-0000-000000000000');

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

    // 4. Prepare & insert supplier prices
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

    // 5. Prepare & insert orders
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

    // 6. Prepare & insert order items
    const itemsToInsert = initialOrderItems.map(oi => ({
      order_id: orderUuidMap[oi.order_id],
      product_id: productUuidMap[oi.product_id],
      supplier_id: supplierUuidMap[oi.supplier_id],
      supplier_price: Number(oi.supplier_price),
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
