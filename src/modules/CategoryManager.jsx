import { useState } from 'react';
import { Layers, Search, Trash2, Edit2, CheckSquare, Square, X, Filter } from 'lucide-react';
import { db } from '../services/db';

export default function CategoryManager({ categories, brands, products, onRefresh }) {
  const [editingCategory, setEditingCategory] = useState(null); // null when creating
  const [categoryName, setCategoryName] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [filterCurrentCategoryOnly, setFilterCurrentCategoryOnly] = useState('all'); // 'all', 'none', or 'current'

  // Quick edit product states
  const [quickEditingProduct, setQuickEditingProduct] = useState(null);
  const [quickEditNameKh, setQuickEditNameKh] = useState('');
  const [quickEditNameEn, setQuickEditNameEn] = useState('');
  const [quickEditBasePrice, setQuickEditBasePrice] = useState('');
  const [quickEditBrandId, setQuickEditBrandId] = useState('');
  const [quickEditCategoryId, setQuickEditCategoryId] = useState('');
  const [isSavingQuickEdit, setIsSavingQuickEdit] = useState(false);

  // Map categories to see their names for label styling
  const categoryMap = {};
  categories.forEach(c => {
    categoryMap[c.id] = c.name;
  });

  // Map brands for quick lookup
  const brandMap = {};
  brands.forEach(b => {
    brandMap[b.id] = b.name;
  });

  // Calculate product counts per category
  const productCounts = {};
  categories.forEach(c => {
    productCounts[c.id] = 0;
  });
  products.forEach(p => {
    if (p.category_id && productCounts[p.category_id] !== undefined) {
      productCounts[p.category_id]++;
    }
  });

  // Handle Edit category click
  const handleEditClick = (category) => {
    setEditingCategory(category);
    setCategoryName(category.name);
    // Gather all products associated with this category
    const associatedIds = products
      .filter(p => p.category_id === category.id)
      .map(p => p.id);
    setSelectedProductIds(associatedIds);
    setProductSearch('');
  };

  // Cancel edit
  const handleCancelEdit = () => {
    setEditingCategory(null);
    setCategoryName('');
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

  // Delete category
  const handleDeleteCategory = async (category) => {
    if (!window.confirm(`Are you sure you want to delete the category "${category.name}"? Products under this category will not be deleted, but they will be dissociated.`)) {
      return;
    }
    setIsDeleting(true);
    try {
      await db.deleteCategory(category.id);
      if (editingCategory?.id === category.id) {
        handleCancelEdit();
      }
      onRefresh();
    } catch (e) {
      console.error(e);
      alert("Failed to delete category: " + e.message);
    } finally {
      setIsDeleting(false);
    }
  };

  // Save category and associations
  const handleSaveCategory = async (e) => {
    e.preventDefault();
    if (!categoryName.trim()) {
      alert("Please enter a category name.");
      return;
    }

    setIsSaving(true);
    try {
      // 1. Save or Update category
      const categoryToSave = {
        name: categoryName.trim()
      };
      if (editingCategory) {
        categoryToSave.id = editingCategory.id;
      }
      const savedCategory = await db.saveCategory(categoryToSave);

      // 2. Save bulk product associations
      await db.associateProductsWithCategory(savedCategory.id, selectedProductIds);

      // Reset form
      setCategoryName('');
      setSelectedProductIds([]);
      setEditingCategory(null);
      setProductSearch('');
      onRefresh();
    } catch (e) {
      console.error(e);
      alert(e.message || "Failed to save category details.");
    } finally {
      setIsSaving(false);
    }
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
      alert("Please enter both Khmer and English product names.");
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
      setQuickEditingProduct(null);
      onRefresh();
    } catch (err) {
      console.error(err);
      alert("Failed to save product details: " + err.message);
    } finally {
      setIsSavingQuickEdit(false);
    }
  };

  // Filter products list for bulk selector
  const filteredProducts = products.filter(p => {
    const matchesSearch = 
      (p.name_en && p.name_en.toLowerCase().includes(productSearch.toLowerCase())) ||
      (p.name_kh && p.name_kh.includes(productSearch));

    if (!matchesSearch) return false;

    if (filterCurrentCategoryOnly === 'none') {
      return !p.category_id;
    } else if (filterCurrentCategoryOnly === 'current') {
      return editingCategory && p.category_id === editingCategory.id;
    } else if (filterCurrentCategoryOnly !== 'all') {
      // By specific category ID
      return p.category_id === filterCurrentCategoryOnly;
    }
    return true;
  });

  const allFilteredSelected = filteredProducts.length > 0 && 
    filteredProducts.every(p => selectedProductIds.includes(p.id));

  const sortedFilteredProducts = [...filteredProducts].sort((a, b) => {
    const aChecked = selectedProductIds.includes(a.id);
    const bChecked = selectedProductIds.includes(b.id);
    if (aChecked && !bChecked) return -1;
    if (!aChecked && bChecked) return 1;
    const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
    return bTime - aTime;
  });

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <Layers className="w-6 h-6 text-primary-400" />
            Category Management
          </h2>
          <p className="text-sm text-dark-400 mt-1">
            Categorize products by cosmetic categories (lotion, cream, mask) and manage assignments.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Categories List (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="glass-panel rounded-2xl p-6 border border-dark-800 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center justify-between">
              <span>Categories Catalog</span>
              <span className="text-xs bg-dark-850 px-2.5 py-1 rounded-md text-dark-400 font-semibold border border-dark-800">
                {categories.length} {categories.length === 1 ? 'category' : 'categories'}
              </span>
            </h3>

            {categories.length === 0 ? (
              <div className="text-center py-8 text-dark-500 italic text-sm">
                No categories created yet. Create one on the right to start.
              </div>
            ) : (
              <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1 scrollbar-thin">
                {categories.map(c => {
                  const count = productCounts[c.id] || 0;
                  const isSelected = editingCategory?.id === c.id;

                  return (
                    <div 
                      key={c.id}
                      onClick={() => handleEditClick(c)}
                      className={`flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer group ${
                        isSelected 
                          ? 'bg-primary-500/10 border-primary-500/40 text-primary-300 ring-1 ring-primary-500/20' 
                          : 'bg-dark-900/40 border-dark-800/60 hover:bg-dark-900/80 hover:border-dark-700'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="font-bold text-sm text-white group-hover:text-primary-400 transition-colors flex items-center gap-1.5">
                          <span>{c.name}</span>
                          {isSelected && (
                            <span className="text-[9px] bg-primary-500 text-white font-extrabold uppercase px-1 py-0.5 rounded leading-none">
                              Editing
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-dark-400">
                          {count} {count === 1 ? 'product' : 'products'} associated
                        </div>
                      </div>

                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditClick(c);
                          }}
                          className="p-1.5 text-dark-400 hover:text-white hover:bg-dark-800 rounded-lg transition-colors"
                          title="Edit category & products"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCategory(c);
                          }}
                          className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                          title="Delete Category"
                          disabled={isDeleting}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Create/Edit and Bulk Associate (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <form 
            onSubmit={handleSaveCategory} 
            className={`glass-panel rounded-2xl p-6 border transition-all duration-350 space-y-5 ${
              editingCategory 
                ? 'border-primary-500/40 shadow-lg shadow-primary-500/5 bg-dark-900/80' 
                : 'border-dark-800'
            }`}
          >
            <div className="flex items-center justify-between border-b border-dark-800/50 pb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-primary-400" />
                {editingCategory ? `Edit Category: ${editingCategory.name}` : 'Create New Category'}
              </h3>
              {editingCategory && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="text-xs text-dark-400 hover:text-white flex items-center gap-1 px-2.5 py-1 bg-dark-900 border border-dark-800 rounded-lg transition-all"
                >
                  <X className="w-3.5 h-3.5" />
                  Cancel Edit
                </button>
              )}
            </div>

            {/* Category Name Input */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-dark-300 uppercase tracking-wider">Category Name</label>
              <input
                type="text"
                placeholder="e.g. Lotion, Night Cream, Mask, Serum..."
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                className="w-full glass-input"
                required
              />
            </div>

            {/* Bulk Product Assignment Section */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <label className="text-xs font-bold text-dark-300 uppercase tracking-wider block">
                  Bulk Product Assignment ({selectedProductIds.length} selected)
                </label>
                
                {/* Category Selection/Filter */}
                <div className="flex items-center gap-1.5 text-xs">
                  <Filter className="w-3.5 h-3.5 text-dark-400" />
                  <span className="text-dark-400 font-medium">View:</span>
                  <select
                    value={filterCurrentCategoryOnly}
                    onChange={(e) => setFilterCurrentCategoryOnly(e.target.value)}
                    className="bg-dark-900 border border-dark-800/50 hover:border-dark-700/60 rounded-xl px-2.5 py-1 text-[11px] text-dark-200 outline-none focus:border-primary-500 transition-all cursor-pointer"
                  >
                    <option value="all">All Products</option>
                    <option value="none">No Category Assigned</option>
                    {editingCategory && <option value="current">Assigned to this Category</option>}
                    {categories.filter(c => !editingCategory || c.id !== editingCategory.id).map(c => (
                      <option key={c.id} value={c.id}>Assigned to {c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Search Inside Bulk Products list */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" />
                <input
                  type="text"
                  placeholder="Filter products for bulk assignment..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-dark-950/80 border border-dark-850 rounded-lg text-xs text-dark-200 placeholder:text-dark-600 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                />
              </div>

              {/* Products Checklist Box */}
              <div className="border border-dark-850 bg-dark-950/40 rounded-xl overflow-hidden">
                {/* Select All row */}
                <div className="flex items-center justify-between p-3 border-b border-dark-850/80 bg-dark-950/80 text-xs font-semibold text-dark-400">
                  <span>Filtered Checklist ({filteredProducts.length} items)</span>
                  {filteredProducts.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleSelectAllFiltered(filteredProducts)}
                      className="text-primary-400 hover:text-primary-300 hover:underline flex items-center gap-1.5 cursor-pointer"
                    >
                      {allFilteredSelected ? 'Deselect All' : 'Select All Filtered'}
                    </button>
                  )}
                </div>

                {/* Checklist Scrolling Panel */}
                <div className="max-h-[35vh] overflow-y-auto divide-y divide-dark-900/60 scrollbar-thin">
                  {filteredProducts.length === 0 ? (
                    <div className="p-8 text-center text-dark-600 italic text-xs">
                      No products match your search/filters.
                    </div>
                  ) : (
                    sortedFilteredProducts.map(p => {
                      const isChecked = selectedProductIds.includes(p.id);
                      const currentCategoryName = p.category_id ? categoryMap[p.category_id] : null;

                      return (
                        <div 
                          key={p.id}
                          onClick={() => handleProductToggle(p.id)}
                          className={`flex items-center justify-between px-4 py-2.5 text-xs cursor-pointer select-none transition-colors ${
                            isChecked 
                              ? 'bg-primary-500/5 hover:bg-primary-500/10' 
                              : 'hover:bg-dark-900/40'
                          }`}
                        >
                          <div className="flex items-center gap-3 pr-2 truncate">
                            {isChecked ? (
                              <CheckSquare className="w-4 h-4 text-primary-400 flex-shrink-0" />
                            ) : (
                              <Square className="w-4 h-4 text-dark-600 flex-shrink-0" />
                            )}
                            <div className="truncate">
                              <span className="font-semibold text-white block truncate">{p.name_kh}</span>
                              <span className="text-[10px] text-dark-400 block truncate">{p.name_en}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0 pl-2">
                            {currentCategoryName ? (
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border border-violet-500/20 text-violet-400 bg-violet-500/10`}>
                                {currentCategoryName}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[9px] text-dark-500 bg-dark-900/80 border border-dark-850">
                                Uncategorized
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleQuickEditProduct(p);
                              }}
                              className="p-1 rounded bg-dark-800 hover:bg-dark-700 text-dark-300 hover:text-white transition-colors"
                              title="Quick Edit Product Details"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-2 flex items-center justify-end gap-3">
              {editingCategory && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="glass-button-secondary py-2"
                  disabled={isSaving}
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                className="glass-button-primary py-2 px-6"
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : editingCategory ? 'Update Category' : 'Create Category'}
              </button>
            </div>
          </form>
        </div>
        
      </div>

      {/* Quick Edit Product Modal */}
      {quickEditingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <form 
            onSubmit={handleSaveQuickEdit}
            className="w-full max-w-md overflow-hidden rounded-2xl border border-dark-800 bg-dark-900 shadow-2xl animate-in fade-in zoom-in duration-150"
          >
            <div className="p-6 border-b border-dark-800 flex justify-between items-center">
              <h3 className="font-bold text-lg text-white">Quick Edit Product Details</h3>
              <button 
                type="button" 
                onClick={() => setQuickEditingProduct(null)}
                className="p-1 rounded-lg hover:bg-dark-800 text-dark-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-dark-300 uppercase tracking-wider mb-2">Product Name (Khmer)</label>
                <input 
                  type="text" 
                  required
                  value={quickEditNameKh}
                  onChange={(e) => setQuickEditNameKh(e.target.value)}
                  className="w-full glass-input"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-dark-300 uppercase tracking-wider mb-2">Product Name (English)</label>
                <input 
                  type="text" 
                  required
                  value={quickEditNameEn}
                  onChange={(e) => setQuickEditNameEn(e.target.value)}
                  className="w-full glass-input"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-dark-300 uppercase tracking-wider mb-2">Base Price ($)</label>
                <input 
                  type="number" 
                  step="0.01"
                  required
                  value={quickEditBasePrice}
                  onChange={(e) => setQuickEditBasePrice(e.target.value)}
                  className="w-full glass-input"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-dark-300 uppercase tracking-wider mb-2">Brand</label>
                <select
                  value={quickEditBrandId}
                  onChange={(e) => setQuickEditBrandId(e.target.value)}
                  className="w-full glass-input"
                >
                  <option value="">No Brand / General</option>
                  {brands.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-dark-300 uppercase tracking-wider mb-2">Category</label>
                <select
                  value={quickEditCategoryId}
                  onChange={(e) => setQuickEditCategoryId(e.target.value)}
                  className="w-full glass-input"
                >
                  <option value="">No Category</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-6 border-t border-dark-800 bg-dark-950/20">
              <button 
                type="button" 
                onClick={() => setQuickEditingProduct(null)} 
                className="glass-button-secondary"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                disabled={isSavingQuickEdit}
                className="glass-button-primary"
              >
                {isSavingQuickEdit ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
