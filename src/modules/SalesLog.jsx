import { useState, useEffect, useRef } from 'react';
import { Search, Calendar, Filter, Eye, Printer, Trash2, Download, ImageIcon, Share2, X, RefreshCw, FileDown } from 'lucide-react';
import { toPng, toJpeg } from 'html-to-image';
import { db } from '../services/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { OldReceiptTemplate, KhmerInvoiceTemplate } from './invoice/templates';
import {
  roundMoney,
  parseQuantity,
  TEMPLATE_IDS,
  TEMPLATE_OPTIONS,
  KHMER_FONTS,
  ENGLISH_FONTS,
  PAGE_SIZES,
  DEFAULT_INVOICE_SETTINGS,
  downloadPdfFromJpeg,
  formatCurrency,
} from './invoice/invoiceUtils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default function SalesLog({ orders, customers, orderItems, products, prices, onRefresh, showToast }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState(''); // YYYY-MM-DD
  const [activeOrderPreview, setActiveOrderPreview] = useState(null); // Order details to view

  // Receipt custom header states (shared with InvoiceBuilder)
  const [shopName, setShopName] = useState(() => localStorage.getItem('wsp_shop_name') || 'ស្រីពៅ លក់ចាប់ហួយ (Zeii Pov Shop)');
  const [shopAddress, setShopAddress] = useState(() => localStorage.getItem('wsp_shop_address') || 'ផ្សារអូរឫស្សី, ភ្នំពេញ');
  const [shopPhone, setShopPhone] = useState(() => localStorage.getItem('wsp_shop_phone') || '012 345 678');
  const [customFooter, setCustomFooter] = useState(() => localStorage.getItem('wsp_custom_footer') || 'សូមអរគុណ ចំពោះការគាំទ្រ! (Thank you for your support!)');

  // Template + Khmer invoice meta / formatting (persisted & shared)
  const [receiptTemplate, setReceiptTemplate] = useState(() => {
    return localStorage.getItem('wsp_receipt_template') || TEMPLATE_IDS.KHMER;
  });
  const [invoiceFontSize, setInvoiceFontSize] = useState(() => Number(localStorage.getItem('wsp_invoice_font_size')) || DEFAULT_INVOICE_SETTINGS.fontSize);
  const [invoiceKhmerFont, setInvoiceKhmerFont] = useState(() => localStorage.getItem('wsp_invoice_khmer_font') || DEFAULT_INVOICE_SETTINGS.khmerFont);
  const [invoiceEnglishFont, setInvoiceEnglishFont] = useState(() => localStorage.getItem('wsp_invoice_english_font') || DEFAULT_INVOICE_SETTINGS.englishFont);
  const [invoiceBorderThickness, setInvoiceBorderThickness] = useState(() => Number(localStorage.getItem('wsp_invoice_border')) || DEFAULT_INVOICE_SETTINGS.borderThickness);
  const [invoiceWidth, setInvoiceWidth] = useState(() => Number(localStorage.getItem('wsp_invoice_width')) || DEFAULT_INVOICE_SETTINGS.invoiceWidth);
  const [invoicePageSize, setInvoicePageSize] = useState(() => localStorage.getItem('wsp_invoice_page_size') || DEFAULT_INVOICE_SETTINGS.pageSize);
  const [currencySymbol, setCurrencySymbol] = useState(() => localStorage.getItem('wsp_currency_symbol') || DEFAULT_INVOICE_SETTINGS.currencySymbol);

  // Editable invoice fields for preview modal
  const [invoiceCustomerName, setInvoiceCustomerName] = useState('');
  const [invoicePhone, setInvoicePhone] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');

  // Sync edits back to localStorage
  useEffect(() => {
    localStorage.setItem('wsp_receipt_template', receiptTemplate);
  }, [receiptTemplate]);
  useEffect(() => {
    localStorage.setItem('wsp_shop_name', shopName);
  }, [shopName]);
  useEffect(() => {
    localStorage.setItem('wsp_shop_address', shopAddress);
  }, [shopAddress]);
  useEffect(() => {
    localStorage.setItem('wsp_shop_phone', shopPhone);
  }, [shopPhone]);
  useEffect(() => {
    localStorage.setItem('wsp_custom_footer', customFooter);
  }, [customFooter]);
  useEffect(() => {
    localStorage.setItem('wsp_invoice_font_size', String(invoiceFontSize));
  }, [invoiceFontSize]);
  useEffect(() => {
    localStorage.setItem('wsp_invoice_khmer_font', invoiceKhmerFont);
  }, [invoiceKhmerFont]);
  useEffect(() => {
    localStorage.setItem('wsp_invoice_english_font', invoiceEnglishFont);
  }, [invoiceEnglishFont]);
  useEffect(() => {
    localStorage.setItem('wsp_invoice_border', String(invoiceBorderThickness));
  }, [invoiceBorderThickness]);
  useEffect(() => {
    localStorage.setItem('wsp_invoice_width', String(invoiceWidth));
  }, [invoiceWidth]);
  useEffect(() => {
    localStorage.setItem('wsp_invoice_page_size', invoicePageSize);
  }, [invoicePageSize]);
  useEffect(() => {
    localStorage.setItem('wsp_currency_symbol', currencySymbol);
  }, [currencySymbol]);

  const invoiceSettings = {
    fontSize: invoiceFontSize,
    khmerFont: invoiceKhmerFont,
    englishFont: invoiceEnglishFont,
    borderThickness: invoiceBorderThickness,
    invoiceWidth,
    pageSize: invoicePageSize,
    currencySymbol
  };

  // Image Export States & Ref
  const printableCardRef = useRef(null);
  const [isExporting, setIsExporting] = useState(false);
  const [imageExportModal, setImageExportModal] = useState(null);

  // Helper to retrieve the cost of an item at order-time with cascade lookup fallbacks
  const getItemCost = (oi) => {
    if (oi.supplier_price) return Number(oi.supplier_price);
    
    const oiProdId = String(oi.product_id || '').trim();
    const oiSupId = String(oi.supplier_id || '').trim();

    // Fallback: look up in the supplier_prices table if a supplier is linked
    if (oiSupId && prices) {
      const match = prices.find(sp => String(sp.product_id).trim() === oiProdId && String(sp.supplier_id).trim() === oiSupId);
      if (match) return Number(match.price);
    }
    
    // Fallback: use cheapest supplier price for this product
    if (prices && oiProdId) {
      const productPrices = prices.filter(sp => String(sp.product_id).trim() === oiProdId);
      if (productPrices.length > 0) {
        return Math.min(...productPrices.map(sp => Number(sp.price)));
      }
    }
    
    // Last fallback: use product base price
    const prod = products.find(p => String(p.id).trim() === oiProdId);
    return prod ? Number(prod.base_price) : 0;
  };

  // Resilient helper to retrieve items for an order from embedded properties or orderItems list
  const getOrderItems = (order) => {
    if (!order) return [];

    // 1. Check if items are embedded directly on the order object
    const embedded = order.order_items || order.items || order.line_items;
    if (Array.isArray(embedded) && embedded.length > 0) {
      return embedded;
    }
    if (typeof embedded === 'string') {
      try {
        const parsed = JSON.parse(embedded);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {
        // ignore
      }
    }

    // 2. Fallback to orderItems prop with loose string ID matching
    if (Array.isArray(orderItems) && orderItems.length > 0 && order.id !== undefined && order.id !== null) {
      const targetId = String(order.id).trim().toLowerCase();
      const matched = orderItems.filter(oi => {
        const oiOrderId = String(oi.order_id || oi.orderId || '').trim().toLowerCase();
        return oiOrderId === targetId && targetId !== '';
      });
      if (matched.length > 0) return matched;
    }

    return [];
  };

  // Helper to resolve product display names safely
  const getProductName = (item) => {
    const prod = products.find(p => String(p.id).trim() === String(item.product_id).trim());
    if (prod) {
      return {
        primary: prod.name_kh || prod.name_en,
        secondary: prod.name_en || ''
      };
    }
    return {
      primary: item.custom_name || item.name_kh || item.name_en || item.product_name || item.name || 'Custom Item',
      secondary: item.custom_name ? 'Custom Freeform Item' : ''
    };
  };

  // Filter orders
  const filteredOrders = orders.filter(order => {
    const cust = customers.find(c => String(c.id).trim().toLowerCase() === String(order.customer_id).trim().toLowerCase());
    const customerName = cust ? cust.name.toLowerCase() : (order.customer?.name?.toLowerCase() || '');
    const matchesSearch = customerName.includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;

    let matchesDate = true;
    if (dateFilter) {
      const orderDate = new Date(order.ordered_at).toISOString().slice(0, 10);
      matchesDate = orderDate === dateFilter;
    }

    return matchesSearch && matchesStatus && matchesDate;
  });

  const handleUpdateStatus = async (orderId, newStatus) => {
    try {
      await db.updateOrderStatus(orderId, newStatus);
      showToast("Order status updated!", "success");
      onRefresh();
    } catch (err) {
      showToast("Error updating status: " + err.message, "error");
    }
  };

  const handleDeleteOrder = async (orderId) => {
    if (confirm("Are you sure you want to delete this order? This action cannot be undone.")) {
      try {
        await db.deleteOrder(orderId);
        showToast("Order deleted successfully.", "success");
        onRefresh();
      } catch (err) {
        showToast("Error deleting order: " + err.message, "error");
      }
    }
  };

  const handleExportCSV = () => {
    if (filteredOrders.length === 0) {
      showToast("No orders available to export.", "warning");
      return;
    }

    const headers = ["Invoice ID", "Customer Name", "Order Date", "Items Summary", "Total Amount (USD)", "Estimated Profit (USD)", "Status"];
    
    const rows = filteredOrders.map(order => {
      const cust = customers.find(c => String(c.id).trim().toLowerCase() === String(order.customer_id).trim().toLowerCase());
      const custName = cust ? cust.name : (order.customer?.name || 'Unknown');
      const orderDate = new Date(order.ordered_at).toLocaleString();
      
      const items = getOrderItems(order);
      const itemsSummary = items.map(oi => {
        const { primary } = getProductName(oi);
        return `${primary} (x${oi.quantity})`;
      }).join('; ');

      const totalProfit = items.reduce((sum, oi) => {
        if (!oi.product_id) return sum;
        const cost = getItemCost(oi);
        const selling = Number(oi.unit_price);
        const qty = Number(oi.quantity);
        return sum + (selling - cost) * qty;
      }, 0);

      return [
        `#${String(order.id).slice(-6).toUpperCase()}`,
        custName,
        orderDate,
        `"${itemsSummary.replace(/"/g, '""')}"`,
        Number(order.total_amount).toFixed(2),
        Number(totalProfit).toFixed(2),
        order.status
      ];
    });

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `wholesale_sales_log_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("CSV exported successfully!", "success");
  };

  const getOrderItemsSummary = (order) => {
    const items = getOrderItems(order);
    return items.map(oi => {
      const { primary } = getProductName(oi);
      return `${primary} (x${oi.quantity})`;
    }).join(', ');
  };

  const handleOpenPreview = async (order) => {
    let items = getOrderItems(order);
    const customer = customers.find(c => String(c.id).trim().toLowerCase() === String(order.customer_id).trim().toLowerCase()) 
      || order.customer 
      || order.customers 
      || null;

    setInvoiceCustomerName(customer?.name || '');
    setInvoicePhone(customer?.phone || '');
    setInvoiceNumber(`#${String(order.id).slice(-6).toUpperCase()}`);
    setInvoiceDate(order.ordered_at ? new Date(order.ordered_at).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));

    setActiveOrderPreview({ 
      order, 
      items, 
      customer, 
      isLoadingItems: items.length === 0 && !!order.id 
    });

    // If no items are currently in memory, fetch on-demand from database
    if (items.length === 0 && order.id) {
      try {
        const fetchedItems = await db.getOrderItemsByOrderId(order.id);
        if (fetchedItems && fetchedItems.length > 0) {
          items = fetchedItems;
          setActiveOrderPreview({ 
            order: { ...order, order_items: fetchedItems }, 
            items: fetchedItems, 
            customer, 
            isLoadingItems: false 
          });
        } else {
          setActiveOrderPreview(prev => prev ? { ...prev, isLoadingItems: false } : null);
        }
      } catch (err) {
        console.error("Failed to fetch order items on preview:", err);
        setActiveOrderPreview(prev => prev ? { ...prev, isLoadingItems: false } : null);
      }
    }
  };

  const getExportWidth = () => {
    if (receiptTemplate === TEMPLATE_IDS.KHMER) {
      return Math.max(480, Number(invoiceWidth) || PAGE_SIZES.A4.widthPx);
    }
    return 460;
  };

  const waitForFonts = async () => {
    try {
      if (document.fonts?.ready) {
        await document.fonts.ready;
      }
    } catch {
      /* ignore */
    }
    await new Promise((r) => setTimeout(r, 80));
  };

  const buildExportFilename = (ext) => {
    if (!activeOrderPreview) return `Invoice_${Date.now()}.${ext}`;
    const custName = (invoiceCustomerName || activeOrderPreview.customer?.name || 'Customer').replace(/[^a-zA-Z0-9_\-\u0600-\u06FF\u1780-\u17FF]/g, '_');
    const orderIdStr = (invoiceNumber || String(activeOrderPreview.order.id).slice(-6)).replace('#', '').toUpperCase();
    return `Invoice_${orderIdStr}_${custName}.${ext}`;
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadImage = async (format = 'png') => {
    if (isExporting || !activeOrderPreview) return;

    setIsExporting(true);
    await new Promise(r => setTimeout(r, 120));
    await waitForFonts();

    try {
      const node = printableCardRef.current;
      if (!node) {
        throw new Error("Printable invoice element not found");
      }

      const exportWidth = getExportWidth();
      const options = {
        quality: 0.95,
        pixelRatio: 3,
        backgroundColor: '#ffffff',
        cacheBust: true,
        style: {
          margin: '0',
          transform: 'none',
          boxShadow: 'none',
          maxWidth: 'none',
          width: `${exportWidth}px`
        }
      };

      const dataUrl = format === 'jpeg' ? await toJpeg(node, options) : await toPng(node, options);
      const filename = buildExportFilename(format);

      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
      const file = new File([blob], filename, { type: mimeType });

      setImageExportModal({
        dataUrl,
        blobUrl,
        filename,
        file,
        format
      });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: filename,
            text: `Wholesale Invoice #${String(activeOrderPreview.order.id).slice(-6).toUpperCase()}`
          });
          showToast("Invoice image shared / saved to photos!", "success");
        } catch (shareErr) {
          if (shareErr.name !== 'AbortError') {
            console.warn("Native share failed", shareErr);
          }
        }
      } else {
        const link = document.createElement('a');
        link.download = filename;
        link.href = blobUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast(`Invoice image generated! Long-press to save to Photos.`, "success");
      }
    } catch (err) {
      console.error("Export error:", err);
      showToast("Error generating image: " + err.message, "error");
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (isExporting || !activeOrderPreview) return;

    setIsExporting(true);
    await new Promise((r) => setTimeout(r, 150));
    await waitForFonts();

    try {
      const node = printableCardRef.current;
      if (!node) throw new Error("Invoice template container element not found");

      const exportWidth = getExportWidth();
      const jpegUrl = await toJpeg(node, {
        quality: 0.95,
        pixelRatio: 3,
        backgroundColor: '#ffffff',
        cacheBust: true,
        style: {
          margin: '0',
          transform: 'none',
          boxShadow: 'none',
          maxWidth: 'none',
          width: `${exportWidth}px`
        }
      });

      const page = PAGE_SIZES[invoicePageSize] || PAGE_SIZES.A4;
      const filename = buildExportFilename('pdf');
      await downloadPdfFromJpeg(jpegUrl, filename, page);
      showToast("Invoice PDF downloaded.", "success");
    } catch (err) {
      console.error("Export PDF error:", err);
      showToast("Failed to generate PDF: " + err.message, "error");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="no-print space-y-6">
        {/* Header Panel */}
        <Card className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card/60 backdrop-blur-md p-6 border-border shadow-xs">
          <div>
            <h2 className="text-xl font-bold text-foreground tracking-wide">Sales Log</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Browse full sales records, update delivery and payment statuses, and review invoices.
            </p>
          </div>
          <Button
            onClick={handleExportCSV}
            className="gap-2 text-xs font-bold"
          >
            <Download className="w-4 h-4" />
            Export Ledger CSV
          </Button>
        </Card>

        {/* Filter Toolbar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Filter by customer name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9 text-xs bg-background/50 border-input"
            />
          </div>
          <div className="relative">
            <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="pl-9 h-9 text-xs bg-background/50 border-input text-foreground"
            />
          </div>
          <div className="relative">
            <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-card pl-9 pr-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-foreground"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="delivered">Delivered</option>
              <option value="paid">Paid</option>
            </select>
          </div>
        </div>

        {/* Sales Log Table */}
        <Card className="rounded-xl overflow-hidden border-border shadow-xs">
          <div className="overflow-x-auto scrollbar-thin">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="p-4 text-xs font-bold uppercase">Invoice ID</TableHead>
                  <TableHead className="p-4 text-xs font-bold uppercase">Customer</TableHead>
                  <TableHead className="p-4 text-xs font-bold uppercase">Order Date</TableHead>
                  <TableHead className="p-4 min-w-[200px] text-xs font-bold uppercase">Items Purchased</TableHead>
                  <TableHead className="p-4 text-right text-xs font-bold uppercase">Total Amount</TableHead>
                  <TableHead className="p-4 text-right text-emerald-500 text-xs font-bold uppercase">Profit</TableHead>
                  <TableHead className="p-4 text-center text-xs font-bold uppercase">Status</TableHead>
                  <TableHead className="p-4 text-center text-xs font-bold uppercase">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map(order => {
                  const cust = customers.find(c => String(c.id).trim().toLowerCase() === String(order.customer_id).trim().toLowerCase()) || order.customer;
                  const itemsSummary = getOrderItemsSummary(order);
                  
                  const currentItems = getOrderItems(order);
                  const orderProfit = currentItems.reduce((sum, oi) => {
                    if (!oi.product_id) return sum; // Skip custom items profit calculation
                    const cost = getItemCost(oi);
                    const selling = Number(oi.unit_price);
                    const qty = Number(oi.quantity);
                    return sum + (selling - cost) * qty;
                  }, 0);

                  return (
                    <TableRow key={order.id} className="hover:bg-muted/30 transition-colors">
                      {/* ID */}
                      <TableCell className="p-4 font-mono font-bold text-xs text-primary">
                        #{order.id.slice(-6).toUpperCase()}
                      </TableCell>
                      
                      {/* Customer */}
                      <TableCell className="p-4 font-semibold text-foreground">
                        {cust ? cust.name : 'Unknown Customer'}
                      </TableCell>
                      
                      {/* Date */}
                      <TableCell className="p-4 text-muted-foreground text-xs">
                        {new Date(order.ordered_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </TableCell>
                      
                      {/* Items */}
                      <TableCell className="p-4 text-xs text-muted-foreground max-w-sm truncate" title={itemsSummary}>
                        {itemsSummary || 'No items'}
                      </TableCell>
                      
                      {/* Price */}
                      <TableCell className="p-4 text-right font-bold font-mono text-foreground">
                        ${Number(order.total_amount).toFixed(2)}
                      </TableCell>
                      
                      {/* Profit */}
                      <TableCell className="p-4 text-right font-bold font-mono text-emerald-500">
                        ${orderProfit.toFixed(2)}
                      </TableCell>
                      
                      {/* Status interactive selector */}
                      <TableCell className="p-4 text-center">
                        <select
                          value={order.status}
                          onChange={(e) => handleUpdateStatus(order.id, e.target.value)}
                          className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase outline-none cursor-pointer border ${
                            order.status === 'paid' 
                              ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                              : order.status === 'delivered'
                              ? 'bg-primary/10 text-primary border-primary/30'
                              : 'bg-amber-500/10 text-amber-500 border-amber-500/30'
                          }`}
                        >
                          <option value="pending">Pending</option>
                          <option value="delivered">Delivered</option>
                          <option value="paid">Paid</option>
                        </select>
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenPreview(order)}
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            title="View Invoice Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteOrder(order.id)}
                            className="h-7 w-7 text-destructive hover:bg-destructive/10"
                            title="Delete / Cancel Order"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}

                {filteredOrders.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="p-8 text-center text-muted-foreground italic">
                      No orders logged matching your search filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      {/* Invoice Details Overlay Modal (Khmer Invoice & Old Receipt Templates) */}
      {activeOrderPreview && (() => {
        const receiptData = {
          order: activeOrderPreview.order,
          items: activeOrderPreview.items,
          customer: activeOrderPreview.customer
        };
        const orderIdStr = String(activeOrderPreview.order.id).slice(-6).toUpperCase();

        return (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-xs p-3 sm:p-6 flex items-center justify-center no-print">
            <div className={`bg-card border border-border w-full rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200 ${receiptTemplate === TEMPLATE_IDS.KHMER ? 'max-w-6xl' : 'max-w-4xl'}`}>

              {/* Top Bar controls */}
              <div className="p-4 border-b border-border flex justify-between items-center bg-card/60 flex-wrap gap-2">
                <h3 className="font-semibold text-foreground text-sm sm:text-base flex items-center gap-2">
                  <span>Invoice Preview</span>
                  {activeOrderPreview.isLoadingItems && (
                    <span className="text-xs text-primary flex items-center gap-1 font-normal">
                      <RefreshCw className="w-3 h-3 animate-spin" /> Fetching items...
                    </span>
                  )}
                </h3>

                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    value={receiptTemplate}
                    onChange={(e) => setReceiptTemplate(e.target.value)}
                    className="h-8 rounded-md border border-input bg-card px-2 text-xs text-foreground font-medium"
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
                    onClick={() => handleDownloadImage('png')}
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
                    onClick={handleDownloadPdf}
                    disabled={isExporting}
                    className="gap-1.5 text-xs"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    <span>PDF</span>
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    onClick={handlePrint}
                    className="gap-1.5 text-xs"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print</span>
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setActiveOrderPreview(null)}
                    className="text-xs"
                  >
                    Close
                  </Button>
                </div>
              </div>

              {/* Modal Body container (two-column split on md sizes) */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 scrollbar-thin bg-muted/20">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">

                  {/* Left Column: Receipt Customization & Profit Card (5 cols) */}
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
                              <Input type="text" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} className="h-8 text-xs" />
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

                    {/* Internal Profit Analysis Card (Owner Only) */}
                    <div className="p-4 sm:p-5 rounded-2xl border border-border bg-card/80 space-y-4 shadow-sm text-left">
                      <div className="flex justify-between items-center border-b border-border pb-3">
                        <h4 className="text-xs font-bold text-emerald-500 uppercase tracking-wider flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                          Internal Profit Analysis (Owner Only)
                        </h4>
                        <span className="text-xs text-muted-foreground font-mono">
                          #{orderIdStr}
                        </span>
                      </div>

                      <div className="divide-y divide-border max-h-48 overflow-y-auto scrollbar-thin">
                        {activeOrderPreview.items.map((oi, idx) => {
                          const { primary, secondary } = getProductName(oi);
                          const isCustom = !oi.product_id;
                          const cost = getItemCost(oi);
                          const selling = Number(oi.unit_price);
                          const qty = Number(oi.quantity);
                          const profitPerUnit = selling - cost;
                          const itemProfit = profitPerUnit * qty;

                          return (
                            <div key={oi.id || idx} className="py-2.5 flex justify-between items-start gap-4 text-xs">
                              <div className="space-y-1">
                                <div className="font-semibold text-foreground">
                                  {primary} {secondary ? `(${secondary})` : ''}
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
                        {activeOrderPreview.items.length === 0 && (
                          <div className="py-4 text-center text-xs text-muted-foreground italic">
                            {activeOrderPreview.isLoadingItems ? (
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
                          ${activeOrderPreview.items.reduce((sum, oi) => {
                            if (!oi.product_id) return sum;
                            return sum + (Number(oi.unit_price) - getItemCost(oi)) * Number(oi.quantity);
                          }, 0).toFixed(2)}
                        </span>
                      </div>
                    </div>

                  </div>

                  {/* Right Column: Printable Receipt Preview (7 cols) */}
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
                            invoiceNumber={invoiceNumber}
                            invoiceDate={invoiceDate}
                            customerName={invoiceCustomerName || receiptData.customer?.name}
                            phone={invoicePhone || receiptData.customer?.phone}
                            isDraft={false}
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
                            isDraft={false}
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
      })()}

      {/* Hidden print layout for standard window.print() */}
      {activeOrderPreview && (() => {
        const receiptData = {
          order: activeOrderPreview.order,
          items: activeOrderPreview.items,
          customer: activeOrderPreview.customer
        };
        return (
          <div className={`hidden print-only bg-white text-black leading-normal ${receiptTemplate === TEMPLATE_IDS.KHMER ? 'print-a4 p-0' : 'p-4 font-sans'}`}>
            {receiptTemplate === TEMPLATE_IDS.KHMER ? (
              <KhmerInvoiceTemplate
                receiptData={receiptData}
                products={products}
                invoiceNumber={invoiceNumber}
                invoiceDate={invoiceDate}
                customerName={invoiceCustomerName || receiptData.customer?.name}
                phone={invoicePhone || receiptData.customer?.phone}
                isDraft={false}
                showDraftBanner={false}
                settings={{ ...invoiceSettings, invoiceWidth: PAGE_SIZES[invoicePageSize]?.widthPx || 794 }}
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
                  isDraft={false}
                  showDraftBanner={false}
                  currencySymbol={currencySymbol}
                />
              </div>
            )}
          </div>
        );
      })()}

      {/* Mobile-Optimized Save to Photos / Share Image Modal */}
      {imageExportModal && (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/85 backdrop-blur-md p-3 sm:p-6 flex items-center justify-center no-print animate-in fade-in duration-200">
          <div className="bg-dark-900 border border-dark-800 w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
            
            {/* Modal Top Bar */}
            <div className="p-4 border-b border-dark-800 flex justify-between items-center bg-dark-950/60">
              <h3 className="font-bold text-white text-sm sm:text-base flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-primary-400" />
                <span>Save Invoice to Photos</span>
              </h3>
              <button 
                type="button"
                onClick={() => {
                  if (imageExportModal.blobUrl) URL.revokeObjectURL(imageExportModal.blobUrl);
                  setImageExportModal(null);
                }}
                className="p-1.5 rounded-lg hover:bg-dark-800 text-dark-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Helper Banner for Mobile Users */}
            <div className="bg-primary-500/10 border-b border-primary-500/20 p-3 px-4 text-xs text-primary-300 flex items-start gap-2.5">
              <Share2 className="w-4 h-4 text-primary-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block text-white">Save to Mobile Photos / Gallery:</span>
                <span>Tap <strong>Share / Save</strong> below, or <strong>long-press (touch & hold)</strong> the image to save directly into your Photos app.</span>
              </div>
            </div>

            {/* Rendered Invoice Image Preview Node */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center justify-center bg-dark-950/40 min-h-[260px]">
              <img 
                src={imageExportModal.dataUrl} 
                alt="Generated Invoice" 
                className="w-full h-auto max-w-sm rounded-xl shadow-2xl border border-dark-700 select-all"
              />
            </div>

            {/* Modal Bottom Actions */}
            <div className="p-4 border-t border-dark-800 bg-dark-950/60 flex flex-col sm:flex-row gap-2">
              {navigator.canShare && imageExportModal.file && (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.share({
                        files: [imageExportModal.file],
                        title: imageExportModal.filename,
                        text: 'Wholesale Invoice'
                      });
                    } catch (err) {
                      if (err.name !== 'AbortError') {
                        console.warn("Share failed", err);
                      }
                    }
                  }}
                  className="flex-1 glass-button-primary py-2.5 text-xs font-bold min-h-[44px]"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Share / Save to Photos</span>
                </button>
              )}

              <a
                href={imageExportModal.blobUrl || imageExportModal.dataUrl}
                download={imageExportModal.filename}
                className="flex-1 glass-button-secondary py-2.5 text-xs font-semibold min-h-[44px] text-center flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4 text-primary-400" />
                <span>Download File</span>
              </a>

              <button
                type="button"
                onClick={() => {
                  if (imageExportModal.blobUrl) URL.revokeObjectURL(imageExportModal.blobUrl);
                  setImageExportModal(null);
                }}
                className="glass-button-secondary py-2.5 px-4 text-xs font-medium min-h-[44px]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
