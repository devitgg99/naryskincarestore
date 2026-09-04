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
  Layers,
  LayoutDashboard,
  Keyboard
} from 'lucide-react';
import { getSupabaseConfig, db } from '../services/db';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function Sidebar({ activeTab, setActiveTab, onOpenSettings, onRefresh, theme, toggleTheme, isOpen, onClose }) {
  const config = getSupabaseConfig();
  const isSupabase = config.active && config.url && config.key;

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'pricing', label: 'Pricing Catalog', icon: Table },
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
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-violet-400" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 text-muted-foreground hover:text-foreground md:hidden"
            title="Close Menu"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Nav List */}
      <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto scrollbar-thin">
        {/* Command Palette Trigger Button */}
        <Button
          variant="outline"
          onClick={() => {
            const event = new KeyboardEvent('keydown', {
              key: 'k',
              metaKey: true,
              ctrlKey: true,
              bubbles: true
            });
            window.dispatchEvent(event);
          }}
          className="w-full justify-between h-9 px-3 mb-4 bg-muted/30 hover:bg-muted/60 border-border text-muted-foreground hover:text-foreground font-normal"
        >
          <div className="flex items-center gap-2">
            <Keyboard className="w-3.5 h-3.5" />
            <span className="text-xs">Command Menu</span>
          </div>
          <Badge variant="outline" className="text-[9px] font-mono px-1.5 py-0 h-4 bg-background">
            ⌘K
          </Badge>
        </Button>

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
              className={`w-full flex items-center gap-3.5 px-4 py-2.5 rounded-lg transition-all duration-150 text-sm font-medium cursor-pointer ${
                isActive
                  ? 'bg-primary/10 text-primary border-l-2 border-primary font-semibold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent hover:translate-x-0.5'
              }`}
            >
              <Icon className={`w-4.5 h-4.5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Database Status Block */}
      <div className="p-4 border-t border-border space-y-3 bg-card/20">
        <div 
          onClick={onOpenSettings}
          className="w-full flex items-center justify-between p-3 rounded-lg bg-card border border-border hover:border-primary/40 transition-all cursor-pointer group shadow-xs"
        >
          <div className="flex items-center gap-3">
            <Database className={`w-4 h-4 ${isSupabase ? 'text-emerald-400' : 'text-amber-400 animate-pulse'}`} />
            <div className="text-left">
              <span className="text-[10px] font-semibold text-muted-foreground block leading-none uppercase tracking-wider mb-0.5">DB STATUS</span>
              <span className="text-xs font-bold text-foreground block">
                {isSupabase ? 'Supabase Live' : 'Offline Mock'}
              </span>
            </div>
          </div>
          <Badge variant={isSupabase ? "success" : "warning"} className="text-[10px] px-1.5 py-0">
            {isSupabase ? 'Connected' : 'Local'}
          </Badge>
        </div>

        {/* Local Reset */}
        {!isSupabase && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleResetMock}
            className="w-full h-8 text-xs border-dashed text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className="w-3 h-3 mr-1.5" />
            Reset Local DB
          </Button>
        )}

        <div className="flex gap-2 text-[10px] text-muted-foreground px-1 leading-normal">
          <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>Click status panel to config Supabase credentials.</span>
        </div>
      </div>
    </aside>
  );
}
