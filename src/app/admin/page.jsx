"use client";

import { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import SupabaseSettingsModal from '../../components/SupabaseSettingsModal';
import PricingTable from '../../modules/PricingTable';
import CustomerDirectory from '../../modules/CustomerDirectory';
import InvoiceBuilder from '../../modules/InvoiceBuilder';
import SalesLog from '../../modules/SalesLog';
import StockTracker from '../../modules/StockTracker';
import BrandManager from '../../modules/BrandManager';
import CategoryManager from '../../modules/CategoryManager';
import { db } from '../../services/db';
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
  ShieldAlert,
  Lock,
  ArrowLeft,
  ChevronRight
} from 'lucide-react';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('pricing');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [theme, setTheme] = useState('dark');

  // Admin access gate states
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminLoginError, setAdminLoginError] = useState('');
  const [adminSubmitting, setAdminSubmitting] = useState(false);

  // Config triggers state reload
  const [configVersion, setConfigVersion] = useState(0);

  // Global state
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [prices, setPrices] = useState([]);
  const [orders, setOrders] = useState([]);
  const [orderItems, setOrderItems] = useState([]);
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);

  // Check admin status on mount/config change
  useEffect(() => {
    const checkAdminStatus = async () => {
      setCheckingAdmin(true);
      try {
        const session = await db.getCurrentCustomer();
        if (session && session.user) {
          const email = session.user.email;
          const adminEmailsStr = process.env.NEXT_PUBLIC_ADMIN_EMAILS || 'admin@naryskincare.com,devitgg99@gmail.com';
          const adminEmails = adminEmailsStr.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
          
          if (adminEmails.includes(email.toLowerCase())) {
            setIsAdminLoggedIn(true);
            await loadData();
          } else {
            setIsAdminLoggedIn(false);
          }
        } else {
          setIsAdminLoggedIn(false);
        }
      } catch (err) {
        console.error('Error checking admin status:', err);
      } finally {
        setCheckingAdmin(false);
      }
    };
    checkAdminStatus();
  }, [configVersion]);

  // Handle Theme
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('wsp_theme') || 'dark';
      setTheme(savedTheme);
    }
  }, []);

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

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setAdminLoginError('');
    setAdminSubmitting(true);

    try {
      const session = await db.signInCustomer(adminEmail, adminPassword);
      const email = session.user.email;
      const adminEmailsStr = process.env.NEXT_PUBLIC_ADMIN_EMAILS || 'admin@naryskincare.com,devitgg99@gmail.com';
      const adminEmails = adminEmailsStr.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

      if (adminEmails.includes(email.toLowerCase())) {
        setIsAdminLoggedIn(true);
        await loadData();
      } else {
        await db.signOutCustomer();
        throw new Error('Access Denied: You are not authorized as an admin.');
      }
    } catch (err) {
      setAdminLoginError(err.message || 'Login failed');
    } finally {
      setAdminSubmitting(false);
    }
  };

  const handleConfigChange = () => {
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

  // Loading Screen while verifying session
  if (checkingAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-dark-950 gap-4 text-dark-400">
        <RefreshCw className="w-8 h-8 animate-spin text-primary-400" />
        <span className="text-xs font-bold tracking-widest uppercase text-dark-300">Verifying administrative access...</span>
      </div>
    );
  }

  // Access Gate Card (If not Admin)
  if (!isAdminLoggedIn) {
    return (
      <div className="min-h-screen bg-dark-950 text-dark-100 flex items-center justify-center p-6 relative font-sans w-full">
        {/* Decorative background gradients */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl" />

        <div className="w-full max-w-md glass-panel border border-dark-800/60 rounded-3xl p-8 relative overflow-hidden bg-dark-900/30 shadow-2xl">
          <div className="text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-rose-600 to-amber-500 flex items-center justify-center mx-auto shadow-lg shadow-rose-500/20">
              <ShieldAlert className="w-6 h-6 text-white" />
            </div>
            
            <div>
              <h1 className="font-extrabold text-xl tracking-wider text-white uppercase leading-none">ADMIN ACCESS GATE</h1>
              <p className="text-xs text-dark-400 mt-2">
                Authorized access only. Please enter your administrator credentials to manage inventories, prices, and orders.
              </p>
            </div>
          </div>

          <form onSubmit={handleAdminLogin} className="mt-8 space-y-4">
            {adminLoginError && (
              <div className="p-3 text-xs bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400">
                {adminLoginError}
              </div>
            )}

            <div>
              <label className="block text-[10px] font-bold text-dark-300 uppercase tracking-widest mb-2">Admin Email</label>
              <input 
                type="email"
                required
                placeholder="admin@naryskincare.com"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                className="glass-input w-full text-xs"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-dark-300 uppercase tracking-widest mb-2">Password</label>
              <input 
                type="password"
                required
                placeholder="••••••••"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                className="glass-input w-full text-xs"
              />
            </div>

            <button 
              type="submit"
              disabled={adminSubmitting}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 font-bold text-white text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-rose-500/10 active:scale-98 cursor-pointer mt-6"
            >
              {adminSubmitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Authenticating...
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  Unlock Dashboard
                </>
              )}
            </button>
          </form>

          <div className="border-t border-dark-850/80 mt-6 pt-4 text-center">
            <a 
              href="/"
              className="inline-flex items-center gap-1.5 text-[10px] font-bold text-dark-400 hover:text-white transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3 h-3" />
              Return to Customer Storefront
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Dashboard calculations
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
    <div className="flex h-screen overflow-hidden bg-dark-950 font-sans w-full">
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
