import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/**
 * EditPriceStockDialog — Modal for editing a supplier's unit cost, stock quantity,
 * and stock unit for a given product.
 */
export default function EditPriceStockDialog({
  editingCell,
  onClose,
  editPrice,
  onEditPriceChange,
  editStock,
  onEditStockChange,
  editUnit,
  onEditUnitChange,
  isSaving,
  getExpectedSellingPrice,
  onSubmit,
  onDeleteOffer,
}) {
  return (
    <Dialog open={!!editingCell} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        {editingCell && (
          <form onSubmit={onSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Edit Price & Stock</DialogTitle>
              <DialogDescription>
                For {editingCell.product.name_kh} from supplier <strong className="text-foreground">{editingCell.supplier.name}</strong>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Price (USD)</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  placeholder="Enter supplier unit price"
                  value={editPrice}
                  onChange={(e) => onEditPriceChange(e.target.value)}
                  className="h-9 text-xs"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  {editingCell.product.selling_price && Number(editingCell.product.selling_price) > 0
                    ? `Selling Price (Manual Override): $${Number(editingCell.product.selling_price).toFixed(2)}`
                    : `Expected Selling Price (Max Cost + $0.20): $${getExpectedSellingPrice(editingCell.product.id, editingCell.priceObj.id, editPrice).toFixed(2)}`}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Stock Quantity</label>
                  <Input
                    type="number"
                    min="0"
                    required
                    placeholder="E.g. 10, 24"
                    value={editStock}
                    onChange={(e) => onEditStockChange(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Stock Unit</label>
                  <select
                    value={editUnit}
                    onChange={(e) => onEditUnitChange(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-foreground"
                  >
                    <option value="pcs">Pieces (pcs)</option>
                    <option value="lo">Dozens (lo)</option>
                    <option value="cs">Cases (cs)</option>
                  </select>
                </div>
              </div>
            </div>

            <DialogFooter className="flex justify-between items-center sm:justify-between w-full pt-2">
              {editingCell.priceObj.id ? (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={onDeleteOffer}
                  disabled={isSaving}
                  className="text-xs"
                >
                  Delete Offer
                </Button>
              ) : (
                <div />
              )}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onClose}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving...' : 'Save Price'}
                </Button>
              </div>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

