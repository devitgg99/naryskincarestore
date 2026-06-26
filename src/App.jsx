import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import SupabaseSettingsModal from './components/SupabaseSettingsModal';
import PricingTable from './modules/PricingTable';
import CustomerDirectory from './modules/CustomerDirectory';
import InvoiceBuilder from './modules/InvoiceBuilder';
import SalesLog from './modules/SalesLog';
import StockTracker from './modules/StockTracker';
import BrandManager from './modules/BrandManager';
import CategoryManager from './modules/CategoryManager';
import { db } from './services/db';
import { 
  RefreshCw, 
  LayoutDashboard, 
  TrendingUp, 
  AlertTriangle, 
  Menu,
  Table, 
  Users, 
  FileText, 
  ClipboardList, 
  Package, 
  Tag, 
  Layers 
} from 'lucide-react';

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
  const [categories, setCategories] = useState([]);

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
      const [prods, sups, custs, prs, ords, items, bnds, cats] = await Promise.all([
        db.getProducts(),
        db.getSuppliers(),
        db.getCustomers(),
        db.getSupplierPrices(),
        db.getOrders(),
        db.getOrderItems(),
        db.getBrands(),
        db.getCategories()
      ]);

      setProducts(prods || []);
      setSuppliers(sups || []);
      setCustomers(custs || []);
      setPrices(prs || []);
      setOrders(ords || []);
      setOrderItems(items || []);
      setBrands(bnds || []);
      setCategories(cats || []);
    } catch (e) {
      console.error("Error loading database records:", e);
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  };

  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    loadData();
  }, [configVersion]);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

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
            categories={categories}
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
            categories={categories}
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
            categories={categories}
            onRefresh={loadData}
          />
        );
      case 'brands':
        return (
          <BrandManager 
            brands={brands}
            categories={categories}
            products={products}
            onRefresh={loadData}
          />
        );
      case 'categories':
        return (
          <CategoryManager 
            categories={categories}
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

  const getTabIcon = () => {
    switch (activeTab) {
      case 'pricing': return <Table className="w-4.5 h-4.5 text-primary-400" />;
      case 'customers': return <Users className="w-4.5 h-4.5 text-primary-400" />;
      case 'invoice': return <FileText className="w-4.5 h-4.5 text-primary-400" />;
      case 'sales': return <ClipboardList className="w-4.5 h-4.5 text-primary-400" />;
      case 'stock': return <Package className="w-4.5 h-4.5 text-primary-400" />;
      case 'brands': return <Tag className="w-4.5 h-4.5 text-primary-400" />;
      case 'categories': return <Layers className="w-4.5 h-4.5 text-primary-400" />;
      default: return <LayoutDashboard className="w-4.5 h-4.5 text-primary-400" />;
    }
  };

  const getTabLabel = () => {
    switch (activeTab) {
      case 'pricing': return 'Pricing Catalog';
      case 'customers': return 'Customer Directory';
      case 'invoice': return 'Invoice Builder';
      case 'sales': return 'Sales Log';
      case 'stock': return 'Stock Tracker';
      case 'brands': return 'Brand Manager';
      case 'categories': return 'Category Manager';
      default: return 'Dashboard';
    }
  };

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
      <main className="flex-1 flex flex-col overflow-hidden bg-dark-950/20">
        {/* Top Header Bar */}
        <header className="h-16 border-b border-dark-800/40 bg-dark-950/50 backdrop-blur-md flex items-center justify-between px-8 flex-shrink-0 no-print">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-1.5 rounded-lg hover:bg-dark-900 text-dark-400 hover:text-white md:hidden transition-all active:scale-95 cursor-pointer"
              title="Open Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-dark-900/60 border border-dark-800/50">
                {getTabIcon()}
              </div>
              <span className="text-sm font-bold text-white uppercase tracking-wider font-sans">
                {getTabLabel()}
              </span>
            </div>
          </div>

          {/* Quick Info Badges */}
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-dark-900/60 border border-dark-800/40 text-xs shadow-sm">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-dark-400 font-medium">Total Volume:</span>
              <strong className="text-white font-bold font-mono">${totalSales.toFixed(2)}</strong>
            </div>

            {lowStockCount > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-900/20 text-xs text-rose-300 shadow-sm">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                <span className="font-semibold">{lowStockCount} Low Stock Alerts</span>
              </div>
            )}

            <button 
              onClick={loadData}
              disabled={loading || syncing}
              className="p-2 rounded-xl hover:bg-dark-900 text-dark-400 hover:text-white border border-dark-800/40 hover:border-dark-700/60 bg-dark-900/20 transition-all active:scale-95 cursor-pointer"
              title="Sync Database"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin text-primary-400' : ''}`} />
            </button>
          </div>
        </header>

        {/* Dashboard Panels */}
        <div className="flex-1 overflow-y-auto p-8 scrollbar-thin animate-fade-slide">
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
