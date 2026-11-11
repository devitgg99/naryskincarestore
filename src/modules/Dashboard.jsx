import { useState, useMemo } from 'react';
import { RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import DashboardMetricCards from './dashboard/components/DashboardMetricCards';
import WeeklyPerformanceCard from './dashboard/components/WeeklyPerformanceCard';
import DashboardSidebarFeed from './dashboard/components/DashboardSidebarFeed';

export default function Dashboard({
  products = [],
  suppliers = [],
  customers = [],
  prices = [],
  orders = [],
  orderItems = [],
  setActiveTab,
  showToast,
  onRefresh,
}) {
  const [syncing, setSyncing] = useState(false);

  const handleRefresh = async () => {
    setSyncing(true);
    try {
      await onRefresh();
      showToast('Dashboard metrics refreshed successfully!', 'success');
    } catch {
      showToast('Refresh failed.', 'error');
    } finally {
      setSyncing(false);
    }
  };

  const customerMap = useMemo(() => {
    const map = {};
    customers.forEach((c) => { map[c.id] = c; });
    return map;
  }, [customers]);

  // Helper to retrieve the cost of an item at order-time with cascade lookup fallbacks
  const getItemCost = (oi) => {
    if (oi.supplier_price) return Number(oi.supplier_price);

    if (oi.supplier_id && prices) {
      const match = prices.find((sp) => sp.product_id === oi.product_id && sp.supplier_id === oi.supplier_id);
      if (match) return match.price;
    }

    if (prices) {
      const productPrices = prices.filter((sp) => sp.product_id === oi.product_id);
      if (productPrices.length > 0) {
        return Math.min(...productPrices.map((sp) => sp.price));
      }
    }

    const prod = products.find((p) => p.id === oi.product_id);
    return prod ? prod.base_price : 0;
  };

  const getOrderItems = (order) => {
    if (!order) return [];
    const embedded = order.order_items || order.items || order.line_items;
    if (Array.isArray(embedded) && embedded.length > 0) return embedded;
    const targetId = String(order.id || '').trim().toLowerCase();
    return orderItems.filter((oi) => String(oi.order_id || oi.orderId || '').trim().toLowerCase() === targetId);
  };

  const totalSales = orders.reduce((sum, o) => sum + Number(o.total_amount), 0);

  const totalProfit = orders.reduce((sum, order) => {
    const currentItems = getOrderItems(order);
    const orderProfit = currentItems.reduce((s, oi) => {
      if (!oi.product_id) return s; // Exclude custom items from profit
      const cost = getItemCost(oi);
      const selling = Number(oi.unit_price);
      const qty = Number(oi.quantity);
      return s + (selling - cost) * qty;
    }, 0);
    return sum + orderProfit;
  }, 0);

  const lowStockAlertCount = prices.filter((sp) => sp.stock_qty <= 2 && sp.price > 0).length;

  // Weekly Trend Calculations (Last 7 Days)
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const last7DaysData = Array.from({ length: 7 })
    .map((_, idx) => {
      const d = new Date();
      d.setDate(d.getDate() - idx);
      const dateStr = d.toISOString().slice(0, 10);
      const dayLabel = daysOfWeek[d.getDay()];

      const dayOrders = orders.filter((o) => new Date(o.ordered_at).toISOString().slice(0, 10) === dateStr);
      const revenue = dayOrders.reduce((sum, o) => sum + Number(o.total_amount), 0);

      const profit = dayOrders.reduce((sum, order) => {
        const currentItems = getOrderItems(order);
        const orderProfit = currentItems.reduce((s, oi) => {
          if (!oi.product_id) return s;
          const cost = getItemCost(oi);
          const selling = Number(oi.unit_price);
          const qty = Number(oi.quantity);
          return s + (selling - cost) * qty;
        }, 0);
        return sum + orderProfit;
      }, 0);

      return { date: dateStr, label: dayLabel, revenue, profit };
    })
    .reverse();

  const maxChartValue = Math.max(...last7DaysData.map((d) => Math.max(d.revenue, d.profit)), 100);

  const handleQuickAddProduct = () => {
    localStorage.setItem('wsp_auto_open_add_product', 'true');
    setActiveTab('pricing');
  };

  const handleQuickAddCustomer = () => {
    localStorage.setItem('wsp_auto_open_add_customer', 'true');
    setActiveTab('customers');
  };

  const recentOrders = orders.slice(0, 5);

  const lowStockWarnings = prices
    .filter((sp) => sp.stock_qty <= 2 && sp.price > 0)
    .slice(0, 4)
    .map((sp) => {
      const prod = products.find((p) => p.id === sp.product_id);
      const sup = suppliers.find((s) => s.id === sp.supplier_id);
      return { sp, prod, sup };
    })
    .filter((item) => item.prod && item.sup);

  return (
    <div className="space-y-6">
      <Card className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-5 bg-card border-border shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-foreground tracking-tight">Dashboard Overview</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time wholesale sales metrics, weekly inventory trends, and system shortcuts.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={syncing}
          className="h-8 gap-1.5 text-xs border-border text-foreground hover:bg-muted"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin text-[#000080]' : ''}`} />
          Refresh Stats
        </Button>
      </Card>

      <DashboardMetricCards
        totalSales={totalSales}
        totalProfit={totalProfit}
        ordersCount={orders.length}
        lowStockAlertCount={lowStockAlertCount}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <WeeklyPerformanceCard
          last7DaysData={last7DaysData}
          maxChartValue={maxChartValue}
          onNavigateTab={setActiveTab}
          onQuickAddProduct={handleQuickAddProduct}
          onQuickAddCustomer={handleQuickAddCustomer}
        />

        <DashboardSidebarFeed
          recentOrders={recentOrders}
          customerMap={customerMap}
          lowStockWarnings={lowStockWarnings}
          onNavigateTab={setActiveTab}
        />
      </div>
    </div>
  );
}
