import { ShoppingBag, AlertTriangle, ArrowUpRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

/**
 * DashboardSidebarFeed — Recent sales and critical low-stock warning cards.
 */
export default function DashboardSidebarFeed({
  recentOrders,
  customerMap,
  lowStockWarnings,
  onNavigateTab,
}) {
  return (
    <div className="lg:col-span-4 space-y-6">
      {/* Recent Invoices Log */}
      <Card className="p-5 border-border space-y-4 shadow-xs">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-violet-400" />
            Recent Sales
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onNavigateTab('sales')}
            className="h-7 text-[11px] font-bold text-primary p-0 hover:bg-transparent hover:underline"
          >
            View all <ArrowUpRight className="w-3 h-3 ml-0.5" />
          </Button>
        </div>

        <div className="space-y-2.5">
          {recentOrders.map((order) => {
            const cust = customerMap[order.customer_id];
            return (
              <div key={order.id} className="p-3 bg-muted/30 border border-border rounded-lg flex items-center justify-between text-xs hover:border-border/80 transition-colors">
                <div className="space-y-0.5">
                  <strong className="text-foreground block truncate max-w-[130px]">
                    {cust ? cust.name : 'Unknown Customer'}
                  </strong>
                  <span className="text-[10px] text-muted-foreground font-medium">
                    {new Date(order.ordered_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </span>
                </div>
                <div className="text-right">
                  <strong className="text-foreground block font-mono">${Number(order.total_amount).toFixed(2)}</strong>
                  <Badge
                    variant={order.status === 'paid' ? 'success' : order.status === 'delivered' ? 'default' : 'warning'}
                    className="text-[9px] uppercase px-1.5 py-0 mt-0.5"
                  >
                    {order.status}
                  </Badge>
                </div>
              </div>
            );
          })}

          {recentOrders.length === 0 && (
            <div className="p-6 text-center text-muted-foreground italic text-xs">
              No sales logged.
            </div>
          )}
        </div>
      </Card>

      {/* Critical Low Stock Warnings list */}
      <Card className="p-5 border-border space-y-4 shadow-xs">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            Inventory Alerts
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onNavigateTab('stock')}
            className="h-7 text-[11px] font-bold text-rose-400 p-0 hover:bg-transparent hover:underline"
          >
            Stock Log <ArrowUpRight className="w-3 h-3 ml-0.5" />
          </Button>
        </div>

        <div className="space-y-2.5">
          {lowStockWarnings.map(({ sp, prod, sup }, idx) => (
            <div key={idx} className="p-3 bg-rose-500/5 border border-rose-500/15 rounded-lg flex items-center justify-between text-xs hover:bg-rose-500/10 transition-colors">
              <div className="space-y-0.5">
                <strong className="text-foreground block truncate max-w-[140px]">{prod.name_kh}</strong>
                <span className="text-[10px] text-muted-foreground block truncate max-w-[140px]">{prod.name_en}</span>
                <span className="text-[9px] text-muted-foreground/80 block leading-tight">Supplier: {sup.name}</span>
              </div>
              <div className="text-right flex-shrink-0">
                <Badge variant="destructive" className="font-mono text-xs px-2 py-0.5">
                  {sp.stock_qty} {sp.stock_unit}
                </Badge>
              </div>
            </div>
          ))}

          {lowStockWarnings.length === 0 && (
            <div className="p-6 text-center text-muted-foreground italic text-xs">
              All items adequately stocked.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

