import { useState, useEffect, useCallback, useMemo } from 'react';
import { RefreshCw, Eye } from 'lucide-react';
import Sidebar from './components/Sidebar';
import SupabaseSettingsModal from './components/SupabaseSettingsModal';
import AuthScreen from './components/AuthScreen';
import CommandPalette from './components/CommandPalette';
import ToastContainer from './components/ToastContainer';
import TopHeaderBar from './components/TopHeaderBar';
import PricingTable from './modules/PricingTable';
import CustomerDirectory from './modules/CustomerDirectory';
import InvoiceBuilder from './modules/InvoiceBuilder';
import SalesLog from './modules/SalesLog';
import StockTracker from './modules/StockTracker';
import BrandManager from './modules/BrandManager';
import CategoryManager from './modules/CategoryManager';
import Dashboard from './modules/Dashboard';
import UserProductCatalog from './modules/UserProductCatalog';
import { auth } from './services/auth';
import { initTelegramMiniApp, isTelegramMiniApp, getTelegramUser } from './services/telegram';
import { usePortalData } from './hooks/usePortalData';
import { Button } from '@/components/ui/button';

const VALID_TABS = ['dashboard', 'pricing', 'customers', 'invoice', 'sales', 'stock', 'brands', 'categories', 'catalog'];

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
  const [currentUser, setCurrentUser] = useState(() => auth.getCurrentUser());
  const [activeTab, setActiveTab] = useState(getInitialTab);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('wsp_theme') || 'light');
  const [toasts, setToasts] = useState([]);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  const {
    products,
    suppliers,
    customers,
    prices,
    orders,
    orderItems,
    brands,
    categories,
    loading,
    syncing,
    loadData,
    refreshPricingData,
    triggerReload,
  } = usePortalData();

  const showToast = useCallback((message, type = 'info') => {
    const id = Date.now().toString() + Math.random().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  // Sync auth state listener
  useEffect(() => {
    return auth.onAuthStateChange((user) => {
      setCurrentUser(user);
    });
  }, []);

  // Initialize Telegram Mini App integration
  useEffect(() => {
    if (!isTelegramMiniApp()) return;

    initTelegramMiniApp({
      onThemeChange: (tgTheme) => {
        setTheme(tgTheme);
      },
    });

    const tgUser = getTelegramUser();
    const existingUser = auth.getCurrentUser();
    if (tgUser && !existingUser) {
      auth.loginWithTelegram(tgUser).then((res) => {
        if (res.success) {
          setCurrentUser(res.user);
          showToast(`Welcome from Telegram, ${res.user.name}!`, 'success');
        }
      });
    }
  }, [showToast]);

  const handleLogout = useCallback(() => {
    auth.logout();
    setCurrentUser(null);
    showToast('You have been signed out successfully.', 'info');
  }, [showToast]);

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

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }

      if (e.altKey) {
        const shortcutMap = {
          d: 'dashboard',
          p: 'pricing',
          c: 'customers',
          i: 'invoice',
          s: 'sales',
          t: 'stock',
        };
        const targetTab = shortcutMap[e.key.toLowerCase()];
        if (targetTab) {
          e.preventDefault();
          setActiveTab(targetTab);
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

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const totalSales = useMemo(
    () => orders.reduce((sum, o) => sum + Number(o.total_amount), 0),
    [orders]
  );

  const lowStockCount = useMemo(
    () => prices.filter((sp) => sp.stock_qty <= 2 && sp.price > 0).length,
    [prices]
  );

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
            onRefresh={refreshPricingData}
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
            orders={orders}
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
      case 'catalog':
        return (
          <div className="space-y-4">
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                <Eye className="w-4 h-4" />
                <span>Admin Live Preview: This is the user product showcase with retail prices and images.</span>
              </div>
              <Button size="sm" variant="outline" onClick={() => setActiveTab('pricing')} className="h-7 text-xs border-emerald-500/30">
                Back to Pricing Catalog
              </Button>
            </div>
            <UserProductCatalog
              products={products}
              brands={brands}
              categories={categories}
              prices={prices}
              currentUser={currentUser}
              onLogout={handleLogout}
              theme={theme}
              toggleTheme={toggleTheme}
            />
          </div>
        );
      default:
        return <div>Module not found.</div>;
    }
  };

  // Security Gate 1: If not logged in, render AuthScreen
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-background text-foreground font-sans">
        <AuthScreen
          onLoginSuccess={(user) => {
            setCurrentUser(user);
            showToast(`Signed in as ${user.name} (${user.role === 'admin' ? 'Administrator' : 'Customer'})`, 'success');
          }}
          theme={theme}
          toggleTheme={toggleTheme}
        />
        <ToastContainer toasts={toasts} />
      </div>
    );
  }

  // Security Gate 2: If logged in as 'user', strictly render UserProductCatalog
  // (Zero access to administrative modules, supplier costs, or orders)
  if (currentUser.role === 'user') {
    return (
      <div className="min-h-screen bg-background text-foreground font-sans">
        <UserProductCatalog
          products={products}
          brands={brands}
          categories={categories}
          prices={prices}
          currentUser={currentUser}
          onLogout={handleLogout}
          theme={theme}
          toggleTheme={toggleTheme}
        />
        <ToastContainer toasts={toasts} />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground font-sans">
      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 md:hidden"
        />
      )}

      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onRefresh={loadData}
        theme={theme}
        toggleTheme={toggleTheme}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        currentUser={currentUser}
        onLogout={handleLogout}
        onPreviewCatalog={() => setActiveTab('catalog')}
      />

      <main className="flex-1 flex flex-col overflow-hidden bg-background">
        <TopHeaderBar
          activeTab={activeTab}
          totalSales={totalSales}
          lowStockCount={lowStockCount}
          loading={loading}
          syncing={syncing}
          currentUser={currentUser}
          onOpenSidebar={() => setIsSidebarOpen(true)}
          onRefresh={loadData}
          onLogout={handleLogout}
        />

        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin animate-fade-slide">
          {renderTabContent()}
        </div>
      </main>

      <SupabaseSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onConfigChange={triggerReload}
      />

      <ToastContainer toasts={toasts} />

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
