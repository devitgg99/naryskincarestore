import { useState } from 'react';
import { Tag, Search, Trash2, Edit2, CheckSquare, Square, X, Filter } from 'lucide-react';
import { db } from '../services/db';

export default function BrandManager({ brands, products, onRefresh }) {
  const [editingBrand, setEditingBrand] = useState(null); // null when creating
  const [brandName, setBrandName] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [filterCurrentBrandOnly, setFilterCurrentBrandOnly] = useState('all'); // 'all', 'none', or 'current'

  // Map products to see their brand names for label styling
  const brandMap = {};
  brands.forEach(b => {
    brandMap[b.id] = b.name;
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
    if (!window.confirm(`Are you sure you want to delete the brand "${brand.name}"? Products under this brand will not be deleted, but they will be dissociated.`)) {
      return;
    }
    setIsDeleting(true);
    try {
      await db.deleteBrand(brand.id);
      if (editingBrand?.id === brand.id) {
        handleCancelEdit();
      }
      onRefresh();
    } catch (e) {
      console.error(e);
      alert("Failed to delete brand: " + e.message);
    } finally {
      setIsDeleting(false);
    }
  };

  // Save brand and associations
  const handleSaveBrand = async (e) => {
    e.preventDefault();
    if (!brandName.trim()) {
      alert("Please enter a brand name.");
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

      // Reset form
      setBrandName('');
      setSelectedProductIds([]);
      setEditingBrand(null);
      setProductSearch('');
      onRefresh();
    } catch (e) {
      console.error(e);
      alert(e.message || "Failed to save brand details.");
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

  const allFilteredSelected = filteredProducts.length > 0 && 
    filteredProducts.every(p => selectedProductIds.includes(p.id));

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <Tag className="w-6 h-6 text-primary-400" />
            Brand Management
          </h2>
          <p className="text-sm text-dark-400 mt-1">
            Categorize products by brand and manage associations in bulk.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Brands List (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="glass-panel rounded-2xl p-6 border border-dark-800 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center justify-between">
              <span>Brands Catalog</span>
              <span className="text-xs bg-dark-850 px-2.5 py-1 rounded-md text-dark-400 font-semibold border border-dark-800">
                {brands.length} {brands.length === 1 ? 'brand' : 'brands'}
              </span>
            </h3>

            {brands.length === 0 ? (
              <div className="text-center py-8 text-dark-500 italic text-sm">
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
                      className={`flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer group ${
                        isSelected 
                          ? 'bg-primary-500/10 border-primary-500/40 text-primary-300' 
                          : 'bg-dark-900/40 border-dark-800/60 hover:bg-dark-900/80 hover:border-dark-700'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="font-bold text-sm text-white group-hover:text-primary-400 transition-colors flex items-center gap-1.5">
                          <span>{b.name}</span>
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
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditClick(b);
                          }}
                          className="p-1.5 text-dark-400 hover:text-white hover:bg-dark-800 rounded-lg transition-colors"
                          title="Edit brand & products"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteBrand(b);
                          }}
                          className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                          title="Delete Brand"
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
          <form onSubmit={handleSaveBrand} className="glass-panel rounded-2xl p-6 border border-dark-800 space-y-5">
            <div className="flex items-center justify-between border-b border-dark-800/50 pb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Tag className="w-5 h-5 text-primary-400" />
                {editingBrand ? `Edit Brand: ${editingBrand.name}` : 'Create New Brand'}
              </h3>
              {editingBrand && (
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

            {/* Brand Name Input */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-dark-300 uppercase tracking-wider">Brand Name</label>
              <input
                type="text"
                placeholder="e.g. EL, Yasaka, Kiss..."
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
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
                
                {/* Brand Selection/Filter */}
                <div className="flex items-center gap-1.5 text-xs">
                  <Filter className="w-3.5 h-3.5 text-dark-400" />
                  <span className="text-dark-400">View:</span>
                  <select
                    value={filterCurrentBrandOnly}
                    onChange={(e) => setFilterCurrentBrandOnly(e.target.value)}
                    className="bg-dark-950 border border-dark-800 rounded px-1.5 py-0.5 text-dark-200 outline-none focus:border-primary-500"
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
                    filteredProducts.map(p => {
                      const isChecked = selectedProductIds.includes(p.id);
                      const currentBrandName = p.brand_id ? brandMap[p.brand_id] : null;

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

                          <div className="flex-shrink-0 pl-2">
                            {currentBrandName ? (
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border border-primary-500/20 text-primary-400 bg-primary-500/10`}>
                                {currentBrandName}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[9px] text-dark-500 bg-dark-900/80 border border-dark-850">
                                Unbranded
                              </span>
                            )}
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
              {editingBrand && (
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
                {isSaving ? 'Saving...' : editingBrand ? 'Update Brand' : 'Create Brand'}
              </button>
            </div>
          </form>
        </div>
        
      </div>
    </div>
  );
}
