import { RefreshCw, Download, FileDown, FileText, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { OldReceiptTemplate, KhmerInvoiceTemplate } from '../templates';
import {
  TEMPLATE_IDS,
  TEMPLATE_OPTIONS,
  KHMER_FONTS,
  ENGLISH_FONTS,
  PAGE_SIZES,
  parseQuantity,
  roundMoney,
} from '../invoiceUtils';

/**
 * InvoicePreviewModal — Full-screen preview/print overlay for both draft
 * previews and completed saved orders. Left column shows receipt customization
 * and profit analysis; right column shows the rendered template.
 *
 * Props:
 *   receiptData        — { order, items, customer } | null
 *   products           — Product[]
 *   printableCardRef   — React ref  (attached to the template container for html-to-image)
 *   // Template selection
 *   receiptTemplate    — string
 *   setReceiptTemplate(val)
 *   // Shop info
 *   shopName, setShopName, shopAddress, setShopAddress, shopPhone, setShopPhone
 *   customFooter, setCustomFooter
 *   // Khmer invoice fields
 *   invoiceNumber      — string (live invoice number or saved order invoice number)
 *   onInvoiceNumberChange(val)
 *   invoiceCustomerName, setInvoiceCustomerName
 *   invoicePhone, setInvoicePhone
 *   invoiceDate, setInvoiceDate
 *   // Formatting settings
 *   invoiceSettings    — { fontSize, khmerFont, englishFont, borderThickness, invoiceWidth, pageSize, currencySymbol }
 *   invoiceFontSize, setInvoiceFontSize
 *   invoiceKhmerFont, setInvoiceKhmerFont
 *   invoiceEnglishFont, setInvoiceEnglishFont
 *   invoiceBorderThickness, setInvoiceBorderThickness
 *   invoiceWidth, setInvoiceWidth
 *   invoicePageSize, setInvoicePageSize
 *   currencySymbol, setCurrencySymbol
 *   // Source & customization flags
 *   savedOrder         — object | null  (non-null means finalized order in InvoiceBuilder)
 *   isLoadingItems     — boolean (optional, shows loading indicator when fetching items)
 *   profitTitle        — string (optional heading for internal profit card)
 *   getItemCost        — (item) => number (optional cost lookup override)
 *   getItemTitle       — (item) => string (optional item name lookup override)
 *   // Actions
 *   isExporting        — boolean
 *   onDownloadImage(format)
 *   onDownloadPdf()
 *   onPrint()
 *   onOpenThermalReceipt()
 *   onClose()
 *   onRegenerateInvoiceId — optional handler; button hidden if omitted
 */
export default function InvoicePreviewModal({
  receiptData,
  products,
  printableCardRef,
  receiptTemplate,
  setReceiptTemplate,
  shopName, setShopName,
  shopAddress, setShopAddress,
  shopPhone, setShopPhone,
  customFooter, setCustomFooter,
  invoiceNumber, onInvoiceNumberChange,
  invoiceCustomerName, setInvoiceCustomerName,
  invoicePhone, setInvoicePhone,
  invoiceDate, setInvoiceDate,
  invoiceSettings,
  invoiceFontSize, setInvoiceFontSize,
  invoiceKhmerFont, setInvoiceKhmerFont,
  invoiceEnglishFont, setInvoiceEnglishFont,
  invoiceBorderThickness, setInvoiceBorderThickness,
  invoiceWidth, setInvoiceWidth,
  invoicePageSize, setInvoicePageSize,
  currencySymbol, setCurrencySymbol,
  savedOrder = null,
  isLoadingItems = false,
  profitTitle = 'Internal Profit Analysis',
  getItemCost,
  getItemTitle,
  isExporting,
  onDownloadImage,
  onDownloadPdf,
  onPrint,
  onOpenThermalReceipt,
  onClose,
  onRegenerateInvoiceId,
}) {
  if (!receiptData) return null;

  const isDraft = String(receiptData.order?.id || '').startsWith('DRAFT_PREVIEW');

  // The invoice number shown/editable in the modal
  const modalInvoiceNumber =
    invoiceNumber !== undefined
      ? invoiceNumber
      : (receiptData.order?.invoice_number || '');

  const modalCustomerName = savedOrder
    ? (receiptData.customer?.name || '')
    : (invoiceCustomerName || receiptData.customer?.name);

  const modalCustomerPhone = savedOrder
    ? (receiptData.customer?.phone || '')
    : (invoicePhone || receiptData.customer?.phone);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-xs p-3 sm:p-6 flex items-center justify-center no-print">
      <div
        className={`bg-card border border-border w-full rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200 ${
          receiptTemplate === TEMPLATE_IDS.KHMER ? 'max-w-6xl' : 'max-w-4xl'
        }`}
      >
        {/* Top Bar */}
        <div className="p-4 border-b border-border flex justify-between items-center bg-card/60 flex-wrap gap-2">
          <h3 className="font-semibold text-foreground text-sm sm:text-base flex items-center gap-2">
            <span>{isDraft ? 'Receipt Preview (Draft)' : 'Invoice Preview'}</span>
            {isLoadingItems && (
              <span className="text-xs text-primary flex items-center gap-1 font-normal">
                <RefreshCw className="w-3 h-3 animate-spin" /> Fetching items...
              </span>
            )}
          </h3>

          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={receiptTemplate}
              onChange={(e) => setReceiptTemplate(e.target.value)}
              className="h-8 rounded-md border border-input bg-card px-2 text-xs text-foreground"
              title="Receipt template"
            >
              {TEMPLATE_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onDownloadImage('png')}
              disabled={isExporting}
              className="gap-1.5 text-xs text-primary border-primary/30 hover:border-primary/60"
            >
              {isExporting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              <span>PNG</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onDownloadPdf}
              disabled={isExporting}
              className="gap-1.5 text-xs"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>PDF</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onOpenThermalReceipt}
              className="gap-1.5 text-xs"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>58 mm Text</span>
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={onPrint}
              className="gap-1.5 text-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{isDraft ? 'Print Draft' : 'Print'}</span>
            </Button>

            <Button type="button" variant="ghost" size="sm" onClick={onClose} className="text-xs">
              Close
            </Button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 scrollbar-thin bg-muted/20">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">

            {/* Left: Receipt Customization + Profit Analysis */}
            <div className="md:col-span-5 space-y-6 no-print order-2 md:order-1">

              {/* Header Customization Form */}
              <div className="p-4 sm:p-5 rounded-2xl border border-border bg-card/80 space-y-4 shadow-sm text-left">
                <h4 className="text-xs font-bold text-primary uppercase tracking-widest border-b border-border pb-2">
                  {receiptTemplate === TEMPLATE_IDS.KHMER ? 'Khmer Invoice Settings' : 'Edit Receipt Header'}
                </h4>
                <div className="space-y-3 text-xs">
                  {receiptTemplate === TEMPLATE_IDS.OLD ? (
                    <>
                      <div>
                        <label className="block font-semibold text-muted-foreground uppercase mb-1">Invoice ID / Number</label>
                        <div className="flex items-center gap-1.5">
                          <Input
                            type="text"
                            value={modalInvoiceNumber}
                            onChange={(e) => onInvoiceNumberChange?.(e.target.value)}
                            placeholder="INV-261111-001"
                            className="h-8 text-xs font-mono"
                          />
                          {!savedOrder && onRegenerateInvoiceId && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={onRegenerateInvoiceId}
                              className="h-8 px-2 shrink-0"
                              title="Generate new Invoice ID"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                      <div>
                        <label className="block font-semibold text-muted-foreground uppercase mb-1">Shop/Vendor Name</label>
                        <Input type="text" value={shopName} onChange={(e) => setShopName(e.target.value)} className="h-8 text-xs" />
                      </div>
                      <div>
                        <label className="block font-semibold text-muted-foreground uppercase mb-1">Shop Address / Landmark</label>
                        <Input type="text" value={shopAddress} onChange={(e) => setShopAddress(e.target.value)} className="h-8 text-xs" />
                      </div>
                      <div>
                        <label className="block font-semibold text-muted-foreground uppercase mb-1">Phone Number</label>
                        <Input type="text" value={shopPhone} onChange={(e) => setShopPhone(e.target.value)} className="h-8 text-xs" />
                      </div>
                      <div>
                        <label className="block font-semibold text-muted-foreground uppercase mb-1">Footer Message</label>
                        <textarea
                          value={customFooter}
                          onChange={(e) => setCustomFooter(e.target.value)}
                          rows="2"
                          className="w-full border border-input bg-background rounded-md px-3 py-1.5 text-xs text-foreground focus:ring-2 focus:ring-ring focus:outline-hidden resize-none"
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="block font-semibold text-muted-foreground uppercase mb-1">Customer Name</label>
                        <Input type="text" value={invoiceCustomerName} onChange={(e) => setInvoiceCustomerName(e.target.value)} className="h-8 text-xs" />
                      </div>
                      <div>
                        <label className="block font-semibold text-muted-foreground uppercase mb-1">Phone</label>
                        <Input type="text" value={invoicePhone} onChange={(e) => setInvoicePhone(e.target.value)} className="h-8 text-xs" />
                      </div>
                      <div>
                        <label className="block font-semibold text-muted-foreground uppercase mb-1">Invoice Number</label>
                        <div className="flex items-center gap-1.5">
                          <Input
                            type="text"
                            value={modalInvoiceNumber}
                            onChange={(e) => onInvoiceNumberChange?.(e.target.value)}
                            className="h-8 text-xs font-mono"
                          />
                          {!savedOrder && onRegenerateInvoiceId && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={onRegenerateInvoiceId}
                              className="h-8 px-2 shrink-0"
                              title="Generate new Invoice ID"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                      <div>
                        <label className="block font-semibold text-muted-foreground uppercase mb-1">Date</label>
                        <Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className="h-8 text-xs" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block font-semibold text-muted-foreground uppercase mb-1">Font Size</label>
                          <Input type="number" min="10" max="22" value={invoiceFontSize} onChange={(e) => setInvoiceFontSize(Number(e.target.value) || 13)} className="h-8 text-xs" />
                        </div>
                        <div>
                          <label className="block font-semibold text-muted-foreground uppercase mb-1">Border (px)</label>
                          <Input type="number" min="1" max="4" step="0.5" value={invoiceBorderThickness} onChange={(e) => setInvoiceBorderThickness(Number(e.target.value) || 1.5)} className="h-8 text-xs" />
                        </div>
                      </div>
                      <div>
                        <label className="block font-semibold text-muted-foreground uppercase mb-1">Khmer Font</label>
                        <select value={invoiceKhmerFont} onChange={(e) => setInvoiceKhmerFont(e.target.value)} className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs">
                          {KHMER_FONTS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block font-semibold text-muted-foreground uppercase mb-1">English Font</label>
                        <select value={invoiceEnglishFont} onChange={(e) => setInvoiceEnglishFont(e.target.value)} className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs">
                          {ENGLISH_FONTS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block font-semibold text-muted-foreground uppercase mb-1">Width (px)</label>
                          <Input type="number" min="480" max="900" value={invoiceWidth} onChange={(e) => setInvoiceWidth(Number(e.target.value) || 794)} className="h-8 text-xs" />
                        </div>
                        <div>
                          <label className="block font-semibold text-muted-foreground uppercase mb-1">Page Size</label>
                          <select value={invoicePageSize} onChange={(e) => setInvoicePageSize(e.target.value)} className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs">
                            {Object.values(PAGE_SIZES).map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block font-semibold text-muted-foreground uppercase mb-1">Currency Symbol</label>
                        <Input type="text" value={currencySymbol} onChange={(e) => setCurrencySymbol(e.target.value || '$')} className="h-8 text-xs" />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Internal Profit Analysis Card */}
              <div className="p-4 sm:p-5 rounded-2xl border border-border bg-card/80 space-y-4 shadow-sm text-left">
                <div className="flex justify-between items-center border-b border-border pb-3">
                  <h4 className="text-xs font-bold text-emerald-500 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    {profitTitle}
                  </h4>
                  <span className="text-xs text-muted-foreground font-mono">
                    {isDraft ? 'DRAFT' : `#${String(receiptData.order.id || '').slice(-6).toUpperCase()}`}
                  </span>
                </div>

                <div className="divide-y divide-border max-h-48 overflow-y-auto scrollbar-thin">
                  {receiptData.items.map((item, idx) => {
                    const prod = products.find((p) => String(p.id).trim() === String(item.product_id).trim());
                    const isCustom = !item.product_id;
                    const cost = typeof getItemCost === 'function' ? getItemCost(item) : Number(item.supplier_price || 0);
                    const selling = Number(item.unit_price);
                    const qty = parseQuantity(item.quantity);
                    const profitPerUnit = selling - cost;
                    const itemProfit = roundMoney(profitPerUnit * qty);
                    const displayTitle = typeof getItemTitle === 'function'
                      ? getItemTitle(item)
                      : (prod ? `${prod.name_kh} (${prod.name_en})` : (item.custom_name || 'Custom Item'));

                    return (
                      <div key={item.id || idx} className="py-2.5 flex justify-between items-start gap-4 text-xs">
                        <div className="space-y-1">
                          <div className="font-semibold text-foreground">
                            {displayTitle}
                          </div>
                          <div className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                            {!isCustom && <span>Cost: ${cost.toFixed(2)}</span>}
                            {!isCustom && <span>•</span>}
                            <span>Sell: ${selling.toFixed(2)}</span>
                            <span>•</span>
                            <span>Qty: {qty}</span>
                          </div>
                        </div>
                        <div className="text-right font-mono">
                          {isCustom ? (
                            <span className="font-semibold text-muted-foreground block">$0.00</span>
                          ) : (
                            <>
                              <span className="font-bold text-emerald-500 block">+${itemProfit.toFixed(2)}</span>
                              <span className="text-[9px] text-muted-foreground">(${profitPerUnit.toFixed(2)}/unit)</span>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {receiptData.items.length === 0 && (
                    <div className="py-4 text-center text-xs text-muted-foreground italic">
                      {isLoadingItems ? (
                        <div className="flex items-center justify-center gap-2 text-primary font-medium">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Loading items from database...</span>
                        </div>
                      ) : (
                        'No item profit data available.'
                      )}
                    </div>
                  )}
                </div>

                <div className="border-t border-border pt-3 flex justify-between items-center text-sm font-bold">
                  <span className="text-foreground">Total Order Profit:</span>
                  <span className="text-lg text-emerald-500 font-mono">
                    ${roundMoney(
                      receiptData.items.reduce((sum, item) => {
                        if (!item.product_id) return sum;
                        const cost = typeof getItemCost === 'function' ? getItemCost(item) : Number(item.supplier_price || 0);
                        return sum + (Number(item.unit_price) - cost) * parseQuantity(item.quantity);
                      }, 0)
                    ).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Rendered Receipt Template */}
            <div className="md:col-span-7 flex flex-col justify-center items-center overflow-x-auto w-full order-1 md:order-2">
              <div
                className={`bg-white border border-gray-300 shadow-xl text-black text-left my-1 ${
                  receiptTemplate === TEMPLATE_IDS.KHMER
                    ? 'w-full max-w-[840px] p-2 sm:p-4 rounded-sm'
                    : 'w-full max-w-md p-6 rounded-xl'
                }`}
              >
                <div ref={printableCardRef} className="bg-white text-black">
                  {receiptTemplate === TEMPLATE_IDS.KHMER ? (
                    <KhmerInvoiceTemplate
                      receiptData={receiptData}
                      products={products}
                      invoiceNumber={modalInvoiceNumber}
                      invoiceDate={invoiceDate}
                      customerName={modalCustomerName}
                      phone={modalCustomerPhone}
                      isDraft={isDraft}
                      settings={invoiceSettings}
                    />
                  ) : (
                    <OldReceiptTemplate
                      receiptData={receiptData}
                      products={products}
                      shopName={shopName}
                      shopAddress={shopAddress}
                      shopPhone={shopPhone}
                      customFooter={customFooter}
                      invoiceNumber={modalInvoiceNumber}
                      isDraft={isDraft}
                      currencySymbol={currencySymbol}
                    />
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

