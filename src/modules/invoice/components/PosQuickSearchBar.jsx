import { Search, X, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { parseQuantity } from '../invoiceUtils';

/**
 * PosQuickSearchBar — POS-style quick product search & barcode scanner bar
 * with dropdown quick-add results and camera scanner trigger.
 */
export default function PosQuickSearchBar({
  quickInputRef,
  quickSearchQuery,
  setQuickSearchQuery,
  isQuickDropdownOpen,
  setIsQuickDropdownOpen,
  isScannerMode,
  setIsScannerMode,
  onBarcodeSubmit,
  onOpenBarcodeCamera,
  getFilteredProducts,
  productSupplierPrices,
  lineItems,
  onAddProduct,
}) {
  const selectQuickProduct = (e, productId) => {
    e.preventDefault();
    onAddProduct(productId, 1);
    setQuickSearchQuery('');
    setIsQuickDropdownOpen(false);
    quickInputRef.current?.focus();
  };

  return (
    <div className={`relative z-30 ${isScannerMode ? 'sm:sticky sm:top-2' : ''}`}>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-dark-500" />
          <input
            ref={quickInputRef}
            type="text"
            inputMode="numeric"
            placeholder={isScannerMode ? 'Scan barcode or type product name…' : '⚡ POS Quick Search & Add Product...'}
            value={quickSearchQuery}
            onChange={(e) => {
              setQuickSearchQuery(e.target.value);
              setIsQuickDropdownOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (e.repeat) return;
                onBarcodeSubmit(e.target.value);
              }
            }}
            onFocus={() => setIsQuickDropdownOpen(true)}
            onBlur={() => {
              setTimeout(() => setIsQuickDropdownOpen(false), 200);
            }}
            className={`w-full pl-11 pr-10 glass-input min-h-[44px] text-xs sm:text-sm font-medium border-primary-500/20 focus:border-primary-500/50 shadow-inner ${isScannerMode ? 'sm:min-h-[52px] text-sm' : ''}`}
          />
          {quickSearchQuery && (
            <button
              type="button"
              onClick={() => {
                setQuickSearchQuery('');
                setIsQuickDropdownOpen(false);
              }}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-dark-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <Button
          type="button"
          variant={isScannerMode ? 'default' : 'outline'}
          size="sm"
          onClick={() => {
            setIsScannerMode((prev) => !prev);
            setTimeout(() => quickInputRef.current?.focus(), 50);
          }}
          className="h-10 px-3 text-[11px] font-bold whitespace-nowrap"
          title="Toggle barcode scanner mode"
        >
          {isScannerMode ? 'Scanner On' : 'Scan Barcode'}
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onOpenBarcodeCamera}
          className="h-10 px-3 text-[11px] font-bold whitespace-nowrap gap-1"
          title="Open camera scan mode on your iPhone or tablet"
        >
          <Camera className="w-3.5 h-3.5" />
          Camera
        </Button>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => onBarcodeSubmit()}
          className="h-10 px-3 text-[11px] font-bold whitespace-nowrap"
          title="Add the current barcode or product match to the invoice"
        >
          Add
        </Button>
      </div>

      {isQuickDropdownOpen && quickSearchQuery && (
        <div
          onMouseDown={(e) => e.preventDefault()}
          className="absolute left-0 right-0 mt-1 max-h-60 overflow-y-auto z-50 rounded-xl bg-dark-900 border border-dark-800 shadow-2xl divide-y divide-dark-850 scrollbar-thin animate-in slide-in-from-top-2 duration-150"
        >
          {getFilteredProducts(quickSearchQuery).map((p) => {
            const sps = productSupplierPrices[p.id] || [];
            const cheapestPrice = sps.length > 0
              ? Math.min(...sps.map((sp) => sp.price))
              : p.base_price;
            const totalStock = sps.reduce((sum, sp) => sum + sp.stock_qty, 0);
            const existingQty = lineItems
              .filter((item) => item.product_id === p.id)
              .reduce((sum, item) => sum + parseQuantity(item.quantity), 0);

            return (
              <div
                key={p.id}
                className="p-3 hover:bg-dark-850/50 transition-colors flex justify-between items-center gap-3 min-h-[48px]"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 bg-dark-800 border border-dark-700 flex items-center justify-center">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name_en} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-dark-600 text-xs">📦</div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="font-semibold text-white text-xs sm:text-sm leading-snug break-words">{p.name_kh}</div>
                    <div className="text-[10px] text-dark-400 leading-tight break-words">{p.name_en}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  <div className="text-right text-[10px] text-dark-400">
                    <span className="block font-medium text-white">${cheapestPrice.toFixed(2)}</span>
                    <span>{p.barcode ? `Barcode: ${p.barcode}` : 'Stock: ' + totalStock}</span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onMouseDown={(e) => selectQuickProduct(e, p.id)}
                    onTouchEnd={(e) => selectQuickProduct(e, p.id)}
                    onClick={(e) => selectQuickProduct(e, p.id)}
                    className={`h-7 px-2.5 text-[11px] font-bold rounded-md shadow-xs active:scale-95 transition-all ${
                      existingQty > 0
                        ? 'bg-primary-500/20 text-primary-400 border border-primary-500/40 hover:bg-primary-500/30'
                        : 'bg-primary text-primary-foreground hover:bg-primary/90'
                    }`}
                  >
                    {existingQty > 0 ? `+1 (${existingQty})` : '+ Add'}
                  </Button>
                </div>
              </div>
            );
          })}
          {getFilteredProducts(quickSearchQuery).length === 0 && (
            <div className="p-3 text-dark-500 text-xs italic text-center">No products found</div>
          )}
        </div>
      )}
    </div>
  );
}

