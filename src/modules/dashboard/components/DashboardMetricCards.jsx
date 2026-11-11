import { TrendingUp, DollarSign, FileText, AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/card';

/**
 * DashboardMetricCards — 4 KPI summary tiles (Total Volume, Net Profit,
 * Total Orders, Stock Warnings).
 */
export default function DashboardMetricCards({
  totalSales,
  totalProfit,
  ordersCount,
  lowStockAlertCount,
}) {
  const cards = [
    {
      label: 'Total Volume',
      value: `$${totalSales.toFixed(2)}`,
      subtext: 'Cumulative sales revenue',
      subtextClass: 'text-emerald-600 dark:text-emerald-400',
      iconBg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500/20 text-emerald-600 dark:text-emerald-400',
      hoverBorder: 'hover:border-[#000080]/40',
      Icon: TrendingUp,
    },
    {
      label: 'Net Profit',
      value: `$${totalProfit.toFixed(2)}`,
      subtext: 'Estimated gross profit margin',
      subtextClass: 'text-[#000080] dark:text-blue-400',
      iconBg: 'bg-blue-50 dark:bg-blue-950/40 border-blue-500/20 text-[#000080] dark:text-blue-400',
      hoverBorder: 'hover:border-[#000080]/40',
      Icon: DollarSign,
    },
    {
      label: 'Total Orders',
      value: ordersCount,
      subtext: 'Invoices logged in database',
      subtextClass: 'text-muted-foreground',
      iconBg: 'bg-muted border-border text-foreground',
      hoverBorder: 'hover:border-[#000080]/40',
      Icon: FileText,
    },
    {
      label: 'Stock Warnings',
      value: lowStockAlertCount,
      subtext: 'Inventories ≤ 2 qty',
      subtextClass: 'text-amber-600 dark:text-amber-400',
      iconBg: 'bg-amber-50 dark:bg-amber-950/40 border-amber-500/20 text-amber-600 dark:text-amber-400',
      hoverBorder: 'hover:border-amber-500/40',
      Icon: AlertTriangle,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => {
        const { Icon } = card;
        return (
          <Card key={card.label} className={`p-4 border-border ${card.hoverBorder} transition-colors flex items-center gap-3.5 shadow-xs`}>
            <div className={`p-2.5 rounded-lg border ${card.iconBg}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block leading-tight">
                {card.label}
              </span>
              <span className="text-xl font-black text-foreground block mt-0.5 font-mono">{card.value}</span>
              <span className={`text-[10px] ${card.subtextClass} font-medium block leading-tight mt-0.5`}>
                {card.subtext}
              </span>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

