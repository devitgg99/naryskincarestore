import { Grid, Search, X, Plus, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { parseQuantity, roundMoney } from '../invoiceUtils';

/**
 * BatchAddModal — Full-screen catalog grid for selecting quantities of
 * multiple products at once and applying them to the invoice in one batch.
 *
 * Props:
 *   isOpen              — boolean
 *   brands              — Brand[]
 *   categories          — Category[]
 *   productSupplierPrices — { [product_id]: SupplierPrice[] }
 *   batchSearchQuery    — string
 *   batchQuantities     — { [product_id]: number | string }
 *   selectedBrandFilter   — string
 *   selectedCategoryFilter — string
 *   getFilteredProducts(query) — (query: string) => Product[]
 *   setBatchSearchQuery(val)
 *   setBatchQuantities(fn)
 *   setSelectedBrandFilter(val)
 *   setSelectedCategoryFilter(val)
 *   onClose()
 *   onApply(itemsToApply: { productId, qty }[])
 */
export default function BatchAddModal({
  isOpen,
  brands,
  categories,
  productSupplierPrices,
  batchSearchQuery,
  batchQuantities,
  selectedBrandFilter,
  selectedCategoryFilter,
  getFilteredProducts,
  setBatchSearchQuery,
  setBatchQuantities,
  setSelectedBrandFilter,
  setSelectedCategoryFilter,
  onClose,
  onApply,
}) {
  if (!isOpen) return null;

  const handleApply = () => {
    const itemsToApply = Object.entries(batchQuantities)
      .map(([id, q]) => ({ productId: id, qty: parseQuantity(q) }))
      .filter((item) => item.qty > 0);
    onApply(itemsToApply);
    onClose();
  };

  const selectedCount = Object.values(batchQuantities).filter((q) => parseQuantity(q) > 0).length;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-xs p-4 flex items-center justify-center no-print">
      <div className="bg-card border border-border w-full max-w-4xl rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">

        {/* Modal Header */}
        <div className="p-5 border-b border-border flex justify-between items-center bg-card/60">
          <div>
            <h3 className="font-bold text-foreground text-base sm:text-lg flex items-center gap-2">
              <Grid className="w-5 h-5 text-primary" />
              Batch Add Products from Catalog
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Adjust quantities for multiple products (including decimals like 0.5 or 1.5) and apply them in one batch.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Modal Search Bar + Filters */}
        <div className="p-4 border-b border-border bg-card/40 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search catalog by product name (English or Khmer)..."
              value={batchSearchQuery}
              onChange={(e) => setBatchSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 text-sm h-10"
            />
          </div>
          <select
            value={selectedBrandFilter}
            onChange={(e) => setSelectedBrandFilter(e.target.value)}
            className="border border-input bg-background text-foreground rounded-lg px-3 py-2 text-sm min-w-[160px] h-10 focus:ring-2 focus:ring-ring focus:outline-hidden"
          >
            <option value="all">All Brands</option>
            <option value="none">No Brand</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <select
            value={selectedCategoryFilter}
            onChange={(e) => setSelectedCategoryFilter(e.target.value)}
            className="border border-input bg-background text-foreground rounded-lg px-3 py-2 text-sm min-w-[160px] h-10 focus:ring-2 focus:ring-ring focus:outline-hidden"
          >
            <option value="all">All Categories</option>
            <option value="none">No Category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Modal Product Grid */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 scrollbar-thin bg-muted/20">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {getFilteredProducts(batchSearchQuery).map((p) => {
              const sps = productSupplierPrices[p.id] || [];
              const cheapestPrice = sps.length > 0
                ? Math.min(...sps.map((sp) => sp.price))
                : p.base_price;
              const totalStock = sps.reduce((sum, sp) => sum + sp.stock_qty, 0);
              const qtyRaw = batchQuantities[p.id];
              const qtyVal = parseQuantity(qtyRaw);

              const setQty = (val) => {
                if (val === '' || val === null) {
                  setBatchQuantities((prev) => ({ ...prev, [p.id]: '' }));
                  return;
                }
                setBatchQuantities((prev) => ({ ...prev, [p.id]: val }));
              };

              const increment = () =>
                setBatchQuantities((prev) => ({
                  ...prev,
                  [p.id]: roundMoney(parseQuantity(prev[p.id]) + 1),
                }));

              const decrement = () =>
                setBatchQuantities((prev) => {
                  const curr = parseQuantity(prev[p.id]);
                  if (curr <= 0) return prev;
                  return { ...prev, [p.id]: roundMoney(Math.max(0, curr - 1)) };
                });

              return (
                <div
                  key={p.id}
                  className={`p-4 rounded-xl border transition-all ${
                    qtyVal > 0
                      ? 'border-primary/40 bg-primary/5 shadow-xs'
                      : 'border-border bg-card/60 hover:border-primary/30'
                  }`}
                >
                  <div className="flex items-start gap-3.5 min-h-[5rem]">
                    {/* Interactive Image — click to increment */}
                    <div
                      onClick={increment}
                      className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden flex-shrink-0 bg-muted border border-border cursor-pointer hover:border-primary/50 hover:scale-105 active:scale-95 transition-all select-none"
                      title="Click to increase quantity"
                    >
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.name_en} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground text-lg">📦</div>
                      )}
                    </div>

                    {/* Product Info */}
                    <div className="flex-1 min-w-0 text-left space-y-1">
                      <div className="flex justify-between items-start gap-1.5">
                        <h4 className="font-semibold text-foreground text-xs sm:text-sm line-clamp-2">{p.name_kh}</h4>
                        <span className="text-xs font-bold text-primary shrink-0 font-mono">
                          ${cheapestPrice.toFixed(2)}
                        </span>
                      </div>
                      <div className="text-[10px] text-muted-foreground flex flex-wrap items-center gap-1.5">
                        <span className="line-clamp-1 block w-full">{p.name_en}</span>
                        {p.brand_id && brands.find((b) => b.id === p.brand_id) && (
                          <Badge variant="outline" className="px-1.5 py-0 text-[9px] border-primary/30 text-primary bg-primary/10">
                            {brands.find((b) => b.id === p.brand_id).name}
                          </Badge>
                        )}
                        {p.category_id && categories.find((c) => c.id === p.category_id) && (
                          <Badge variant="outline" className="px-1.5 py-0 text-[9px] border-violet-500/30 text-violet-500 bg-violet-500/10">
                            {categories.find((c) => c.id === p.category_id).name}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between items-center mt-3 pt-3 border-t border-border">
                    <div className="text-[10px] text-muted-foreground text-left">
                      <span className="block font-mono">Cost: ${cheapestPrice.toFixed(2)}</span>
                      <span className={totalStock <= 2 ? 'text-rose-500 font-semibold' : 'text-muted-foreground'}>
                        Stock: {totalStock}
                      </span>
                    </div>

                    {/* Qty stepper supporting decimals */}
                    <div className="flex items-center gap-1 bg-background rounded-lg p-0.5 border border-input">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={decrement}
                        className="h-7 w-7 text-muted-foreground hover:text-foreground active:scale-90 transition-all cursor-pointer"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </Button>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        inputMode="decimal"
                        value={qtyRaw !== undefined ? qtyRaw : ''}
                        placeholder="0"
                        onChange={(e) => setQty(e.target.value)}
                        className="w-12 text-center bg-transparent border-0 outline-none text-xs font-bold text-foreground p-0 font-mono"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={increment}
                        className="h-7 w-7 text-muted-foreground hover:text-foreground active:scale-90 transition-all cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
            {getFilteredProducts(batchSearchQuery).length === 0 && (
              <div className="col-span-full py-12 text-center text-muted-foreground italic text-sm">
                No products found matching your search.
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-border flex flex-col sm:flex-row justify-between items-center gap-3 bg-card/60">
          <div className="text-xs text-muted-foreground text-center sm:text-left">
            Selected: <strong className="text-foreground">{selectedCount}</strong> products
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button type="button" variant="outline" onClick={onClose} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button type="button" onClick={handleApply} className="w-full sm:w-auto">
              Apply to Invoice
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

