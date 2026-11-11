import { Eye, Trash2, Phone, User, Calendar, Package } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { resolveOrderInvoiceNumber } from '../../invoice/invoiceUtils';
import {
  PERIOD_MODES,
  STATUS_FILTERS,
  getOrderTimestamp,
  getOrderTotalProfit,
  isOrderPaid,
  resolveOrderCustomer,
} from '../salesUtils';
import OrderPaymentToggle from './OrderPaymentToggle';

/**
 * SalesReceiptCards — Card-based receipt tracker showing each order's customer,
 * items, totals, and direct Paid / Unpaid toggle buttons.
 */
export default function SalesReceiptCards({
  filteredOrders,
  customers,
  getOrderItems,
  getProductName,
  getItemCost,
  updatingOrderId,
  onUpdateStatus,
  onOpenPreview,
  onDeleteOrder,
  periodMode,
  periodLabel,
  statusFilter,
  onSwitchPeriod,
  onResetFilters,
}) {
  if (filteredOrders.length === 0) {
    const statusText =
      statusFilter === STATUS_FILTERS.UNPAID
        ? 'unpaid receipts'
        : statusFilter === STATUS_FILTERS.PAID
        ? 'paid receipts'
        : 'receipts';

    return (
      <Card className="p-8 text-center border-dashed border-border bg-card/50 space-y-4">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">
            No {statusText} found for {periodLabel}.
          </p>
          <p className="text-xs text-muted-foreground">
            Switch to another period or reset filters to browse earlier receipts.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {periodMode !== PERIOD_MODES.WEEK && (
            <Button type="button" variant="outline" size="sm" onClick={() => onSwitchPeriod(PERIOD_MODES.WEEK)} className="text-xs">
              Show This Week
            </Button>
          )}
          {periodMode !== PERIOD_MODES.MONTH && (
            <Button type="button" variant="outline" size="sm" onClick={() => onSwitchPeriod(PERIOD_MODES.MONTH)} className="text-xs">
              Show This Month
            </Button>
          )}
          {periodMode !== PERIOD_MODES.ALL && (
            <Button type="button" variant="outline" size="sm" onClick={() => onSwitchPeriod(PERIOD_MODES.ALL)} className="text-xs">
              Show All Time
            </Button>
          )}
          {statusFilter !== STATUS_FILTERS.ALL && (
            <Button type="button" variant="ghost" size="sm" onClick={onResetFilters} className="text-xs">
              Reset Status Filter
            </Button>
          )}
        </div>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {filteredOrders.map((order) => {
        const cust = resolveOrderCustomer(order, customers);
        const items = getOrderItems(order);
        const profit = getOrderTotalProfit(items, getItemCost);
        const paid = isOrderPaid(order);
        const timestamp = getOrderTimestamp(order);
        const previewItems = items.slice(0, 3);
        const remainingCount = Math.max(0, items.length - previewItems.length);
        const deliveryFee = Number(order.delivery_fee || 0);

        return (
          <Card
            key={order.id}
            className={`p-4 flex flex-col justify-between gap-3.5 border transition-colors shadow-xs ${
              paid
                ? 'border-border bg-card/80 hover:border-emerald-500/40'
                : 'border-amber-500/40 bg-amber-500/[0.03] hover:border-amber-500/70'
            }`}
          >
            {/* Card Header */}
            <div className="space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-mono font-bold text-xs text-primary">
                      {resolveOrderInvoiceNumber(order)}
                    </span>
                    {order.status === 'delivered' && (
                      <Badge variant="secondary" className="text-[9px] uppercase px-1.5 py-0">
                        Delivered
                      </Badge>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Calendar className="w-3 h-3 shrink-0" />
                    <span>
                      {timestamp
                        ? new Date(timestamp).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
                        : 'No date'}
                    </span>
                  </div>
                </div>

                <Badge variant={paid ? 'success' : 'warning'} className="text-[10px] uppercase shrink-0">
                  {paid ? 'Paid' : 'Unpaid'}
                </Badge>
              </div>

              {/* Customer Info */}
              <div className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg bg-muted/40 border border-border/60">
                <div className="flex items-center gap-2 min-w-0">
                  <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs font-semibold text-foreground truncate">
                    {cust ? cust.name : 'Unknown Customer'}
                  </span>
                </div>
                {cust?.phone && (
                  <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1 shrink-0">
                    <Phone className="w-3 h-3" />
                    {cust.phone}
                  </span>
                )}
              </div>

              {/* Items Summary */}
              <div className="space-y-1.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Package className="w-3 h-3" />
                  <span>Items ({items.length})</span>
                </div>
                {previewItems.length > 0 ? (
                  <ul className="space-y-1 text-xs">
                    {previewItems.map((oi, idx) => {
                      const itemName = getProductName(oi).primary;
                      const lineSub = Number(oi.subtotal ?? Number(oi.unit_price || 0) * Number(oi.quantity || 0));
                      return (
                        <li key={oi.id || idx} className="flex items-center justify-between gap-2 text-foreground/90">
                          <span className="truncate">
                            {itemName} <span className="text-muted-foreground font-mono">x{oi.quantity}</span>
                          </span>
                          <span className="font-mono text-[11px] text-muted-foreground shrink-0">
                            ${lineSub.toFixed(2)}
                          </span>
                        </li>
                      );
                    })}
                    {remainingCount > 0 && (
                      <li className="text-[11px] text-primary font-medium">
                        +{remainingCount} more item{remainingCount > 1 ? 's' : ''}
                      </li>
                    )}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground italic">No items listed</p>
                )}
              </div>
            </div>

            {/* Totals & Action Footer */}
            <div className="space-y-3 pt-2.5 border-t border-border/70">
              <div className="flex items-end justify-between gap-2">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                    Total Amount
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-lg font-extrabold font-mono text-foreground">
                      ${Number(order.total_amount || 0).toFixed(2)}
                    </span>
                    {deliveryFee > 0 && (
                      <span className="text-[10px] text-muted-foreground font-mono">
                        (incl. ${deliveryFee.toFixed(2)} del.)
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
                    Profit
                  </span>
                  <span className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400">
                    +${profit.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <OrderPaymentToggle
                  orderId={order.id}
                  isPaid={paid}
                  isUpdating={updatingOrderId === order.id}
                  onUpdateStatus={onUpdateStatus}
                />

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenPreview(order)}
                  className="h-8 px-2.5 gap-1 text-xs shrink-0"
                  title="View & Print Receipt"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>View</span>
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => onDeleteOrder(order.id)}
                  className="h-8 w-8 text-destructive hover:bg-destructive/10 shrink-0"
                  title="Delete / Cancel Receipt"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

