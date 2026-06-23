/* eslint-env node */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read raw data from local Price.csv
const csvPath = path.resolve(__dirname, './Price.csv');
if (!fs.existsSync(csvPath)) {
  console.error("Error: Price.csv not found in scripts directory.");
  process.exit(1);
}
const rawData = fs.readFileSync(csvPath, 'utf8');

// Suppliers list & maps based on the columns
const suppliers = [
  { id: "s1", name: "Makara", contact_phone: "012 345 678", created_at: new Date("2026-01-01").toISOString() },
  { id: "s2", name: "Siloeng", contact_phone: "098 765 432", created_at: new Date("2026-01-02").toISOString() },
  { id: "s3", name: "SY168", contact_phone: "088 123 456", created_at: new Date("2026-01-03").toISOString() },
  { id: "s4", name: "Jee Ya", contact_phone: "011 222 333", created_at: new Date("2026-01-04").toISOString() },
  { id: "s5", name: "Leng Heng", contact_phone: "077 888 999", created_at: new Date("2026-01-05").toISOString() },
  { id: "s6", name: "Srey Len", contact_phone: "015 444 555", created_at: new Date("2026-01-06").toISOString() },
  { id: "s7", name: "Oun Ka", contact_phone: "099 333 444", created_at: new Date("2026-01-07").toISOString() },
  { id: "s8", name: "Korea SCT", contact_phone: "016 777 888", created_at: new Date("2026-01-08").toISOString() },
  { id: "s9", name: "Chanty AI", contact_phone: "093 555 666", created_at: new Date("2026-01-09").toISOString() },
  { id: "s10", name: "Sun Kunthea TGN", contact_phone: "085 666 777", created_at: new Date("2026-01-10").toISOString() },
  { id: "s11", name: "Moy Pa", contact_phone: "012 987 654", created_at: new Date("2026-01-11").toISOString() }
];

// Helper to separate Khmer and English words
function parseName(name) {
  const cleanName = name.trim();
  // Find any English characters (A-Za-z0-9)
  const khMatch = cleanName.replace(/[A-Za-z0-9\s-+()./&]+/g, '').trim();
  const enMatch = cleanName.match(/[A-Za-z0-9\s-+()./&]+/g);
  let name_kh = cleanName;
  let name_en = cleanName;
  if (khMatch && enMatch) {
    name_kh = khMatch + ' ' + enMatch.join(' ').trim();
    name_en = enMatch.join(' ').trim();
  } else if (khMatch) {
    name_kh = khMatch;
    name_en = khMatch;
  } else if (enMatch) {
    name_kh = enMatch.join(' ').trim();
    name_en = enMatch.join(' ').trim();
  }
  return { name_kh, name_en };
}

// Helper to clean price value
function parsePrice(val) {
  if (!val) return 0;
  const num = val.replace(/[^0-9.]/g, '');
  return parseFloat(num) || 0;
}

// Helper to parse stock
function parseStock(val) {
  if (!val) return { qty: 0, unit: 'pcs' };
  const cleanVal = val.trim().toLowerCase();

  // Extract number
  const numMatch = cleanVal.match(/^[0-9]+/);
  const qty = numMatch ? parseInt(numMatch[0], 10) : 0;

  // Detect unit
  let unit = 'pcs';
  if (cleanVal.includes('pcs')) {
    unit = 'pcs';
  } else if (cleanVal.includes('lo') || cleanVal.includes('dozen')) {
    unit = 'lo';
  } else if (cleanVal.includes('cs') || cleanVal.includes('case') || cleanVal.includes('kes') || cleanVal.includes('box')) {
    unit = 'cs';
  } else if (qty > 0) {
    unit = 'pcs';
  }
  return { qty, unit };
}

const lines = rawData.split('\n');
// Slice(1) to skip the header line
const dataLines = lines.slice(1);
const products = [];
const supplierPrices = [];

dataLines.forEach((line, index) => {
  if (!line.trim()) return;
  const cols = line.split(',');

  const rawName = cols[0];
  if (!rawName) return;

  const { name_kh, name_en } = parseName(rawName);
  const productId = `p_${index + 1}`;

  // Selling Price is in Col 2
  const rawSelling = cols[2];
  const sellingPrice = parsePrice(rawSelling);

  // Base Price: Selling Price - $0.20
  let basePrice = sellingPrice > 0.20 ? Math.round((sellingPrice - 0.20) * 100) / 100 : 0.00;

  const supplierMappings = [
    { supplierId: 's1', priceIdx: 3, stockIdx: 4 },
    { supplierId: 's2', priceIdx: 5, stockIdx: 6 },
    { supplierId: 's3', priceIdx: 7, stockIdx: 8 },
    { supplierId: 's4', priceIdx: 9, stockIdx: 10 },
    { supplierId: 's5', priceIdx: 11, stockIdx: 12 },
    { supplierId: 's6', priceIdx: 13, stockIdx: 14 },
    { supplierId: 's7', priceIdx: 15, stockIdx: 16 },
    { supplierId: 's8', priceIdx: 17, stockIdx: 18 },
    { supplierId: 's9', priceIdx: 19, stockIdx: 20 },
    { supplierId: 's10', priceIdx: 21, stockIdx: 22 },
    { supplierId: 's11', priceIdx: 23, stockIdx: 24 }
  ];

  let maxSupplierPrice = 0;

  supplierMappings.forEach(({ supplierId, priceIdx, stockIdx }) => {
    const rawPrice = cols[priceIdx];
    const rawStock = cols[stockIdx];

    if (rawPrice || rawStock) {
      const price = parsePrice(rawPrice);
      const { qty, unit } = parseStock(rawStock);

      if (price > 0 || qty > 0) {
        supplierPrices.push({
          id: `sp_${productId}_${supplierId}`,
          product_id: productId,
          supplier_id: supplierId,
          price: price,
          stock_qty: qty,
          stock_unit: unit,
          updated_at: new Date("2026-06-23T07:54:00+07:00").toISOString()
        });

        if (price > maxSupplierPrice) {
          maxSupplierPrice = price;
        }
      }
    }
  });

  if (basePrice === 0 && maxSupplierPrice > 0) {
    basePrice = maxSupplierPrice;
  }

  products.push({
    id: productId,
    name_kh: name_kh,
    name_en: name_en,
    image_url: "",
    base_price: basePrice,
    created_at: new Date("2026-06-23T07:54:00+07:00").toISOString()
  });
});

const customersCode = `[
  { id: "c1", name: "Zeii Pov Store (ស្រីពៅ លក់ចាប់ហួយ)", phone: "012 999 888", map_url: "https://maps.google.com/?q=Phnom+Penh", location_note: "ទល់មុខផ្សារអូរឫស្សី, ផ្ទះលេខ ១២អា", created_at: new Date("2026-02-01").toISOString() },
  { id: "c2", name: "Sok Cheat Minimart (សុខជាតិ ម៉ាត)", phone: "098 111 222", map_url: "https://maps.google.com/?q=Tuol+Kork", location_note: "ផ្លូវ ៣១៥, ក្បែរសាលាបឋមសិក្សាទួលគោក", created_at: new Date("2026-02-02").toISOString() },
  { id: "c3", name: "Bona Coffee & Bakery (បូណា កាហ្វេ)", phone: "088 444 555", map_url: "https://maps.google.com/?q=BKK1", location_note: "ផ្លូវ ៦៣, កែងផ្លូវ ២៩4", created_at: new Date("2026-02-03").toISOString() }
]`;

const ordersCode = `[
  {
    id: "o1",
    customer_id: "c1",
    delivery_fee: 1.50,
    total_amount: 55.70,
    status: "paid",
    ordered_at: new Date("2026-06-18T10:30:00Z").toISOString(),
  }
]`;

const orderItemsCode = `[
  { id: "oi1", order_id: "o1", product_id: "p_1", supplier_id: "s1", supplier_price: 3.50, unit_price: 3.70, quantity: 2, subtotal: 7.40 }
]`;

const mockDataFileContent = `// Mock Data Seed for Wholesale Portal - Generated from User Catalog

export const initialSuppliers = ${JSON.stringify(suppliers, null, 2)};

export const initialProducts = ${JSON.stringify(products, null, 2)};

export const initialSupplierPrices = ${JSON.stringify(supplierPrices, null, 2)};

export const initialCustomers = ${customersCode};

export const initialOrders = ${ordersCode};

export const initialOrderItems = ${orderItemsCode};
`;

const destPath = path.resolve(__dirname, '../src/services/mockData.js');
fs.writeFileSync(destPath, mockDataFileContent, 'utf8');
console.log("Mock data seed generated successfully in:", destPath);
console.log(`Generated ${products.length} products and ${supplierPrices.length} pricing rows.`);
