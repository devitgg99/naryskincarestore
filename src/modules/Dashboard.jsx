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

  // 1. Metric Calculations
  const totalSales = orders.reduce((sum, o) => sum + Number(o.total_amount), 0);
  
  const totalProfit = orders.reduce((sum, order) => {
    const currentItems = orderItems.filter(oi => oi.order_id === order.id);
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
      const currentItems = orderItems.filter(oi => oi.order_id === order.id);
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
      <Card className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-6 bg-card/60 backdrop-blur-md border-border shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-foreground tracking-wide">Dashboard Overview</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Real-time visual metrics, performance trends, and quick access shortcuts for the Wholesale Portal.
          </p>
        </div>
        <Button 
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={syncing}
          className="h-8 gap-1.5 text-xs cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin text-primary' : ''}`} />
          Refresh Stats
        </Button>
      </Card>

      {/* 4 Stats Metrics Panel */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <Card className="p-5 border-border hover:border-primary/40 transition-all flex items-center gap-4 shadow-xs">
          <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-emerald-400">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block leading-tight">Total Volume</span>
            <span className="text-xl font-black text-foreground block mt-0.5 font-mono">${totalSales.toFixed(2)}</span>
            <span className="text-[9px] text-emerald-400 font-semibold block leading-tight mt-0.5">Cumulative sales revenue</span>
          </div>
        </Card>

        {/* Metric 2 */}
        <Card className="p-5 border-border hover:border-primary/40 transition-all flex items-center gap-4 shadow-xs">
          <div className="p-3 bg-primary/10 rounded-xl border border-primary/20 text-primary">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block leading-tight">Net Profit</span>
            <span className="text-xl font-black text-foreground block mt-0.5 font-mono">${totalProfit.toFixed(2)}</span>
            <span className="text-[9px] text-primary font-semibold block leading-tight mt-0.5">Estimated gross profit margin</span>
          </div>
        </Card>

        {/* Metric 3 */}
        <Card className="p-5 border-border hover:border-primary/40 transition-all flex items-center gap-4 shadow-xs">
          <div className="p-3 bg-violet-500/10 rounded-xl border border-violet-500/20 text-violet-400">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block leading-tight">Total Orders</span>
            <span className="text-xl font-black text-foreground block mt-0.5 font-mono">{ordersCount}</span>
            <span className="text-[9px] text-violet-400 font-semibold block leading-tight mt-0.5">Invoices logged in database</span>
          </div>
        </Card>

        {/* Metric 4 */}
        <Card className="p-5 border-border hover:border-primary/40 transition-all flex items-center gap-4 shadow-xs">
          <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/20 text-amber-400">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block leading-tight">Stock Warnings</span>
            <span className="text-xl font-black text-foreground block mt-0.5 font-mono">{lowStockAlertCount}</span>
            <span className="text-[9px] text-amber-400 font-semibold block leading-tight mt-0.5">Supplier inventories ≤ 2 qty</span>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Area: Visual CSS Chart (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Trend Chart Card */}
          <Card className="p-6 border-border space-y-6 shadow-xs">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                <TrendingUp className="w-4.5 h-4.5 text-primary" />
                Weekly Performance Trend
              </h3>
              <div className="flex gap-4 text-[10px] font-bold text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-primary rounded"></span> Revenue</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-emerald-400 rounded"></span> Net Profit</span>
              </div>
            </div>

            {/* Render CSS Visual bar graph */}
            <div className="h-64 flex items-end justify-between gap-3 sm:gap-6 border-b border-border/80 pb-2 pt-6">
              {last7DaysData.map((d, index) => {
                const revHeightPercent = Math.max(4, (d.revenue / maxChartValue) * 100);
                const profHeightPercent = Math.max(4, (d.profit / maxChartValue) * 100);

                return (
                  <div key={index} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                    <div className="absolute bottom-full mb-2 bg-popover border border-border text-[10px] font-bold rounded-lg p-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 w-24 text-center shadow-xl space-y-0.5">
                      <span className="block text-foreground">Rev: ${d.revenue.toFixed(1)}</span>
                      <span className="block text-emerald-400">Prof: ${d.profit.toFixed(1)}</span>
                    </div>

                    <div className="w-full flex items-end justify-center gap-1 h-full max-h-[220px]">
                      <div 
                        style={{ height: `${revHeightPercent}%` }} 
                        className="w-1/2 rounded-t bg-gradient-to-t from-primary/90 to-primary/60 shadow-xs group-hover:brightness-110 transition-all"
                      />
                      <div 
                        style={{ height: `${profHeightPercent}%` }} 
                        className="w-1/2 rounded-t bg-gradient-to-t from-emerald-500 to-emerald-300 shadow-xs group-hover:brightness-110 transition-all"
                      />
                    </div>

                    <span className="text-[10px] font-semibold text-muted-foreground mt-2.5 block group-hover:text-foreground transition-colors">
                      {d.label}
                    </span>
                  </div>
                );
              })}
            </div>
            
            <div className="flex justify-between items-center text-[10px] text-muted-foreground font-semibold px-1">
              <span>(Last 7 days performance metrics summary)</span>
              <span>Max value: ${maxChartValue.toFixed(0)}</span>
            </div>
          </Card>

          {/* Quick Actions Panel */}
          <Card className="p-6 border-border space-y-4 shadow-xs">
            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Quick Actions Shortcuts</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Button 
                variant="outline"
                onClick={() => setActiveTab('invoice')}
                className="h-auto p-4 flex flex-col items-center justify-center gap-2.5 text-center cursor-pointer group hover:border-primary/40 bg-card/40"
              >
                <div className="p-2.5 bg-primary/10 text-primary rounded-lg group-hover:bg-primary/20 transition-colors">
                  <Plus className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-foreground block">Create Invoice</span>
              </Button>

              <Button 
                variant="outline"
                onClick={handleQuickAddProduct}
                className="h-auto p-4 flex flex-col items-center justify-center gap-2.5 text-center cursor-pointer group hover:border-violet-500/40 bg-card/40"
              >
                <div className="p-2.5 bg-violet-500/10 text-violet-400 rounded-lg group-hover:bg-violet-500/20 transition-colors">
                  <Package className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-foreground block">Add Product</span>
              </Button>

              <Button 
                variant="outline"
                onClick={handleQuickAddCustomer}
                className="h-auto p-4 flex flex-col items-center justify-center gap-2.5 text-center cursor-pointer group hover:border-emerald-500/40 bg-card/40"
              >
                <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-lg group-hover:bg-emerald-500/20 transition-colors">
                  <Users className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-foreground block">Add Customer</span>
              </Button>

              <Button 
                variant="outline"
                onClick={() => setActiveTab('stock')}
                className="h-auto p-4 flex flex-col items-center justify-center gap-2.5 text-center cursor-pointer group hover:border-amber-500/40 bg-card/40"
              >
                <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-lg group-hover:bg-amber-500/20 transition-colors">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-foreground block">Stock Alerts</span>
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
