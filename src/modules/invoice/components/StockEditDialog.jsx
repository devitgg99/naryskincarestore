import { Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatStockInTime } from '../invoiceUtils';

/**
 * StockEditDialog — Modal dialog for quickly updating a supplier's
 * cost price and stock quantity directly from the invoice line item.
 *
 * Props:
 *   stockEditModal   — { product, supplier, priceObj, itemIndex } | null
 *   editStockPrice   — string
 *   editStockQty     — string
 *   editStockUnit    — string
 *   isSavingStock    — boolean
 *   setStockEditModal(null)
 *   setEditStockPrice(val)
 *   setEditStockQty(val)
 *   setEditStockUnit(val)
 *   onSave(e)        — form submit handler
 */
export default function StockEditDialog({
  stockEditModal,
  editStockPrice,
  editStockQty,
  editStockUnit,
  isSavingStock,
  setStockEditModal,
  setEditStockPrice,
  setEditStockQty,
  setEditStockUnit,
  onSave,
}) {
  return (
    <Dialog open={!!stockEditModal} onOpenChange={(open) => !open && setStockEditModal(null)}>
      <DialogContent className="max-w-md w-full sm:rounded-2xl">
        {stockEditModal && (
          <form onSubmit={onSave} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="text-base sm:text-lg flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                <span>Update Stock &amp; Cost Price</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                For <strong className="text-foreground">{stockEditModal.product?.name_kh}</strong> from supplier{' '}
                <strong className="text-foreground">{stockEditModal.supplier?.name}</strong>
              </DialogDescription>
            </DialogHeader>

            {/* Previous Stock-In Info Banner */}
            {stockEditModal.priceObj?.updated_at && (
              <div className="p-2.5 rounded-xl bg-muted/50 border border-border flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span>Last Stock In:</span>
                </div>
                <strong className="text-foreground font-semibold">
                  {formatStockInTime(stockEditModal.priceObj.updated_at)?.relative}{' '}
                  ({formatStockInTime(stockEditModal.priceObj.updated_at)?.formattedDate})
                </strong>
              </div>
            )}

            {/* Cost Price */}
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                Supplier Cost Price ($)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-semibold">$</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  placeholder="0.00"
                  value={editStockPrice}
                  onChange={(e) => setEditStockPrice(e.target.value)}
                  className="pl-7 h-10 text-sm font-semibold"
                />
              </div>
            </div>

            {/* Stock Quantity */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Stock Quantity
                </label>
                <span className="text-[11px] text-muted-foreground">
                  Current: <strong>{stockEditModal.priceObj?.stock_qty ?? 0}</strong> {editStockUnit}
                </span>
              </div>

              <Input
                type="number"
                min="0"
                step="any"
                required
                placeholder="E.g. 10, 25"
                value={editStockQty}
                onChange={(e) => setEditStockQty(e.target.value)}
                className="h-10 text-sm font-bold"
              />

              {/* Quick Add Pills for Fast Mobile Restocking */}
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                <span className="text-[10px] text-muted-foreground font-semibold uppercase">Quick Add:</span>
                {[1, 5, 10, 25, 50].map((addAmount) => (
                  <button
                    key={addAmount}
                    type="button"
                    onClick={() => {
                      const current = Number(editStockQty) || 0;
                      setEditStockQty((current + addAmount).toString());
                    }}
                    className="px-2 py-1 rounded-md text-[11px] font-bold bg-muted hover:bg-primary/10 hover:text-primary border border-border active:scale-95 transition-all"
                  >
                    +{addAmount}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setEditStockQty('0')}
                  className="px-2 py-1 rounded-md text-[11px] font-semibold text-muted-foreground hover:text-destructive hover:bg-destructive/10 border border-border active:scale-95 transition-all ml-auto"
                >
                  Set 0
                </button>
              </div>
            </div>

            {/* Stock Unit */}
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                Stock Unit
              </label>
              <select
                value={editStockUnit}
                onChange={(e) => setEditStockUnit(e.target.value)}
                className="w-full border border-input bg-background text-foreground rounded-lg px-3 py-2 text-sm h-10 focus:ring-2 focus:ring-ring focus:outline-hidden"
              >
                <option value="pcs">Pieces (pcs)</option>
                <option value="pack">Pack</option>
                <option value="box">Box</option>
                <option value="bottle">Bottle</option>
                <option value="set">Set</option>
                <option value="tube">Tube</option>
                <option value="jar">Jar</option>
                <option value="kg">Kilogram (kg)</option>
                <option value="g">Gram (g)</option>
                <option value="pair">Pair</option>
              </select>
            </div>

            <div className="text-[11px] text-muted-foreground bg-primary/5 border border-primary/20 rounded-xl p-2.5 flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary shrink-0" />
              <span>
                Saving will record <strong>now</strong> as the new stock-in time and update the invoice line item.
              </span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStockEditModal(null)}
                disabled={isSavingStock}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSavingStock}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
              >
                {isSavingStock ? 'Saving...' : 'Save & Stock In'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

