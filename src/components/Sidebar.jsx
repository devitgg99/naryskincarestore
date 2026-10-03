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
    <aside className={`fixed inset-y-0 left-0 z-50 w-64 border-r border-border bg-card text-card-foreground flex flex-col h-screen transition-transform duration-200 md:relative md:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} no-print`}>
      {/* Title */}
      <div className="p-5 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#000080] flex items-center justify-center font-black text-white shadow-xs text-sm tracking-tight">
            WP
          </div>
          <div>
            <h1 className="font-extrabold text-sm tracking-wider text-foreground leading-tight font-sans">WHOLESALE</h1>
            <p className="text-[9px] font-bold text-[#000080] dark:text-blue-400 tracking-widest uppercase font-sans">Portal System</p>
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-[#000080]" />}
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
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-thin">
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
          className="w-full justify-between h-8.5 px-2.5 mb-3 bg-muted/40 hover:bg-muted border-border text-muted-foreground hover:text-foreground font-normal rounded-md"
        >
          <div className="flex items-center gap-2">
            <Keyboard className="w-3.5 h-3.5" />
            <span className="text-xs">Command Menu</span>
          </div>
          <Badge variant="outline" className="text-[9px] font-mono px-1.5 py-0 h-4 bg-background border-border">
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
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm cursor-pointer ${
                isActive
                  ? 'bg-[#000080] text-white font-medium shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted font-medium'
              }`}
            >
              <Icon className={`w-4 h-4 transition-colors ${isActive ? 'text-white' : 'text-muted-foreground'}`} />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Database Status Block */}
      <div className="p-3 border-t border-border space-y-2 bg-muted/20">
        <div 
          onClick={onOpenSettings}
          className="w-full flex items-center justify-between p-2.5 rounded-lg bg-card border border-border hover:border-[#000080]/60 transition-colors cursor-pointer group shadow-xs"
        >
          <div className="flex items-center gap-2.5">
            <Database className={`w-3.5 h-3.5 ${isSupabase ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400 animate-pulse'}`} />
            <div className="text-left">
              <span className="text-[9px] font-semibold text-muted-foreground block leading-none uppercase tracking-wider mb-0.5">DB STATUS</span>
              <span className="text-xs font-bold text-foreground block">
                {isSupabase ? 'Supabase Live' : 'Offline Mock'}
              </span>
            </div>
          </div>
          <Badge variant={isSupabase ? "success" : "secondary"} className="text-[9px] px-1.5 py-0">
            {isSupabase ? 'Connected' : 'Local'}
          </Badge>
        </div>

        {/* Local Reset */}
        {!isSupabase && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleResetMock}
            className="w-full h-7 text-xs border-dashed text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className="w-3 h-3 mr-1.5" />
            Reset Local DB
          </Button>
        )}

        <div className="flex gap-1.5 text-[9px] text-muted-foreground px-1 leading-tight">
          <Info className="w-3 h-3 flex-shrink-0 mt-0.5" />
          <span>Click status panel to config Supabase credentials.</span>
        </div>
      </div>
    </aside>
  );
}
