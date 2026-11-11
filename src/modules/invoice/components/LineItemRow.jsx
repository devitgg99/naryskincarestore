import {
  Trash2, ChevronUp, ChevronDown, AlertTriangle, Clock,
  Edit2, ImageIcon, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { formatStockInTime, roundMoney, parseQuantity } from '../invoiceUtils';

/**
 * LineItemRow — A single invoice line item card (mobile+desktop responsive).
 * Handles both catalog products and freeform custom items.
 *
 * Props:
 *   item                  — LineItem
 *   idx                   — number (row index)
 *   isLast                — boolean (is this the last row in the list)
 *   products              — Product[]
 *   suppliers             — Supplier[]
 *   productSupplierPrices — { [product_id]: SupplierPrice[] }
 *   getFilteredProducts(query) — (q:string) => Product[]
 *   onUpdateItem(idx, field, value)
 *   onSelectProduct(idx, product)
 *   onRemoveItem(idx)
 *   onMoveItem(idx, direction)
 *   onOpenSupplierPicker(idx)
 *   onOpenStockEdit(idx, product, supplier, priceObj)
 *   setLineItems — direct state setter (for custom name blur/enter to add row)
 *   createEmptyLineItem() — factory
 */
export default function LineItemRow({
  item,
  idx,
  isLast,
  products,
  suppliers,
  productSupplierPrices,
  getFilteredProducts,
  onUpdateItem,
  onSelectProduct,
  onRemoveItem,
  onMoveItem,
  onOpenSupplierPicker,
  onOpenStockEdit,
  setLineItems,
  createEmptyLineItem,
}) {
  const sps = productSupplierPrices[item.product_id] || [];
  const cheapestSp = [...sps].sort((a, b) => a.price - b.price)[0];
  const numericQty = parseQuantity(item.quantity);
  const isStockWarning = item.product_id && item.supplier_id && numericQty > item.maxStock;
  const prod = products.find((p) => p.id === item.product_id);
  const selectedSp = item.supplier_id
    ? sps.find((sp) => sp.supplier_id === item.supplier_id)
    : sps.length > 0
    ? sps[0]
    : null;
  const selectedSup = selectedSp ? suppliers.find((s) => s.id === selectedSp.supplier_id) : null;
  const isSelectedCheapest =
    selectedSp && cheapestSp && selectedSp.supplier_id === cheapestSp.supplier_id;
  const selectedStockTime = selectedSp ? formatStockInTime(selectedSp.updated_at) : null;

  return (
    <div className="p-3.5 sm:p-4 rounded-xl border border-border bg-card/40 space-y-3 transition-colors hover:border-primary/30">

      {/* ── Mobile Header Bar ── */}
      <div className="flex items-center justify-between gap-2 sm:hidden pb-1 border-b border-border/40">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg border border-border flex items-center justify-center overflow-hidden bg-muted shrink-0">
            {item.isCustom ? (
              <span className="text-[9px] text-violet-500 font-bold">Custom</span>
            ) : prod && prod.image_url ? (
              <img src={prod.image_url} alt="Product" className="w-full h-full object-cover rounded-lg" />
            ) : (
              <ImageIcon className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
          <span className="text-xs font-bold text-foreground">Item #{idx + 1}</span>
          {prod && (
            <span className="text-[10px] bg-primary/10 text-primary font-semibold px-2 py-0.5 rounded truncate max-w-[120px]">
              {prod.brand || prod.category || 'Catalog'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Button
            type="button"
            variant={item.isCustom ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => onUpdateItem(idx, 'isCustom', !item.isCustom)}
            className={`h-8 px-2 text-[10px] font-bold ${
              item.isCustom ? 'border-violet-500/30 text-violet-500 hover:bg-violet-500/20' : ''
            }`}
            title={item.isCustom ? 'Switch to Catalog item select' : 'Switch to freeform manual input'}
          >
            {item.isCustom ? 'Custom' : 'Catalog'}
          </Button>

          <div className="flex items-center">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onMoveItem(idx, -1)}
              disabled={idx === 0}
              className="h-8 w-7 text-muted-foreground hover:text-foreground"
              title="Move up"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onMoveItem(idx, 1)}
              disabled={isLast}
              className="h-8 w-7 text-muted-foreground hover:text-foreground"
              title="Move down"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </Button>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onRemoveItem(idx)}
            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            title="Remove row"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* ── Main Product Selector Row ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
        {/* Desktop Thumbnail */}
        <div className="hidden sm:flex w-10 h-10 sm:w-11 sm:h-11 rounded-xl border border-border items-center justify-center overflow-hidden bg-muted shrink-0 shadow-xs">
          {item.isCustom ? (
            <span className="text-[10px] text-violet-500 font-bold bg-violet-500/10 w-full h-full flex items-center justify-center">Custom</span>
          ) : prod && prod.image_url ? (
            <img src={prod.image_url} alt="Product" className="w-full h-full object-cover rounded-xl" />
          ) : (
            <ImageIcon className="w-5 h-5 text-muted-foreground" />
          )}
        </div>

        {/* Product Search / Custom Name Input */}
        <div className="flex-1 relative min-w-0">
          {item.isCustom ? (
            <Input
              type="text"
              placeholder="Custom item name..."
              value={item.custom_name || ''}
              onChange={(e) => onUpdateItem(idx, 'custom_name', e.target.value)}
              onBlur={() => {
                if (item.custom_name?.trim() && isLast) {
                  setLineItems((prev) => {
                    const last = prev[prev.length - 1];
                    if (last && (last.product_id || (last.isCustom && last.custom_name?.trim()))) {
                      return [...prev, createEmptyLineItem()];
                    }
                    return prev;
                  });
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (item.custom_name?.trim() && isLast) {
                    setLineItems((prev) => {
                      const last = prev[prev.length - 1];
                      if (last && (last.product_id || (last.isCustom && last.custom_name?.trim()))) {
                        return [...prev, createEmptyLineItem()];
                      }
                      return prev;
                    });
                  }
                }
              }}
              className="w-full border-violet-500/30 focus-visible:border-violet-500/60 text-xs sm:text-sm font-medium h-10"
            />
          ) : (
            <>
              <div className="relative">
                <Input
                  type="text"
                  placeholder="Search product by name or barcode..."
                  value={
                    item.searchQuery !== undefined
                      ? item.searchQuery
                      : prod
                      ? `${prod.name_kh} (${prod.name_en})`
                      : ''
                  }
                  title={prod ? `${prod.name_kh} (${prod.name_en})` : item.searchQuery || ''}
                  onFocus={() => {
                    setLineItems((prevItems) =>
                      prevItems.map((li, i) => {
                        if (i === idx) {
                          const currentProd = products.find((p) => p.id === li.product_id);
                          return {
                            ...li,
                            isDropdownOpen: true,
                            searchQuery: currentProd
                              ? `${currentProd.name_kh} (${currentProd.name_en})`
                              : li.searchQuery || '',
                          };
                        }
                        return { ...li, isDropdownOpen: false };
                      })
                    );
                  }}
                  onBlur={() => {
                    setTimeout(() => {
                      setLineItems((prevItems) =>
                        prevItems.map((li, i) => {
                          if (i === idx) {
                            const currentProd = products.find((p) => p.id === li.product_id);
                            return {
                              ...li,
                              isDropdownOpen: false,
                              searchQuery: currentProd
                                ? `${currentProd.name_kh} (${currentProd.name_en})`
                                : '',
                            };
                          }
                          return li;
                        })
                      );
                    }, 200);
                  }}
                  onChange={(e) => {
                    const val = e.target.value;
                    setLineItems((prevItems) =>
                      prevItems.map((li, i) =>
                        i === idx ? { ...li, searchQuery: val, isDropdownOpen: true } : li
                      )
                    );
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const matches = getFilteredProducts(item.searchQuery || '');
                      if (matches.length > 0) {
                        onSelectProduct(idx, matches[0]);
                      }
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      setLineItems((prevItems) =>
                        prevItems.map((li, i) =>
                          i === idx ? { ...li, isDropdownOpen: false } : li
                        )
                      );
                    }
                  }}
                  className="w-full text-xs sm:text-sm h-10 pr-8"
                />
                {item.searchQuery && (
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setLineItems((prevItems) =>
                        prevItems.map((li, i) =>
                          i === idx ? { ...li, searchQuery: '', isDropdownOpen: true } : li
                        )
                      );
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Selected Product Details Banner */}
              {prod && (
                <div className="mt-1.5 px-3 py-1.5 rounded-lg bg-muted/60 border border-border/70 flex flex-wrap items-center justify-between gap-1.5 text-xs animate-in fade-in-50 duration-150">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-foreground text-xs leading-snug break-words">
                      {prod.name_kh}
                      {prod.name_en && (
                        <span className="text-muted-foreground font-normal ml-1.5 break-words">
                          ({prod.name_en})
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground flex-wrap">
                      {prod.barcode && <span>Barcode: <span className="font-mono">{prod.barcode}</span></span>}
                      {prod.brand && <span>Brand: <span className="font-medium text-foreground">{prod.brand}</span></span>}
                      {prod.category && <span>Category: <span className="font-medium text-foreground">{prod.category}</span></span>}
                    </div>
                  </div>
                </div>
              )}

              {/* Search Dropdown */}
              {item.isDropdownOpen && (
                <div
                  onMouseDown={(e) => e.preventDefault()}
                  className="absolute left-0 right-0 sm:left-0 sm:right-auto w-full sm:w-[500px] md:w-[560px] max-w-[95vw] mt-1 max-h-72 overflow-y-auto z-50 rounded-xl bg-popover/98 backdrop-blur-md border border-border shadow-2xl divide-y divide-border/60 scrollbar-thin animate-in fade-in-50 zoom-in-95 duration-100 touch-pan-y overscroll-contain"
                >
                  {getFilteredProducts(item.searchQuery || '').map((p) => {
                    const pSps = productSupplierPrices[p.id] || [];
                    const cheapestPrice =
                      pSps.length > 0
                        ? Math.min(...pSps.map((sp) => sp.price))
                        : p.base_price || 0;
                    const totalStock = pSps.reduce((sum, sp) => sum + (sp.stock_qty || 0), 0);

                    return (
                      <div
                        key={p.id}
                        className="p-3 hover:bg-muted/40 transition-colors flex items-center justify-between gap-3 min-h-[56px]"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-muted border border-border/60 flex items-center justify-center">
                            {p.image_url ? (
                              <img src={p.image_url} alt={p.name_en || p.name_kh} className="w-full h-full object-cover" />
                            ) : (
                              <ImageIcon className="w-4 h-4 text-muted-foreground" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <div className="font-semibold text-foreground text-xs sm:text-sm leading-snug break-words">{p.name_kh}</div>
                            {p.name_en && (
                              <div className="text-[11px] text-muted-foreground leading-tight break-words">{p.name_en}</div>
                            )}
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground flex-wrap">
                              {p.barcode && <span className="font-mono">#{p.barcode}</span>}
                              {p.brand && <span className="bg-muted px-1.5 py-0.2 rounded">{p.brand}</span>}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0">
                          <div className="text-right text-[10px] text-muted-foreground">
                            <span className="block font-bold text-foreground text-xs sm:text-sm">${cheapestPrice.toFixed(2)}</span>
                            <span className={totalStock <= 2 ? 'text-destructive font-semibold' : ''}>
                              Stock: {totalStock}
                            </span>
                          </div>

                          <Button
                            type="button"
                            size="sm"
                            onMouseDown={(e) => { e.preventDefault(); onSelectProduct(idx, p); }}
                            onTouchEnd={(e) => { e.preventDefault(); onSelectProduct(idx, p); }}
                            onClick={(e) => { e.preventDefault(); onSelectProduct(idx, p); }}
                            className="h-8 px-3 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 shrink-0 rounded-lg shadow-sm active:scale-95 transition-transform"
                          >
                            + Add
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                  {getFilteredProducts(item.searchQuery || '').length === 0 && (
                    <div className="p-4 text-muted-foreground text-xs italic text-center">No products found</div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Desktop Controls */}
        <div className="hidden sm:flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant={item.isCustom ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => onUpdateItem(idx, 'isCustom', !item.isCustom)}
            className={`h-10 px-2.5 text-[11px] font-bold shrink-0 ${
              item.isCustom ? 'border-violet-500/30 text-violet-500 hover:bg-violet-500/20' : ''
            }`}
            title={item.isCustom ? 'Switch to Catalog item select' : 'Switch to freeform manual input'}
          >
            {item.isCustom ? 'Custom' : 'Catalog'}
          </Button>

          <div className="flex flex-col gap-0.5 shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onMoveItem(idx, -1)}
              disabled={idx === 0}
              className="h-5 w-8 text-muted-foreground hover:text-foreground"
              title="Move up"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onMoveItem(idx, 1)}
              disabled={isLast}
              className="h-5 w-8 text-muted-foreground hover:text-foreground"
              title="Move down"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </Button>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onRemoveItem(idx)}
            className="h-10 w-10 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
            title="Remove row"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* ── Controls Grid: Supplier, Unit Price, Qty, Subtotal ── */}
      <div className="grid grid-cols-2 sm:grid-cols-12 gap-3 items-end pt-1">
        {/* Supplier Selector */}
        <div className="col-span-2 sm:col-span-5 space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Supplier &amp; Cost Price
            </label>
            {selectedStockTime && !item.isCustom && (
              <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1 sm:hidden">
                <Clock className="w-3 h-3 text-primary" />
                In: {selectedStockTime.relativeShort || selectedStockTime.relative}
              </span>
            )}
          </div>

          {item.isCustom ? (
            <div className="w-full border border-dashed border-border rounded-lg bg-muted/30 text-muted-foreground text-xs italic flex items-center justify-center h-10">
              No Supplier (Ad-hoc)
            </div>
          ) : (
            <>
              {/* Mobile: Thumb-friendly trigger card */}
              <div className="sm:hidden">
                <button
                  type="button"
                  disabled={!item.product_id}
                  onClick={() => onOpenSupplierPicker(idx)}
                  className={`w-full min-h-[46px] p-2.5 rounded-xl border transition-all text-left flex items-center justify-between gap-2.5 active:scale-[0.99] ${
                    !item.product_id
                      ? 'opacity-40 border-input bg-background cursor-not-allowed'
                      : isSelectedCheapest
                      ? 'border-emerald-500/40 bg-emerald-500/5 hover:bg-emerald-500/10'
                      : 'border-input bg-card hover:bg-muted/40'
                  }`}
                >
                  {selectedSup ? (
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-xs text-foreground truncate">{selectedSup.name}</span>
                        {isSelectedCheapest && (
                          <Badge className="text-[9px] font-extrabold uppercase bg-emerald-600 text-white px-1.5 py-0 leading-tight shrink-0">
                            Cheapest ★
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[11px] flex-wrap">
                        <span className={`font-bold font-mono ${isSelectedCheapest ? 'text-emerald-500' : 'text-foreground'}`}>
                          ${Number(selectedSp.price || 0).toFixed(2)}
                        </span>
                        <span className={`text-[10px] ${selectedSp.stock_qty <= 2 ? 'text-destructive font-bold' : 'text-muted-foreground'}`}>
                          (Qty: {selectedSp.stock_qty}{selectedSp.stock_unit && selectedSp.stock_unit !== 'pcs' ? ` ${selectedSp.stock_unit}` : ''})
                        </span>
                        {selectedStockTime && (
                          <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-0.5 truncate">
                            • In: {selectedStockTime.relativeShort || selectedStockTime.relative}
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground italic">
                      {sps.length === 0 ? 'No suppliers available' : 'Tap to select supplier...'}
                    </span>
                  )}

                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[10px] font-semibold bg-primary/10 text-primary px-2 py-1 rounded-md">
                      {sps.length > 1 ? `${sps.length} offers` : 'Change'}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                </button>
              </div>

              {/* Desktop: Select + Edit button */}
              <div className="hidden sm:flex items-center gap-1.5">
                <select
                  required={Boolean(item.product_id)}
                  disabled={!item.product_id}
                  value={item.supplier_id}
                  onChange={(e) => onUpdateItem(idx, 'supplier_id', e.target.value)}
                  className="w-full border border-input bg-background text-foreground rounded-lg px-3 py-2 text-xs disabled:opacity-40 h-10 focus:ring-2 focus:ring-ring focus:outline-hidden"
                >
                  {sps.length === 0 ? (
                    <option value="">No suppliers</option>
                  ) : (
                    sps.map((sp) => {
                      const sup = suppliers.find((s) => s.id === sp.supplier_id);
                      const name = sup ? sup.name : 'Unknown';
                      const cheapestLabel = cheapestSp && cheapestSp.supplier_id === sp.supplier_id ? ' ★' : '';
                      const timeInfo = formatStockInTime(sp.updated_at);
                      const timeLabel = timeInfo ? ` • In: ${timeInfo.relative}` : '';
                      const unitLabel = sp.stock_unit && sp.stock_unit !== 'pcs' ? ` ${sp.stock_unit}` : '';
                      return (
                        <option key={sp.supplier_id} value={sp.supplier_id}>
                          {name}: ${Number(sp.price || 0).toFixed(2)} (Qty: {sp.stock_qty}{unitLabel}){timeLabel}{cheapestLabel}
                        </option>
                      );
                    })
                  )}
                </select>

                {selectedSp && prod && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => onOpenStockEdit(idx, prod, selectedSup, selectedSp)}
                    className="h-10 w-10 shrink-0 text-muted-foreground hover:text-primary hover:border-primary/50"
                    title="Quick update stock & cost price"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>

              {/* Stock-In History Sub-Bar */}
              {selectedSp && prod && (
                <div className="flex flex-wrap items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted/40 border border-border/50 text-[10px]">
                  <div className="flex items-center gap-1.5 text-muted-foreground min-w-0">
                    <Clock className="w-3 h-3 text-primary shrink-0" />
                    <span className="font-medium">Stock In:</span>
                    {selectedStockTime ? (
                      <span className="font-semibold text-foreground truncate" title={selectedStockTime.full}>
                        {selectedStockTime.relative}{' '}
                        <span className="text-muted-foreground font-normal">({selectedStockTime.formattedDate})</span>
                      </span>
                    ) : (
                      <span className="italic text-muted-foreground">Not recorded</span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => onOpenStockEdit(idx, prod, selectedSup, selectedSp)}
                    className="text-primary hover:text-primary/80 font-bold flex items-center gap-1 shrink-0 ml-auto transition-colors"
                  >
                    <Edit2 className="w-2.5 h-2.5" />
                    <span>Update Stock</span>
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Unit Price */}
        <div className="col-span-1 sm:col-span-2">
          <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
            Unit Price ($)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-semibold">$</span>
            <Input
              type="number"
              step="0.01"
              min="0"
              required={Boolean(item.product_id || (item.isCustom && item.custom_name))}
              value={item.unit_price}
              onChange={(e) => onUpdateItem(idx, 'unit_price', e.target.value)}
              className="w-full pl-6 pr-2 h-10 text-left text-foreground text-xs font-semibold"
            />
          </div>
        </div>

        {/* Quantity */}
        <div className="col-span-1 sm:col-span-2">
          <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
            Qty (Float)
          </label>
          <Input
            type="number"
            step="any"
            min="0"
            inputMode="decimal"
            required={Boolean(item.product_id || (item.isCustom && item.custom_name))}
            placeholder="1"
            value={item.quantity}
            onChange={(e) => onUpdateItem(idx, 'quantity', e.target.value)}
            className="w-full h-10 text-center text-xs font-semibold text-foreground"
          />
        </div>

        {/* Line Total + Profit */}
        <div className="col-span-2 sm:col-span-3 text-right flex sm:flex-col justify-between sm:justify-end items-center sm:items-end pt-1 sm:pt-0">
          <div>
            <span className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider sm:mb-1">Line Total</span>
            <span className="font-bold text-foreground text-sm sm:text-base font-mono">
              ${roundMoney(Number(item.unit_price || 0) * numericQty).toFixed(2)}
            </span>
          </div>

          {item.product_id && !item.isCustom && (
            <div
              className="text-[10px] text-emerald-500 font-medium truncate"
              title={`Cost: $${Number(item.supplier_price || 0).toFixed(2)} / unit`}
            >
              Profit: +${roundMoney((Number(item.unit_price || 0) - Number(item.supplier_price || 0)) * numericQty).toFixed(2)}
            </div>
          )}
          {item.isCustom && (
            <div className="text-[10px] text-muted-foreground font-medium">Ad-hoc item</div>
          )}
        </div>
      </div>

      {/* Stock Warning */}
      {!item.isCustom && isStockWarning && (
        <div className="flex items-center gap-1.5 text-[11px] font-bold bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 px-3 py-1.5 rounded-lg mt-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>Stock Warning: Available stock is only {item.maxStock} {item.stockUnit}</span>
        </div>
      )}
    </div>
  );
}

