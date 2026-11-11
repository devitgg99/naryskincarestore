import { Edit2, ImageIcon, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { getEffectiveSellingPrice } from '../pricingUtils';

/**
 * ProductMobileCards — Card-based product & supplier offer grid view,
 * optimized for mobile and quick touch editing.
 */
export default function ProductMobileCards({
  filteredProducts,
  suppliers,
  selectedSupplierFilter,
  brandMap,
  categoryMap,
  priceMap,
  getCheapestPrice,
  getHighestPrice,
  onProductClick,
  onCellClick,
  onPrintBarcode,
}) {
  return (
    <div className="space-y-4">
      {filteredProducts.map((product) => {
        const cheapestPrice = getCheapestPrice(product.id);
        const highestPrice = getHighestPrice(product.id);
        const sellingPrice = getEffectiveSellingPrice(product, highestPrice);

        return (
          <Card key={product.id} className="p-5 bg-card/60 backdrop-blur-md border-border shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-border pb-3">
              <div
                onClick={() => onProductClick(product)}
                className="flex items-center gap-3 cursor-pointer group"
              >
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
                  <h4 className="font-bold text-foreground text-base group-hover:text-primary transition-colors flex items-center gap-1.5">
                    {product.name_kh}
                    <Edit2 className="w-3.5 h-3.5 opacity-60 text-primary" />
                  </h4>
                  <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
                    <span>{product.name_en}</span>
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

              <div className="flex items-center gap-2.5 self-start sm:self-auto">
                {product.barcode && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPrintBarcode(product)}
                    className="h-8 px-2.5 text-xs text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 gap-1 font-bold"
                    title="Print Barcode Sticker"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Label
                  </Button>
                )}
                <div className="text-left sm:text-right">
                  <span className="text-[10px] text-muted-foreground block font-semibold uppercase">Selling Price</span>
                  <span className="text-base font-bold text-foreground font-mono">${sellingPrice.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Supplier Offers List for Card */}
            <div className="space-y-2">
              <h5 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Supplier Offers</h5>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {suppliers.map((supplier) => {
                  if (selectedSupplierFilter !== 'all' && selectedSupplierFilter !== supplier.id) return null;
                  const priceObj = priceMap[product.id] && priceMap[product.id][supplier.id];
                  const isCheapest = cheapestPrice && priceObj && priceObj.id === cheapestPrice.id;

                  return (
                    <div
                      key={supplier.id}
                      onClick={() => onCellClick(product, supplier)}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-colors flex justify-between items-center ${
                        isCheapest
                          ? 'bg-emerald-500/10 border-emerald-500/30'
                          : 'bg-card/70 border-border hover:bg-muted/50'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <span className="font-semibold text-xs text-foreground block">{supplier.name}</span>
                        {priceObj && (priceObj.price > 0 || priceObj.stock_qty > 0) ? (
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`font-bold text-sm ${isCheapest ? 'text-emerald-500' : 'text-foreground'}`}>
                              ${priceObj.price.toFixed(2)}
                            </span>
                            <span className={`text-[10px] ${priceObj.stock_qty <= 2 ? 'text-destructive font-bold' : 'text-muted-foreground'}`}>
                              (Stock: {priceObj.stock_qty} {priceObj.stock_unit})
                            </span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-muted-foreground italic">No offer +</span>
                        )}
                      </div>

                      {isCheapest && (
                        <Badge className="text-[9px] font-extrabold uppercase bg-emerald-600 text-white leading-none shrink-0">
                          Cheapest ★
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>
        );
      })}

      {filteredProducts.length === 0 && (
        <Card className="p-8 text-center text-muted-foreground italic border-dashed">
          No products found matching your filters.
        </Card>
      )}
    </div>
  );
}

