import { formatCurrency, parseQuantity, roundMoney } from '../invoiceUtils';

/**
 * Original thermal-style bilingual receipt template.
 * Preserves existing visual layout used by the invoice builder.
 */
export default function OldReceiptTemplate({
  receiptData,
  products = [],
  shopName,
  shopAddress,
  shopPhone,
  customFooter,
  isDraft = false,
  currencySymbol = '$',
  showDraftBanner = true
}) {
  if (!receiptData) return null;

  const items = receiptData.items || [];
  const itemsSubtotal = items.reduce(
    (sum, item) => sum + roundMoney(Number(item.unit_price) * parseQuantity(item.quantity)),
    0
  );

  return (
    <div className="bg-white p-2 text-black font-sans invoice-khmer-text">
      {isDraft && showDraftBanner && (
        <div className="no-print text-center text-amber-700 bg-amber-500/10 border border-amber-500/30 rounded-lg p-2 mb-4 text-xs font-bold">
          DRAFT INVOICE PREVIEW
        </div>
      )}

      <div className="text-center space-y-1.5 border-b pb-4 border-dashed border-gray-300">
        <h1 className="text-xl font-bold uppercase tracking-wider text-black">វិក្កយបត្រ / INVOICE</h1>
        <h2 className="text-base font-bold text-black font-mono leading-tight">{shopName}</h2>
        <p className="text-[10px] text-gray-600">
          {shopAddress}
          {shopPhone ? ` • Tel: ${shopPhone}` : ''}
        </p>

        <div className="text-left text-xs grid grid-cols-2 gap-y-1 pt-3 font-mono text-gray-800">
          <div>
            <strong>Invoice No:</strong> #{isDraft ? 'DRAFT_PREVIEW' : receiptData.order.id.slice(-6).toUpperCase()}
          </div>
          <div>
            <strong>Date:</strong> {new Date(receiptData.order.ordered_at).toLocaleDateString()}
          </div>
          <div className="col-span-2">
            <strong>Customer:</strong> {receiptData.customer?.name}
          </div>
          {receiptData.customer?.phone && (
            <div className="col-span-2">
              <strong>Phone:</strong> {receiptData.customer.phone}
            </div>
          )}
          {receiptData.customer?.location_note && (
            <div className="col-span-2">
              <strong>Address:</strong> {receiptData.customer.location_note}
            </div>
          )}
        </div>
      </div>

      <table className="w-full text-xs text-left mt-4 border-b border-dashed border-gray-300 pb-4">
        <thead>
          <tr className="border-b border-gray-300 font-bold text-gray-900">
            <th className="py-2">Description / ទំនិញ</th>
            <th className="py-2 text-center">Qty</th>
            <th className="py-2 text-right">Price</th>
            <th className="py-2 text-right">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {items.map((item, index) => {
            const prod = products.find((p) => p.id === item.product_id);
            const qty = parseQuantity(item.quantity);
            const sub = roundMoney(Number(item.unit_price) * qty);
            return (
              <tr key={item.id || index} className="text-gray-900">
                <td className="py-2">
                  <div className="font-bold">{prod ? prod.name_kh : item.custom_name || 'Custom Item'}</div>
                  <div className="text-[10px] text-gray-500">{prod ? prod.name_en : 'Custom Item'}</div>
                </td>
                <td className="py-2 text-center font-mono font-medium">{qty}</td>
                <td className="py-2 text-right font-mono">{formatCurrency(item.unit_price, currencySymbol)}</td>
                <td className="py-2 text-right font-mono font-bold">{formatCurrency(sub, currencySymbol)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="mt-4 space-y-1.5 text-xs text-right font-mono">
        <div className="flex justify-between text-gray-700">
          <span>Subtotal / សរុបបណ្តោះអាសន្ន:</span>
          <span>{formatCurrency(itemsSubtotal, currencySymbol)}</span>
        </div>
        {Number(receiptData.order.discount || 0) > 0 && (
          <div className="flex justify-between text-rose-600 font-semibold">
            <span>Discount / បញ្ចុះតម្លៃ:</span>
            <span>-{formatCurrency(receiptData.order.discount, currencySymbol)}</span>
          </div>
        )}
        <div className="flex justify-between text-gray-700">
          <span>Delivery / ថ្លៃដឹកជញ្ជូន:</span>
          <span>
            {Number(receiptData.order.delivery_fee) > 0
              ? formatCurrency(receiptData.order.delivery_fee, currencySymbol)
              : 'Free / Pickup'}
          </span>
        </div>
        <div className="flex justify-between border-t border-double pt-2 text-sm font-bold text-black">
          <span>Grand Total / សរុបរួម:</span>
          <span>{formatCurrency(receiptData.order.total_amount, currencySymbol)}</span>
        </div>
      </div>

      <div className="mt-6 text-center space-y-1 border-t border-dashed border-gray-300 pt-4 text-[10px] text-gray-500">
        <p className="font-medium text-gray-700">{customFooter}</p>
        <p className="font-mono text-[9px] text-gray-400">Wholesale Portal Invoice System</p>
      </div>
    </div>
  );
}
