import { useLocalStorageSetting } from './useLocalStorageSetting';
import { DEFAULT_INVOICE_SETTINGS } from '../modules/invoice/invoiceUtils';

/**
 * Shared hook for all receipt/invoice display settings that are persisted to
 * localStorage and shared between InvoiceBuilder and SalesLog.
 */
export function useReceiptSettings({ defaultTemplate = DEFAULT_INVOICE_SETTINGS.template } = {}) {
  const [shopName, setShopName] = useLocalStorageSetting(
    'wsp_shop_name',
    'ស្រីពៅ លក់ចាប់ហួយ (Zeii Pov Shop)'
  );
  const [shopAddress, setShopAddress] = useLocalStorageSetting(
    'wsp_shop_address',
    'ផ្សារអូរឫស្សី, ភ្នំពេញ'
  );
  const [shopPhone, setShopPhone] = useLocalStorageSetting(
    'wsp_shop_phone',
    '012 345 678'
  );
  const [customFooter, setCustomFooter] = useLocalStorageSetting(
    'wsp_custom_footer',
    'សូមអរគុណ ចំពោះការគាំទ្រ! (Thank you for your support!)'
  );
  const [receiptTemplate, setReceiptTemplate] = useLocalStorageSetting(
    'wsp_receipt_template',
    defaultTemplate
  );
  const [invoiceDate, setInvoiceDate] = useLocalStorageSetting(
    'wsp_invoice_date',
    new Date().toISOString().slice(0, 10)
  );
  const [invoiceFontSize, setInvoiceFontSize] = useLocalStorageSetting(
    'wsp_invoice_font_size',
    DEFAULT_INVOICE_SETTINGS.fontSize
  );
  const [invoiceKhmerFont, setInvoiceKhmerFont] = useLocalStorageSetting(
    'wsp_invoice_khmer_font',
    DEFAULT_INVOICE_SETTINGS.khmerFont
  );
  const [invoiceEnglishFont, setInvoiceEnglishFont] = useLocalStorageSetting(
    'wsp_invoice_english_font',
    DEFAULT_INVOICE_SETTINGS.englishFont
  );
  const [invoiceBorderThickness, setInvoiceBorderThickness] = useLocalStorageSetting(
    'wsp_invoice_border',
    DEFAULT_INVOICE_SETTINGS.borderThickness
  );
  const [invoiceWidth, setInvoiceWidth] = useLocalStorageSetting(
    'wsp_invoice_width',
    DEFAULT_INVOICE_SETTINGS.invoiceWidth
  );
  const [invoicePageSize, setInvoicePageSize] = useLocalStorageSetting(
    'wsp_invoice_page_size',
    DEFAULT_INVOICE_SETTINGS.pageSize
  );
  const [currencySymbol, setCurrencySymbol] = useLocalStorageSetting(
    'wsp_currency_symbol',
    DEFAULT_INVOICE_SETTINGS.currencySymbol
  );

  const invoiceSettings = {
    fontSize: invoiceFontSize,
    khmerFont: invoiceKhmerFont,
    englishFont: invoiceEnglishFont,
    borderThickness: invoiceBorderThickness,
    invoiceWidth,
    pageSize: invoicePageSize,
    currencySymbol,
  };

  return {
    // Shop / receipt header
    shopName, setShopName,
    shopAddress, setShopAddress,
    shopPhone, setShopPhone,
    customFooter, setCustomFooter,
    // Template selection
    receiptTemplate, setReceiptTemplate,
    // Invoice-specific fields
    invoiceDate, setInvoiceDate,
    // Formatting settings
    invoiceFontSize, setInvoiceFontSize,
    invoiceKhmerFont, setInvoiceKhmerFont,
    invoiceEnglishFont, setInvoiceEnglishFont,
    invoiceBorderThickness, setInvoiceBorderThickness,
    invoiceWidth, setInvoiceWidth,
    invoicePageSize, setInvoicePageSize,
    currencySymbol, setCurrencySymbol,
    // Convenience object for passing to templates
    invoiceSettings,
  };
}

