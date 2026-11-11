import { useState, useMemo } from 'react';
import { Package, Layers, ListFilter, Search, Eye, EyeOff } from 'lucide-react';
import { db } from '../services/db';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { matchesBrandAndCategoryFilter } from './stock/stockUtils';
import LowStockAlertsCard from './stock/components/LowStockAlertsCard';
import StockProductCards from './stock/components/StockProductCards';
import StockSupplierTables from './stock/components/StockSupplierTables';

export default function StockTracker({ products, suppliers, prices, brands = [], categories = [], onRefresh, showToast }) {
  const [groupMode, setGroupMode] = useState('product'); // 'product' or 'supplier'
  const [lowStockThreshold, setLowStockThreshold] = useState(2);
  const [showLowStockAlerts, setShowLowStockAlerts] = useState(true);
  const [editingPriceId, setEditingPriceId] = useState(null); // id of sp record being edited
  const [editQty, setEditQty] = useState('');
  const [editUnit, setEditUnit] = useState('pcs');
  const [editPrice, setEditPrice] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBrandFilter, setSelectedBrandFilter] = useState('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');

  const productMap = useMemo(() => {
    const map = {};
    products.forEach((p) => { map[p.id] = p; });
    return map;
  }, [products]);

  const supplierMap = useMemo(() => {
    const map = {};
    suppliers.forEach((s) => { map[s.id] = s; });
    return map;
  }, [suppliers]);

  const brandMap = useMemo(() => {
    const map = {};
    brands.forEach((b) => { map[b.id] = b.name; });
    return map;
  }, [brands]);

  const categoryMap = useMemo(() => {
    const map = {};
    categories.forEach((c) => { map[c.id] = c.name; });
    return map;
  }, [categories]);

  const productPricesMap = useMemo(() => {
    const map = {};
    prices.forEach((sp) => {
      if (!map[sp.product_id]) {
        map[sp.product_id] = [];
      }
      map[sp.product_id].push(sp);
    });
    return map;
  }, [prices]);

  // Low stock items: stock_qty <= lowStockThreshold and matches brand + category filters
  const lowStockItems = useMemo(() =>
    prices.filter((sp) => {
      if (sp.stock_qty > lowStockThreshold || sp.price <= 0) return false;
      const prod = productMap[sp.product_id];
      return matchesBrandAndCategoryFilter(prod, selectedBrandFilter, selectedCategoryFilter);
    }),
    [prices, lowStockThreshold, productMap, selectedBrandFilter, selectedCategoryFilter]
  );

  // Filter products based on search term and brand + category
  const filteredProducts = useMemo(() => {
    const queryLower = searchTerm.toLowerCase();
    return products.filter((product) => {
      if (!matchesBrandAndCategoryFilter(product, selectedBrandFilter, selectedCategoryFilter)) {
        return false;
      }

      const matchesName =
        product.name_en.toLowerCase().includes(queryLower) ||
        product.name_kh.includes(searchTerm);

      const productPrices = (productPricesMap[product.id] || []).filter((sp) => sp.price > 0);
      const matchesSupplier = productPrices.some((sp) => {
        const sup = supplierMap[sp.supplier_id];
        return sup && sup.name.toLowerCase().includes(queryLower);
      });

      return matchesName || matchesSupplier;
    });
  }, [products, productPricesMap, supplierMap, selectedBrandFilter, selectedCategoryFilter, searchTerm]);

  // Filter suppliers based on search term and brand + category
  const filteredSuppliers = useMemo(() => {
    const queryLower = searchTerm.toLowerCase();
    return suppliers.filter((supplier) => {
      const supplierPrices = prices.filter((sp) => sp.supplier_id === supplier.id && sp.price > 0);

      const matchingPrices = supplierPrices.filter((sp) => {
        const prod = productMap[sp.product_id];
        return matchesBrandAndCategoryFilter(prod, selectedBrandFilter, selectedCategoryFilter);
      });

      if (matchingPrices.length === 0) return false;

      const matchesSupplierName = supplier.name.toLowerCase().includes(queryLower);
      const matchesProductName = matchingPrices.some((sp) => {
        const prod = productMap[sp.product_id];
        return prod && (
          prod.name_en.toLowerCase().includes(queryLower) ||
          prod.name_kh.includes(searchTerm)
        );
      });

      return matchesSupplierName || matchesProductName;
    });
  }, [suppliers, prices, productMap, selectedBrandFilter, selectedCategoryFilter, searchTerm]);

  const getProductSellingPrice = (productId) => {
    const prod = productMap[productId];
    if (prod && prod.selling_price && Number(prod.selling_price) > 0) {
      return Number(prod.selling_price);
    }
    const sps = productPricesMap[productId] || [];
    if (sps.length > 0) {
      const maxPrice = Math.max(...sps.map((sp) => sp.price));
      return maxPrice > 0 ? maxPrice + 0.20 : 0;
    }
    return prod ? prod.base_price + 0.20 : 0;
  };

  const handleQuickRestock = async (spRecord, amount) => {
    try {
      await db.updateSupplierPrice({
        ...spRecord,
        stock_qty: spRecord.stock_qty + amount,
      });
      showToast('Stock added successfully!', 'success');
      onRefresh();
    } catch (err) {
      showToast('Error restock: ' + err.message, 'error');
    }
  };

  const startEditing = (sp) => {
    setEditingPriceId(sp.id);
    setEditQty(sp.stock_qty.toString());
    setEditUnit(sp.stock_unit || 'pcs');
    setEditPrice(sp.price > 0 ? sp.price.toString() : '');
  };

  const saveInlineEdit = async (sp) => {
    setIsSaving(true);
    try {
      await db.updateSupplierPrice({
        ...sp,
        price: editPrice ? Number(editPrice) : sp.price,
        stock_qty: Number(editQty),
        stock_unit: editUnit,
      });
      setEditingPriceId(null);
      showToast('Stock details updated!', 'success');
      onRefresh();
    } catch (err) {
      showToast('Error saving: ' + err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <Card className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-6 bg-card/60 backdrop-blur-md border-border shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-foreground tracking-wide">Stock Tracker</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Monitor product availability, adjust threshold levels, and review inventory counts.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Threshold:</span>
          <select
            value={lowStockThreshold}
            onChange={(e) => setLowStockThreshold(Number(e.target.value))}
            className="flex h-8 w-14 rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-center font-mono font-bold"
          >
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="5">5</option>
            <option value="10">10</option>
          </select>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowLowStockAlerts(!showLowStockAlerts)}
            className="h-8 gap-1.5 text-xs font-medium"
            type="button"
          >
            {showLowStockAlerts ? (
              <>
                <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
                Hide Alerts
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5 text-primary" />
                Show Alerts ({lowStockItems.length})
              </>
            )}
          </Button>
        </div>
      </Card>

      {/* Low Stock Alerts */}
      {showLowStockAlerts && (
        <LowStockAlertsCard
          lowStockItems={lowStockItems}
          productMap={productMap}
          supplierMap={supplierMap}
          onQuickRestock={handleQuickRestock}
        />
      )}

      {/* Main Inventory Log Section */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
            <Package className="w-4.5 h-4.5 text-primary" />
            Inventory Records
          </h3>

          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center flex-1 max-w-2xl justify-end">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search products or suppliers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 text-xs bg-background/50 border-input"
              />
            </div>

            <select
              value={selectedBrandFilter}
              onChange={(e) => setSelectedBrandFilter(e.target.value)}
              className="flex h-9 rounded-md border border-input bg-card px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-foreground min-w-[130px]"
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
              className="flex h-9 rounded-md border border-input bg-card px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-foreground min-w-[130px]"
            >
              <option value="all">All Categories</option>
              <option value="none">No Category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg border border-border self-end sm:self-auto">
              <Button
                type="button"
                variant={groupMode === 'product' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setGroupMode('product')}
                className="h-7 px-2.5 text-xs font-semibold gap-1.5"
              >
                <Layers className="w-3.5 h-3.5" />
                By Product
              </Button>
              <Button
                type="button"
                variant={groupMode === 'supplier' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setGroupMode('supplier')}
                className="h-7 px-2.5 text-xs font-semibold gap-1.5"
              >
                <ListFilter className="w-3.5 h-3.5" />
                By Supplier
              </Button>
            </div>
          </div>
        </div>

        {groupMode === 'product' ? (
          <StockProductCards
            filteredProducts={filteredProducts}
            productPricesMap={productPricesMap}
            supplierMap={supplierMap}
            brandMap={brandMap}
            categoryMap={categoryMap}
            lowStockThreshold={lowStockThreshold}
            editingPriceId={editingPriceId}
            editQty={editQty}
            editUnit={editUnit}
            editPrice={editPrice}
            isSaving={isSaving}
            onEditQtyChange={setEditQty}
            onEditUnitChange={setEditUnit}
            onEditPriceChange={setEditPrice}
            onStartEditing={startEditing}
            onSaveInlineEdit={saveInlineEdit}
            onCancelEditing={() => setEditingPriceId(null)}
          />
        ) : (
          <StockSupplierTables
            filteredSuppliers={filteredSuppliers}
            prices={prices}
            productMap={productMap}
            brandMap={brandMap}
            categoryMap={categoryMap}
            selectedBrandFilter={selectedBrandFilter}
            selectedCategoryFilter={selectedCategoryFilter}
            searchTerm={searchTerm}
            lowStockThreshold={lowStockThreshold}
            editingPriceId={editingPriceId}
            editQty={editQty}
            editUnit={editUnit}
            editPrice={editPrice}
            isSaving={isSaving}
            onEditQtyChange={setEditQty}
            onEditUnitChange={setEditUnit}
            onEditPriceChange={setEditPrice}
            onStartEditing={startEditing}
            onSaveInlineEdit={saveInlineEdit}
            onCancelEditing={() => setEditingPriceId(null)}
            getProductSellingPrice={getProductSellingPrice}
          />
        )}
      </div>
    </div>
  );
}
