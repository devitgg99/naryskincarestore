import { Search, Calendar, LayoutGrid, List, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { PERIOD_MODES, STATUS_FILTERS, getWeekDateRange } from '../salesUtils';

const PERIOD_OPTIONS = [
  { id: PERIOD_MODES.TODAY, label: 'Today' },
  { id: PERIOD_MODES.WEEK, label: 'Week' },
  { id: PERIOD_MODES.MONTH, label: 'Month' },
  { id: PERIOD_MODES.RANGE, label: 'Date Range' },
  { id: PERIOD_MODES.ALL, label: 'All Time' },
];

/**
 * SalesFilterBar — Period pills (Today / Week / Month / Date Range / All),
 * always-visible Date picker, Paid/Unpaid filter pills, search, and Cards/Table switch.
 */
export default function SalesFilterBar({
  searchTerm,
  onSearchTermChange,
  periodMode,
  onPeriodModeChange,
  dateFilter,
  onDateFilterChange,
  weekOffset,
  onWeekOffsetChange,
  monthFilter,
  onMonthFilterChange,
  onShiftMonth,
  rangeStart,
  rangeEnd,
  onRangeStartChange,
  onRangeEndChange,
  statusFilter,
  onStatusFilterChange,
  periodCounts,
  viewMode,
  onViewModeChange,
}) {
  const statusOptions = [
    {
      id: STATUS_FILTERS.ALL,
      label: `All (${periodCounts.all})`,
      activeClass: 'bg-[#000080] text-white border-[#000080] dark:bg-blue-600 dark:border-blue-600',
    },
    {
      id: STATUS_FILTERS.UNPAID,
      label: `Unpaid (${periodCounts.unpaid})`,
      activeClass: 'bg-amber-500 text-white border-amber-500 dark:bg-amber-600 dark:border-amber-600',
    },
    {
      id: STATUS_FILTERS.PAID,
      label: `Paid (${periodCounts.paid})`,
      activeClass: 'bg-emerald-600 text-white border-emerald-600',
    },
  ];

  const weekRange = getWeekDateRange(new Date(), weekOffset);
  const formatDay = (d) => d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  const weekRangeText = `${formatDay(weekRange.start)} – ${formatDay(weekRange.end)}`;

  return (
    <Card className="p-4 border-border bg-card/70 space-y-3 shadow-xs">
      {/* Row 1: Period Pills + Always-Visible Date Picker + View Switch */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {PERIOD_OPTIONS.map((opt) => {
            const active = periodMode === opt.id;
            return (
              <Button
                key={opt.id}
                type="button"
                variant={active ? 'default' : 'outline'}
                size="sm"
                onClick={() => onPeriodModeChange(opt.id)}
                className="h-8 px-3 text-xs font-semibold"
              >
                {opt.label}
              </Button>
            );
          })}

          {/* Always-visible Date Picker */}
          <div
            className={`inline-flex items-center gap-1 rounded-md border px-2 h-8 transition-colors ${
              periodMode === PERIOD_MODES.DATE
                ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                : 'border-input bg-background'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span className="text-[11px] font-medium text-muted-foreground hidden sm:inline">Date:</span>
            <input
              type="date"
              value={periodMode === PERIOD_MODES.DATE ? dateFilter : ''}
              onChange={(e) => onDateFilterChange(e.target.value)}
              aria-label="Filter receipts by date"
              className="h-7 bg-transparent text-xs text-foreground outline-none cursor-pointer"
            />
            {periodMode === PERIOD_MODES.DATE && (
              <button
                type="button"
                onClick={() => onDateFilterChange('')}
                className="p-0.5 text-muted-foreground hover:text-foreground cursor-pointer"
                title="Clear date filter"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Cards vs Table Toggle */}
        <div className="inline-flex items-center rounded-lg border border-border bg-muted/40 p-0.5 gap-0.5">
          <Button
            type="button"
            variant={viewMode === 'cards' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onViewModeChange('cards')}
            className="h-7 px-2.5 text-xs gap-1.5"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Cards</span>
          </Button>
          <Button
            type="button"
            variant={viewMode === 'table' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onViewModeChange('table')}
            className="h-7 px-2.5 text-xs gap-1.5"
          >
            <List className="w-3.5 h-3.5" />
            <span>Table</span>
          </Button>
        </div>
      </div>

      {/* Contextual Week / Month / Date Range Sub-bar */}
      {(periodMode === PERIOD_MODES.WEEK ||
        periodMode === PERIOD_MODES.MONTH ||
        periodMode === PERIOD_MODES.RANGE) && (
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/50 text-xs">
          {periodMode === PERIOD_MODES.WEEK && (
            <>
              <span className="text-muted-foreground font-medium">Week:</span>
              <div className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-1 py-0.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => onWeekOffsetChange(weekOffset - 1)}
                  className="h-6 w-6"
                  title="Previous week"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </Button>
                <span className="px-2 font-semibold text-foreground">{weekRangeText}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => onWeekOffsetChange(weekOffset + 1)}
                  className="h-6 w-6"
                  title="Next week"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
              {weekOffset !== 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onWeekOffsetChange(0)}
                  className="h-7 px-2 text-xs text-primary"
                >
                  Jump to This Week
                </Button>
              )}
            </>
          )}

          {periodMode === PERIOD_MODES.MONTH && (
            <>
              <span className="text-muted-foreground font-medium">Month:</span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => onShiftMonth(-1)}
                className="h-8 w-8"
                title="Previous month"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <Input
                type="month"
                value={monthFilter}
                onChange={(e) => onMonthFilterChange(e.target.value)}
                aria-label="Filter receipts by month"
                className="h-8 w-[155px] text-xs bg-background border-input text-foreground"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => onShiftMonth(1)}
                className="h-8 w-8"
                title="Next month"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </>
          )}

          {periodMode === PERIOD_MODES.RANGE && (
            <>
              <span className="text-muted-foreground font-medium">From:</span>
              <Input
                type="date"
                value={rangeStart}
                onChange={(e) => onRangeStartChange(e.target.value)}
                aria-label="Range start date"
                className="h-8 w-[150px] text-xs bg-background border-input text-foreground"
              />
              <span className="text-muted-foreground font-medium">To:</span>
              <Input
                type="date"
                value={rangeEnd}
                onChange={(e) => onRangeEndChange(e.target.value)}
                aria-label="Range end date"
                className="h-8 w-[150px] text-xs bg-background border-input text-foreground"
              />
            </>
          )}
        </div>
      )}

      {/* Row 2: Search + Paid/Unpaid Filter Buttons */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2 border-t border-border/60">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by customer name or invoice ID..."
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
            className="pl-9 h-9 text-xs bg-background/60 border-input"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {statusOptions.map((opt) => {
            const active = statusFilter === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onStatusFilterChange(opt.id)}
                className={`h-9 px-3 rounded-md border text-xs font-bold transition-all cursor-pointer ${
                  active
                    ? `${opt.activeClass} shadow-xs`
                    : 'bg-background text-foreground border-border hover:bg-muted'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
