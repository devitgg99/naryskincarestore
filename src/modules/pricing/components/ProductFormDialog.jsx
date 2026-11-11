import { Camera, Printer, Sparkles } from 'lucide-react';
import ImageUploadWidget from '../../../components/ImageUploadWidget';
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

const MODE_CONFIG = {
  add: {
    title: 'Add New Product',
    description: 'Create a new product in the system catalog.',
    khLabel: 'Khmer Name (ឈ្មោះទំនិញ) *',
    khPlaceholder: 'E.g. កូកាកូឡា កំប៉ុង',
    enLabel: 'English Name *',
    enPlaceholder: 'E.g. Coca Cola (330ml)',
    barcodeLabel: 'Barcode (Optional)',
    submitText: 'Add Product',
    submittingText: 'Adding...',
  },
  edit: {
    title: 'Edit Product Details',
    description: 'Modify product name, image, or pricing details, or delete from portal.',
    khLabel: 'Khmer Name *',
    khPlaceholder: 'Khmer Product Name',
    enLabel: 'English Name *',
    enPlaceholder: 'English Product Name',
    barcodeLabel: 'Barcode',
    submitText: 'Save Changes',
    submittingText: 'Saving...',
  },
};

/**
 * ProductFormDialog — Unified modal for creating ('add') or updating ('edit')
 * a catalog product, including photo upload, barcode auto-generation/scanning,
 * and optional deletion when editing.
 */
export default function ProductFormDialog({
  open,
  onOpenChange,
  mode = 'add',
  existingImageUrl = null,
  onImageStateChange,
  nameKh,
  onNameKhChange,
  nameEn,
  onNameEnChange,
  barcode,
  onBarcodeChange,
  onAutoGenerateBarcode,
  onScanBarcode,
  onPrintBarcode,
  basePrice,
  onBasePriceChange,
  sellingPrice,
  onSellingPriceChange,
  brandId,
  onBrandIdChange,
  brands,
  categoryId,
  onCategoryIdChange,
  categories,
  isSaving,
  onSubmit,
  onDelete,
}) {
  const isEdit = mode === 'edit';
  const copy = MODE_CONFIG[mode] || MODE_CONFIG.add;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        {open && (
          <form onSubmit={onSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{copy.title}</DialogTitle>
              <DialogDescription>{copy.description}</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {/* Product Image */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Product Image</label>
                <ImageUploadWidget
                  existingImageUrl={existingImageUrl}
                  onStateChange={onImageStateChange}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{copy.khLabel}</label>
                <Input
                  type="text"
                  required
                  placeholder={copy.khPlaceholder}
                  value={nameKh}
                  onChange={(e) => onNameKhChange(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{copy.enLabel}</label>
                <Input
                  type="text"
                  required
                  placeholder={copy.enPlaceholder}
                  value={nameEn}
                  onChange={(e) => onNameEnChange(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{copy.barcodeLabel}</label>
                <div className="flex items-center gap-2">
                  <Input
                    type="text"
                    placeholder="Scan or enter barcode"
                    value={barcode}
                    onChange={(e) => onBarcodeChange(e.target.value)}
                    className="h-9 text-xs flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onAutoGenerateBarcode}
                    title="Auto-generate a unique 13-digit barcode"
                    className="h-9 px-2 text-[10px] font-bold gap-1 border-primary/30 text-primary hover:bg-primary/10"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Auto
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onScanBarcode}
                    className="h-9 px-2.5 text-[10px] font-bold gap-1"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    Scan
                  </Button>
                  {isEdit && barcode && onPrintBarcode && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={onPrintBarcode}
                      title="Print Barcode Labels"
                      className="h-9 px-2.5 text-[10px] font-bold gap-1 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Print
                    </Button>
                  )}
                </div>
              </div>

              {isEdit && (
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Base Price (USD) *</label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="Base Price"
                    value={basePrice}
                    onChange={(e) => onBasePriceChange(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Custom Selling Price ($) (Optional)</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Leave blank for automatic base+0.20"
                  value={sellingPrice}
                  onChange={(e) => onSellingPriceChange(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Brand</label>
                <select
                  value={brandId}
                  onChange={(e) => onBrandIdChange(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-foreground"
                >
                  <option value="">No Brand / General</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Category</label>
                <select
                  value={categoryId}
                  onChange={(e) => onCategoryIdChange(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-foreground"
                >
                  <option value="">No Category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <DialogFooter className={isEdit ? 'flex justify-between items-center sm:justify-between w-full pt-2' : 'flex justify-end gap-2 pt-2'}>
              {isEdit && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={onDelete}
                  disabled={isSaving}
                  className="text-xs"
                >
                  Delete Product
                </Button>
              )}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSaving}
                >
                  {isSaving ? copy.submittingText : copy.submitText}
                </Button>
              </div>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

