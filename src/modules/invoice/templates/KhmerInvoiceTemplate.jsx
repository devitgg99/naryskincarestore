import {
  formatCurrency,
  formatInvoiceDate,
  parseQuantity,
  roundMoney,
  PAGE_SIZES
} from '../invoiceUtils';

/**
 * A4 Khmer/English invoice template matching traditional printed invoice layout.
 * Item column is flexible so long Khmer names wrap without breaking the table.
 */
export default function KhmerInvoiceTemplate({
  receiptData,
  products = [],
  invoiceNumber = '',
  invoiceDate = '',
  customerName = '',
  phone = '',
  isDraft = false,
  showDraftBanner = true,
  settings = {}
}) {
  if (!receiptData) return null;

  const {
    fontSize = 13,
    khmerFont = "'Noto Sans Khmer', sans-serif",
    englishFont = "'Noto Sans', 'Inter', sans-serif",
    borderThickness = 1.5,
    invoiceWidth = 794,
    pageSize = 'A4',
    currencySymbol = '$'
  } = settings;

  const page = PAGE_SIZES[pageSize] || PAGE_SIZES.A4;
  const width = Math.max(480, Number(invoiceWidth) || page.widthPx);
  const border = `${borderThickness}px solid #000`;
  const thinBorder = `${Math.max(1, borderThickness * 0.75)}px solid #000`;
  const fontStack = `${khmerFont}, ${englishFont}`;

  const items = receiptData.items || [];
  const itemsSubtotal = items.reduce(
    (sum, item) => sum + roundMoney(Number(item.unit_price) * parseQuantity(item.quantity)),
    0
  );
  const discountAmount = Number(receiptData.order?.discount || 0);
  const deliveryFee = Number(receiptData.order?.delivery_fee || 0);
  const grandTotal = Number(receiptData.order?.total_amount || 0) || roundMoney(Math.max(0, itemsSubtotal - discountAmount) + deliveryFee);

  const displayCustomer = customerName || receiptData.customer?.name || '';
  const displayPhone = phone || receiptData.customer?.phone || '';
  const displayNumber =
    invoiceNumber ||
    (isDraft ? 'DRAFT' : (receiptData.order?.id || '').slice(-5).toUpperCase());
  const displayDate = invoiceDate
    ? formatInvoiceDate(invoiceDate)
    : formatInvoiceDate(receiptData.order?.ordered_at);

  const cellPad = Math.max(4, Math.round(fontSize * 0.35));
  const titleSize = Math.round(fontSize * 1.55);
  const bodySize = fontSize;

  return (
    <div
      className="invoice-khmer-text bg-white text-black"
      style={{
        width: `${width}px`,
        maxWidth: '100%',
        minHeight: `${Math.round(width * (page.heightMm / page.widthMm) * 0.55)}px`,
        padding: `${Math.round(width * 0.055)}px ${Math.round(width * 0.06)}px`,
        boxSizing: 'border-box',
        fontFamily: fontStack,
        fontSize: `${bodySize}px`,
        lineHeight: 1.45,
        color: '#000',
        background: '#fff'
      }}
    >
      {isDraft && showDraftBanner && (
        <div className="no-print text-center text-amber-700 bg-amber-500/10 border border-amber-500/30 rounded-lg p-2 mb-4 text-xs font-bold">
          DRAFT INVOICE PREVIEW
        </div>
      )}

      {/* Title */}
      <div style={{ textAlign: 'center', marginBottom: Math.round(fontSize * 1.4) }}>
        <h1
          style={{
            margin: 0,
            fontSize: `${titleSize}px`,
            fontWeight: 700,
            letterSpacing: '0.02em',
            display: 'inline-block',
            borderBottom: `${Math.max(1.5, borderThickness)}px solid #000`,
            paddingBottom: 4,
            fontFamily: fontStack
          }}
        >
          វិក្កយបត្រ / INVOICE
        </h1>
      </div>

      {/* Two-column header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 24,
          marginBottom: Math.round(fontSize * 1.2),
          fontSize: `${bodySize}px`
        }}
      >
        <div style={{ flex: '1 1 55%', minWidth: 0 }}>
          <div style={{ marginBottom: 4 }}>
            <span style={{ fontWeight: 600 }}>អតិថិជនៈ </span>
            <span>{displayCustomer}</span>
          </div>
          <div>
            <span style={{ fontWeight: 600 }}>លេខទូរស័ព្ទៈ </span>
            <span>{displayPhone}</span>
          </div>
        </div>
        <div style={{ flex: '0 0 auto', textAlign: 'left', whiteSpace: 'nowrap' }}>
          <div style={{ marginBottom: 4 }}>
            <span style={{ fontWeight: 600 }}>វិក្កយបត្រលេខ </span>
            <span>{displayNumber}</span>
          </div>
          <div>
            <span style={{ fontWeight: 600 }}>កាលបរិច្ឆេទៈ </span>
            <span>{displayDate}</span>
          </div>
        </div>
      </div>

      {/* Product table — Item column takes remaining width */}
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          tableLayout: 'fixed',
          border,
          fontSize: `${bodySize}px`
        }}
      >
        <colgroup>
          <col style={{ width: '8%' }} />
          <col style={{ width: '44%' }} />
          <col style={{ width: '12%' }} />
          <col style={{ width: '18%' }} />
          <col style={{ width: '18%' }} />
        </colgroup>
        <thead>
          <tr>
            <th style={thStyle(border, thinBorder, cellPad, true)}>ល.រ / No</th>
            <th style={thStyle(border, thinBorder, cellPad, false, 'left')}>ឈ្មោះទំនិញ / Item</th>
            <th style={thStyle(border, thinBorder, cellPad, true)}>ចំនួន / Qty</th>
            <th style={thStyle(border, thinBorder, cellPad, false, 'right')}>តម្លៃ / Price</th>
            <th style={thStyle(border, thinBorder, cellPad, false, 'right')}>សរុប / Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => {
            const prod = products.find((p) => p.id === item.product_id);
            const qty = parseQuantity(item.quantity);
            const price = Number(item.unit_price) || 0;
            const amount = roundMoney(price * qty);
            const name = prod
              ? prod.name_kh || prod.name_en
              : item.custom_name || 'Custom Item';

            return (
              <tr key={item.id || index}>
                <td style={tdStyle(thinBorder, cellPad, 'center')}>{index + 1}</td>
                <td
                  style={{
                    ...tdStyle(thinBorder, cellPad, 'left'),
                    wordBreak: 'break-word',
                    overflowWrap: 'anywhere',
                    whiteSpace: 'normal'
                  }}
                >
                  {name}
                </td>
                <td style={tdStyle(thinBorder, cellPad, 'center')}>{formatQty(qty)}</td>
                <td style={tdStyle(thinBorder, cellPad, 'right')}>
                  {formatCurrency(price, currencySymbol)}
                </td>
                <td style={tdStyle(thinBorder, cellPad, 'right')}>
                  {formatCurrency(amount, currencySymbol)}
                </td>
              </tr>
            );
          })}

          <tr>
            <td
              colSpan={4}
              style={{
                ...tdStyle(border, cellPad, 'left'),
                fontWeight: 700,
                borderTop: border
              }}
            >
              សរុប / Subtotal
            </td>
            <td
              style={{
                ...tdStyle(border, cellPad, 'right'),
                fontWeight: 700,
                borderTop: border
              }}
            >
              {formatCurrency(itemsSubtotal, currencySymbol)}
            </td>
          </tr>
        </tbody>
      </table>

      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 6, fontSize: `${bodySize}px` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ color: '#374151' }}>Subtotal / សរុបបណ្តោះអាសន្ន:</span>
          <span>{formatCurrency(itemsSubtotal, currencySymbol)}</span>
        </div>

        {discountAmount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, color: '#B91C1C', fontWeight: 600 }}>
            <span>Discount / បញ្ចុះតម្លៃ:</span>
            <span>-{formatCurrency(discountAmount, currencySymbol)}</span>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, color: '#374151' }}>
          <span>Delivery / ថ្លៃដឹកជញ្ជូន:</span>
          <span>
            {deliveryFee > 0 ? formatCurrency(deliveryFee, currencySymbol) : 'Free / Pickup'}
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, borderTop: `${Math.max(1, borderThickness - 0.5)}px double #000`, paddingTop: 8, fontWeight: 700, fontSize: `${Math.max(12, bodySize + 1)}px` }}>
          <span>Grand Total / សរុបរួម:</span>
          <span>{formatCurrency(grandTotal, currencySymbol)}</span>
        </div>
      </div>
    </div>
  );
}

function formatQty(qty) {
  if (Number.isInteger(qty)) return String(qty);
  return String(roundMoney(qty));
}

function thStyle(outerBorder, innerBorder, pad, center = false, align) {
  return {
    border: innerBorder,
    borderBottom: outerBorder,
    padding: `${pad}px ${pad + 2}px`,
    fontWeight: 700,
    textAlign: align || (center ? 'center' : 'left'),
    verticalAlign: 'middle',
    background: '#fff'
  };
}

function tdStyle(border, pad, align = 'left') {
  return {
    border,
    padding: `${pad}px ${pad + 2}px`,
    textAlign: align,
    verticalAlign: 'middle'
  };
}
