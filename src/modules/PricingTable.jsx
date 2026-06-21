import React, { useState, useEffect } from 'react';
import { Search, SlidersHorizontal, Edit2, TrendingUp, Info, ShoppingCart, Plus } from 'lucide-react';
import { db } from '../services/db';

export default function PricingTable({ products, suppliers, prices, onRefresh }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSupplierFilter, setSelectedSupplierFilter] = useState('all');
  const [editingCell, setEditingCell] = useState(null); // { product, supplier, priceObj }
  const [editPrice, setEditPrice] = useState('');
  const [editStock, setEditStock] = useState('');
  const [editUnit, setEditUnit] = useState('pcs');
  const [isSaving, setIsSaving] = useState(false);

  // States for adding a new product
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [newProductNameKh, setNewProductNameKh] = useState('');
  const [newProductNameEn, setNewProductNameEn] = useState('');
  const [newProductBasePrice, setNewProductBasePrice] = useState('');
  const [isSavingProduct, setIsSavingProduct] = useState(false);

  // Group prices by product_id and supplier_id for easy lookup
  const priceMap = {};
  prices.forEach(sp => {
    if (!priceMap[sp.product_id]) {
      priceMap[sp.product_id] = {};
    }
    priceMap[sp.product_id][sp.supplier_id] = sp;
  });

  // Find cheapest price details for each product
  const getCheapestPrice = (productId) => {
    const productPrices = priceMap[productId];
    if (!productPrices) return null;

    let cheapest = null;
    Object.keys(productPrices).forEach(supplierId => {
      const sp = productPrices[supplierId];
      if (sp.price > 0 && (!cheapest || sp.price < cheapest.price)) {
        cheapest = sp;
      }
    });
    return cheapest;
  };

  // Find highest price details for each product
  const getHighestPrice = (productId) => {
    const productPrices = priceMap[productId];
    if (!productPrices) return null;

    let highest = null;
    Object.keys(productPrices).forEach(supplierId => {
      const sp = productPrices[supplierId];
      if (sp.price > 0 && (!highest || sp.price > highest.price)) {
        highest = sp;
      }
    });
    return highest;
  };

  const getExpectedSellingPrice = (productId, editingSpId, newPrice) => {
    const productPrices = priceMap[productId] || {};
    let maxPrice = 0;
    
    Object.keys(productPrices).forEach(supplierId => {
      const sp = productPrices[supplierId];
      const pVal = sp.id === editingSpId ? Number(newPrice || 0) : sp.price;
      if (pVal > maxPrice) {
        maxPrice = pVal;
      }
    });
    
    if (maxPrice === 0) {
      maxPrice = Number(newPrice || 0);
    }
    
    return maxPrice > 0 ? maxPrice + 0.20 : 0;
  };

  // Filter products based on search term and supplier filter
  const filteredProducts = products.filter(product => {
    const matchesSearch = 
      product.name_en.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.name_kh.includes(searchTerm);

    if (selectedSupplierFilter === 'all') {
      return matchesSearch;
    } else {
      // Must be offered by the selected supplier
      const hasSupplierOffer = priceMap[product.id] && priceMap[product.id][selectedSupplierFilter];
      return matchesSearch && hasSupplierOffer;
    }
  });

  const handleCellClick = (product, supplier) => {
    const priceObj = (priceMap[product.id] && priceMap[product.id][supplier.id]) || {
      product_id: product.id,
      supplier_id: supplier.id,
      price: 0,
      stock_qty: 0,
      stock_unit: 'pcs'
    };

    setEditingCell({ product, supplier, priceObj });
    setEditPrice(priceObj.price > 0 ? priceObj.price.toString() : '');
    setEditStock(priceObj.stock_qty.toString());
    setEditUnit(priceObj.stock_unit || 'pcs');
  };

  const handleSavePrice = async (e) => {
    e.preventDefault();
    if (!editingCell) return;

    setIsSaving(true);
    try {
      await db.updateSupplierPrice({
        ...editingCell.priceObj,
        price: editPrice ? Number(editPrice) : 0,
        stock_qty: Number(editStock),
        stock_unit: editUnit
      });
      onRefresh();
      setEditingCell(null);
    } catch (err) {
      alert("Error saving price: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    if (!newProductNameKh || !newProductNameEn || !newProductBasePrice) return;
    
    setIsSavingProduct(true);
    try {
      await db.saveProduct({
        name_kh: newProductNameKh,
        name_en: newProductNameEn,
        base_price: Number(newProductBasePrice)
      });
      // Reset values
      setNewProductNameKh('');
      setNewProductNameEn('');
      setNewProductBasePrice('');
      setIsAddProductOpen(false);
      onRefresh();
    } catch (err) {
      alert("Error adding product: " + err.message);
    } finally {
      setIsSavingProduct(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-dark-900/30 p-6 rounded-2xl border border-dark-800">
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide">Product + Supplier Pricing Table</h2>
          <p className="text-xs text-dark-400 mt-1">
            Compare prices across all suppliers and manage stock levels side-by-side.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setIsAddProductOpen(true)}
            className="glass-button-primary py-2 px-4 flex items-center gap-2 text-xs font-bold"
          >
            <Plus className="w-4 h-4" />
            Add Product
          </button>
          <div className="flex items-center gap-2 text-xs text-dark-400 bg-dark-950/60 px-3.5 py-2 rounded-xl border border-dark-800">
            <Info className="w-4 h-4 text-primary-400 flex-shrink-0" />
            <span>Click any supplier cell in the table to edit pricing and stock levels.</span>
          </div>
        </div>
      </div>

      {/* Filters bar */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-dark-500" />
          <input
            type="text"
            placeholder="Search by English or Khmer product name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 glass-input"
          />
        </div>
        <div className="flex items-center gap-3">
          <SlidersHorizontal className="w-5 h-5 text-dark-400" />
          <select
            value={selectedSupplierFilter}
            onChange={(e) => setSelectedSupplierFilter(e.target.value)}
            className="glass-input min-w-[200px]"
          >
            <option value="all">All Suppliers (Show Grid)</option>
            {suppliers.map(s => (
              <option key={s.id} value={s.id}>Only {s.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Grid Card */}
      <div className="glass-panel rounded-2xl overflow-hidden shadow-xl border border-dark-800">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="bg-dark-950/60 border-b border-dark-800/80 text-dark-300 font-semibold">
                <th className="p-4 min-w-[240px]">Product Details</th>
                <th className="p-4 text-center">Selling Price</th>
                {suppliers.map(supplier => {
                  // Hide columns if single supplier filter is active (except selected)
                  if (selectedSupplierFilter !== 'all' && selectedSupplierFilter !== supplier.id) return null;
                  return (
                    <th key={supplier.id} className="p-4 text-center min-w-[140px] border-l border-dark-800/40">
                      {supplier.name}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-850">
              {filteredProducts.map(product => {
                const cheapestPrice = getCheapestPrice(product.id);
                const highestPrice = getHighestPrice(product.id);
                const sellingPrice = highestPrice ? (highestPrice.price + 0.20) : (product.base_price + 0.20);

                return (
                  <tr key={product.id} className="hover:bg-dark-900/30 transition-colors group">
                    {/* Product Name details */}
                    <td className="p-4">
                      <div className="font-semibold text-white group-hover:text-primary-400 transition-colors">
                        {product.name_kh}
                      </div>
                      <div className="text-xs text-dark-400 mt-0.5">
                        {product.name_en}
                      </div>
                    </td>
                    
                    {/* Selling Price */}
                    <td className="p-4 text-center font-medium text-dark-300">
                      ${sellingPrice.toFixed(2)}
                    </td>

                    {/* Suppliers' columns */}
                    {suppliers.map(supplier => {
                      if (selectedSupplierFilter !== 'all' && selectedSupplierFilter !== supplier.id) return null;

                      const priceObj = priceMap[product.id] && priceMap[product.id][supplier.id];
                      const isCheapest = cheapestPrice && priceObj && priceObj.id === cheapestPrice.id;
                      
                      return (
                        <td 
                          key={supplier.id}
                          onClick={() => handleCellClick(product, supplier)}
                          className={`p-4 text-center border-l border-dark-850 cursor-pointer transition-all duration-150 group/cell hover:bg-primary-500/5 ${
                            isCheapest 
                              ? 'bg-emerald-950/20 text-emerald-300 border-x border-emerald-900/40' 
                              : ''
                          }`}
                        >
                          {priceObj && priceObj.price > 0 ? (
                            <div className="space-y-1 relative">
                              {/* Price */}
                              <div className="font-semibold flex items-center justify-center gap-1.5">
                                <span className={isCheapest ? 'text-emerald-400 text-base font-bold' : 'text-white'}>
                                  ${priceObj.price.toFixed(2)}
                                </span>
                                {isCheapest && (
                                  <span className="text-[9px] font-extrabold uppercase bg-emerald-500 text-dark-950 px-1 py-0.5 rounded leading-none">
                                    Cheapest
                                  </span>
                                )}
                              </div>
                              {/* Stock */}
                              <div className={`text-[11px] font-medium ${
                                priceObj.stock_qty <= 2 
                                  ? 'text-rose-400 font-bold bg-rose-500/10 px-1 py-0.5 rounded inline-block' 
                                  : 'text-dark-400'
                              }`}>
                                Stock: {priceObj.stock_qty} {priceObj.stock_unit}
                              </div>
                              
                              <Edit2 className="w-3.5 h-3.5 absolute right-0 top-0 opacity-0 group-hover/cell:opacity-60 transition-opacity text-primary-400" />
                            </div>
                          ) : (
                            <span className="text-xs text-dark-600 italic group-hover/cell:text-dark-400">
                              No offer +
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}

              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={2 + suppliers.length} className="p-8 text-center text-dark-500 italic">
                    No products found matching your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Editing Dialog Modal */}
      {editingCell && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <form 
            onSubmit={handleSavePrice}
            className="w-full max-w-md overflow-hidden rounded-2xl border border-dark-800 bg-dark-900 shadow-2xl animate-in fade-in zoom-in duration-150"
          >
            <div className="p-6 border-b border-dark-800">
              <h3 className="font-bold text-lg text-white">Edit Price & Stock</h3>
              <p className="text-xs text-dark-400 mt-1">
                For {editingCell.product.name_kh} from supplier <strong>{editingCell.supplier.name}</strong>
              </p>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-dark-300 uppercase tracking-wider mb-2">Price (USD)</label>
                <input 
                  type="number" 
                  step="0.01"
                  min="0"
                  required
                  placeholder="Enter supplier unit price"
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                  className="w-full glass-input"
                />
                <p className="text-[10px] text-dark-500 mt-1">
                  Expected Selling Price (Max Cost + $0.20): ${getExpectedSellingPrice(editingCell.product.id, editingCell.priceObj.id, editPrice).toFixed(2)}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-dark-300 uppercase tracking-wider mb-2">Stock Quantity</label>
                  <input 
                    type="number" 
                    min="0"
                    required
                    placeholder="E.g. 10, 24"
                    value={editStock}
                    onChange={(e) => setEditStock(e.target.value)}
                    className="w-full glass-input"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-dark-300 uppercase tracking-wider mb-2">Stock Unit</label>
                  <select 
                    value={editUnit}
                    onChange={(e) => setEditUnit(e.target.value)}
                    className="w-full glass-input"
                  >
                    <option value="pcs">Pieces (pcs)</option>
                    <option value="lo">Dozens (lo)</option>
                    <option value="cs">Cases (cs)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-6 border-t border-dark-800 bg-dark-950/20">
              <button 
                type="button" 
                onClick={() => setEditingCell(null)} 
                className="glass-button-secondary"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                disabled={isSaving}
                className="glass-button-primary"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add Product Modal */}
      {isAddProductOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <form 
            onSubmit={handleAddProduct}
            className="w-full max-w-md overflow-hidden rounded-2xl border border-dark-800 bg-dark-900 shadow-2xl animate-in fade-in zoom-in duration-150 text-left"
          >
            <div className="p-6 border-b border-dark-800">
              <h3 className="font-bold text-lg text-white">Add New Product</h3>
              <p className="text-xs text-dark-400 mt-1">Create a new product in the system catalog.</p>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-dark-300 uppercase tracking-wider mb-2">Khmer Name (ឈ្មោះទំនិញ) *</label>
                <input 
                  type="text" 
                  required
                  placeholder="E.g. កូកាកូឡា កំប៉ុង"
                  value={newProductNameKh}
                  onChange={(e) => setNewProductNameKh(e.target.value)}
                  className="w-full glass-input"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-dark-300 uppercase tracking-wider mb-2">English Name *</label>
                <input 
                  type="text" 
                  required
                  placeholder="E.g. Coca Cola (330ml)"
                  value={newProductNameEn}
                  onChange={(e) => setNewProductNameEn(e.target.value)}
                  className="w-full glass-input"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-dark-300 uppercase tracking-wider mb-2">Reference Base Price ($) *</label>
                <input 
                  type="number" 
                  step="0.01"
                  min="0"
                  required
                  placeholder="E.g. 13.50"
                  value={newProductBasePrice}
                  onChange={(e) => setNewProductBasePrice(e.target.value)}
                  className="w-full glass-input"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 p-6 border-t border-dark-800 bg-dark-950/20">
              <button 
                type="button" 
                onClick={() => setIsAddProductOpen(false)} 
                className="glass-button-secondary"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                disabled={isSavingProduct}
                className="glass-button-primary"
              >
                {isSavingProduct ? 'Adding...' : 'Add Product'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
