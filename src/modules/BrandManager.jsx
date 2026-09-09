import { useState } from 'react';
import { Tag, Search, Trash2, Edit2, CheckSquare, Square, X, Filter } from 'lucide-react';
import { db } from '../services/db';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

export default function BrandManager({ brands, categories = [], products, onRefresh, showToast }) {
  const [editingBrand, setEditingBrand] = useState(null); // null when creating
  const [brandName, setBrandName] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [filterCurrentBrandOnly, setFilterCurrentBrandOnly] = useState('all'); // 'all', 'none', or 'current'
 
  // Quick edit product states
  const [quickEditingProduct, setQuickEditingProduct] = useState(null);
  const [quickEditNameKh, setQuickEditNameKh] = useState('');
  const [quickEditNameEn, setQuickEditNameEn] = useState('');
  const [quickEditBasePrice, setQuickEditBasePrice] = useState('');
  const [quickEditBrandId, setQuickEditBrandId] = useState('');
  const [quickEditCategoryId, setQuickEditCategoryId] = useState('');
  const [isSavingQuickEdit, setIsSavingQuickEdit] = useState(false);

  // Map products to see their brand names for label styling
  const brandMap = {};
  brands.forEach(b => {
    brandMap[b.id] = b.name;
  });

  // Map categories for label lookup
  const categoryMap = {};
  categories.forEach(c => {
    categoryMap[c.id] = c.name;
  });

  // Calculate product counts per brand
  const productCounts = {};
  brands.forEach(b => {
    productCounts[b.id] = 0;
  });
  products.forEach(p => {
    if (p.brand_id && productCounts[p.brand_id] !== undefined) {
      productCounts[p.brand_id]++;
    }
  });

  // Handle Edit click
  const handleEditClick = (brand) => {
    setEditingBrand(brand);
    setBrandName(brand.name);
    // Gather all products associated with this brand
    const associatedIds = products
      .filter(p => p.brand_id === brand.id)
      .map(p => p.id);
    setSelectedProductIds(associatedIds);
    setProductSearch('');
  };

  // Open quick edit product modal
  const handleQuickEditProduct = (product) => {
    setQuickEditingProduct(product);
    setQuickEditNameKh(product.name_kh || '');
    setQuickEditNameEn(product.name_en || '');
    setQuickEditBasePrice(product.base_price || '0.00');
    setQuickEditBrandId(product.brand_id || '');
    setQuickEditCategoryId(product.category_id || '');
  };

  // Save quick edit product
  const handleSaveQuickEdit = async (e) => {
    e.preventDefault();
    if (!quickEditNameKh.trim() || !quickEditNameEn.trim()) {
      showToast("Please enter both Khmer and English product names.", "warning");
      return;
    }

    setIsSavingQuickEdit(true);
    try {
      const updatedProduct = {
        ...quickEditingProduct,
        name_kh: quickEditNameKh.trim(),
        name_en: quickEditNameEn.trim(),
        base_price: Number(quickEditBasePrice) || 0,
        brand_id: quickEditBrandId || null,
        category_id: quickEditCategoryId || null
      };

      await db.saveProduct(updatedProduct);
      showToast("Product updated successfully!", "success");
      setQuickEditingProduct(null);
      onRefresh();
    } catch (err) {
      console.error(err);
      showToast("Failed to save product details: " + err.message, "error");
    } finally {
      setIsSavingQuickEdit(false);
    }
  };

  // Cancel edit
  const handleCancelEdit = () => {
    setEditingBrand(null);
    setBrandName('');
    setSelectedProductIds([]);
    setProductSearch('');
  };

  // Toggle single product selection
  const handleProductToggle = (productId) => {
    setSelectedProductIds(prev => {
      if (prev.includes(productId)) {
        return prev.filter(id => id !== productId);
      } else {
        return [...prev, productId];
      }
    });
  };

  // Select all / Deselect all currently filtered products
  const handleSelectAllFiltered = (filteredProds) => {
    const filteredIds = filteredProds.map(p => p.id);
    const allSelected = filteredIds.every(id => selectedProductIds.includes(id));

    if (allSelected) {
      // Remove all filtered ids
      setSelectedProductIds(prev => prev.filter(id => !filteredIds.includes(id)));
    } else {
      // Add missing filtered ids
      setSelectedProductIds(prev => {
        const toAdd = filteredIds.filter(id => !prev.includes(id));
        return [...prev, ...toAdd];
      });
    }
  };

  // Delete brand
  const handleDeleteBrand = async (brand) => {
    if (!confirm(`Are you sure you want to delete the brand "${brand.name}"? Products under this brand will not be deleted, but they will be dissociated.`)) {
      return;
    }
    setIsDeleting(true);
    try {
      await db.deleteBrand(brand.id);
      showToast("Brand deleted successfully.", "success");
      if (editingBrand?.id === brand.id) {
        handleCancelEdit();
      }
      onRefresh();
    } catch (e) {
      console.error(e);
      showToast("Failed to delete brand: " + e.message, "error");
    } finally {
      setIsDeleting(false);
    }
  };

  // Save brand and associations
  const handleSaveBrand = async (e) => {
    e.preventDefault();
    if (!brandName.trim()) {
      showToast("Please enter a brand name.", "warning");
      return;
    }

    setIsSaving(true);
    try {
      // 1. Save or Update brand
      const brandToSave = {
        name: brandName.trim()
      };
      if (editingBrand) {
        brandToSave.id = editingBrand.id;
      }
      const savedBrand = await db.saveBrand(brandToSave);

      // 2. Save bulk product associations
      await db.associateProductsWithBrand(savedBrand.id, selectedProductIds);

      showToast("Brand saved and products associated successfully!", "success");
      // Reset form
      setBrandName('');
      setSelectedProductIds([]);
      setEditingBrand(null);
      setProductSearch('');
      onRefresh();
    } catch (e) {
      console.error(e);
      showToast(e.message || "Failed to save brand details.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  // Filter products list for bulk selector
  const filteredProducts = products.filter(p => {
    const matchesSearch = 
      (p.name_en && p.name_en.toLowerCase().includes(productSearch.toLowerCase())) ||
      (p.name_kh && p.name_kh.includes(productSearch));

    if (!matchesSearch) return false;

    if (filterCurrentBrandOnly === 'none') {
      return !p.brand_id;
    } else if (filterCurrentBrandOnly === 'current') {
      return editingBrand && p.brand_id === editingBrand.id;
    } else if (filterCurrentBrandOnly !== 'all') {
      // By specific brand ID
      return p.brand_id === filterCurrentBrandOnly;
    }
    return true;
  });

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    const aChecked = selectedProductIds.includes(a.id);
    const bChecked = selectedProductIds.includes(b.id);
    if (aChecked && !bChecked) return -1;
    if (!aChecked && bChecked) return 1;
    const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
    return bTime - aTime;
  });

  const areAllFilteredSelected = sortedProducts.length > 0 && 
    sortedProducts.every(p => selectedProductIds.includes(p.id));

  return (
    <div className="space-y-6">
      <Card className="p-6 bg-card/60 backdrop-blur-md border-border shadow-xs">
        <h2 className="text-xl font-bold text-foreground tracking-tight flex items-center gap-2.5">
          <Tag className="w-5 h-5 text-primary" />
          Brand Management
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Categorize products by brand and manage associations in bulk.
        </p>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Brands List (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="p-6 border-border space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-foreground">Brands Catalog</h3>
              <Badge variant="secondary" className="text-xs font-semibold">
                {brands.length} {brands.length === 1 ? 'brand' : 'brands'}
              </Badge>
            </div>

            {brands.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground italic text-xs">
                No brands created yet. Create one on the right to start.
              </div>
            ) : (
              <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1 scrollbar-thin">
                {brands.map(b => {
                  const count = productCounts[b.id] || 0;
                  const isSelected = editingBrand?.id === b.id;

                  return (
                    <div 
                      key={b.id}
                      onClick={() => handleEditClick(b)}
                      className={`flex items-center justify-between p-3.5 rounded-lg border transition-all cursor-pointer group ${
                        isSelected 
                          ? 'bg-primary/10 border-primary/50 text-primary ring-1 ring-primary/20' 
                          : 'bg-card border-border hover:bg-accent/50'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="font-bold text-sm text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5">
                          <span>{b.name}</span>
                          {isSelected && (
                            <Badge variant="default" className="text-[9px] uppercase px-1 py-0 h-4">
                              Editing
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {count} {count === 1 ? 'product' : 'products'} associated
                        </div>
                      </div>

                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditClick(b);
                          }}
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          title="Edit brand & products"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteBrand(b);
                          }}
                          className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                          title="Delete Brand"
                          disabled={isDeleting}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* Right Column: Create/Edit and Bulk Associate (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <Card className={`p-6 border transition-all shadow-xs space-y-5 ${
            editingBrand 
              ? 'border-primary/50 shadow-md shadow-primary/5 bg-card' 
              : 'border-border'
          }`}>
            <form onSubmit={handleSaveBrand} className="space-y-5">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Tag className="w-4 h-4 text-primary" />
                  {editingBrand ? `Edit Brand: ${editingBrand.name}` : 'Create New Brand'}
                </h3>
                {editingBrand && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCancelEdit}
                    className="text-xs h-7 gap-1"
                  >
                    <X className="w-3 h-3" />
                    Cancel Edit
                  </Button>
                )}
              </div>

              {/* Brand Name Input */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Brand Name</label>
                <Input
                  type="text"
                  placeholder="e.g. EL, Yasaka, Kiss..."
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  required
                />
              </div>

              {/* Bulk Product Assignment Section */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                    Bulk Product Assignment ({selectedProductIds.length} selected)
                  </label>
                  
                  <div className="flex items-center gap-1.5 text-xs">
                    <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground font-medium">View:</span>
                    <select
                      value={filterCurrentBrandOnly}
                      onChange={(e) => setFilterCurrentBrandOnly(e.target.value)}
                      className="bg-card border border-border rounded-lg px-2.5 py-1 text-xs text-foreground outline-none focus:border-primary transition-all cursor-pointer"
                    >
                      <option value="all">All Products</option>
                      <option value="none">No Brand Assigned</option>
                      {editingBrand && <option value="current">Assigned to this Brand</option>}
                      {brands.filter(b => !editingBrand || b.id !== editingBrand.id).map(b => (
                        <option key={b.id} value={b.id}>Assigned to {b.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Filter and Select-all Controls */}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Filter products..."
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      className="pl-9 h-8 text-xs"
                    />
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleSelectAllFiltered(sortedProducts)}
                    className="text-xs h-8 whitespace-nowrap gap-1.5"
                  >
                    {areAllFilteredSelected ? (
                      <>
                        <CheckSquare className="w-3.5 h-3.5 text-primary" />
                        Deselect Filtered
                      </>
                    ) : (
                      <>
                        <Square className="w-3.5 h-3.5" />
                        Select Filtered ({sortedProducts.length})
                      </>
                    )}
                  </Button>
                </div>

                {/* Products Checkbox List */}
                <div className="border border-border rounded-lg max-h-[35vh] overflow-y-auto p-2 space-y-1.5 bg-muted/20 scrollbar-thin">
                  {sortedProducts.length === 0 ? (
                    <div className="p-6 text-center text-muted-foreground italic text-xs">
                      No products match your filter.
                    </div>
                  ) : (
                    sortedProducts.map(p => {
                      const isChecked = selectedProductIds.includes(p.id);
                      const currentBrandName = p.brand_id ? brandMap[p.brand_id] : null;
                      const currentCategoryName = p.category_id ? categoryMap[p.category_id] : null;

                      return (
                        <div 
                          key={p.id}
                          onClick={() => handleProductToggle(p.id)}
                          className={`flex items-center justify-between p-2.5 rounded-md border text-xs cursor-pointer transition-all ${
                            isChecked
                              ? 'bg-primary/10 border-primary/40 text-foreground'
                              : 'bg-card border-border hover:bg-accent/40 text-muted-foreground'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <input 
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}} 
                              className="rounded border-border text-primary focus:ring-primary w-4 h-4"
                            />
                            <div className="truncate">
                              <span className="font-semibold text-foreground mr-1.5">{p.name_kh}</span>
                              <span className="text-muted-foreground text-[11px]">({p.name_en})</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            {currentCategoryName && (
                              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                                {currentCategoryName}
                              </Badge>
                            )}

                            {currentBrandName && currentBrandName !== editingBrand?.name && (
                              <Badge variant="secondary" className="text-[10px]">
                                {currentBrandName}
                              </Badge>
                            )}

                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleQuickEditProduct(p);
                              }}
                              className="h-6 w-6 text-muted-foreground hover:text-foreground"
                              title="Quick edit product info"
                            >
                              <Edit2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end gap-3 pt-2">
                {editingBrand && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleCancelEdit}
                  >
                    Cancel
                  </Button>
                )}
                <Button 
                  type="submit" 
                  size="sm"
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving...' : (editingBrand ? 'Save Brand & Associations' : 'Create Brand')}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </div>

      {/* Quick Edit Product Dialog */}
      <Dialog open={!!quickEditingProduct} onOpenChange={(open) => !open && setQuickEditingProduct(null)}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleSaveQuickEdit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Quick Edit Product</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-3 py-2">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Name (Khmer) *</label>
                <Input 
                  type="text" 
                  required
                  value={quickEditNameKh}
                  onChange={(e) => setQuickEditNameKh(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Name (English) *</label>
                <Input 
                  type="text" 
                  required
                  value={quickEditNameEn}
                  onChange={(e) => setQuickEditNameEn(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Base Price ($)</label>
                <Input 
                  type="number" 
                  step="0.01"
                  required
                  value={quickEditBasePrice}
                  onChange={(e) => setQuickEditBasePrice(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Brand</label>
                <select
                  value={quickEditBrandId}
                  onChange={(e) => setQuickEditBrandId(e.target.value)}
                  className="w-full flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">No Brand / General</option>
                  {brands.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Category</label>
                <select
                  value={quickEditCategoryId}
                  onChange={(e) => setQuickEditCategoryId(e.target.value)}
                  className="w-full flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">No Category</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <DialogFooter className="pt-2 border-t border-border">
              <Button 
                type="button" 
                variant="ghost" 
                size="sm"
                onClick={() => setQuickEditingProduct(null)} 
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                size="sm"
                disabled={isSavingQuickEdit}
              >
                {isSavingQuickEdit ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
