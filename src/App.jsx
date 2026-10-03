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
import Dashboard from './modules/Dashboard';
import CommandPalette from './components/CommandPalette';
import { db } from './services/db';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  Layers,
  CheckCircle,
  AlertCircle,
  Info
} from 'lucide-react';

const VALID_TABS = ['dashboard', 'pricing', 'customers', 'invoice', 'sales', 'stock', 'brands', 'categories'];

const getInitialTab = () => {
  const hash = window.location.hash.replace(/^#\/?/, '');
  if (VALID_TABS.includes(hash)) {
    return hash;
  }
  const savedTab = localStorage.getItem('wsp_activeTab');
  if (VALID_TABS.includes(savedTab)) {
    return savedTab;
  }
  return 'dashboard';
};

export default function App() {
  const [activeTab, setActiveTab] = useState(getInitialTab);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('wsp_theme') || 'light');
  const [toasts, setToasts] = useState([]);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('wsp_activeTab', activeTab);
    const currentHash = window.location.hash.replace(/^#\/?/, '');
    if (currentHash !== activeTab) {
      window.history.replaceState(null, '', `#${activeTab}`);
    }
  }, [activeTab]);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace(/^#\/?/, '');
      if (VALID_TABS.includes(hash)) {
        setActiveTab(hash);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const showToast = (message, type = 'info') => {
    const id = Date.now().toString() + Math.random().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Toggle Command Palette with Cmd+K or Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }
      
      // Alt shortcuts for navigation
      if (e.altKey) {
        switch (e.key.toLowerCase()) {
          case 'd':
            e.preventDefault();
            setActiveTab('dashboard');
            break;
          case 'p':
            e.preventDefault();
            setActiveTab('pricing');
            break;
          case 'c':
            e.preventDefault();
            setActiveTab('customers');
            break;
          case 'i':
            e.preventDefault();
            setActiveTab('invoice');
            break;
          case 's':
            e.preventDefault();
            setActiveTab('sales');
            break;
          case 't':
            e.preventDefault();
            setActiveTab('stock');
            break;
          default:
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
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

      // Consolidate orderItems: items from getOrderItems() PLUS any embedded order_items in ords
      const combinedMap = new Map();
      (items || []).forEach(item => {
        const key = item.id || `${item.order_id}_${item.product_id || item.custom_name}_${item.quantity}`;
        combinedMap.set(key, item);
      });
      (ords || []).forEach(order => {
        const embedded = order.order_items || order.items || order.line_items;
        if (Array.isArray(embedded)) {
          embedded.forEach((item, idx) => {
            const key = item.id || `${order.id}_${item.product_id || item.custom_name || idx}_${item.quantity}`;
            if (!combinedMap.has(key)) {
              combinedMap.set(key, { ...item, order_id: item.order_id || order.id });
            }
          });
        }
      });
      setOrderItems(Array.from(combinedMap.values()));

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
      case 'dashboard':
        return (
          <Dashboard 
            products={products}
            suppliers={suppliers}
            customers={customers}
            prices={prices}
            orders={orders}
            orderItems={orderItems}
            brands={brands}
            categories={categories}
            setActiveTab={setActiveTab}
            showToast={showToast}
            onRefresh={loadData}
          />
        );
      case 'pricing':
        return (
          <PricingTable 
            products={products}
            suppliers={suppliers}
            prices={prices}
            brands={brands}
            categories={categories}
            onRefresh={loadData}
            showToast={showToast}
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
            showToast={showToast}
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
            showToast={showToast}
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
            showToast={showToast}
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
            showToast={showToast}
          />
        );
      case 'brands':
        return (
          <BrandManager 
            brands={brands}
            categories={categories}
            products={products}
            onRefresh={loadData}
            showToast={showToast}
          />
        );
      case 'categories':
        return (
          <CategoryManager 
            categories={categories}
            brands={brands}
            products={products}
            onRefresh={loadData}
            showToast={showToast}
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
    <div className="flex h-screen overflow-hidden bg-background text-foreground font-sans">
      {/* Sidebar Backdrop Overlay on Mobile */}
      {isSidebarOpen && (
        <div 
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 md:hidden"
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
      <main className="flex-1 flex flex-col overflow-hidden bg-background">
        {/* Top Header Bar */}
        <header className="h-14 border-b border-border bg-card flex items-center justify-between px-6 flex-shrink-0 no-print">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden h-8 w-8"
              title="Open Menu"
            >
              <Menu className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-md bg-muted border border-border text-[#000080] dark:text-blue-400">
                {getTabIcon()}
              </div>
              <span className="text-xs font-bold text-foreground uppercase tracking-wider font-sans">
                {getTabLabel()}
              </span>
            </div>
          </div>

          {/* Quick Info Badges */}
          <div className="flex items-center gap-2.5">
            <Badge variant="outline" className="hidden md:flex items-center gap-2 py-1 px-3 bg-card font-normal border-border">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="text-muted-foreground font-medium text-xs">Total Volume:</span>
              <strong className="text-foreground font-bold font-mono text-xs">${totalSales.toFixed(2)}</strong>
            </Badge>

            {lowStockCount > 0 && (
              <Badge variant="destructive" className="flex items-center gap-1.5 py-1 px-2.5 text-xs">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span className="font-semibold">{lowStockCount} Low Stock</span>
              </Badge>
            )}

            <Button 
              variant="outline"
              size="icon"
              onClick={loadData}
              disabled={loading || syncing}
              className="h-8.5 w-8.5 bg-card border-border"
              title="Sync Database"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin text-[#000080]' : ''}`} />
            </Button>
          </div>
        </header>

        {/* Dashboard Panels */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin animate-fade-slide">
          {renderTabContent()}
        </div>
      </main>

      {/* Settings Modal */}
      <SupabaseSettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onConfigChange={handleConfigChange}
      />

      {/* Floating Toast Notifications Banner */}
      <div className="fixed bottom-5 right-5 z-[200] flex flex-col gap-2 max-w-sm pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`p-3.5 rounded-lg shadow-md flex items-center gap-3 border text-xs font-semibold pointer-events-auto animate-in slide-in-from-bottom-3 fade-in duration-200 ${
              t.type === 'success'
                ? 'bg-card text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                : t.type === 'error'
                ? 'bg-card text-rose-700 dark:text-rose-300 border-rose-500/30'
                : t.type === 'warning'
                ? 'bg-card text-amber-700 dark:text-amber-300 border-amber-500/30'
                : 'bg-card text-foreground border-border'
            }`}
          >
            {t.type === 'success' && <CheckCircle className="w-4 h-4 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />}
            {t.type === 'error' && <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600 dark:text-rose-400" />}
            {t.type === 'warning' && <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-600 dark:text-amber-400" />}
            {t.type === 'info' && <Info className="w-4 h-4 flex-shrink-0 text-[#000080] dark:text-blue-400" />}
            <span>{t.message}</span>
          </div>
        ))}
      </div>

      {/* Global Command Palette search overlay */}
      {isCommandPaletteOpen && (
        <CommandPalette
          onClose={() => setIsCommandPaletteOpen(false)}
          setActiveTab={setActiveTab}
          products={products}
          customers={customers}
          onRefresh={loadData}
          showToast={showToast}
        />
      )}
    </div>
  );
}
