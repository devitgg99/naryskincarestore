import { 
  Table, 
  Users, 
  FileText, 
  ClipboardList, 
  Package, 
  Database,
  RefreshCw,
  Info,
  Sun,
  Moon,
  X,
  Tag,
  Layers
} from 'lucide-react';
import { getSupabaseConfig, db } from '../services/db';

export default function Sidebar({ activeTab, setActiveTab, onOpenSettings, onRefresh, theme, toggleTheme, isOpen, onClose }) {
  const config = getSupabaseConfig();
  const isSupabase = config.active && config.url && config.key;

  const menuItems = [
    { id: 'pricing', label: 'Pricing Table', icon: Table },
    { id: 'customers', label: 'Customer Directory', icon: Users },
    { id: 'invoice', label: 'Invoice Builder', icon: FileText },
    { id: 'sales', label: 'Sales Log', icon: ClipboardList },
    { id: 'stock', label: 'Stock Tracker', icon: Package },
    { id: 'brands', label: 'Brand Manager', icon: Tag },
    { id: 'categories', label: 'Category Manager', icon: Layers },
  ];

  const handleResetMock = () => {
    if (window.confirm("Are you sure you want to reset all Local Storage mock data? This will overwrite your custom changes with initial sample data.")) {
      db.resetMockData();
      if (onRefresh) onRefresh();
    }
  };

  return (
    <aside className={`fixed inset-y-0 left-0 z-50 w-64 border-r border-dark-800/40 bg-dark-950/80 backdrop-blur-2xl flex flex-col h-screen transition-transform duration-300 md:relative md:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} no-print`}>
      {/* Title */}
      <div className="p-6 flex items-center justify-between border-b border-dark-800/40">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary-600 to-violet-500 flex items-center justify-center font-bold text-white shadow-lg shadow-primary-500/25 text-lg animate-float">
            WP
          </div>
          <div>
            <h1 className="font-extrabold text-base tracking-wide text-white leading-tight font-sans">WHOLESALE</h1>
            <p className="text-[10px] font-semibold text-primary-400 tracking-widest uppercase font-sans">Portal System</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl hover:bg-dark-900 text-dark-400 hover:text-white border border-dark-800/40 transition-all active:scale-95 cursor-pointer"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-violet-400" />}
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-dark-900 text-dark-400 hover:text-white md:hidden transition-all active:scale-95 cursor-pointer"
            title="Close Menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Nav List */}
      <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto scrollbar-thin">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                if (onClose) onClose();
              }}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all duration-200 text-sm font-medium cursor-pointer ${
                isActive
                  ? 'bg-primary-500/10 text-primary-400 border-l-2 border-primary-500 shadow-sm'
                  : 'text-dark-400 hover:text-white hover:bg-dark-900/40 hover:translate-x-1'
              }`}
            >
              <Icon className={`w-4.5 h-4.5 ${isActive ? 'text-primary-400' : 'text-dark-500 group-hover:text-dark-300'}`} />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Database Status Block */}
      <div className="p-4 border-t border-dark-800/40 space-y-3 bg-dark-950/20">
        <div 
          onClick={onOpenSettings}
          className="w-full flex items-center justify-between p-3.5 rounded-xl bg-dark-900/40 border border-dark-800/60 hover:bg-dark-900/80 hover:border-primary-500/20 transition-all cursor-pointer group"
        >
          <div className="flex items-center gap-3">
            <Database className={`w-4 h-4 ${isSupabase ? 'text-emerald-400' : 'text-amber-400 animate-pulse'}`} />
            <div className="text-left">
              <span className="text-[10px] font-semibold text-dark-500 block leading-none uppercase tracking-wider mb-0.5">DB STATUS</span>
              <span className="text-xs font-bold text-white block">
                {isSupabase ? 'Supabase Live' : 'Offline Mock'}
              </span>
            </div>
          </div>
          <div className={`w-2 h-2 rounded-full ${isSupabase ? 'bg-emerald-400 shadow-sm shadow-emerald-400' : 'bg-amber-400 shadow-sm shadow-amber-400'} animate-pulse`} />
        </div>

        {/* Local Reset */}
        {!isSupabase && (
          <button
            onClick={handleResetMock}
            className="w-full py-2.5 px-3 flex items-center justify-center gap-2 text-xs font-semibold text-dark-400 hover:text-white bg-dark-900/20 hover:bg-dark-900/60 border border-dashed border-dark-800 rounded-xl transition-all cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reset Local DB
          </button>
        )}

        <div className="flex gap-2 text-[10px] text-dark-500 px-1 leading-normal">
          <Info className="w-3.5 h-3.5 flex-shrink-0 text-dark-600 mt-0.5" />
          <span>Click status panel to config Supabase credentials.</span>
        </div>
      </div>
    </aside>
  );
}
