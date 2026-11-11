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
  LogOut,
  ShoppingBag,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const TAB_META = {
  dashboard: { label: 'Dashboard', Icon: LayoutDashboard },
  pricing: { label: 'Pricing Catalog', Icon: Table },
  customers: { label: 'Customer Directory', Icon: Users },
  invoice: { label: 'Invoice Builder', Icon: FileText },
  sales: { label: 'Sales Log', Icon: ClipboardList },
  stock: { label: 'Stock Tracker', Icon: Package },
  brands: { label: 'Brand Manager', Icon: Tag },
  categories: { label: 'Category Manager', Icon: Layers },
  catalog: { label: 'User Catalog Preview', Icon: ShoppingBag },
};

/**
 * TopHeaderBar — Persistent admin top navigation header with active module indicator,
 * sales/stock badges, manual database sync trigger, user badge, and sign-out action.
 */
export default function TopHeaderBar({
  activeTab,
  totalSales,
  lowStockCount,
  loading,
  syncing,
  currentUser,
  onOpenSidebar,
  onRefresh,
  onLogout,
}) {
  const { label, Icon: TabIcon } = TAB_META[activeTab] || TAB_META.dashboard;

  return (
    <header className="h-14 border-b border-border bg-card flex items-center justify-between px-6 flex-shrink-0 no-print">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onOpenSidebar}
          className="md:hidden h-8 w-8"
          title="Open Menu"
        >
          <Menu className="w-4 h-4" />
        </Button>
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-md bg-muted border border-border text-[#000080] dark:text-blue-400">
            <TabIcon className="w-4.5 h-4.5 text-primary-400" />
          </div>
          <span className="text-xs font-bold text-foreground uppercase tracking-wider font-sans">
            {label}
          </span>
        </div>
      </div>

      {/* Quick Info Badges & User Controls */}
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
          onClick={onRefresh}
          disabled={loading || syncing}
          className="h-8.5 w-8.5 bg-card border-border"
          title="Sync Database"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin text-[#000080]' : ''}`} />
        </Button>

        {/* Admin Profile & Logout */}
        <div className="hidden lg:flex items-center gap-2 pl-2 border-l border-border">
          <div className="w-6 h-6 rounded-md bg-[#000080] text-white flex items-center justify-center font-bold text-xs">
            {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'A'}
          </div>
          <div className="text-left leading-none">
            <span className="text-xs font-bold text-foreground block max-w-[100px] truncate">{currentUser?.name}</span>
            <span className="text-[9px] font-bold text-[#000080] dark:text-blue-400 uppercase tracking-wider">Admin</span>
          </div>
        </div>

        <Button
          variant="outline"
          size="icon"
          onClick={onLogout}
          className="h-8.5 w-8.5 bg-card border-border hover:text-destructive hover:border-destructive/40"
          title="Sign Out"
        >
          <LogOut className="w-3.5 h-3.5" />
        </Button>
      </div>
    </header>
  );
}

