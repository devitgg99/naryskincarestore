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
  Tag
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
  ];

  const handleResetMock = () => {
    if (window.confirm("Are you sure you want to reset all Local Storage mock data? This will overwrite your custom changes with initial sample data.")) {
      db.resetMockData();
      if (onRefresh) onRefresh();
    }
  };

  return (
    <aside className={`fixed inset-y-0 left-0 z-50 w-64 border-r border-dark-800 bg-dark-950/95 backdrop-blur-xl flex flex-col h-screen transition-transform duration-300 md:relative md:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} no-print`}>
      {/* Title */}
      <div className="p-6 flex items-center justify-between border-b border-dark-800/80">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary-600 to-violet-500 flex items-center justify-center font-bold text-white shadow-lg shadow-primary-500/20 text-lg">
            WP
          </div>
          <div>
            <h1 className="font-extrabold text-base tracking-wide text-white leading-tight">WHOLESALE</h1>
            <p className="text-[10px] font-semibold text-primary-400 tracking-widest uppercase">Portal System</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-lg hover:bg-dark-900 text-dark-400 hover:text-white border border-transparent hover:border-dark-800 transition-all active:scale-95 cursor-pointer"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-violet-400" />}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-dark-900 text-dark-400 hover:text-white md:hidden transition-all active:scale-95 cursor-pointer"
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
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all duration-200 text-sm font-medium ${
                isActive
                  ? 'bg-primary-500/10 text-primary-400 border-l-4 border-primary-500 shadow-md shadow-primary-500/5'
                  : 'text-dark-400 hover:text-white hover:bg-dark-900/60'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-primary-400' : 'text-dark-500 group-hover:text-dark-300'}`} />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Database Status Block */}
      <div className="p-4 border-t border-dark-800/80 space-y-3">
        <div 
          onClick={onOpenSettings}
          className="w-full flex items-center justify-between p-3 rounded-xl bg-dark-900/50 border border-dark-850 hover:bg-dark-900 hover:border-dark-800 transition-all cursor-pointer group"
        >
          <div className="flex items-center gap-2.5">
            <Database className={`w-4 h-4 ${isSupabase ? 'text-emerald-400' : 'text-amber-400 animate-pulse'}`} />
            <div className="text-left">
              <span className="text-[11px] font-semibold text-dark-400 block leading-tight">DATABASE MODE</span>
              <span className="text-xs font-bold text-white block">
                {isSupabase ? 'Supabase Live' : 'Local Storage'}
              </span>
            </div>
          </div>
          <div className="w-2 h-2 rounded-full bg-emerald-500 ${isSupabase ? 'bg-emerald-500 shadow-sm shadow-emerald-400' : 'bg-amber-500 shadow-sm shadow-amber-400'}" />
        </div>

        {/* Local Reset */}
        {!isSupabase && (
          <button
            onClick={handleResetMock}
            className="w-full py-2 px-3 flex items-center justify-center gap-2 text-xs font-semibold text-dark-400 hover:text-white bg-dark-900/30 hover:bg-dark-900/70 border border-dashed border-dark-800 rounded-lg transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reset Mock Data
          </button>
        )}

        <div className="flex gap-2 text-[10px] text-dark-500 px-1">
          <Info className="w-3.5 h-3.5 flex-shrink-0 text-dark-600" />
          <span>Tap database pill to configure credentials and sync settings.</span>
        </div>
      </div>
    </aside>
  );
}
