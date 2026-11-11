import { Check, ImageIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

/**
 * StockProductCards — Inventory records grouped by product, with inline
 * editing per supplier offer card.
 */
export default function StockProductCards({
  filteredProducts,
  productPricesMap,
  supplierMap,
  brandMap,
  categoryMap,
  lowStockThreshold,
  editingPriceId,
  editQty,
  editUnit,
  editPrice,
  isSaving,
  onEditQtyChange,
  onEditUnitChange,
  onEditPriceChange,
  onStartEditing,
  onSaveInlineEdit,
  onCancelEditing,
}) {
  return (
    <div className="space-y-3">
      {filteredProducts.map((product) => {
        const productPrices = (productPricesMap[product.id] || []).filter((sp) => sp.price > 0);
        if (productPrices.length === 0) return null;

        return (
          <Card key={product.id} className="p-5 bg-card/60 backdrop-blur-md border-border shadow-xs space-y-4">
            {/* Title with thumbnail */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-muted border border-border">
                {product.image_url ? (
                  <img src={product.image_url} alt={product.name_en} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="w-5 h-5 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div>
                <h4 className="font-bold text-foreground text-base">{product.name_kh}</h4>
                <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                  <span className="text-xs text-muted-foreground">{product.name_en}</span>
                  {product.brand_id && brandMap[product.brand_id] && (
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-primary/30 text-primary bg-primary/10">
                      {brandMap[product.brand_id]}
                    </Badge>
                  )}
                  {product.category_id && categoryMap[product.category_id] && (
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-violet-500/30 text-violet-500 bg-violet-500/10">
                      {categoryMap[product.category_id]}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Supplier offers list */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {productPrices.map((sp) => {
                const sup = supplierMap[sp.supplier_id];
                const isEditing = editingPriceId === sp.id;
                const isLow = sp.stock_qty <= lowStockThreshold;

                return (
                  <div
                    key={sp.id}
                    className={`p-4 rounded-xl border bg-card/70 flex flex-col justify-between gap-3 transition-colors ${
                      isLow ? 'border-destructive/30 bg-destructive/5' : 'border-border'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-semibold text-foreground text-sm block">{sup ? sup.name : 'Unknown'}</span>
                        <span className="text-xs font-bold text-emerald-500">${sp.price.toFixed(2)}</span>
                      </div>

                      {isLow && (
                        <Badge variant="destructive" className="text-[9px] px-1.5 py-0">
                          LOW
                        </Badge>
                      )}
                    </div>

                    {isEditing ? (
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            min="0"
                            value={editQty}
                            onChange={(e) => onEditQtyChange(e.target.value)}
                            className="w-16 h-7 text-xs text-center px-1"
                            placeholder="Qty"
                          />
                          <select
                            value={editUnit}
                            onChange={(e) => onEditUnitChange(e.target.value)}
                            className="flex-1 h-7 rounded-md border border-input bg-card px-2 text-xs text-foreground"
                          >
                            <option value="pcs">pcs</option>
                            <option value="lo">lo</option>
                            <option value="cs">cs</option>
                          </select>
                        </div>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                          <Input
                            type="number"
                            step="any"
                            min="0"
                            value={editPrice}
                            onChange={(e) => onEditPriceChange(e.target.value)}
                            className="w-full pl-6 pr-2 h-7 text-xs"
                            placeholder="Supplier Price"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => onSaveInlineEdit(sp)}
                            disabled={isSaving}
                            className="flex-1 h-7 text-[11px] font-bold gap-1 bg-emerald-600 hover:bg-emerald-500 text-white"
                          >
                            <Check className="w-3.5 h-3.5" /> Save
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={onCancelEditing}
                            className="h-7 px-2 text-[11px] font-bold"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-between items-center gap-2">
                        <div className="text-left space-y-0.5">
                          <span className="text-xs font-semibold text-muted-foreground block">
                            Stock: <strong className="text-foreground">{sp.stock_qty}</strong> {sp.stock_unit}
                          </span>
                          {sp.updated_at && (
                            <span className="text-[10px] text-muted-foreground block">
                              Updated: {new Date(sp.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onStartEditing(sp)}
                          className="h-6 text-xs font-bold text-primary hover:text-primary px-2"
                        >
                          Edit
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}
      {filteredProducts.length === 0 && (
        <Card className="p-8 text-center text-muted-foreground italic border-dashed">
          No products found matching your search.
        </Card>
      )}
    </div>
  );
}

