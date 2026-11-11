import { Check } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { matchesBrandAndCategoryFilter } from '../stockUtils';

/**
 * StockSupplierTables — Inventory records grouped by supplier with
 * inline editing per product row.
 */
export default function StockSupplierTables({
  filteredSuppliers,
  prices,
  productMap,
  brandMap,
  categoryMap,
  selectedBrandFilter,
  selectedCategoryFilter,
  searchTerm,
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
  getProductSellingPrice,
}) {
  return (
    <div className="space-y-3">
      {filteredSuppliers.map((supplier) => {
        const supplierPrices = prices.filter((sp) => sp.supplier_id === supplier.id && sp.price > 0);
        const queryLower = searchTerm.toLowerCase();

        const filteredSupplierPrices = supplierPrices.filter((sp) => {
          const prod = productMap[sp.product_id];
          if (!matchesBrandAndCategoryFilter(prod, selectedBrandFilter, selectedCategoryFilter)) {
            return false;
          }

          const matchesSupplier = supplier.name.toLowerCase().includes(queryLower);
          const matchesProduct =
            prod.name_en.toLowerCase().includes(queryLower) ||
            prod.name_kh.includes(searchTerm);
          return matchesSupplier || matchesProduct;
        });

        if (filteredSupplierPrices.length === 0) return null;

        return (
          <Card key={supplier.id} className="p-5 bg-card/60 backdrop-blur-md border-border shadow-xs space-y-4">
            <div className="border-b border-border pb-3 flex justify-between items-center">
              <div>
                <h4 className="font-bold text-foreground text-base">{supplier.name}</h4>
                <p className="text-xs text-muted-foreground">Phone: {supplier.contact_phone || 'N/A'}</p>
              </div>
              <Badge variant="secondary" className="text-xs font-semibold px-2.5 py-0.5">
                {filteredSupplierPrices.length} products
              </Badge>
            </div>

            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="py-2.5 text-xs font-bold">Product Name</TableHead>
                    <TableHead className="py-2.5 text-center text-xs font-bold">Supplier Price</TableHead>
                    <TableHead className="py-2.5 text-center text-xs font-bold">Selling Price</TableHead>
                    <TableHead className="py-2.5 text-center text-xs font-bold">Stock Level</TableHead>
                    <TableHead className="py-2.5 text-center text-xs font-bold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSupplierPrices.map((sp) => {
                    const prod = productMap[sp.product_id];
                    if (!prod) return null;

                    const isEditing = editingPriceId === sp.id;
                    const isLow = sp.stock_qty <= lowStockThreshold;

                    return (
                      <TableRow key={sp.id} className="hover:bg-muted/30">
                        <TableCell className="py-3">
                          <div className="font-bold text-foreground">{prod.name_kh}</div>
                          <div className="text-[10px] text-muted-foreground flex flex-wrap items-center gap-1.5 mt-0.5">
                            <span>{prod.name_en}</span>
                            {prod.brand_id && brandMap[prod.brand_id] && (
                              <Badge variant="outline" className="text-[8px] px-1 py-0 border-primary/30 text-primary bg-primary/10 font-bold">
                                {brandMap[prod.brand_id]}
                              </Badge>
                            )}
                            {prod.category_id && categoryMap[prod.category_id] && (
                              <Badge variant="outline" className="text-[8px] px-1 py-0 border-violet-500/30 text-violet-500 bg-violet-500/10 font-bold">
                                {categoryMap[prod.category_id]}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-3 text-center">
                          {isEditing ? (
                            <div className="relative w-24 mx-auto">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                              <Input
                                type="number"
                                step="any"
                                min="0"
                                value={editPrice}
                                onChange={(e) => onEditPriceChange(e.target.value)}
                                className="w-full pl-5 pr-1 h-7 text-xs text-center font-bold text-emerald-500"
                              />
                            </div>
                          ) : (
                            <span className="text-emerald-500 font-bold">${sp.price.toFixed(2)}</span>
                          )}
                        </TableCell>
                        <TableCell className="py-3 text-center text-muted-foreground font-mono">
                          ${getProductSellingPrice(sp.product_id).toFixed(2)}
                        </TableCell>

                        <TableCell className="py-3 text-center">
                          {isEditing ? (
                            <div className="flex gap-1 justify-center items-center">
                              <Input
                                type="number"
                                min="0"
                                value={editQty}
                                onChange={(e) => onEditQtyChange(e.target.value)}
                                className="w-14 h-7 text-xs text-center px-1"
                              />
                              <select
                                value={editUnit}
                                onChange={(e) => onEditUnitChange(e.target.value)}
                                className="h-7 rounded-md border border-input bg-card px-1 text-xs text-foreground"
                              >
                                <option value="pcs">pcs</option>
                                <option value="lo">lo</option>
                                <option value="cs">cs</option>
                              </select>
                            </div>
                          ) : (
                            <div className="space-y-0.5">
                              <Badge variant={isLow ? 'destructive' : 'secondary'} className="font-bold">
                                {sp.stock_qty} {sp.stock_unit}
                              </Badge>
                              {sp.updated_at && (
                                <span className="block text-[10px] text-muted-foreground font-medium">
                                  {new Date(sp.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                </span>
                              )}
                            </div>
                          )}
                        </TableCell>

                        <TableCell className="py-3 text-center">
                          {isEditing ? (
                            <div className="flex gap-1 justify-center">
                              <Button
                                size="sm"
                                onClick={() => onSaveInlineEdit(sp)}
                                disabled={isSaving}
                                className="h-7 w-7 p-0 bg-emerald-600 hover:bg-emerald-500 text-white"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={onCancelEditing}
                                className="h-7 w-7 p-0"
                              >
                                ✕
                              </Button>
                            </div>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onStartEditing(sp)}
                              className="h-7 text-xs font-bold text-primary hover:text-primary"
                            >
                              Edit Stock
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>
        );
      })}
      {filteredSuppliers.length === 0 && (
        <Card className="p-8 text-center text-muted-foreground italic border-dashed">
          No suppliers found matching your search.
        </Card>
      )}
    </div>
  );
}

