import { Clock, Plus, Edit2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatStockInTime } from '../invoiceUtils';

/**
 * SupplierPickerDialog — Mobile-optimized bottom-sheet style dialog for
 * selecting a supplier offer on a line item. Shows all offers with stock-in
 * history, cheapest badge, and quick "Update Stock" button.
 *
 * Props:
 *   supplierPickerModal  — { itemIndex, product, currentSupplierId } | null
 *   productSupplierPrices — { [product_id]: SupplierPrice[] }
 *   suppliers            — Supplier[]
 *   setSupplierPickerModal(null)
 *   onSelectSupplier(itemIndex, supplierId)
 *   onOpenStockEdit(itemIndex, product, supplier, priceObj)
 */
export default function SupplierPickerDialog({
  supplierPickerModal,
  productSupplierPrices,
  suppliers,
  setSupplierPickerModal,
  onSelectSupplier,
  onOpenStockEdit,
}) {
  return (
    <Dialog open={!!supplierPickerModal} onOpenChange={(open) => !open && setSupplierPickerModal(null)}>
      <DialogContent className="max-w-md w-full max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden sm:rounded-2xl">
        <DialogHeader className="p-4 sm:p-5 border-b border-border bg-card/60">
          <DialogTitle className="text-base sm:text-lg flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            <span>Select Supplier &amp; Stock</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-0.5">
            {supplierPickerModal?.product?.name_kh}{' '}
            {supplierPickerModal?.product?.name_en ? `(${supplierPickerModal.product.name_en})` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 scrollbar-thin">
          {(() => {
            if (!supplierPickerModal?.product) return null;
            const productSps = productSupplierPrices[supplierPickerModal.product.id] || [];
            const cheapest = [...productSps].sort((a, b) => a.price - b.price)[0];

            return (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
                  <span>Available Offers ({productSps.length})</span>
                  <span className="text-[10px] text-muted-foreground/80 lowercase">tap card to select</span>
                </div>

                {productSps.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground space-y-3 bg-muted/20 rounded-xl border border-dashed border-border">
                    <p className="text-xs italic">No supplier offers found for this product.</p>
                    {suppliers.length > 0 && (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          const targetIdx = supplierPickerModal.itemIndex;
                          const targetProd = supplierPickerModal.product;
                          const firstSup = suppliers[0];
                          setSupplierPickerModal(null);
                          onOpenStockEdit(targetIdx, targetProd, firstSup, null);
                        }}
                        className="text-xs"
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" /> Add Offer from {suppliers[0].name}
                      </Button>
                    )}
                  </div>
                ) : (
                  productSps.map((sp) => {
                    const sup = suppliers.find((s) => s.id === sp.supplier_id);
                    const isCheapest = cheapest && cheapest.supplier_id === sp.supplier_id;
                    const isSelected = supplierPickerModal.currentSupplierId === sp.supplier_id;
                    const timeInfo = formatStockInTime(sp.updated_at);

                    return (
                      <div
                        key={sp.supplier_id}
                        className={`p-3.5 rounded-xl border transition-all ${
                          isSelected
                            ? 'border-primary bg-primary/5 ring-2 ring-primary/30 shadow-xs'
                            : isCheapest
                            ? 'border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500/60'
                            : 'border-border bg-card hover:border-primary/40'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div
                            className="flex-1 cursor-pointer min-w-0"
                            onClick={() => {
                              onSelectSupplier(supplierPickerModal.itemIndex, sp.supplier_id);
                              setSupplierPickerModal(null);
                            }}
                          >
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-sm text-foreground">
                                {sup ? sup.name : 'Unknown Supplier'}
                              </span>
                              {isCheapest && (
                                <Badge className="text-[9px] font-extrabold uppercase bg-emerald-600 text-white px-1.5 py-0 leading-tight">
                                  Cheapest ★
                                </Badge>
                              )}
                              {isSelected && (
                                <Badge variant="outline" className="text-[9px] font-bold uppercase border-primary text-primary px-1.5 py-0 leading-tight">
                                  Active In Invoice
                                </Badge>
                              )}
                            </div>

                            <div className="flex items-center gap-3 mt-1.5">
                              <span className={`text-base font-extrabold font-mono ${isCheapest ? 'text-emerald-500' : 'text-foreground'}`}>
                                ${Number(sp.price || 0).toFixed(2)}
                              </span>
                              <span className={`text-xs font-semibold ${sp.stock_qty <= 2 ? 'text-destructive font-bold' : 'text-muted-foreground'}`}>
                                Stock: {sp.stock_qty} {sp.stock_unit || 'pcs'}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-2">
                              <Clock className="w-3.5 h-3.5 text-primary shrink-0" />
                              <span>Stock In:</span>
                              {timeInfo ? (
                                <strong className="text-foreground font-semibold">
                                  {timeInfo.relative}{' '}
                                  <span className="text-muted-foreground font-normal">({timeInfo.formattedDate})</span>
                                </strong>
                              ) : (
                                <span className="italic">Not recorded</span>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-col gap-2 shrink-0 items-end">
                            <Button
                              type="button"
                              size="sm"
                              variant={isSelected ? 'default' : 'outline'}
                              onClick={() => {
                                onSelectSupplier(supplierPickerModal.itemIndex, sp.supplier_id);
                                setSupplierPickerModal(null);
                              }}
                              className="h-8 text-xs font-semibold px-3"
                            >
                              {isSelected ? (
                                <>
                                  <Check className="w-3.5 h-3.5 mr-1" /> Selected
                                </>
                              ) : (
                                'Select'
                              )}
                            </Button>

                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                const targetIdx = supplierPickerModal.itemIndex;
                                const targetProd = supplierPickerModal.product;
                                setSupplierPickerModal(null);
                                onOpenStockEdit(targetIdx, targetProd, sup, sp);
                              }}
                              className="h-7 text-[11px] text-muted-foreground hover:text-primary px-2"
                            >
                              <Edit2 className="w-3 h-3 mr-1" /> Update Stock
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}

                {/* Add Offer from other available suppliers */}
                {suppliers.filter((s) => !productSps.some((sp) => sp.supplier_id === s.id)).length > 0 && (
                  <div className="pt-3 border-t border-border mt-3">
                    <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                      Add Other Suppliers
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {suppliers
                        .filter((s) => !productSps.some((sp) => sp.supplier_id === s.id))
                        .map((sup) => (
                          <Button
                            key={sup.id}
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const targetIdx = supplierPickerModal.itemIndex;
                              const targetProd = supplierPickerModal.product;
                              setSupplierPickerModal(null);
                              onOpenStockEdit(targetIdx, targetProd, sup, null);
                            }}
                            className="h-8 text-xs border-dashed text-foreground hover:text-primary"
                          >
                            <Plus className="w-3 h-3 mr-1 text-primary" /> {sup.name}
                          </Button>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        <div className="p-3 border-t border-border bg-card/60 flex items-center justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setSupplierPickerModal(null)}
            className="text-xs"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

