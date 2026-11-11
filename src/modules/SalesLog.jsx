import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { db } from '../services/db';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import ThermalReceiptDialog from '../components/ThermalReceiptDialog';
import { useReceiptSettings } from '../hooks/useReceiptSettings';
import { useReceiptExport } from '../hooks/useReceiptExport';
import InvoicePreviewModal from './invoice/components/InvoicePreviewModal';
import PrintableReceiptLayout from './invoice/components/PrintableReceiptLayout';
import ImageExportModal from './invoice/components/ImageExportModal';
import SalesLogTable from './sales/components/SalesLogTable';
import SalesReceiptCards from './sales/components/SalesReceiptCards';
import SalesSummaryBar from './sales/components/SalesSummaryBar';
import SalesFilterBar from './sales/components/SalesFilterBar';
import {
  PERIOD_MODES,
  STATUS_FILTERS,
  getOrderTimestamp,
  getOrderTotalProfit,
  getPeriodLabel,
  getWeekDateRange,
  isOrderInPeriod,
  isOrderPaid,
  resolveOrderCustomer,
  shiftMonthKey,
  toLocalDateKey,
  toLocalMonthKey,
} from './sales/salesUtils';
import {
  TEMPLATE_IDS,
  createThermalReceiptText,
  resolveOrderInvoiceNumber,
} from './invoice/invoiceUtils';

export default function SalesLog({ orders, customers, orderItems, products, prices, onRefresh, showToast }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState(STATUS_FILTERS.ALL);
  const [periodMode, setPeriodMode] = useState(PERIOD_MODES.TODAY);
  const [dateFilter, setDateFilter] = useState(() => toLocalDateKey(new Date()));
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthFilter, setMonthFilter] = useState(() => toLocalMonthKey(new Date()));
  const [rangeStart, setRangeStart] = useState(() => toLocalDateKey(getWeekDateRange().start));
  const [rangeEnd, setRangeEnd] = useState(() => toLocalDateKey(new Date()));
  const [viewMode, setViewMode] = useState('cards');
  const [updatingOrderId, setUpdatingOrderId] = useState(null);
  const [activeOrderPreview, setActiveOrderPreview] = useState(null);

  // Shared persisted receipt settings (header, template, fonts, sizing)
  const {
    shopName, setShopName,
    shopAddress, setShopAddress,
    shopPhone, setShopPhone,
    customFooter, setCustomFooter,
    receiptTemplate, setReceiptTemplate,
    invoiceFontSize, setInvoiceFontSize,
    invoiceKhmerFont, setInvoiceKhmerFont,
    invoiceEnglishFont, setInvoiceEnglishFont,
    invoiceBorderThickness, setInvoiceBorderThickness,
    invoiceWidth, setInvoiceWidth,
    invoicePageSize, setInvoicePageSize,
    currencySymbol, setCurrencySymbol,
    invoiceSettings,
  } = useReceiptSettings({ defaultTemplate: TEMPLATE_IDS.KHMER });

  // Editable invoice fields scoped to the active preview modal
  const [invoiceCustomerName, setInvoiceCustomerName] = useState('');
  const [invoicePhone, setInvoicePhone] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');

  // Export & thermal receipt state
  const {
    printableCardRef,
    isExporting,
    imageExportModal,
    closeImageExportModal,
    exportImage,
    exportPdf,
  } = useReceiptExport({
    receiptTemplate,
    invoiceWidth,
    invoicePageSize,
    showToast,
  });
  const [isTextReceiptOpen, setIsTextReceiptOpen] = useState(false);

  // Helper to retrieve the cost of an item at order-time with cascade lookup fallbacks
  const getItemCost = (oi) => {
    if (oi.supplier_price) return Number(oi.supplier_price);

    const oiProdId = String(oi.product_id || '').trim();
    const oiSupId = String(oi.supplier_id || '').trim();

    if (oiSupId && prices) {
      const match = prices.find(
        (sp) => String(sp.product_id).trim() === oiProdId && String(sp.supplier_id).trim() === oiSupId
      );
      if (match) return Number(match.price);
    }

    if (prices && oiProdId) {
      const productPrices = prices.filter((sp) => String(sp.product_id).trim() === oiProdId);
      if (productPrices.length > 0) {
        return Math.min(...productPrices.map((sp) => Number(sp.price)));
      }
    }

    const prod = products.find((p) => String(p.id).trim() === oiProdId);
    return prod ? Number(prod.base_price) : 0;
  };

  // Resilient helper to retrieve items for an order from embedded properties or orderItems list
  const getOrderItems = (order) => {
    if (!order) return [];

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

    if (Array.isArray(orderItems) && orderItems.length > 0 && order.id !== undefined && order.id !== null) {
      const targetId = String(order.id).trim().toLowerCase();
      const matched = orderItems.filter((oi) => {
        const oiOrderId = String(oi.order_id || oi.orderId || '').trim().toLowerCase();
        return oiOrderId === targetId && targetId !== '';
      });
      if (matched.length > 0) return matched;
    }

    return [];
  };

  // Helper to resolve product display names safely
  const getProductName = (item) => {
    const prod = products.find((p) => String(p.id).trim() === String(item.product_id).trim());
    if (prod) {
      return {
        primary: prod.name_kh || prod.name_en,
        secondary: prod.name_en || '',
      };
    }
    return {
      primary: item.custom_name || item.name_kh || item.name_en || item.product_name || item.name || 'Custom Item',
      secondary: item.custom_name ? 'Custom Freeform Item' : '',
    };
  };

  const getItemTitle = (item) => {
    const { primary, secondary } = getProductName(item);
    return secondary ? `${primary} (${secondary})` : primary;
  };

  const sortedOrders = useMemo(
    () =>
      [...orders].sort(
        (a, b) => new Date(getOrderTimestamp(b) || 0).getTime() - new Date(getOrderTimestamp(a) || 0).getTime()
      ),
    [orders]
  );

  // Orders filtered by search and active period (before status filter, for accurate Paid/Unpaid counts)
  const periodAndSearchOrders = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return sortedOrders.filter((order) => {
      if (!isOrderInPeriod(order, { periodMode, dateFilter, monthFilter, weekOffset, rangeStart, rangeEnd })) {
        return false;
      }
      if (!q) return true;
      const cust = resolveOrderCustomer(order, customers);
      const customerName = cust?.name?.toLowerCase() || '';
      const customerPhone = cust?.phone?.toLowerCase() || '';
      const orderInvoiceNo = resolveOrderInvoiceNumber(order).toLowerCase();
      return customerName.includes(q) || customerPhone.includes(q) || orderInvoiceNo.includes(q);
    });
  }, [sortedOrders, searchTerm, periodMode, dateFilter, monthFilter, weekOffset, rangeStart, rangeEnd, customers]);

  const filteredOrders = useMemo(
    () =>
      periodAndSearchOrders.filter((order) => {
        if (statusFilter === STATUS_FILTERS.PAID) return isOrderPaid(order);
        if (statusFilter === STATUS_FILTERS.UNPAID) return !isOrderPaid(order);
        return true;
      }),
    [periodAndSearchOrders, statusFilter]
  );

  const allUnpaidOrders = useMemo(
    () => sortedOrders.filter((order) => !isOrderPaid(order)),
    [sortedOrders]
  );

  const periodCounts = useMemo(() => {
    const paid = periodAndSearchOrders.filter((o) => isOrderPaid(o)).length;
    const unpaid = periodAndSearchOrders.length - paid;
    return { all: periodAndSearchOrders.length, paid, unpaid };
  }, [periodAndSearchOrders]);

  const periodLabel = getPeriodLabel({ periodMode, dateFilter, monthFilter, weekOffset, rangeStart, rangeEnd });

  const handlePeriodModeChange = (nextMode) => {
    setPeriodMode(nextMode);
    if (nextMode === PERIOD_MODES.WEEK) {
      setWeekOffset(0);
    }
    if (nextMode === PERIOD_MODES.DATE && !dateFilter) {
      setDateFilter(toLocalDateKey(new Date()));
    }
    if (nextMode === PERIOD_MODES.MONTH && !monthFilter) {
      setMonthFilter(toLocalMonthKey(new Date()));
    }
  };

  const handleDateFilterChange = (nextDate) => {
    setDateFilter(nextDate);
    setPeriodMode(nextDate ? PERIOD_MODES.DATE : PERIOD_MODES.TODAY);
  };

  const handleMonthFilterChange = (nextMonth) => {
    setMonthFilter(nextMonth);
    setPeriodMode(PERIOD_MODES.MONTH);
  };

  const handleShiftMonth = (delta) => {
    setMonthFilter((prev) => shiftMonthKey(prev, delta));
    setPeriodMode(PERIOD_MODES.MONTH);
  };

  const handleRangeStartChange = (nextStart) => {
    setRangeStart(nextStart);
    setPeriodMode(PERIOD_MODES.RANGE);
  };

  const handleRangeEndChange = (nextEnd) => {
    setRangeEnd(nextEnd);
    setPeriodMode(PERIOD_MODES.RANGE);
  };

  const handleViewAllUnpaid = () => {
    setPeriodMode(PERIOD_MODES.ALL);
    setStatusFilter(STATUS_FILTERS.UNPAID);
  };

  const handleUpdateStatus = async (orderId, newStatus) => {
    setUpdatingOrderId(orderId);
    try {
      await db.updateOrderStatus(orderId, newStatus);
      showToast(
        newStatus === 'paid' ? 'Receipt marked as Paid!' : 'Receipt marked as Unpaid.',
        'success'
      );
      onRefresh();
    } catch (err) {
      showToast('Error updating status: ' + err.message, 'error');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleDeleteOrder = async (orderId) => {
    if (confirm('Are you sure you want to delete this order? This action cannot be undone.')) {
      try {
        await db.deleteOrder(orderId);
        showToast('Order deleted successfully.', 'success');
        onRefresh();
      } catch (err) {
        showToast('Error deleting order: ' + err.message, 'error');
      }
    }
  };

  const handleExportCSV = () => {
    if (filteredOrders.length === 0) {
      showToast('No orders available to export.', 'warning');
      return;
    }

    const headers = ['Invoice ID', 'Customer Name', 'Order Date', 'Items Summary', 'Total Amount (USD)', 'Estimated Profit (USD)', 'Status'];

    const rows = filteredOrders.map((order) => {
      const cust = resolveOrderCustomer(order, customers);
      const custName = cust ? cust.name : 'Unknown';
      const orderDate = new Date(getOrderTimestamp(order) || Date.now()).toLocaleString();

      const items = getOrderItems(order);
      const itemsSummary = items
        .map((oi) => `${getProductName(oi).primary} (x${oi.quantity})`)
        .join('; ');

      const totalProfit = getOrderTotalProfit(items, getItemCost);

      return [
        resolveOrderInvoiceNumber(order),
        custName,
        orderDate,
        `"${itemsSummary.replace(/"/g, '""')}"`,
        Number(order.total_amount).toFixed(2),
        Number(totalProfit).toFixed(2),
        order.status,
      ];
    });

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `wholesale_sales_log_${toLocalDateKey(new Date())}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('CSV exported successfully!', 'success');
  };

  const getOrderItemsSummary = (order) => {
    const items = getOrderItems(order);
    return items.map((oi) => `${getProductName(oi).primary} (x${oi.quantity})`).join(', ');
  };

  const handleOpenPreview = async (order) => {
    let items = getOrderItems(order);
    const customer = resolveOrderCustomer(order, customers);

    setInvoiceCustomerName(customer?.name || '');
    setInvoicePhone(customer?.phone || '');
    setInvoiceNumber(resolveOrderInvoiceNumber(order));
    setInvoiceDate(
      order.ordered_at
        ? new Date(order.ordered_at).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10)
    );

    setActiveOrderPreview({
      order,
      items,
      customer,
      isLoadingItems: items.length === 0 && !!order.id,
    });

    if (items.length === 0 && order.id) {
      try {
        const fetchedItems = await db.getOrderItemsByOrderId(order.id);
        if (fetchedItems && fetchedItems.length > 0) {
          items = fetchedItems;
          setActiveOrderPreview({
            order: { ...order, order_items: fetchedItems },
            items: fetchedItems,
            customer,
            isLoadingItems: false,
          });
        } else {
          setActiveOrderPreview((prev) => (prev ? { ...prev, isLoadingItems: false } : null));
        }
      } catch (err) {
        console.error('Failed to fetch order items on preview:', err);
        setActiveOrderPreview((prev) => (prev ? { ...prev, isLoadingItems: false } : null));
      }
    }
  };

  const buildExportFilename = (ext) => {
    if (!activeOrderPreview) return `Invoice_${Date.now()}.${ext}`;
    const custName = (invoiceCustomerName || activeOrderPreview.customer?.name || 'Customer').replace(
      /[^a-zA-Z0-9_\-\u0600-\u06FF\u1780-\u17FF]/g,
      '_'
    );
    const orderIdStr = (invoiceNumber || String(activeOrderPreview.order.id).slice(-6))
      .replace('#', '')
      .toUpperCase();
    return `Invoice_${orderIdStr}_${custName}.${ext}`;
  };

  const handleDownloadImage = async (format = 'png') => {
    if (isExporting || !activeOrderPreview) return;
    await exportImage({
      format,
      filename: buildExportFilename(format),
      shareText: `Wholesale Invoice ${invoiceNumber || resolveOrderInvoiceNumber(activeOrderPreview.order)}`,
      settleDelayMs: 120,
    });
  };

  const handleDownloadPdf = async () => {
    if (isExporting || !activeOrderPreview) return;
    await exportPdf({ filename: buildExportFilename('pdf') });
  };

  const receiptData = activeOrderPreview
    ? {
        order: activeOrderPreview.order,
        items: activeOrderPreview.items,
        customer: activeOrderPreview.customer,
      }
    : null;

  return (
    <div className="space-y-6">
      <div className="no-print space-y-6">
        {/* Header Panel */}
        <Card className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card/60 backdrop-blur-md p-6 border-border shadow-xs">
          <div>
            <h2 className="text-xl font-bold text-foreground tracking-wide">Sales Log & Receipts</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Track daily, weekly, and monthly receipts and toggle Paid or Unpaid status with one click.
            </p>
          </div>
          <Button onClick={handleExportCSV} className="gap-2 text-xs font-bold">
            <Download className="w-4 h-4" />
            Export Ledger CSV
          </Button>
        </Card>

        <SalesSummaryBar
          periodOrders={periodAndSearchOrders}
          filteredOrders={filteredOrders}
          allUnpaidOrders={allUnpaidOrders}
          getOrderItems={getOrderItems}
          getItemCost={getItemCost}
          statusFilter={statusFilter}
          onSelectStatusFilter={setStatusFilter}
          periodMode={periodMode}
          periodLabel={periodLabel}
          onViewAllUnpaid={handleViewAllUnpaid}
        />

        <SalesFilterBar
          searchTerm={searchTerm}
          onSearchTermChange={setSearchTerm}
          periodMode={periodMode}
          onPeriodModeChange={handlePeriodModeChange}
          dateFilter={dateFilter}
          onDateFilterChange={handleDateFilterChange}
          weekOffset={weekOffset}
          onWeekOffsetChange={setWeekOffset}
          monthFilter={monthFilter}
          onMonthFilterChange={handleMonthFilterChange}
          onShiftMonth={handleShiftMonth}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          onRangeStartChange={handleRangeStartChange}
          onRangeEndChange={handleRangeEndChange}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          periodCounts={periodCounts}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />

        {viewMode === 'cards' ? (
          <SalesReceiptCards
            filteredOrders={filteredOrders}
            customers={customers}
            getOrderItems={getOrderItems}
            getProductName={getProductName}
            getItemCost={getItemCost}
            updatingOrderId={updatingOrderId}
            onUpdateStatus={handleUpdateStatus}
            onOpenPreview={handleOpenPreview}
            onDeleteOrder={handleDeleteOrder}
            periodMode={periodMode}
            periodLabel={periodLabel}
            statusFilter={statusFilter}
            onSwitchPeriod={handlePeriodModeChange}
            onResetFilters={() => setStatusFilter(STATUS_FILTERS.ALL)}
          />
        ) : (
          <SalesLogTable
            filteredOrders={filteredOrders}
            customers={customers}
            getOrderItems={getOrderItems}
            getOrderItemsSummary={getOrderItemsSummary}
            getItemCost={getItemCost}
            updatingOrderId={updatingOrderId}
            onUpdateStatus={handleUpdateStatus}
            onOpenPreview={handleOpenPreview}
            onDeleteOrder={handleDeleteOrder}
          />
        )}
      </div>

      {/* Invoice Details Overlay Modal */}
      {receiptData && (
        <InvoicePreviewModal
          receiptData={receiptData}
          products={products}
          printableCardRef={printableCardRef}
          receiptTemplate={receiptTemplate}
          setReceiptTemplate={setReceiptTemplate}
          shopName={shopName}
          setShopName={setShopName}
          shopAddress={shopAddress}
          setShopAddress={setShopAddress}
          shopPhone={shopPhone}
          setShopPhone={setShopPhone}
          customFooter={customFooter}
          setCustomFooter={setCustomFooter}
          invoiceNumber={invoiceNumber}
          onInvoiceNumberChange={setInvoiceNumber}
          invoiceCustomerName={invoiceCustomerName}
          setInvoiceCustomerName={setInvoiceCustomerName}
          invoicePhone={invoicePhone}
          setInvoicePhone={setInvoicePhone}
          invoiceDate={invoiceDate}
          setInvoiceDate={setInvoiceDate}
          invoiceSettings={invoiceSettings}
          invoiceFontSize={invoiceFontSize}
          setInvoiceFontSize={setInvoiceFontSize}
          invoiceKhmerFont={invoiceKhmerFont}
          setInvoiceKhmerFont={setInvoiceKhmerFont}
          invoiceEnglishFont={invoiceEnglishFont}
          setInvoiceEnglishFont={setInvoiceEnglishFont}
          invoiceBorderThickness={invoiceBorderThickness}
          setInvoiceBorderThickness={setInvoiceBorderThickness}
          invoiceWidth={invoiceWidth}
          setInvoiceWidth={setInvoiceWidth}
          invoicePageSize={invoicePageSize}
          setInvoicePageSize={setInvoicePageSize}
          currencySymbol={currencySymbol}
          setCurrencySymbol={setCurrencySymbol}
          isLoadingItems={activeOrderPreview.isLoadingItems}
          profitTitle="Internal Profit Analysis (Owner Only)"
          getItemCost={getItemCost}
          getItemTitle={getItemTitle}
          isExporting={isExporting}
          onDownloadImage={handleDownloadImage}
          onDownloadPdf={handleDownloadPdf}
          onPrint={() => window.print()}
          onOpenThermalReceipt={() => setIsTextReceiptOpen(true)}
          onClose={() => setActiveOrderPreview(null)}
        />
      )}

      {/* Hidden print layout for standard window.print() */}
      <PrintableReceiptLayout
        receiptData={receiptData}
        products={products}
        receiptTemplate={receiptTemplate}
        invoiceNumber={invoiceNumber}
        invoiceDate={invoiceDate}
        customerName={invoiceCustomerName || receiptData?.customer?.name}
        phone={invoicePhone || receiptData?.customer?.phone}
        shopName={shopName}
        shopAddress={shopAddress}
        shopPhone={shopPhone}
        customFooter={customFooter}
        currencySymbol={currencySymbol}
        invoiceSettings={invoiceSettings}
        invoicePageSize={invoicePageSize}
        isDraft={false}
      />

      {receiptData && (
        <ThermalReceiptDialog
          open={isTextReceiptOpen}
          onOpenChange={setIsTextReceiptOpen}
          receiptText={createThermalReceiptText({
            receiptData,
            getItemName: (item) => getProductName(item).primary,
            shopName,
            shopAddress,
            shopPhone,
            footer: customFooter,
            invoiceNumber,
            invoiceDate: receiptTemplate === TEMPLATE_IDS.KHMER ? invoiceDate : '',
            customerName: receiptTemplate === TEMPLATE_IDS.KHMER ? invoiceCustomerName : '',
            customerPhone: receiptTemplate === TEMPLATE_IDS.KHMER ? invoicePhone : '',
            currencySymbol,
          })}
          onCopied={() => showToast('58 mm receipt copied. Paste it into your printer app.', 'success')}
        />
      )}

      {/* Mobile-Optimized Save to Photos / Share Image Modal */}
      <ImageExportModal
        imageExportModal={imageExportModal}
        onClose={closeImageExportModal}
      />
    </div>
  );
}
