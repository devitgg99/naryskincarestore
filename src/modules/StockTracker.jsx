import { useState } from 'react';
import { Package, AlertTriangle, Check, Layers, ListFilter, Search, Eye, EyeOff, ImageIcon } from 'lucide-react';
import { db } from '../services/db';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';


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

  // Group prices
  const productMap = {};
  products.forEach(p => { productMap[p.id] = p; });

  const supplierMap = {};
  suppliers.forEach(s => { supplierMap[s.id] = s; });

  // Low stock items: stock_qty <= lowStockThreshold and matches brand + category filters
  const lowStockItems = prices.filter(sp => {
    if (sp.stock_qty > lowStockThreshold || sp.price <= 0) return false;
    
    const prod = productMap[sp.product_id];
    if (!prod) return false;
 
    if (selectedBrandFilter !== 'all') {
      if (selectedBrandFilter === 'none') {
        if (prod.brand_id) return false;
      } else {
        if (prod.brand_id !== selectedBrandFilter) return false;
      }
    }
 
    if (selectedCategoryFilter !== 'all') {
      if (selectedCategoryFilter === 'none') {
        if (prod.category_id) return false;
      } else {
        if (prod.category_id !== selectedCategoryFilter) return false;
      }
    }
    return true;
  });

  // Group prices by product_id
  const productPricesMap = {};
  prices.forEach(sp => {
    if (!productPricesMap[sp.product_id]) {
      productPricesMap[sp.product_id] = [];
    }
    productPricesMap[sp.product_id].push(sp);
  });

  // Filter products based on search term and brand + category
  const filteredProducts = products.filter(product => {
    if (selectedBrandFilter !== 'all') {
      if (selectedBrandFilter === 'none') {
        if (product.brand_id) return false;
      } else {
        if (product.brand_id !== selectedBrandFilter) return false;
      }
    }
 
    if (selectedCategoryFilter !== 'all') {
      if (selectedCategoryFilter === 'none') {
        if (product.category_id) return false;
      } else {
        if (product.category_id !== selectedCategoryFilter) return false;
      }
    }

    const matchesName = 
      product.name_en.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.name_kh.includes(searchTerm);
    
    const productPrices = prices.filter(sp => sp.product_id === product.id && sp.price > 0);
    const matchesSupplier = productPrices.some(sp => {
      const sup = supplierMap[sp.supplier_id];
      return sup && sup.name.toLowerCase().includes(searchTerm.toLowerCase());
    });

    return matchesName || matchesSupplier;
  });

  // Filter suppliers based on search term and brand
  const filteredSuppliers = suppliers.filter(supplier => {
    const supplierPrices = prices.filter(sp => sp.supplier_id === supplier.id && sp.price > 0);
    
    // Filter supplier's offers by brand and category first
    const brandMatchingPrices = supplierPrices.filter(sp => {
      const prod = productMap[sp.product_id];
      if (!prod) return false;
      if (selectedBrandFilter !== 'all') {
        if (selectedBrandFilter === 'none') {
          if (prod.brand_id) return false;
        } else {
          if (prod.brand_id !== selectedBrandFilter) return false;
        }
      }
      if (selectedCategoryFilter !== 'all') {
        if (selectedCategoryFilter === 'none') {
          if (prod.category_id) return false;
        } else {
          if (prod.category_id !== selectedCategoryFilter) return false;
        }
      }
      return true;
    });

    if (brandMatchingPrices.length === 0) return false;

    const matchesSupplierName = supplier.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesProductName = brandMatchingPrices.some(sp => {
      const prod = productMap[sp.product_id];
      return prod && (
        prod.name_en.toLowerCase().includes(searchTerm.toLowerCase()) ||
        prod.name_kh.includes(searchTerm)
      );
    });

    return matchesSupplierName || matchesProductName;
  });

  const getProductSellingPrice = (productId) => {
    const prod = productMap[productId];
    if (prod && prod.selling_price && Number(prod.selling_price) > 0) {
      return Number(prod.selling_price);
    }
    const sps = productPricesMap[productId] || [];
    if (sps.length > 0) {
      const maxPrice = Math.max(...sps.map(sp => sp.price));
      return maxPrice > 0 ? maxPrice + 0.20 : 0;
    }
    return prod ? prod.base_price + 0.20 : 0;
  };

  const handleQuickRestock = async (spRecord, amount) => {
    try {
      await db.updateSupplierPrice({
        ...spRecord,
        stock_qty: spRecord.stock_qty + amount
      });
      showToast("Stock added successfully!", "success");
      onRefresh();
    } catch (err) {
      showToast("Error restock: " + err.message, "error");
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
        stock_unit: editUnit
      });
      setEditingPriceId(null);
      showToast("Stock details updated!", "success");
      onRefresh();
    } catch (err) {
      showToast("Error saving: " + err.message, "error");
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
      {showLowStockAlerts && lowStockItems.length > 0 && (
        <Card className="bg-destructive/5 border-destructive/20 p-6 space-y-4 shadow-xs">
          <div className="flex items-center gap-2 text-destructive font-bold text-sm sm:text-base">
            <AlertTriangle className="w-4.5 h-4.5" />
            <h3>Low Stock Warnings ({lowStockItems.length} items)</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {lowStockItems.map(sp => {
              const prod = productMap[sp.product_id];
              const sup = supplierMap[sp.supplier_id];
              if (!prod || !sup) return null;

              return (
                <Card 
                  key={sp.id} 
                  className="bg-card/80 border-destructive/20 p-3.5 flex justify-between items-center shadow-xs"
                >
                  <div className="flex items-center gap-3">
                    {/* Thumbnail */}
                    <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-muted border border-border">
                      {prod.image_url ? (
                        <img src={prod.image_url} alt={prod.name_en} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageIcon className="w-4 h-4 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="space-y-0.5">
                      <span className="font-bold text-foreground text-xs block">{prod.name_kh}</span>
                      <span className="text-[11px] text-muted-foreground block truncate max-w-[130px]">{prod.name_en}</span>
                      <Badge variant="destructive" className="text-[9px] px-1.5 py-0 mt-1">
                        {sup.name}: {sp.stock_qty} {sp.stock_unit}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Button
                      size="sm"
                      onClick={() => handleQuickRestock(sp, 12)}
                      className="h-6 text-[10px] px-2 bg-emerald-600 hover:bg-emerald-500 font-bold"
                    >
                      +12 ({sp.stock_unit === 'pcs' ? 'pcs' : sp.stock_unit})
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleQuickRestock(sp, 24)}
                      className="h-6 text-[10px] px-2 font-bold"
                    >
                      +24
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </Card>
      )}

      {/* Main Inventory Log Section */}
      <div className="space-y-4">
        {/* Toggle & Search bar */}
        <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
            <Package className="w-4.5 h-4.5 text-primary" />
            Inventory Records
          </h3>

          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center flex-1 max-w-2xl justify-end">
            {/* Search Input */}
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

            {/* Brand Filter */}
            <select
              value={selectedBrandFilter}
              onChange={(e) => setSelectedBrandFilter(e.target.value)}
              className="flex h-9 rounded-md border border-input bg-card px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-foreground min-w-[130px]"
            >
              <option value="all">All Brands</option>
              <option value="none">No Brand</option>
              {brands.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
 
            {/* Category Filter */}
            <select
              value={selectedCategoryFilter}
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              className="flex h-9 rounded-md border border-input bg-card px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-foreground min-w-[130px]"
            >
              <option value="all">All Categories</option>
              <option value="none">No Category</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            {/* View toggles */}
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

        {/* Group by Product Output */}
        {groupMode === 'product' && (
          <div className="space-y-3">
            {filteredProducts.map(product => {
              const productPrices = prices.filter(sp => sp.product_id === product.id && sp.price > 0);
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
                        {product.brand_id && brands.find(b => b.id === product.brand_id) && (
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-primary/30 text-primary bg-primary/10">
                            {brands.find(b => b.id === product.brand_id).name}
                          </Badge>
                        )}
                        {product.category_id && categories.find(c => c.id === product.category_id) && (
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-violet-500/30 text-violet-500 bg-violet-500/10">
                            {categories.find(c => c.id === product.category_id).name}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Supplier offers list */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {productPrices.map(sp => {
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
                                  onChange={(e) => setEditQty(e.target.value)}
                                  className="w-16 h-7 text-xs text-center px-1"
                                  placeholder="Qty"
                                />
                                <select
                                  value={editUnit}
                                  onChange={(e) => setEditUnit(e.target.value)}
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
                                  onChange={(e) => setEditPrice(e.target.value)}
                                  className="w-full pl-6 pr-2 h-7 text-xs"
                                  placeholder="Supplier Price"
                                />
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => saveInlineEdit(sp)}
                                  disabled={isSaving}
                                  className="flex-1 h-7 text-[11px] font-bold gap-1 bg-emerald-600 hover:bg-emerald-500 text-white"
                                >
                                  <Check className="w-3.5 h-3.5" /> Save
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setEditingPriceId(null)}
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
                                onClick={() => startEditing(sp)}
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
        )}

        {/* Group by Supplier Output */}
        {groupMode === 'supplier' && (
          <div className="space-y-3">
            {filteredSuppliers.map(supplier => {
              const supplierPrices = prices.filter(sp => sp.supplier_id === supplier.id && sp.price > 0);
              
              const filteredSupplierPrices = supplierPrices.filter(sp => {
                const prod = productMap[sp.product_id];
                if (!prod) return false;

                // Brand filter check
                if (selectedBrandFilter !== 'all') {
                  if (selectedBrandFilter === 'none') {
                    if (prod.brand_id) return false;
                  } else {
                    if (prod.brand_id !== selectedBrandFilter) return false;
                  }
                }
 
                // Category filter check
                if (selectedCategoryFilter !== 'all') {
                  if (selectedCategoryFilter === 'none') {
                    if (prod.category_id) return false;
                  } else {
                    if (prod.category_id !== selectedCategoryFilter) return false;
                  }
                }

                const matchesSupplier = supplier.name.toLowerCase().includes(searchTerm.toLowerCase());
                const matchesProduct = 
                  prod.name_en.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  prod.name_kh.includes(searchTerm);
                return matchesSupplier || matchesProduct;
              });

              if (filteredSupplierPrices.length === 0) return null;

              return (
                <Card key={supplier.id} className="p-5 bg-card/60 backdrop-blur-md border-border shadow-xs space-y-4">
                  {/* Title */}
                  <div className="border-b border-border pb-3 flex justify-between items-center">
                    <div>
                      <h4 className="font-bold text-foreground text-base">{supplier.name}</h4>
                      <p className="text-xs text-muted-foreground">Phone: {supplier.contact_phone || 'N/A'}</p>
                    </div>
                    <Badge variant="secondary" className="text-xs font-semibold px-2.5 py-0.5">
                      {filteredSupplierPrices.length} products
                    </Badge>
                  </div>

                  {/* Products table for this supplier */}
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
                        {filteredSupplierPrices.map(sp => {
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
                                  {prod.brand_id && brands.find(b => b.id === prod.brand_id) && (
                                    <Badge variant="outline" className="text-[8px] px-1 py-0 border-primary/30 text-primary bg-primary/10 font-bold">
                                      {brands.find(b => b.id === prod.brand_id).name}
                                    </Badge>
                                  )}
                                  {prod.category_id && categories.find(c => c.id === prod.category_id) && (
                                    <Badge variant="outline" className="text-[8px] px-1 py-0 border-violet-500/30 text-violet-500 bg-violet-500/10 font-bold">
                                      {categories.find(c => c.id === prod.category_id).name}
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
                                      onChange={(e) => setEditPrice(e.target.value)}
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
                                      onChange={(e) => setEditQty(e.target.value)}
                                      className="w-14 h-7 text-xs text-center px-1"
                                    />
                                    <select
                                      value={editUnit}
                                      onChange={(e) => setEditUnit(e.target.value)}
                                      className="h-7 rounded-md border border-input bg-card px-1 text-xs text-foreground"
                                    >
                                      <option value="pcs">pcs</option>
                                      <option value="lo">lo</option>
                                      <option value="cs">cs</option>
                                    </select>
                                  </div>
                                ) : (
                                  <div className="space-y-0.5">
                                    <Badge variant={isLow ? "destructive" : "secondary"} className="font-bold">
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
                                      onClick={() => saveInlineEdit(sp)}
                                      disabled={isSaving}
                                      className="h-7 w-7 p-0 bg-emerald-600 hover:bg-emerald-500 text-white"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setEditingPriceId(null)}
                                      className="h-7 w-7 p-0"
                                    >
                                      ✕
                                    </Button>
                                  </div>
                                ) : (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => startEditing(sp)}
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
        )}
      </div>
    </div>
  );
}
