import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

/**
 * QuickEditProductDialog — Compact product edit modal launched from
 * bulk product assignment lists in BrandManager and CategoryManager.
 */
export default function QuickEditProductDialog({
  open,
  onClose,
  nameKh,
  onNameKhChange,
  nameEn,
  onNameEnChange,
  basePrice,
  onBasePriceChange,
  brandId,
  onBrandIdChange,
  brands,
  categoryId,
  onCategoryIdChange,
  categories,
  isSaving,
  onSubmit,
}) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Quick Edit Product</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Name (Khmer) *</label>
              <Input
                type="text"
                required
                value={nameKh}
                onChange={(e) => onNameKhChange(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Name (English) *</label>
              <Input
                type="text"
                required
                value={nameEn}
                onChange={(e) => onNameEnChange(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Base Price ($)</label>
              <Input
                type="number"
                step="0.01"
                required
                value={basePrice}
                onChange={(e) => onBasePriceChange(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Brand</label>
              <select
                value={brandId}
                onChange={(e) => onBrandIdChange(e.target.value)}
                className="w-full flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">No Brand / General</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Category</label>
              <select
                value={categoryId}
                onChange={(e) => onCategoryIdChange(e.target.value)}
                className="w-full flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">No Category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <DialogFooter className="pt-2 border-t border-border">
            <Button
              type="button"
              variant="ghost"
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
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

