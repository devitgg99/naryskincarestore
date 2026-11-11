import { Edit2, ImageIcon, Printer, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatStockInTime } from '../../invoice/invoiceUtils';
import { getEffectiveSellingPrice } from '../pricingUtils';

/**
 * ProductMatrixTable — Product × Supplier price comparison matrix table.
 */
export default function ProductMatrixTable({
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
  onDeleteSupplier,
}) {
  return (
    <Card className="rounded-xl overflow-hidden border-border shadow-xs">
      <div className="overflow-x-auto scrollbar-thin">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="p-4 min-w-[260px] text-xs font-bold uppercase">Product Details</TableHead>
              <TableHead className="p-4 text-center text-xs font-bold uppercase">Selling Price</TableHead>
              {suppliers.map((supplier) => {
                if (selectedSupplierFilter !== 'all' && selectedSupplierFilter !== supplier.id) return null;
                return (
                  <TableHead key={supplier.id} className="p-4 text-center min-w-[180px] border-l border-border relative group text-xs font-bold uppercase">
                    <span className="inline-block">{supplier.name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteSupplier(supplier);
                      }}
                      className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 h-6 w-6 text-destructive hover:bg-destructive/10"
                      title={`Delete ${supplier.name}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProducts.map((product) => {
              const cheapestPrice = getCheapestPrice(product.id);
              const highestPrice = getHighestPrice(product.id);
              const sellingPrice = getEffectiveSellingPrice(product, highestPrice);

              return (
                <TableRow key={product.id} className="hover:bg-muted/30 transition-colors group">
                  <TableCell
                    onClick={() => onProductClick(product)}
                    className="p-4 cursor-pointer hover:bg-primary/5 transition-colors relative group/prod-name"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-muted border border-border">
                        {product.image_url ? (
                          <img
                            src={product.image_url}
                            alt={product.name_en}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageIcon className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="font-semibold text-foreground group-hover/prod-name:text-primary flex items-center gap-1.5 transition-colors">
                          <span>{product.name_kh}</span>
                          <Edit2 className="w-3.5 h-3.5 opacity-0 group-hover/prod-name:opacity-60 transition-opacity text-primary" />
                          {product.barcode && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                onPrintBarcode(product);
                              }}
                              className="h-6 w-6 text-emerald-400 opacity-0 group-hover/prod-name:opacity-100 transition-opacity hover:bg-emerald-500/10"
                              title="Print Barcode Label"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-1.5">
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
                  </TableCell>

                  <TableCell className="p-4 text-center font-medium font-mono text-foreground">
                    ${sellingPrice.toFixed(2)}
                  </TableCell>

                  {suppliers.map((supplier) => {
                    if (selectedSupplierFilter !== 'all' && selectedSupplierFilter !== supplier.id) return null;

                    const priceObj = priceMap[product.id] && priceMap[product.id][supplier.id];
                    const isCheapest = cheapestPrice && priceObj && priceObj.id === cheapestPrice.id;
                    const updatedTime = priceObj?.updated_at ? formatStockInTime(priceObj.updated_at) : null;

                    return (
                      <TableCell
                        key={supplier.id}
                        onClick={() => onCellClick(product, supplier)}
                        className={`p-4 text-center border-l border-border cursor-pointer transition-all duration-150 group/cell hover:bg-primary/5 ${
                          isCheapest
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold'
                            : ''
                        }`}
                      >
                        {priceObj && (priceObj.price > 0 || priceObj.stock_qty > 0) ? (
                          <div className="space-y-1 relative">
                            <div className="font-semibold flex items-center justify-center gap-1.5">
                              <span className={isCheapest ? 'text-emerald-500 text-base font-bold' : 'text-foreground font-mono'}>
                                ${priceObj.price.toFixed(2)}
                              </span>
                              {isCheapest && (
                                <Badge className="text-[9px] font-extrabold uppercase bg-emerald-600 text-white px-1 py-0 leading-none">
                                  Cheapest
                                </Badge>
                              )}
                            </div>
                            <div className="space-y-0.5">
                              <div className={`text-[11px] font-medium ${
                                priceObj.stock_qty <= 2
                                  ? 'text-destructive font-bold bg-destructive/10 px-1 py-0.5 rounded inline-block'
                                  : 'text-muted-foreground'
                              }`}>
                                Stock: {priceObj.stock_qty} {priceObj.stock_unit}
                              </div>
                              {updatedTime && (
                                <div className="text-[10px] text-muted-foreground font-medium group-hover/cell:text-foreground transition-colors">
                                  Updated: {updatedTime.relative}
                                </div>
                              )}
                            </div>

                            <Edit2 className="w-3.5 h-3.5 absolute right-0 top-0 opacity-0 group-hover/cell:opacity-60 transition-opacity text-primary" />
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic group-hover/cell:text-foreground">
                            No offer +
                          </span>
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })}

            {filteredProducts.length === 0 && (
              <TableRow>
                <TableCell colSpan={2 + suppliers.length} className="p-8 text-center text-muted-foreground italic">
                  No products found matching your filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

