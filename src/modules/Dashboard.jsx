import { useState } from 'react';
import { 
  TrendingUp, 
  DollarSign, 
  FileText, 
  Users, 
  AlertTriangle, 
  Plus, 
  ArrowUpRight, 
  ShoppingBag, 
  RefreshCw,
  Package
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function Dashboard({ 
  products = [], 
  suppliers = [], 
  customers = [], 
  prices = [], 
  orders = [], 
  orderItems = [], 
  setActiveTab, 
  showToast, 
  onRefresh 
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

  // Helper to retrieve the cost of an item at order-time with cascade lookup fallbacks
  const getItemCost = (oi) => {
    if (oi.supplier_price) return Number(oi.supplier_price);
    
    if (oi.supplier_id && prices) {
      const match = prices.find(sp => sp.product_id === oi.product_id && sp.supplier_id === oi.supplier_id);
      if (match) return match.price;
    }
    
    if (prices) {
      const productPrices = prices.filter(sp => sp.product_id === oi.product_id);
      if (productPrices.length > 0) {
        return Math.min(...productPrices.map(sp => sp.price));
      }
    }
    
    const prod = products.find(p => p.id === oi.product_id);
    return prod ? prod.base_price : 0;
  };

  // Resilient item helper
  const getOrderItems = (order) => {
    if (!order) return [];
    const embedded = order.order_items || order.items || order.line_items;
    if (Array.isArray(embedded) && embedded.length > 0) return embedded;
    const targetId = String(order.id || '').trim().toLowerCase();
    return orderItems.filter(oi => String(oi.order_id || oi.orderId || '').trim().toLowerCase() === targetId);
  };

  // 1. Metric Calculations
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

  const lowStockAlertCount = prices.filter(sp => sp.stock_qty <= 2 && sp.price > 0).length;
  const ordersCount = orders.length;

  // 2. Weekly Trend Calculations (Last 7 Days)
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const last7DaysData = Array.from({ length: 7 }).map((_, idx) => {
    const d = new Date();
    d.setDate(d.getDate() - idx);
    const dateStr = d.toISOString().slice(0, 10);
    
    const dayLabel = daysOfWeek[d.getDay()];

    const dayOrders = orders.filter(o => new Date(o.ordered_at).toISOString().slice(0, 10) === dateStr);
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

    return {
      date: dateStr,
      label: dayLabel,
      revenue,
      profit
    };
  }).reverse();

  const maxChartValue = Math.max(...last7DaysData.map(d => Math.max(d.revenue, d.profit)), 100);

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
    .filter(sp => sp.stock_qty <= 2 && sp.price > 0)
    .slice(0, 4)
    .map(sp => {
      const prod = products.find(p => p.id === sp.product_id);
      const sup = suppliers.find(s => s.id === sp.supplier_id);
      return { sp, prod, sup };
    })
    .filter(item => item.prod && item.sup);

  return (
    <div className="space-y-6">
      {/* Welcome Banner Panel */}
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

      {/* 4 Stats Metrics Panel */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <Card className="p-4 border-border hover:border-[#000080]/40 transition-colors flex items-center gap-3.5 shadow-xs">
          <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block leading-tight">Total Volume</span>
            <span className="text-xl font-black text-foreground block mt-0.5 font-mono">${totalSales.toFixed(2)}</span>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium block leading-tight mt-0.5">Cumulative sales revenue</span>
          </div>
        </Card>

        {/* Metric 2 */}
        <Card className="p-4 border-border hover:border-[#000080]/40 transition-colors flex items-center gap-3.5 shadow-xs">
          <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 rounded-lg border border-blue-500/20 text-[#000080] dark:text-blue-400">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block leading-tight">Net Profit</span>
            <span className="text-xl font-black text-foreground block mt-0.5 font-mono">${totalProfit.toFixed(2)}</span>
            <span className="text-[10px] text-[#000080] dark:text-blue-400 font-medium block leading-tight mt-0.5">Estimated gross profit margin</span>
          </div>
        </Card>

        {/* Metric 3 */}
        <Card className="p-4 border-border hover:border-[#000080]/40 transition-colors flex items-center gap-3.5 shadow-xs">
          <div className="p-2.5 bg-muted rounded-lg border border-border text-foreground">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block leading-tight">Total Orders</span>
            <span className="text-xl font-black text-foreground block mt-0.5 font-mono">{ordersCount}</span>
            <span className="text-[10px] text-muted-foreground font-medium block leading-tight mt-0.5">Invoices logged in database</span>
          </div>
        </Card>

        {/* Metric 4 */}
        <Card className="p-4 border-border hover:border-amber-500/40 transition-colors flex items-center gap-3.5 shadow-xs">
          <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 rounded-lg border border-amber-500/20 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block leading-tight">Stock Warnings</span>
            <span className="text-xl font-black text-foreground block mt-0.5 font-mono">{lowStockAlertCount}</span>
            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium block leading-tight mt-0.5">Inventories ≤ 2 qty</span>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Area: Visual CSS Chart (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Trend Chart Card */}
          <Card className="p-5 border-border space-y-5 shadow-xs">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#000080] dark:text-blue-400" />
                Weekly Performance Trend
              </h3>
              <div className="flex gap-4 text-[10px] font-bold text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-[#000080] rounded-xs"></span> Revenue</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-emerald-600 dark:bg-emerald-500 rounded-xs"></span> Net Profit</span>
              </div>
            </div>

            {/* Render CSS Visual bar graph */}
            <div className="h-64 flex items-end justify-between gap-3 sm:gap-6 border-b border-border pb-2 pt-6">
              {last7DaysData.map((d, index) => {
                const revHeightPercent = Math.max(4, (d.revenue / maxChartValue) * 100);
                const profHeightPercent = Math.max(4, (d.profit / maxChartValue) * 100);

                return (
                  <div key={index} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                    <div className="absolute bottom-full mb-2 bg-popover border border-border text-[10px] font-bold rounded-md p-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 w-24 text-center shadow-md space-y-0.5">
                      <span className="block text-foreground">Rev: ${d.revenue.toFixed(1)}</span>
                      <span className="block text-emerald-600 dark:text-emerald-400">Prof: ${d.profit.toFixed(1)}</span>
                    </div>

                    <div className="w-full flex items-end justify-center gap-1.5 h-full max-h-[220px]">
                      <div 
                        style={{ height: `${revHeightPercent}%` }} 
                        className="w-1/2 rounded-t bg-[#000080] shadow-xs group-hover:bg-[#000066] transition-colors"
                      />
                      <div 
                        style={{ height: `${profHeightPercent}%` }} 
                        className="w-1/2 rounded-t bg-emerald-600 dark:bg-emerald-500 shadow-xs group-hover:bg-emerald-700 transition-colors"
                      />
                    </div>

                    <span className="text-[10px] font-semibold text-muted-foreground mt-2 block group-hover:text-foreground transition-colors">
                      {d.label}
                    </span>
                  </div>
                );
              })}
            </div>
            
            <div className="flex justify-between items-center text-[10px] text-muted-foreground font-medium px-1">
              <span>Last 7 days performance metrics summary</span>
              <span>Max volume scale: ${maxChartValue.toFixed(0)}</span>
            </div>
          </Card>

          {/* Quick Actions Panel */}
          <Card className="p-5 border-border space-y-3 shadow-xs">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Quick Actions Shortcuts</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Button 
                variant="outline"
                onClick={() => setActiveTab('invoice')}
                className="h-auto p-3.5 flex flex-col items-center justify-center gap-2 text-center cursor-pointer group hover:border-[#000080]/50 bg-card rounded-lg"
              >
                <div className="p-2 bg-muted text-[#000080] dark:text-blue-400 rounded-md group-hover:bg-[#000080] group-hover:text-white transition-colors">
                  <Plus className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-foreground block">Create Invoice</span>
              </Button>

              <Button 
                variant="outline"
                onClick={handleQuickAddProduct}
                className="h-auto p-3.5 flex flex-col items-center justify-center gap-2 text-center cursor-pointer group hover:border-[#000080]/50 bg-card rounded-lg"
              >
                <div className="p-2 bg-muted text-[#000080] dark:text-blue-400 rounded-md group-hover:bg-[#000080] group-hover:text-white transition-colors">
                  <Package className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-foreground block">Add Product</span>
              </Button>

              <Button 
                variant="outline"
                onClick={handleQuickAddCustomer}
                className="h-auto p-3.5 flex flex-col items-center justify-center gap-2 text-center cursor-pointer group hover:border-[#000080]/50 bg-card rounded-lg"
              >
                <div className="p-2 bg-muted text-[#000080] dark:text-blue-400 rounded-md group-hover:bg-[#000080] group-hover:text-white transition-colors">
                  <Users className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-foreground block">Add Customer</span>
              </Button>

              <Button 
                variant="outline"
                onClick={() => setActiveTab('stock')}
                className="h-auto p-3.5 flex flex-col items-center justify-center gap-2 text-center cursor-pointer group hover:border-amber-500/50 bg-card rounded-lg"
              >
                <div className="p-2 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-md group-hover:bg-amber-500 group-hover:text-white transition-colors">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-foreground block">Stock Alerts</span>
              </Button>
            </div>
          </Card>
        </div>

        {/* Right Area: Activities & Warnings (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Recent Invoices Log */}
          <Card className="p-5 border-border space-y-4 shadow-xs">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-violet-400" />
                Recent Sales
              </h3>
              <Button 
                variant="ghost"
                size="sm"
                onClick={() => setActiveTab('sales')}
                className="h-7 text-[11px] font-bold text-primary p-0 hover:bg-transparent hover:underline"
              >
                View all <ArrowUpRight className="w-3 h-3 ml-0.5" />
              </Button>
            </div>

            <div className="space-y-2.5">
              {recentOrders.map(order => {
                const cust = customers.find(c => c.id === order.customer_id);
                return (
                  <div key={order.id} className="p-3 bg-muted/30 border border-border rounded-lg flex items-center justify-between text-xs hover:border-border/80 transition-colors">
                    <div className="space-y-0.5">
                      <strong className="text-foreground block truncate max-w-[130px]">
                        {cust ? cust.name : 'Unknown Customer'}
                      </strong>
                      <span className="text-[10px] text-muted-foreground font-medium">
                        {new Date(order.ordered_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    <div className="text-right">
                      <strong className="text-foreground block font-mono">${Number(order.total_amount).toFixed(2)}</strong>
                      <Badge 
                        variant={order.status === 'paid' ? 'success' : order.status === 'delivered' ? 'default' : 'warning'}
                        className="text-[9px] uppercase px-1.5 py-0 mt-0.5"
                      >
                        {order.status}
                      </Badge>
                    </div>
                  </div>
                );
              })}

              {recentOrders.length === 0 && (
                <div className="p-6 text-center text-muted-foreground italic text-xs">
                  No sales logged.
                </div>
              )}
            </div>
          </Card>

          {/* Critical Low Stock Warnings list */}
          <Card className="p-5 border-border space-y-4 shadow-xs">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                Inventory Alerts
              </h3>
              <Button 
                variant="ghost"
                size="sm"
                onClick={() => setActiveTab('stock')}
                className="h-7 text-[11px] font-bold text-rose-400 p-0 hover:bg-transparent hover:underline"
              >
                Stock Log <ArrowUpRight className="w-3 h-3 ml-0.5" />
              </Button>
            </div>

            <div className="space-y-2.5">
              {lowStockWarnings.map(({ sp, prod, sup }, idx) => (
                <div key={idx} className="p-3 bg-rose-500/5 border border-rose-500/15 rounded-lg flex items-center justify-between text-xs hover:bg-rose-500/10 transition-colors">
                  <div className="space-y-0.5">
                    <strong className="text-foreground block truncate max-w-[140px]">{prod.name_kh}</strong>
                    <span className="text-[10px] text-muted-foreground block truncate max-w-[140px]">{prod.name_en}</span>
                    <span className="text-[9px] text-muted-foreground/80 block leading-tight">Supplier: {sup.name}</span>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <Badge variant="destructive" className="font-mono text-xs px-2 py-0.5">
                      {sp.stock_qty} {sp.stock_unit}
                    </Badge>
                  </div>
                </div>
              ))}

              {lowStockWarnings.length === 0 && (
                <div className="p-6 text-center text-muted-foreground italic text-xs">
                  All items adequately stocked.
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
