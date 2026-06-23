import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import SupabaseSettingsModal from './components/SupabaseSettingsModal';
import PricingTable from './modules/PricingTable';
import CustomerDirectory from './modules/CustomerDirectory';
import InvoiceBuilder from './modules/InvoiceBuilder';
import SalesLog from './modules/SalesLog';
import StockTracker from './modules/StockTracker';
import BrandManager from './modules/BrandManager';
import { db, getSupabaseConfig } from './services/db';
import { RefreshCw, LayoutDashboard, Database, HelpCircle, Package, TrendingUp, AlertTriangle, Menu } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('pricing');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('wsp_theme') || 'dark');

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
    localStorage.setItem('wsp_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  // Global state
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [prices, setPrices] = useState([]);
  const [orders, setOrders] = useState([]);
  const [orderItems, setOrderItems] = useState([]);
  const [brands, setBrands] = useState([]);

  // Config triggers state reload
  const [configVersion, setConfigVersion] = useState(0);

  const loadData = async () => {
    const isInitial = products.length === 0;
    if (isInitial) {
      setLoading(true);
    } else {
      setSyncing(true);
    }
    try {
      const [prods, sups, custs, prs, ords, items, bnds] = await Promise.all([
        db.getProducts(),
        db.getSuppliers(),
        db.getCustomers(),
        db.getSupplierPrices(),
        db.getOrders(),
        db.getOrderItems(),
        db.getBrands()
      ]);

      setProducts(prods || []);
      setSuppliers(sups || []);
      setCustomers(custs || []);
      setPrices(prs || []);
      setOrders(ords || []);
      setOrderItems(items || []);
      setBrands(bnds || []);
    } catch (e) {
      console.error("Error loading database records:", e);
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [configVersion]);

  const handleConfigChange = () => {
    // Increment config version to force data reload with new db client
    setConfigVersion(prev => prev + 1);
  };

  // Render view depending on tab
  const renderTabContent = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center h-[60vh] gap-3 text-dark-400">
          <RefreshCw className="w-8 h-8 animate-spin text-primary-400" />
          <span className="text-sm font-semibold">Syncing with database...</span>
        </div>
      );
    }

    switch (activeTab) {
      case 'pricing':
        return (
          <PricingTable 
            products={products}
            suppliers={suppliers}
            prices={prices}
            brands={brands}
            onRefresh={loadData}
          />
        );
      case 'customers':
        return (
          <CustomerDirectory 
            customers={customers}
            orders={orders}
            orderItems={orderItems}
            products={products}
            onRefresh={loadData}
          />
        );
      case 'invoice':
        return (
          <InvoiceBuilder 
            customers={customers}
            products={products}
            suppliers={suppliers}
            prices={prices}
            brands={brands}
            onRefresh={loadData}
          />
        );
      case 'sales':
        return (
          <SalesLog 
            orders={orders}
            customers={customers}
            orderItems={orderItems}
            products={products}
            suppliers={suppliers}
            prices={prices}
            onRefresh={loadData}
          />
        );
      case 'stock':
        return (
          <StockTracker 
            products={products}
            suppliers={suppliers}
            prices={prices}
            brands={brands}
            onRefresh={loadData}
          />
        );
      case 'brands':
        return (
          <BrandManager 
            brands={brands}
            products={products}
            onRefresh={loadData}
          />
        );
      default:
        return <div>Module not found.</div>;
    }
  };

  // Quick stats calculations
  const totalSales = orders.reduce((sum, o) => sum + Number(o.total_amount), 0);
  const lowStockCount = prices.filter(sp => sp.stock_qty <= 2 && sp.price > 0).length;

  return (
    <div className="flex h-screen overflow-hidden bg-dark-950 font-sans">
      {/* Sidebar Backdrop Overlay on Mobile */}
      {isSidebarOpen && (
        <div 
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 md:hidden"
        />
      )}

      {/* Sidebar Navigation */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onOpenSettings={() => setIsSettingsOpen(true)}
        onRefresh={loadData}
        theme={theme}
        toggleTheme={toggleTheme}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header Bar */}
        <header className="h-16 border-b border-dark-800/80 bg-dark-950/20 backdrop-blur-md flex items-center justify-between px-8 flex-shrink-0 no-print">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-1.5 rounded-lg hover:bg-dark-900 text-dark-400 hover:text-white md:hidden transition-all active:scale-95 cursor-pointer"
              title="Open Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <LayoutDashboard className="w-5 h-5 text-primary-400" />
              <span className="text-sm font-bold text-white uppercase tracking-wider">
                {activeTab} Dashboard
              </span>
            </div>
          </div>

          {/* Quick Info Badges */}
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-dark-900/40 border border-dark-850 text-xs">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-dark-400 font-medium">Total Volume:</span>
              <strong className="text-white font-bold">${totalSales.toFixed(2)}</strong>
            </div>

            {lowStockCount > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-900/20 text-xs text-rose-300">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                <span>{lowStockCount} Low stock alerts</span>
              </div>
            )}

            <button 
              onClick={loadData}
              disabled={loading || syncing}
              className="p-2 rounded-lg hover:bg-dark-900 text-dark-400 hover:text-white border border-transparent hover:border-dark-800 transition-all active:scale-95"
              title="Sync Database"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin text-primary-400' : ''}`} />
            </button>
          </div>
        </header>

        {/* Dashboard Panels */}
        <div className="flex-1 overflow-y-auto p-8 scrollbar-thin">
          {renderTabContent()}
        </div>
      </main>

      {/* Settings Modal */}
      <SupabaseSettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onConfigChange={handleConfigChange}
      />
    </div>
  );
}
