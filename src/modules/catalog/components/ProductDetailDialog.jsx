import { ImageIcon, Barcode as BarcodeIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent } from '@/components/ui/dialog';

/**
 * ProductDetailDialog — Quick-preview modal displaying product photo,
 * bilingual names, selling price, availability, category, and barcode.
 */
export default function ProductDetailDialog({
  product,
  sellingPrice,
  brandName,
  categoryName,
  onClose,
}) {
  return (
    <Dialog open={!!product} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden">
        {product && (
          <div>
            <div className="w-full h-64 bg-muted relative overflow-hidden flex items-center justify-center border-b border-border">
              {product.image_url ? (
                <img
                  src={product.image_url}
                  alt={product.name_en}
                  className="w-full h-full object-contain p-4"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-muted-foreground gap-2">
                  <ImageIcon className="w-12 h-12 opacity-30" />
                  <span className="text-xs">No image uploaded</span>
                </div>
              )}
              {brandName && (
                <Badge className="absolute top-3 left-3 bg-[#000080] text-white">
                  {brandName}
                </Badge>
              )}
            </div>

            <div className="p-6 space-y-4">
              <div>
                <h3 className="text-xl font-bold text-foreground">
                  {product.name_kh}
                </h3>
                <p className="text-sm text-muted-foreground font-medium mt-0.5">
                  {product.name_en}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-muted/40 border border-border">
                <div>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                    Selling Price
                  </span>
                  <span className="text-2xl font-black font-mono text-[#000080] dark:text-blue-400">
                    ${sellingPrice.toFixed(2)}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                    Availability
                  </span>
                  <Badge variant="outline" className="mt-1 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 font-semibold">
                    In Stock
                  </Badge>
                </div>

                {categoryName && (
                  <div>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                      Category
                    </span>
                    <span className="text-xs font-semibold text-foreground">
                      {categoryName}
                    </span>
                  </div>
                )}

                {product.barcode && (
                  <div>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                      Barcode
                    </span>
                    <span className="text-xs font-mono font-bold text-foreground flex items-center gap-1 mt-0.5">
                      <BarcodeIcon className="w-3.5 h-3.5 text-muted-foreground" />
                      {product.barcode}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  variant="outline"
                  onClick={onClose}
                  className="h-9 px-4 text-xs font-semibold"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

