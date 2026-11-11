import { Receipt, Clock, CheckCircle2, TrendingUp } from 'lucide-react';
import { Card } from '@/components/ui/card';
import {
  PERIOD_MODES,
  STATUS_FILTERS,
  getOrderTotalProfit,
  isOrderPaid,
} from '../salesUtils';

const formatSignedMoney = (value) => {
  const num = Number(value || 0);
  const abs = Math.abs(num).toFixed(2);
  return num < 0 ? `-$${abs}` : `+$${abs}`;
};

/**
 * SalesSummaryBar — Quick overview cards for the active date filter:
 * Total Receipts, Unpaid, Paid, and Estimated Profit.
 */
export default function SalesSummaryBar({
  periodOrders = [],
  filteredOrders = [],
  allUnpaidOrders = [],
  getOrderItems,
  getItemCost,
  statusFilter,
  onSelectStatusFilter,
  periodMode,
  periodLabel,
  onViewAllUnpaid,
}) {
  const unpaidOrders = periodOrders.filter((o) => !isOrderPaid(o));
  const paidOrders = periodOrders.filter((o) => isOrderPaid(o));

  const sumAmount = (list) => list.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
  const sumProfit = (list) =>
    list.reduce((sum, o) => {
      const items = typeof getOrderItems === 'function' ? getOrderItems(o) : [];
      return sum + getOrderTotalProfit(items, getItemCost);
    }, 0);

  const totalAmount = sumAmount(periodOrders);
  const unpaidAmount = sumAmount(unpaidOrders);
  const paidAmount = sumAmount(paidOrders);
  const allUnpaidAmount = sumAmount(allUnpaidOrders);

  const activeProfit = sumProfit(filteredOrders);
  const activeRevenue = sumAmount(filteredOrders);
  const paidProfit = sumProfit(paidOrders);
  const unpaidProfit = sumProfit(unpaidOrders);
  const marginPct = activeRevenue > 0 ? (activeProfit / activeRevenue) * 100 : 0;

  const showAllUnpaidHint =
    periodMode !== PERIOD_MODES.ALL && allUnpaidOrders.length > unpaidOrders.length;

  const profitScopeLabel =
    statusFilter === STATUS_FILTERS.PAID
      ? 'Paid'
      : statusFilter === STATUS_FILTERS.UNPAID
      ? 'Unpaid'
      : periodLabel;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <Card
        role="button"
        tabIndex={0}
        onClick={() => onSelectStatusFilter(STATUS_FILTERS.ALL)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelectStatusFilter(STATUS_FILTERS.ALL);
          }
        }}
        className={`p-4 cursor-pointer transition-all border shadow-2xs ${
          statusFilter === STATUS_FILTERS.ALL
            ? 'border-primary ring-1 ring-primary/30 bg-primary/5'
            : 'border-border bg-card/70 hover:border-primary/40'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Receipts ({periodLabel})
          </span>
          <Receipt className="w-4 h-4 text-primary" />
        </div>
        <div className="mt-2 flex items-baseline justify-between gap-2">
          <span className="text-2xl font-extrabold text-foreground">{periodOrders.length}</span>
          <span className="text-sm font-bold font-mono text-foreground">${totalAmount.toFixed(2)}</span>
        </div>
      </Card>

      <Card
        role="button"
        tabIndex={0}
        onClick={() => onSelectStatusFilter(STATUS_FILTERS.UNPAID)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelectStatusFilter(STATUS_FILTERS.UNPAID);
          }
        }}
        className={`p-4 cursor-pointer transition-all border shadow-2xs ${
          statusFilter === STATUS_FILTERS.UNPAID
            ? 'border-amber-500 ring-1 ring-amber-500/30 bg-amber-500/10'
            : 'border-border bg-card/70 hover:border-amber-500/50'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
            Unpaid ({periodLabel})
          </span>
          <Clock className="w-4 h-4 text-amber-500" />
        </div>
        <div className="mt-2 flex items-baseline justify-between gap-2">
          <span className="text-2xl font-extrabold text-amber-600 dark:text-amber-400">{unpaidOrders.length}</span>
          <span className="text-sm font-bold font-mono text-amber-600 dark:text-amber-400">${unpaidAmount.toFixed(2)}</span>
        </div>
        {showAllUnpaidHint && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onViewAllUnpaid();
            }}
            className="mt-2 text-[11px] font-semibold text-amber-700 dark:text-amber-300 underline underline-offset-2 hover:opacity-80 cursor-pointer text-left"
          >
            View all {allUnpaidOrders.length} unpaid (${allUnpaidAmount.toFixed(2)}) across all dates →
          </button>
        )}
      </Card>

      <Card
        role="button"
        tabIndex={0}
        onClick={() => onSelectStatusFilter(STATUS_FILTERS.PAID)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelectStatusFilter(STATUS_FILTERS.PAID);
          }
        }}
        className={`p-4 cursor-pointer transition-all border shadow-2xs ${
          statusFilter === STATUS_FILTERS.PAID
            ? 'border-emerald-500 ring-1 ring-emerald-500/30 bg-emerald-500/10'
            : 'border-border bg-card/70 hover:border-emerald-500/50'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Paid ({periodLabel})
          </span>
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
        </div>
        <div className="mt-2 flex items-baseline justify-between gap-2">
          <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">{paidOrders.length}</span>
          <span className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400">${paidAmount.toFixed(2)}</span>
        </div>
      </Card>

      <Card className="p-4 border border-emerald-500/30 bg-emerald-500/[0.04] shadow-2xs flex flex-col justify-between">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 truncate">
            Profit ({profitScopeLabel})
          </span>
          <TrendingUp className="w-4 h-4 text-emerald-500 shrink-0" />
        </div>
        <div className="mt-2 flex items-baseline justify-between gap-2">
          <span
            className={`text-2xl font-extrabold font-mono ${
              activeProfit < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
            }`}
          >
            {formatSignedMoney(activeProfit)}
          </span>
          {activeRevenue > 0 && (
            <span className="text-[11px] font-semibold font-mono text-muted-foreground">
              {marginPct.toFixed(1)}% margin
            </span>
          )}
        </div>
        <div className="mt-1.5 text-[11px] text-muted-foreground font-mono flex items-center justify-between gap-2">
          <span>Paid: {formatSignedMoney(paidProfit)}</span>
          <span>Unpaid: {formatSignedMoney(unpaidProfit)}</span>
        </div>
      </Card>
    </div>
  );
}
