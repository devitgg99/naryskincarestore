/** Shared invoice helpers — keep money math consistent with InvoiceBuilder */

export const roundMoney = (num) => {
  const n = Number(num);
  if (isNaN(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
};

export const parseQuantity = (val) => {
  if (val === '' || val === null || val === undefined) return 0;
  const parsed = parseFloat(val);
  return isNaN(parsed) || parsed < 0 ? 0 : parsed;
};

export const formatCurrency = (amount, symbol = '$') => {
  const value = roundMoney(amount);
  return `${symbol}${value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
};

/**
 * Generates a unique, human-readable sequential daily Invoice ID (e.g. INV-261111-001).
 * Tracks a daily sequence counter in localStorage while guaranteeing no collision
 * against any active draft or saved order IDs passed in `existingIds`.
 */
export const generateInvoiceId = (existingIds = [], dateInput = new Date()) => {
  const d = dateInput instanceof Date && !isNaN(dateInput.getTime()) ? dateInput : new Date();
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const dateKey = `${yy}${mm}${dd}`;
  const prefix = `INV-${dateKey}-`;

  const existingSet = new Set();
  let maxFromExisting = 0;

  (Array.isArray(existingIds) ? existingIds : []).forEach((rawId) => {
    const clean = String(rawId || '').trim().toUpperCase();
    if (!clean) return;
    existingSet.add(clean);
    if (clean.startsWith(prefix)) {
      const seqPart = Number.parseInt(clean.slice(prefix.length), 10);
      if (Number.isFinite(seqPart) && seqPart > maxFromExisting) {
        maxFromExisting = seqPart;
      }
    }
  });

  const storageKey = `wsp_invoice_seq_${dateKey}`;
  let storedSeq = 0;
  try {
    storedSeq = Number.parseInt(localStorage.getItem(storageKey) || '0', 10) || 0;
  } catch {
    // Ignore storage read errors in restricted environments
  }

  let nextSeq = Math.max(storedSeq, maxFromExisting) + 1;
  let candidate = `${prefix}${String(nextSeq).padStart(3, '0')}`;
  while (existingSet.has(candidate)) {
    nextSeq += 1;
    candidate = `${prefix}${String(nextSeq).padStart(3, '0')}`;
  }

  try {
    localStorage.setItem(storageKey, String(nextSeq));
  } catch {
    // Ignore storage write errors in restricted environments
  }

  return candidate;
};

/**
 * Resolves the display Invoice ID / Number for a saved order or draft.
 */
export const resolveOrderInvoiceNumber = (order, overrideNumber = '') => {
  const explicit = String(overrideNumber || order?.invoice_number || '').trim();
  if (explicit) return explicit;
  if (order?.id) return `#${String(order.id).slice(-6).toUpperCase()}`;
  return '';
};

export const formatInvoiceDate = (dateInput) => {
  if (!dateInput) return '';
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = String(d.getDate()).padStart(2, '0');
  return `${day}-${months[d.getMonth()]}-${d.getFullYear()}`;
};

/**
 * Formats stock-in / last price update date with relative elapsed time (e.g. '2 days ago', 'just now')
 * matching PricingTable.jsx, alongside concise date and time strings.
 */
export const formatStockInTime = (dateInput) => {
  if (!dateInput) return null;
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  const time = d.getTime();
  if (isNaN(time)) return null;

  const diff = Math.max(0, Date.now() - time);
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);

  let relative;
  let relativeShort;
  if (mins < 1) {
    relative = 'just now';
    relativeShort = 'just now';
  } else if (mins < 60) {
    relative = `${mins} min${mins > 1 ? 's' : ''} ago`;
    relativeShort = `${mins}m ago`;
  } else if (hrs < 24) {
    relative = `${hrs} hr${hrs > 1 ? 's' : ''} ago`;
    relativeShort = `${hrs}h ago`;
  } else if (days < 7) {
    relative = `${days} day${days > 1 ? 's' : ''} ago`;
    relativeShort = `${days}d ago`;
  } else if (weeks < 5) {
    relative = `${weeks} week${weeks > 1 ? 's' : ''} ago`;
    relativeShort = `${weeks}w ago`;
  } else {
    relative = `${months} month${months > 1 ? 's' : ''} ago`;
    relativeShort = `${months}mo ago`;
  }

  const monthsArr = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = d.getDate();
  const month = monthsArr[d.getMonth()];
  const year = d.getFullYear();
  const currentYear = new Date().getFullYear();
  const formattedDate = year === currentYear ? `${month} ${day}` : `${month} ${day}, ${year}`;

  const hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  const formattedTime = `${hour12}:${minutes} ${ampm}`;

  return {
    relative,
    relativeShort,
    formattedDate,
    formattedTime,
    full: `${formattedDate} ${formattedTime}`
  };
};

/**
 * Builds a high-legibility receipt for 58 mm Bluetooth thermal printers.
 * Product names get their own line, while prices and totals use compact,
 * copy-safe text rows for printer apps that only accept pasted text.
 */
export const createThermalReceiptText = ({
  receiptData,
  getItemName,
  shopName = '',
  shopAddress = '',
  shopPhone = '',
  footer = '',
  invoiceNumber = '',
  invoiceDate = '',
  currencySymbol = '$',
  isDraft = false,
}) => {
  if (!receiptData?.order) return '';

  const order = receiptData.order;
  const items = receiptData.items || [];
  const line = '-'.repeat(32);
  const strongLine = '='.repeat(32);
  const orderNumber = invoiceNumber || order.invoice_number || (isDraft
    ? 'DRAFT'
    : `#${String(order.id || '').slice(-6).toUpperCase()}`);
  const date = invoiceDate || formatInvoiceDate(order.ordered_at);
  const subtotal = roundMoney(items.reduce((sum, item) => (
    sum + Number(item.subtotal ?? (parseQuantity(item.quantity) * Number(item.unit_price || 0)))
  ), 0));
  const discount = Number(order.discount || 0);
  const delivery = Number(order.delivery_fee || 0);
  const total = Number(order.total_amount ?? roundMoney(Math.max(0, subtotal - discount) + delivery));
  const nameForItem = typeof getItemName === 'function'
    ? getItemName
    : (item) => item.custom_name || item.name_kh || item.name_en || item.product_name || item.name || 'Item';

  const moneyRow = (label, amount) => `${label.padEnd(20, ' ')}${amount}`;
  // Leading spaces are retained when pasted into common Bluetooth printer apps.
  // Do not truncate long Khmer or English names: those apps can wrap them naturally.
  const centered = (value) => {
    const text = String(value || '').trim();
    return text ? `${' '.repeat(Math.max(0, Math.floor((32 - text.length) / 2)))}${text}` : '';
  };
  const lines = [
    strongLine,
    centered(shopName),
    centered(shopAddress),
    shopPhone ? centered(`Tel: ${shopPhone}`) : '',
    strongLine,
    centered(`RECEIPT ${orderNumber}`),
    date ? centered(`Date: ${date}`) : '',
    line,
    'ITEMS',
  ].filter(Boolean);

  items.forEach((item, index) => {
    const quantity = parseQuantity(item.quantity);
    const price = Number(item.unit_price || 0);
    const amount = Number(item.subtotal ?? roundMoney(quantity * price));
    lines.push(`${index + 1}. ${String(nameForItem(item) || 'Item').trim()}`);
    lines.push(`   ${quantity} x ${formatCurrency(price, currencySymbol)} = ${formatCurrency(amount, currencySymbol)}`);
  });

  lines.push(line);
  lines.push(moneyRow('Subtotal', formatCurrency(subtotal, currencySymbol)));
  if (discount > 0) lines.push(moneyRow('Discount', `-${formatCurrency(discount, currencySymbol)}`));
  if (delivery > 0) lines.push(moneyRow('Delivery', formatCurrency(delivery, currencySymbol)));
  lines.push(strongLine);
  lines.push(moneyRow('TOTAL', formatCurrency(total, currencySymbol)));
  lines.push(strongLine);
  if (footer) lines.push(footer);

  return lines.join('\n');
};

export const TEMPLATE_IDS = {
  OLD: 'old',
  KHMER: 'khmer'
};

export const TEMPLATE_OPTIONS = [
  { id: TEMPLATE_IDS.OLD, label: 'Old Receipt' },
  { id: TEMPLATE_IDS.KHMER, label: 'Khmer Invoice' }
];

export const KHMER_FONTS = [
  { id: "'Noto Sans Khmer', sans-serif", label: 'Noto Sans Khmer' },
  { id: "'Noto Serif Khmer', serif", label: 'Noto Serif Khmer' }
];

export const ENGLISH_FONTS = [
  { id: "'Noto Sans', 'Inter', sans-serif", label: 'Noto Sans' },
  { id: "'Times New Roman', Times, serif", label: 'Times' },
  { id: 'Arial, Helvetica, sans-serif', label: 'Arial' },
  { id: "'Courier New', Courier, monospace", label: 'Courier' }
];

export const PAGE_SIZES = {
  A4: { id: 'A4', label: 'A4', widthMm: 210, heightMm: 297, widthPx: 794 },
  Letter: { id: 'Letter', label: 'Letter', widthMm: 216, heightMm: 279, widthPx: 816 }
};

export const DEFAULT_INVOICE_SETTINGS = {
  template: TEMPLATE_IDS.OLD,
  fontSize: 13,
  khmerFont: KHMER_FONTS[0].id,
  englishFont: ENGLISH_FONTS[0].id,
  borderThickness: 1.5,
  invoiceWidth: 794,
  pageSize: 'A4',
  currencySymbol: '$'
};

/** Sample line items matching the printed Khmer invoice reference (custom items only). */
export const SAMPLE_KHMER_ITEMS = [
  { name: 'យប់MN', quantity: 180, price: 3.7 },
  { name: 'លេខទឹកMN', quantity: 80, price: 3.1 },
  { name: 'យប់Dana', quantity: 6, price: 11.5 },
  { name: 'យប់MN', quantity: 60, price: 3.7 },
  { name: 'ទឹកកាម៉យ Femfresh', quantity: 4, price: 16 },
  { name: 'សាប៊ូកក់សក់', quantity: 50, price: 6.9 },
  { name: 'យប់Dana', quantity: 6, price: 11.5 },
  { name: 'ទឹកក្រូច', quantity: 12, price: 3.6 },
  { name: 'វ៉ែនតា NAMI', quantity: 24, price: 8.2 },
  { name: 'ម៉ាកsalika ក្រែម', quantity: 10, price: 7.8 },
  { name: 'សាប៊ូលាងមុខ', quantity: 24, price: 5.4 },
  { name: 'ម៉ាកHk7', quantity: 12, price: 5.4 }
];

export const createSampleCustomLineItems = (generateId) =>
  SAMPLE_KHMER_ITEMS.map((item) => ({
    id: generateId(),
    product_id: '',
    supplier_id: '',
    supplier_price: 0,
    unit_price: item.price,
    quantity: item.quantity,
    subtotal: roundMoney(item.price * item.quantity),
    maxStock: 0,
    stockUnit: 'pcs',
    searchQuery: '',
    isDropdownOpen: false,
    isCustom: true,
    custom_name: item.name
  }));

function dataUrlToUint8Array(dataUrl) {
  const base64 = dataUrl.split(',')[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function getImageDimensions(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = reject;
    img.src = dataUrl;
  });
}

/**
 * Embed a JPEG data URL into a single-page PDF (DCTDecode) — no extra dependencies.
 */
export async function downloadPdfFromJpeg(dataUrl, filename, pageSize = PAGE_SIZES.A4) {
  const jpegBytes = dataUrlToUint8Array(dataUrl);
  const { width: imgW, height: imgH } = await getImageDimensions(dataUrl);

  const pageW = pageSize.widthMm;
  const pageH = pageSize.heightMm;
  const margin = 6;
  const maxW = pageW - margin * 2;
  const maxH = pageH - margin * 2;
  const pxToMm = 25.4 / 96;
  const scale = Math.min(maxW / (imgW * pxToMm), maxH / (imgH * pxToMm), 1);
  const drawW = imgW * pxToMm * scale;
  const drawH = imgH * pxToMm * scale;
  const x = (pageW - drawW) / 2;
  const y = pageH - margin - drawH;

  const parts = [];
  const offsets = [];
  const encoder = new TextEncoder();

  const push = (strOrBytes) => {
    if (typeof strOrBytes === 'string') parts.push(encoder.encode(strOrBytes));
    else parts.push(strOrBytes);
  };

  const contentStream = `q\n${drawW.toFixed(2)} 0 0 ${drawH.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm\n/Im0 Do\nQ\n`;
  const contentBytes = encoder.encode(contentStream);

  push('%PDF-1.4\n');

  const writeObj = (num, bodyBytes) => {
    offsets[num] = parts.reduce((sum, p) => sum + p.length, 0);
    push(`${num} 0 obj\n`);
    push(bodyBytes);
    push('\nendobj\n');
  };

  writeObj(1, encoder.encode('<< /Type /Catalog /Pages 2 0 R >>'));
  writeObj(2, encoder.encode('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'));
  writeObj(
    3,
    encoder.encode(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`
    )
  );

  offsets[4] = parts.reduce((sum, p) => sum + p.length, 0);
  push('4 0 obj\n');
  push(
    encoder.encode(
      `<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`
    )
  );
  push(jpegBytes);
  push(encoder.encode('\nendstream\nendobj\n'));

  offsets[5] = parts.reduce((sum, p) => sum + p.length, 0);
  push('5 0 obj\n');
  push(encoder.encode(`<< /Length ${contentBytes.length} >>\nstream\n`));
  push(contentBytes);
  push(encoder.encode('endstream\nendobj\n'));

  const xrefOffset = parts.reduce((sum, p) => sum + p.length, 0);
  push('xref\n');
  push('0 6\n');
  push('0000000000 65535 f \n');
  for (let i = 1; i <= 5; i++) {
    push(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  }
  push('trailer\n');
  push('<< /Size 6 /Root 1 0 R >>\n');
  push('startxref\n');
  push(`${xrefOffset}\n`);
  push('%%EOF\n');

  const totalLength = parts.reduce((sum, p) => sum + p.length, 0);
  const pdf = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    pdf.set(part, offset);
    offset += part.length;
  }

  const blob = new Blob([pdf], { type: 'application/pdf' });
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  link.href = blobUrl;
  link.click();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
  return blobUrl;
}
