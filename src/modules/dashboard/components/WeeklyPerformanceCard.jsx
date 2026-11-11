import { TrendingUp, Plus, Package, Users, AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

/**
 * WeeklyPerformanceCard — 7-day revenue vs net-profit bar chart and quick
 * action shortcuts.
 */
export default function WeeklyPerformanceCard({
  last7DaysData,
  maxChartValue,
  onNavigateTab,
  onQuickAddProduct,
  onQuickAddCustomer,
}) {
  return (
    <div className="lg:col-span-8 space-y-6">
      {/* Trend Chart Card */}
      <Card className="p-5 border-border space-y-5 shadow-xs">
        <div className="flex justify-between items-center">
          <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#000080] dark:text-blue-400" />
            Weekly Performance Trend
          </h3>
          <div className="flex gap-4 text-[10px] font-bold text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-[#000080] rounded-xs" /> Revenue</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-emerald-600 dark:bg-emerald-500 rounded-xs" /> Net Profit</span>
          </div>
        </div>

        <div className="h-64 flex items-end justify-between gap-3 sm:gap-6 border-b border-border pb-2 pt-6">
          {last7DaysData.map((d, index) => {
            const revHeightPercent = Math.max(4, (d.revenue / maxChartValue) * 100);
            const profHeightPercent = Math.max(4, (d.profit / maxChartValue) * 100);

            return (
              <div key={index} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                <div className="absolute bottom-full mb-2 bg-popover border border-border text-[10px] font-bold rounded-md p-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 w-24 text-center shadow-md space-y-0.5">
                  <span className="block text-foreground">Rev: ${d.revenue.toFixed(1)}</span>
                  <span className="block text-emerald-600 dark:text-emerald-400">Prof: ${d.profit.toFixed(1)}</span>
                </div>

                <div className="w-full flex items-end justify-center gap-1.5 h-full max-h-[220px]">
                  <div
                    style={{ height: `${revHeightPercent}%` }}
                    className="w-1/2 rounded-t bg-[#000080] shadow-xs group-hover:bg-[#000066] transition-colors"
                  />
                  <div
                    style={{ height: `${profHeightPercent}%` }}
                    className="w-1/2 rounded-t bg-emerald-600 dark:bg-emerald-500 shadow-xs group-hover:bg-emerald-700 transition-colors"
                  />
                </div>

                <span className="text-[10px] font-semibold text-muted-foreground mt-2 block group-hover:text-foreground transition-colors">
                  {d.label}
                </span>
              </div>
            );
          })}
        </div>

        <div className="flex justify-between items-center text-[10px] text-muted-foreground font-medium px-1">
          <span>Last 7 days performance metrics summary</span>
          <span>Max volume scale: ${maxChartValue.toFixed(0)}</span>
        </div>
      </Card>

      {/* Quick Actions Panel */}
      <Card className="p-5 border-border space-y-3 shadow-xs">
        <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Quick Actions Shortcuts</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Button
            variant="outline"
            onClick={() => onNavigateTab('invoice')}
            className="h-auto p-3.5 flex flex-col items-center justify-center gap-2 text-center cursor-pointer group hover:border-[#000080]/50 bg-card rounded-lg"
          >
            <div className="p-2 bg-muted text-[#000080] dark:text-blue-400 rounded-md group-hover:bg-[#000080] group-hover:text-white transition-colors">
              <Plus className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold text-foreground block">Create Invoice</span>
          </Button>

          <Button
            variant="outline"
            onClick={onQuickAddProduct}
            className="h-auto p-3.5 flex flex-col items-center justify-center gap-2 text-center cursor-pointer group hover:border-[#000080]/50 bg-card rounded-lg"
          >
            <div className="p-2 bg-muted text-[#000080] dark:text-blue-400 rounded-md group-hover:bg-[#000080] group-hover:text-white transition-colors">
              <Package className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold text-foreground block">Add Product</span>
          </Button>

          <Button
            variant="outline"
            onClick={onQuickAddCustomer}
            className="h-auto p-3.5 flex flex-col items-center justify-center gap-2 text-center cursor-pointer group hover:border-[#000080]/50 bg-card rounded-lg"
          >
            <div className="p-2 bg-muted text-[#000080] dark:text-blue-400 rounded-md group-hover:bg-[#000080] group-hover:text-white transition-colors">
              <Users className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold text-foreground block">Add Customer</span>
          </Button>

          <Button
            variant="outline"
            onClick={() => onNavigateTab('stock')}
            className="h-auto p-3.5 flex flex-col items-center justify-center gap-2 text-center cursor-pointer group hover:border-amber-500/50 bg-card rounded-lg"
          >
            <div className="p-2 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-md group-hover:bg-amber-500 group-hover:text-white transition-colors">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold text-foreground block">Stock Alerts</span>
          </Button>
        </div>
      </Card>
    </div>
  );
}

