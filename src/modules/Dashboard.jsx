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
    
    // Day Label
    const dayLabel = daysOfWeek[d.getDay()];

    // Total orders on this day
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

  // Find max value in chart to scale height correctly
  const maxChartValue = Math.max(...last7DaysData.map(d => Math.max(d.revenue, d.profit)), 100);

  // Quick navigate helpers that toggle tab triggers
  const handleQuickAddProduct = () => {
    localStorage.setItem('wsp_auto_open_add_product', 'true');
    setActiveTab('pricing');
  };

  const handleQuickAddCustomer = () => {
    localStorage.setItem('wsp_auto_open_add_customer', 'true');
    setActiveTab('customers');
  };

  // Recent 5 Invoices
  const recentOrders = orders.slice(0, 5);

  // High Priority Low Stock Alerts (show max 4 warnings)
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-dark-900/40 p-6 rounded-2xl border border-dark-800/40 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide">Dashboard Overview</h2>
          <p className="text-xs text-dark-400 mt-1">
            Real-time visual metrics, performance trends, and quick access shortcuts for the Wholesale Portal.
          </p>
        </div>
        <button 
          onClick={handleRefresh}
          disabled={syncing}
          className="glass-button-secondary py-2 px-3 flex items-center gap-1.5 text-xs cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin text-primary-400' : ''}`} />
          Refresh Stats
        </button>
      </div>

      {/* 4 Stats Metrics Panel */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="glass-panel p-5 rounded-2xl border border-dark-800 flex items-center gap-4 hover:border-primary-500/25 transition-all">
          <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-emerald-400">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-dark-400 uppercase tracking-widest block leading-tight">Total Volume</span>
            <span className="text-xl font-black text-white block mt-0.5 font-mono">${totalSales.toFixed(2)}</span>
            <span className="text-[9px] text-emerald-400 font-semibold block leading-tight mt-0.5">Cumulative sales revenue</span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="glass-panel p-5 rounded-2xl border border-dark-800 flex items-center gap-4 hover:border-primary-500/25 transition-all">
          <div className="p-3 bg-primary-500/10 rounded-xl border border-primary-500/20 text-primary-400">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-dark-400 uppercase tracking-widest block leading-tight">Net Profit</span>
            <span className="text-xl font-black text-white block mt-0.5 font-mono">${totalProfit.toFixed(2)}</span>
            <span className="text-[9px] text-primary-400 font-semibold block leading-tight mt-0.5">Estimated gross profit margin</span>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="glass-panel p-5 rounded-2xl border border-dark-800 flex items-center gap-4 hover:border-primary-500/25 transition-all">
          <div className="p-3 bg-violet-500/10 rounded-xl border border-violet-500/20 text-violet-400">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-dark-400 uppercase tracking-widest block leading-tight">Total Orders</span>
            <span className="text-xl font-black text-white block mt-0.5 font-mono">{ordersCount}</span>
            <span className="text-[9px] text-violet-400 font-semibold block leading-tight mt-0.5">Invoices logged in database</span>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="glass-panel p-5 rounded-2xl border border-dark-800 flex items-center gap-4 hover:border-primary-500/25 transition-all">
          <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/20 text-amber-400">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-dark-400 uppercase tracking-widest block leading-tight">Stock Warnings</span>
            <span className="text-xl font-black text-white block mt-0.5 font-mono">{lowStockAlertCount}</span>
            <span className="text-[9px] text-amber-400 font-semibold block leading-tight mt-0.5">Supplier inventories ≤ 2 qty</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Area: Visual CSS Chart (7 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Trend Chart Card */}
          <div className="glass-panel p-6 rounded-2xl border border-dark-800 space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <TrendingUp className="w-4.5 h-4.5 text-primary-400" />
                Weekly Performance Trend
              </h3>
              <div className="flex gap-4 text-[10px] font-bold text-dark-400">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-primary-500 rounded"></span> Revenue</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-emerald-400 rounded"></span> Net Profit</span>
              </div>
            </div>

            {/* Render CSS Visual bar graph */}
            <div className="h-64 flex items-end justify-between gap-3 sm:gap-6 border-b border-dark-800/80 pb-2 pt-6">
              {last7DaysData.map((d, index) => {
                // Compute height percentage
                const revHeightPercent = Math.max(4, (d.revenue / maxChartValue) * 100);
                const profHeightPercent = Math.max(4, (d.profit / maxChartValue) * 100);

                return (
                  <div key={index} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                    {/* Tooltip on hover */}
                    <div className="absolute bottom-full mb-2 bg-dark-900 border border-dark-800 text-[10px] font-bold rounded-lg p-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 w-24 text-center shadow-xl space-y-0.5">
                      <span className="block text-white">Rev: ${d.revenue.toFixed(1)}</span>
                      <span className="block text-emerald-400">Prof: ${d.profit.toFixed(1)}</span>
                    </div>

                    {/* Bars wrapper */}
                    <div className="w-full flex items-end justify-center gap-1 h-full max-h-[220px]">
                      {/* Revenue Bar */}
                      <div 
                        style={{ height: `${revHeightPercent}%` }} 
                        className="w-1/2 rounded-t bg-gradient-to-t from-primary-600 to-primary-400 shadow shadow-primary-500/10 group-hover:brightness-110 transition-all"
                      />
                      {/* Profit Bar */}
                      <div 
                        style={{ height: `${profHeightPercent}%` }} 
                        className="w-1/2 rounded-t bg-gradient-to-t from-emerald-500 to-emerald-300 shadow shadow-emerald-400/10 group-hover:brightness-110 transition-all"
                      />
                    </div>

                    {/* Labels */}
                    <span className="text-[10px] font-semibold text-dark-500 mt-2.5 block group-hover:text-white transition-colors">
                      {d.label}
                    </span>
                  </div>
                );
              })}
            </div>
            
            <div className="flex justify-between items-center text-[10px] text-dark-500 font-semibold px-1">
              <span>(Last 7 days performance metrics summary)</span>
              <span>Max value: ${maxChartValue.toFixed(0)}</span>
            </div>
          </div>

          {/* Quick Actions Panel */}
          <div className="glass-panel p-6 rounded-2xl border border-dark-800 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Quick Actions Shortcuts</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <button 
                onClick={() => setActiveTab('invoice')}
                className="p-4 bg-dark-900/40 border border-dark-800 hover:border-primary-500/30 rounded-xl flex flex-col items-center justify-center gap-2.5 transition-all text-center cursor-pointer group active:scale-95"
              >
                <div className="p-2.5 bg-primary-500/10 text-primary-400 rounded-lg group-hover:bg-primary-500/20">
                  <Plus className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-white block">Create Invoice</span>
              </button>

              <button 
                onClick={handleQuickAddProduct}
                className="p-4 bg-dark-900/40 border border-dark-800 hover:border-violet-500/30 rounded-xl flex flex-col items-center justify-center gap-2.5 transition-all text-center cursor-pointer group active:scale-95"
              >
                <div className="p-2.5 bg-violet-500/10 text-violet-400 rounded-lg group-hover:bg-violet-500/20">
                  <Package className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-white block">Add Product</span>
              </button>

              <button 
                onClick={handleQuickAddCustomer}
                className="p-4 bg-dark-900/40 border border-dark-800 hover:border-emerald-500/30 rounded-xl flex flex-col items-center justify-center gap-2.5 transition-all text-center cursor-pointer group active:scale-95"
              >
                <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-lg group-hover:bg-emerald-500/20">
                  <Users className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-white block">Add Customer</span>
              </button>

              <button 
                onClick={() => setActiveTab('stock')}
                className="p-4 bg-dark-900/40 border border-dark-800 hover:border-amber-500/30 rounded-xl flex flex-col items-center justify-center gap-2.5 transition-all text-center cursor-pointer group active:scale-95"
              >
                <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-lg group-hover:bg-amber-500/20">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-white block">Stock Alerts</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Area: Activities & Warnings (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Recent Invoices Log */}
          <div className="glass-panel p-5 rounded-2xl border border-dark-800 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-violet-400" />
                Recent Sales
              </h3>
              <button 
                onClick={() => setActiveTab('sales')}
                className="text-[10px] font-bold text-primary-400 hover:underline flex items-center gap-0.5"
              >
                View all <ArrowUpRight className="w-3 h-3" />
              </button>
            </div>

            <div className="space-y-2.5">
              {recentOrders.map(order => {
                const cust = customers.find(c => c.id === order.customer_id);
                return (
                  <div key={order.id} className="p-3 bg-dark-900/30 border border-dark-850 rounded-xl flex items-center justify-between text-xs hover:border-dark-800 transition-colors">
                    <div className="space-y-0.5">
                      <strong className="text-white block truncate max-w-[130px]">
                        {cust ? cust.name : 'Unknown Customer'}
                      </strong>
                      <span className="text-[10px] text-dark-500 font-medium">
                        {new Date(order.ordered_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    <div className="text-right">
                      <strong className="text-white block font-mono">${Number(order.total_amount).toFixed(2)}</strong>
                      <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full uppercase leading-none border inline-block mt-0.5 ${
                        order.status === 'paid' 
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-900/20'
                          : order.status === 'delivered'
                          ? 'bg-primary-500/10 text-primary-400 border-primary-900/20'
                          : 'bg-amber-500/10 text-amber-400 border-amber-900/20'
                      }`}>
                        {order.status}
                      </span>
                    </div>
                  </div>
                );
              })}

              {recentOrders.length === 0 && (
                <div className="p-6 text-center text-dark-500 italic text-xs">
                  No sales logged.
                </div>
              )}
            </div>
          </div>

          {/* Critical Low Stock Warnings list */}
          <div className="glass-panel p-5 rounded-2xl border border-dark-800 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                Inventory Alerts
              </h3>
              <button 
                onClick={() => setActiveTab('stock')}
                className="text-[10px] font-bold text-rose-400 hover:underline flex items-center gap-0.5"
              >
                Stock Log <ArrowUpRight className="w-3 h-3" />
              </button>
            </div>

            <div className="space-y-2.5 animate-pulse-slow">
              {lowStockWarnings.map(({ sp, prod, sup }, idx) => (
                <div key={idx} className="p-3 bg-rose-950/5 border border-rose-900/10 rounded-xl flex items-center justify-between text-xs hover:bg-rose-950/10 transition-colors">
                  <div className="space-y-0.5">
                    <strong className="text-white block truncate max-w-[140px]">{prod.name_kh}</strong>
                    <span className="text-[10px] text-dark-400 block truncate max-w-[140px]">{prod.name_en}</span>
                    <span className="text-[9px] text-dark-500 block leading-tight">Supplier: {sup.name}</span>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="text-rose-400 font-extrabold block text-xs bg-rose-500/10 px-2 py-0.5 rounded border border-rose-900/20 text-center">
                      {sp.stock_qty} {sp.stock_unit}
                    </span>
                  </div>
                </div>
              ))}

              {lowStockWarnings.length === 0 && (
                <div className="p-6 text-center text-dark-500 italic text-xs">
                  All items adequately stocked.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
