import { OldReceiptTemplate, KhmerInvoiceTemplate } from '../templates';
import { TEMPLATE_IDS, PAGE_SIZES } from '../invoiceUtils';

/**
 * PrintableReceiptLayout — Hidden container rendered only when printing (`hidden print-only`)
 * via window.print(). Shared between InvoiceBuilder and SalesLog.
 */
export default function PrintableReceiptLayout({
  receiptData,
  products,
  receiptTemplate,
  invoiceNumber,
  invoiceDate,
  customerName,
  phone,
  shopName,
  shopAddress,
  shopPhone,
  customFooter,
  currencySymbol,
  invoiceSettings,
  invoicePageSize,
  isDraft = false,
}) {
  if (!receiptData) return null;

  return (
    <div
      className={`hidden print-only bg-white text-black leading-normal ${
        receiptTemplate === TEMPLATE_IDS.KHMER ? 'print-a4 p-0' : 'p-4 font-sans'
      }`}
    >
      {receiptTemplate === TEMPLATE_IDS.KHMER ? (
        <KhmerInvoiceTemplate
          receiptData={receiptData}
          products={products}
          invoiceNumber={invoiceNumber}
          invoiceDate={invoiceDate}
          customerName={customerName}
          phone={phone}
          isDraft={isDraft}
          showDraftBanner={false}
          settings={{
            ...invoiceSettings,
            invoiceWidth: PAGE_SIZES[invoicePageSize]?.widthPx || 794,
          }}
        />
      ) : (
        <div className="max-w-md mx-auto border-0 p-2">
          <OldReceiptTemplate
            receiptData={receiptData}
            products={products}
            shopName={shopName}
            shopAddress={shopAddress}
            shopPhone={shopPhone}
            customFooter={customFooter}
            invoiceNumber={invoiceNumber}
            isDraft={isDraft}
            showDraftBanner={false}
            currencySymbol={currencySymbol}
          />
        </div>
      )}
    </div>
  );
}

