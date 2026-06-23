/* eslint-env node */
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse .env manually to get Supabase credentials
const envPath = path.resolve(process.cwd(), '.env');
if (!fs.existsSync(envPath)) {
  console.error("Error: .env file not found.");
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
  console.error("Error: Please set valid VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.");
  process.exit(1);
}

console.log(`Connecting to Supabase at: ${url}...`);
const supabase = createClient(url, key);

// Read raw data from local Price.csv
const csvPath = path.resolve(__dirname, './Price.csv');
if (!fs.existsSync(csvPath)) {
  console.error("Error: Price.csv not found in scripts directory.");
  process.exit(1);
}
const rawData = fs.readFileSync(csvPath, 'utf8');

// Spreadsheet suppliers columns
const spreadsheetSuppliers = [
  { name: "Makara" },
  { name: "Siloeng" },
  { name: "SY 168" },
  { name: "Jee Ya" },
  { name: "Leng Heng" },
  { name: "Srey Len" },
  { name: "Oun Ka" },
  { name: "Korea SCT" },
  { name: "Chanty AI" },
  { name: "Sun Kunthea TGN" },
  { name: "Moy Pa" }
];

function parseName(name) {
  const cleanName = name.trim();
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

function parsePrice(val) {
  if (!val) return 0;
  return parseFloat(val.replace(/[^0-9.]/g, '')) || 0;
}

function parseStock(val) {
  if (!val) return { qty: 0, unit: 'pcs' };
  const cleanVal = val.trim().toLowerCase();
  const numMatch = cleanVal.match(/^[0-9]+/);
  const qty = numMatch ? parseInt(numMatch[0], 10) : 0;
  let unit = 'pcs';
  if (cleanVal.includes('pcs')) {
    unit = 'pcs';
  } else if (cleanVal.includes('lo')) {
    unit = 'lo';
  } else if (cleanVal.includes('cs') || cleanVal.includes('case') || cleanVal.includes('kes') || cleanVal.includes('box')) {
    unit = 'cs';
  }
  return { qty, unit };
}

async function mergeSeed() {
  try {
    console.log("Fetching existing database records...");
    const { data: dbProducts, error: dbProdErr } = await supabase.from('products').select('*');
    if (dbProdErr) throw dbProdErr;
    console.log(`Loaded ${dbProducts.length} existing products.`);

    const { data: dbSuppliers, error: dbSupErr } = await supabase.from('suppliers').select('*');
    if (dbSupErr) throw dbSupErr;
    console.log(`Loaded ${dbSuppliers.length} existing suppliers.`);

    const productMapByName = {};
    dbProducts.forEach(p => {
      productMapByName[p.name_kh.trim().toLowerCase()] = p;
    });

    const supplierMapByName = {};
    dbSuppliers.forEach(s => {
      supplierMapByName[s.name.trim().toLowerCase()] = s;
    });

    // 1. Merge suppliers
    console.log("Syncing spreadsheet suppliers...");
    const supplierIdMap = {}; // name -> uuid
    for (const sup of spreadsheetSuppliers) {
      const lowerName = sup.name.trim().toLowerCase();
      let matchedSup = supplierMapByName[lowerName];
      if (!matchedSup) {
        // Try exact substring match or alias
        const match = dbSuppliers.find(s => s.name.toLowerCase().includes(lowerName) || lowerName.includes(s.name.toLowerCase()));
        if (match) matchedSup = match;
      }

      if (matchedSup) {
        supplierIdMap[sup.name] = matchedSup.id;
      } else {
        // Insert new supplier
        console.log(`Adding new supplier: ${sup.name}...`);
        const { data: newSupData, error: newSupErr } = await supabase.from('suppliers').insert({
          name: sup.name,
          contact_phone: null
        }).select();
        if (newSupErr) throw newSupErr;
        supplierIdMap[sup.name] = newSupData[0].id;
        dbSuppliers.push(newSupData[0]);
        supplierMapByName[sup.name.trim().toLowerCase()] = newSupData[0];
      }
    }

    // 2. Merge products
    console.log("Syncing spreadsheet products...");
    const productIdMap = {}; // tempIndex -> uuid
    const productsToUpsert = [];
    const lines = rawData.split('\n');
    const dataLines = lines.slice(1);

    for (let index = 0; index < dataLines.length; index++) {
      const line = dataLines[index];
      if (!line.trim()) continue;
      const cols = line.split(',');
      const rawName = cols[0];
      if (!rawName) continue;

      const { name_kh, name_en } = parseName(rawName);
      const sellingPrice = parsePrice(cols[2]);
      let basePrice = sellingPrice > 0.20 ? Math.round((sellingPrice - 0.20) * 100) / 100 : 0.00;

      // Find if product already exists
      let matchedProd = productMapByName[name_kh.toLowerCase()];
      if (!matchedProd) {
        matchedProd = dbProducts.find(p => p.name_kh.toLowerCase() === name_kh.toLowerCase() || p.name_en.toLowerCase() === name_en.toLowerCase());
      }

      let uuid;
      if (matchedProd) {
        uuid = matchedProd.id;
        productIdMap[index] = uuid;
      } else {
        // Prepare to insert new product
        uuid = crypto.randomUUID();
        productIdMap[index] = uuid;
        const newProduct = {
          id: uuid,
          name_kh,
          name_en,
          base_price: basePrice,
          image_url: null,
          created_at: new Date().toISOString()
        };
        productsToUpsert.push(newProduct);
        // Cache dynamically to avoid double inserts if same product is duplicated in sheet
        productMapByName[name_kh.toLowerCase()] = newProduct;
      }
    }

    if (productsToUpsert.length > 0) {
      console.log(`Inserting ${productsToUpsert.length} new products...`);
      const { error: insertProdErr } = await supabase.from('products').insert(productsToUpsert);
      if (insertProdErr) throw insertProdErr;
    }

    // 3. Map supplier prices
    const pricesMap = new Map();
    
    const supplierMappings = [
      { supplierName: 'Makara', priceIdx: 3, stockIdx: 4 },
      { supplierName: 'Siloeng', priceIdx: 5, stockIdx: 6 },
      { supplierName: 'SY 168', priceIdx: 7, stockIdx: 8 },
      { supplierName: 'Jee Ya', priceIdx: 9, stockIdx: 10 },
      { supplierName: 'Leng Heng', priceIdx: 11, stockIdx: 12 },
      { supplierName: 'Srey Len', priceIdx: 13, stockIdx: 14 },
      { supplierName: 'Oun Ka', priceIdx: 15, stockIdx: 16 },
      { supplierName: 'Korea SCT', priceIdx: 17, stockIdx: 18 },
      { supplierName: 'Chanty AI', priceIdx: 19, stockIdx: 20 },
      { supplierName: 'Sun Kunthea TGN', priceIdx: 21, stockIdx: 22 },
      { supplierName: 'Moy Pa', priceIdx: 23, stockIdx: 24 }
    ];

    for (let index = 0; index < dataLines.length; index++) {
      const line = dataLines[index];
      if (!line.trim()) continue;
      const cols = line.split(',');
      const prodUuid = productIdMap[index];
      if (!prodUuid) continue;

      supplierMappings.forEach(({ supplierName, priceIdx, stockIdx }) => {
        const rawPrice = cols[priceIdx];
        const rawStock = cols[stockIdx];
        const supUuid = supplierIdMap[supplierName];

        if (supUuid && (rawPrice || rawStock)) {
          const price = parsePrice(rawPrice);
          const { qty, unit } = parseStock(rawStock);

          if (price > 0 || qty > 0) {
            const key = `${prodUuid}_${supUuid}`;
            pricesMap.set(key, {
              product_id: prodUuid,
              supplier_id: supUuid,
              price: price,
              stock_qty: qty,
              stock_unit: unit,
              updated_at: new Date().toISOString()
            });
          }
        }
      });
    }

    const pricesToUpsert = Array.from(pricesMap.values());
    console.log(`Upserting ${pricesToUpsert.length} supplier pricing and inventory counts...`);
    const { error: upsertPriceErr } = await supabase.from('supplier_prices').upsert(pricesToUpsert, {
      onConflict: 'product_id,supplier_id'
    });
    if (upsertPriceErr) throw upsertPriceErr;

    console.log("🎉 Database merge completed successfully! No existing records were deleted.");
  } catch (err) {
    console.error("❌ Merge seeding failed:", err);
  }
}

mergeSeed();
