import { Eye, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { resolveOrderInvoiceNumber } from '../../invoice/invoiceUtils';
import {
  getOrderTimestamp,
  getOrderTotalProfit,
  isOrderPaid,
  resolveOrderCustomer,
} from '../salesUtils';
import OrderPaymentToggle from './OrderPaymentToggle';

/**
 * SalesLogTable — Displays filtered sales orders with invoice ID, customer, date,
 * item summary, revenue, computed profit, Paid/Unpaid quick buttons, and row actions.
 */
export default function SalesLogTable({
  filteredOrders,
  customers,
  getOrderItems,
  getOrderItemsSummary,
  getItemCost,
  updatingOrderId,
  onUpdateStatus,
  onOpenPreview,
  onDeleteOrder,
}) {
  return (
    <Card className="rounded-xl overflow-hidden border-border shadow-xs">
      <div className="overflow-x-auto scrollbar-thin">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="p-4 text-xs font-bold uppercase">Invoice ID</TableHead>
              <TableHead className="p-4 text-xs font-bold uppercase">Customer</TableHead>
              <TableHead className="p-4 text-xs font-bold uppercase">Order Date</TableHead>
              <TableHead className="p-4 min-w-[200px] text-xs font-bold uppercase">Items Purchased</TableHead>
              <TableHead className="p-4 text-right text-xs font-bold uppercase">Total Amount</TableHead>
              <TableHead className="p-4 text-right text-emerald-500 text-xs font-bold uppercase">Profit</TableHead>
              <TableHead className="p-4 text-center text-xs font-bold uppercase">Payment</TableHead>
              <TableHead className="p-4 text-center text-xs font-bold uppercase">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredOrders.map((order) => {
              const cust = resolveOrderCustomer(order, customers);
              const itemsSummary = getOrderItemsSummary(order);
              const currentItems = getOrderItems(order);
              const orderProfit = getOrderTotalProfit(currentItems, getItemCost);
              const paid = isOrderPaid(order);
              const timestamp = getOrderTimestamp(order);

              return (
                <TableRow key={order.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="p-4 font-mono font-bold text-xs text-primary">
                    {resolveOrderInvoiceNumber(order)}
                  </TableCell>

                  <TableCell className="p-4 font-semibold text-foreground">
                    {cust ? cust.name : 'Unknown Customer'}
                  </TableCell>

                  <TableCell className="p-4 text-muted-foreground text-xs">
                    {timestamp
                      ? new Date(timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
                      : 'N/A'}
                  </TableCell>

                  <TableCell className="p-4 text-xs text-muted-foreground max-w-sm truncate" title={itemsSummary}>
                    {itemsSummary || 'No items'}
                  </TableCell>

                  <TableCell className="p-4 text-right font-bold font-mono text-foreground">
                    ${Number(order.total_amount || 0).toFixed(2)}
                  </TableCell>

                  <TableCell className="p-4 text-right font-bold font-mono text-emerald-500">
                    ${orderProfit.toFixed(2)}
                  </TableCell>

                  <TableCell className="p-4 text-center">
                    <div className="inline-flex flex-col items-center gap-1">
                      <OrderPaymentToggle
                        orderId={order.id}
                        isPaid={paid}
                        isUpdating={updatingOrderId === order.id}
                        onUpdateStatus={onUpdateStatus}
                        size="compact"
                      />
                      {order.status === 'delivered' && (
                        <Badge variant="secondary" className="text-[9px] uppercase px-1.5 py-0">
                          Delivered
                        </Badge>
                      )}
                    </div>
                  </TableCell>

                  <TableCell className="p-4 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onOpenPreview(order)}
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        title="View Invoice Details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDeleteOrder(order.id)}
                        className="h-7 w-7 text-destructive hover:bg-destructive/10"
                        title="Delete / Cancel Order"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}

            {filteredOrders.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="p-8 text-center text-muted-foreground italic">
                  No orders logged matching your search filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
