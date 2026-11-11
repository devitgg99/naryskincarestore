import { MapPin, Calendar, ShoppingBag, Edit, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

/**
 * CustomerProfileCard — Selected customer details, map coordinates link,
 * aggregate purchase stats, and invoice history list.
 */
export default function CustomerProfileCard({
  activeCustomer,
  customerOrders,
  totalSpent,
  avgOrderValue,
  getOrderSummaryText,
  onEditCustomer,
  onDeleteCustomer,
}) {
  if (!activeCustomer) {
    return (
      <div className="lg:col-span-7">
        <Card className="border-border border-dashed p-12 text-center text-muted-foreground italic h-full flex flex-col justify-center items-center">
          Please select or create a customer to view their details.
        </Card>
      </div>
    );
  }

  return (
    <div className="lg:col-span-7">
      <Card className="border-border p-6 space-y-6 h-[calc(100vh-270px)] overflow-y-auto scrollbar-thin shadow-xs">
        {/* Profile Card */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-6 border-b border-border">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-[#000080] flex items-center justify-center font-bold text-white shadow-xs text-lg">
                {activeCustomer.name.charAt(0)}
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">{activeCustomer.name}</h3>
                <p className="text-xs text-muted-foreground">
                  Created: {new Date(activeCustomer.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>

            {activeCustomer.location_note && (
              <div className="flex items-start gap-2 text-sm text-foreground/80 bg-muted/40 p-3 rounded-xl border border-border">
                <MapPin className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <span>{activeCustomer.location_note}</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {activeCustomer.map_url ? (
              <a
                href={activeCustomer.map_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button size="sm" variant="default" className="gap-1.5 h-8 text-xs">
                  <MapPin className="w-3.5 h-3.5" />
                  Google Maps
                </Button>
              </a>
            ) : (
              <span className="text-[10px] text-muted-foreground italic border border-dashed border-border px-2.5 py-1 rounded-lg flex items-center">
                No GPS location added
              </span>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => onEditCustomer(activeCustomer)}
              className="gap-1.5 h-8 text-xs"
            >
              <Edit className="w-3.5 h-3.5 text-primary" />
              Edit Info
            </Button>

            <Button
              variant="destructive"
              size="sm"
              onClick={() => onDeleteCustomer(activeCustomer.id)}
              className="gap-1.5 h-8 text-xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </Button>
          </div>
        </div>

        {/* Stats Block */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="bg-muted/30 p-4 text-center border-border">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Total Spent</span>
            <span className="text-lg sm:text-2xl font-black text-emerald-400 block mt-1 font-mono">${totalSpent.toFixed(2)}</span>
          </Card>
          <Card className="bg-muted/30 p-4 text-center border-border">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Orders</span>
            <span className="text-lg sm:text-2xl font-black text-primary block mt-1 font-mono">{customerOrders.length}</span>
          </Card>
          <Card className="bg-muted/30 p-4 text-center border-border">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Avg. Invoice</span>
            <span className="text-lg sm:text-2xl font-black text-violet-400 block mt-1 font-mono">${avgOrderValue.toFixed(2)}</span>
          </Card>
        </div>

        {/* Invoices History list */}
        <div className="space-y-3">
          <h4 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-primary" />
            Invoice History
          </h4>

          <div className="space-y-2">
            {customerOrders.map((order) => (
              <Card
                key={order.id}
                className="p-3.5 border-border bg-card/60 hover:bg-accent/40 transition-colors flex justify-between items-center shadow-2xs"
              >
                <div className="space-y-1 pr-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono">
                      ID: {String(order.id).slice(-6).toUpperCase()}
                    </span>
                    <Badge
                      variant={order.status === 'paid' ? 'success' : order.status === 'delivered' ? 'default' : 'warning'}
                      className="text-[9px] uppercase px-1.5 py-0"
                    >
                      {order.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-foreground/80 font-medium truncate max-w-sm">
                    {getOrderSummaryText(order)}
                  </p>
                  <div className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                    <Calendar className="w-3 h-3" />
                    {new Date(order.ordered_at).toLocaleString()}
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-sm font-bold text-foreground font-mono">${Number(order.total_amount).toFixed(2)}</span>
                  {Number(order.delivery_fee) > 0 && (
                    <div className="text-[9px] text-muted-foreground">+$${Number(order.delivery_fee).toFixed(2)} delivery</div>
                  )}
                </div>
              </Card>
            ))}

            {customerOrders.length === 0 && (
              <Card className="p-6 text-center text-muted-foreground italic text-xs border-dashed">
                No purchase records for this customer yet.
              </Card>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

