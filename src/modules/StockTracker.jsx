import React, { useState } from 'react';
import { Package, AlertTriangle, ArrowUpDown, ChevronDown, Check, Save, Layers, ListFilter, Search } from 'lucide-react';
import { db } from '../services/db';

export default function StockTracker({ products, suppliers, prices, onRefresh }) {
  const [groupMode, setGroupMode] = useState('product'); // 'product' or 'supplier'
  const [lowStockThreshold, setLowStockThreshold] = useState(2);
  const [editingPriceId, setEditingPriceId] = useState(null); // id of sp record being edited
  const [editQty, setEditQty] = useState('');
  const [editUnit, setEditUnit] = useState('pcs');
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Group prices
  const productMap = {};
  products.forEach(p => { productMap[p.id] = p; });

  const supplierMap = {};
  suppliers.forEach(s => { supplierMap[s.id] = s; });

  // Low stock items: stock_qty <= lowStockThreshold
  const lowStockItems = prices.filter(sp => sp.stock_qty <= lowStockThreshold && sp.price > 0);

  // Group prices by product_id
  const productPricesMap = {};
  prices.forEach(sp => {
    if (!productPricesMap[sp.product_id]) {
      productPricesMap[sp.product_id] = [];
    }
    productPricesMap[sp.product_id].push(sp);
  });

  // Filter products based on search term
  const filteredProducts = products.filter(product => {
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

  // Filter suppliers based on search term
  const filteredSuppliers = suppliers.filter(supplier => {
    const matchesSupplierName = supplier.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const supplierPrices = prices.filter(sp => sp.supplier_id === supplier.id && sp.price > 0);
    const matchesProductName = supplierPrices.some(sp => {
      const prod = productMap[sp.product_id];
      return prod && (
        prod.name_en.toLowerCase().includes(searchTerm.toLowerCase()) ||
        prod.name_kh.includes(searchTerm)
      );
    });

    return matchesSupplierName || matchesProductName;
  });

  const getProductSellingPrice = (productId) => {
    const sps = productPricesMap[productId] || [];
    if (sps.length > 0) {
      const maxPrice = Math.max(...sps.map(sp => sp.price));
      return maxPrice > 0 ? maxPrice + 0.20 : 0;
    }
    const prod = productMap[productId];
    return prod ? prod.base_price + 0.20 : 0;
  };

  const handleQuickRestock = async (spRecord, amount) => {
    try {
      await db.updateSupplierPrice({
        ...spRecord,
        stock_qty: spRecord.stock_qty + amount
      });
      onRefresh();
    } catch (err) {
      alert("Error restock: " + err.message);
    }
  };

  const startEditing = (sp) => {
    setEditingPriceId(sp.id);
    setEditQty(sp.stock_qty.toString());
    setEditUnit(sp.stock_unit || 'pcs');
  };

  const saveInlineEdit = async (sp) => {
    setIsSaving(true);
    try {
      await db.updateSupplierPrice({
        ...sp,
        stock_qty: Number(editQty),
        stock_unit: editUnit
      });
      setEditingPriceId(null);
      onRefresh();
    } catch (err) {
      alert("Error saving: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-dark-900/30 p-6 rounded-2xl border border-dark-800">
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide">Stock Tracker</h2>
          <p className="text-xs text-dark-400 mt-1">
            Monitor product availability, adjust threshold levels, and review inventory counts.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-dark-400 uppercase tracking-wider">Alert Threshold:</span>
          <select
            value={lowStockThreshold}
            onChange={(e) => setLowStockThreshold(Number(e.target.value))}
            className="glass-input py-1.5 px-3 min-w-[70px] text-center"
          >
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="5">5</option>
            <option value="10">10</option>
          </select>
        </div>
      </div>

      {/* Low Stock Alerts */}
      {lowStockItems.length > 0 && (
        <div className="bg-rose-950/20 border border-rose-900/30 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 text-rose-400 font-bold text-sm sm:text-base">
            <AlertTriangle className="w-5 h-5" />
            <h3>Low Stock Warnings ({lowStockItems.length} items)</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {lowStockItems.map(sp => {
              const prod = productMap[sp.product_id];
              const sup = supplierMap[sp.supplier_id];
              if (!prod || !sup) return null;

              return (
                <div 
                  key={sp.id} 
                  className="bg-dark-950/40 border border-rose-900/20 rounded-xl p-4 flex justify-between items-center"
                >
                  <div className="space-y-1">
                    <span className="font-bold text-white text-sm block">{prod.name_kh}</span>
                    <span className="text-xs text-dark-400 block">{prod.name_en}</span>
                    <span className="text-[10px] text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full inline-block font-semibold mt-1">
                      {sup.name}: {sp.stock_qty} {sp.stock_unit} left
                    </span>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <button
                      onClick={() => handleQuickRestock(sp, 12)}
                      className="glass-button-primary py-1 px-2.5 text-[10px] bg-emerald-700/80 hover:bg-emerald-600 font-bold"
                    >
                      +12 ({sp.stock_unit === 'pcs' ? 'pcs' : sp.stock_unit})
                    </button>
                    <button
                      onClick={() => handleQuickRestock(sp, 24)}
                      className="glass-button-secondary py-1 px-2.5 text-[10px] border-dark-700 font-bold"
                    >
                      +24
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Inventory Log Section */}
      <div className="space-y-4">
        {/* Toggle & Search bar */}
        <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Package className="w-4.5 h-4.5 text-primary-400" />
            Inventory Records
          </h3>

          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center flex-1 max-w-2xl justify-end">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" />
              <input
                type="text"
                placeholder="Search products or suppliers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 py-1.5 glass-input text-xs"
              />
            </div>

            {/* View toggles */}
            <div className="flex items-center gap-2 bg-dark-900/30 p-1 rounded-xl border border-dark-800 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => setGroupMode('product')}
                className={`py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                  groupMode === 'product'
                    ? 'bg-primary-500/10 text-primary-400'
                    : 'text-dark-400 hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                Group by Product
              </button>
              <button
                type="button"
                onClick={() => setGroupMode('supplier')}
                className={`py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                  groupMode === 'supplier'
                    ? 'bg-primary-500/10 text-primary-400'
                    : 'text-dark-400 hover:text-white'
                }`}
              >
                <ListFilter className="w-3.5 h-3.5" />
                Group by Supplier
              </button>
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
                <div key={product.id} className="glass-panel p-5 rounded-2xl border border-dark-800 space-y-4">
                  {/* Title */}
                  <div>
                    <h4 className="font-bold text-white text-base">{product.name_kh}</h4>
                    <p className="text-xs text-dark-400">{product.name_en}</p>
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
                          className={`p-4 rounded-xl border bg-dark-950/20 flex flex-col justify-between gap-3 transition-colors ${
                            isLow ? 'border-rose-900/30 bg-rose-950/5' : 'border-dark-850'
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="font-semibold text-white text-sm block">{sup ? sup.name : 'Unknown'}</span>
                              <span className="text-xs font-medium text-emerald-400">${sp.price.toFixed(2)}</span>
                            </div>
                            
                            {isLow && (
                              <span className="bg-rose-500/10 text-rose-400 text-[9px] font-bold px-1.5 py-0.5 rounded border border-rose-900/20">
                                LOW
                              </span>
                            )}
                          </div>

                          {isEditing ? (
                            <div className="space-y-2">
                              <div className="flex gap-2">
                                <input
                                  type="number"
                                  min="0"
                                  value={editQty}
                                  onChange={(e) => setEditQty(e.target.value)}
                                  className="w-16 glass-input py-1 px-2 text-xs text-center"
                                />
                                <select
                                  value={editUnit}
                                  onChange={(e) => setEditUnit(e.target.value)}
                                  className="flex-1 glass-input py-1 px-2 text-xs"
                                >
                                  <option value="pcs">pcs</option>
                                  <option value="lo">lo</option>
                                  <option value="cs">cs</option>
                                </select>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => saveInlineEdit(sp)}
                                  disabled={isSaving}
                                  className="flex-1 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-bold flex items-center justify-center gap-1"
                                >
                                  <Check className="w-3.5 h-3.5" /> Save
                                </button>
                                <button
                                  onClick={() => setEditingPriceId(null)}
                                  className="py-1 px-2 bg-dark-800 hover:bg-dark-700 text-dark-300 rounded text-[11px] font-bold"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-semibold text-dark-300">
                                Stock: <strong className="text-white">{sp.stock_qty}</strong> {sp.stock_unit}
                              </span>
                              <button
                                onClick={() => startEditing(sp)}
                                className="text-xs font-bold text-primary-400 hover:text-primary-300 underline"
                              >
                                Edit
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {filteredProducts.length === 0 && (
              <div className="glass-panel p-8 text-center text-dark-500 italic rounded-2xl border border-dark-800">
                No products found matching your search.
              </div>
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
                const matchesSupplier = supplier.name.toLowerCase().includes(searchTerm.toLowerCase());
                const matchesProduct = 
                  prod.name_en.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  prod.name_kh.includes(searchTerm);
                return matchesSupplier || matchesProduct;
              });

              if (filteredSupplierPrices.length === 0) return null;

              return (
                <div key={supplier.id} className="glass-panel p-5 rounded-2xl border border-dark-800 space-y-4">
                  {/* Title */}
                  <div className="border-b border-dark-850 pb-3 flex justify-between items-center">
                    <div>
                      <h4 className="font-bold text-white text-base">{supplier.name}</h4>
                      <p className="text-xs text-dark-400">Phone: {supplier.contact_phone || 'N/A'}</p>
                    </div>
                    <span className="text-xs font-bold bg-dark-850 text-dark-300 px-3 py-1 rounded-full border border-dark-800">
                      {filteredSupplierPrices.length} products
                    </span>
                  </div>

                  {/* Products table for this supplier */}
                  <div className="overflow-x-auto scrollbar-thin">
                    <table className="w-full border-collapse text-left text-xs sm:text-sm">
                      <thead>
                        <tr className="text-dark-400 font-bold border-b border-dark-850 pb-2">
                          <th className="py-2">Product Name</th>
                          <th className="py-2 text-center">Supplier Price</th>
                          <th className="py-2 text-center">Selling Price</th>
                          <th className="py-2 text-center">Stock Level</th>
                          <th className="py-2 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-dark-850">
                        {filteredSupplierPrices.map(sp => {
                          const prod = productMap[sp.product_id];
                          if (!prod) return null;

                          const isEditing = editingPriceId === sp.id;
                          const isLow = sp.stock_qty <= lowStockThreshold;

                          return (
                            <tr key={sp.id} className="hover:bg-dark-900/20">
                              <td className="py-3">
                                <div className="font-bold text-white">{prod.name_kh}</div>
                                <div className="text-[10px] text-dark-400">{prod.name_en}</div>
                              </td>
                              <td className="py-3 text-center text-emerald-400 font-bold">
                                ${sp.price.toFixed(2)}
                              </td>
                              <td className="py-3 text-center text-dark-400">
                                ${getProductSellingPrice(sp.product_id).toFixed(2)}
                              </td>
                              
                              <td className="py-3 text-center">
                                {isEditing ? (
                                  <div className="flex gap-1 justify-center items-center">
                                    <input
                                      type="number"
                                      min="0"
                                      value={editQty}
                                      onChange={(e) => setEditQty(e.target.value)}
                                      className="w-14 glass-input py-1 px-1 text-xs text-center"
                                    />
                                    <select
                                      value={editUnit}
                                      onChange={(e) => setEditUnit(e.target.value)}
                                      className="glass-input py-1 px-1 text-xs"
                                    >
                                      <option value="pcs">pcs</option>
                                      <option value="lo">lo</option>
                                      <option value="cs">cs</option>
                                    </select>
                                  </div>
                                ) : (
                                  <span className={`font-bold px-2 py-0.5 rounded ${
                                    isLow ? 'text-rose-400 bg-rose-500/10 font-black' : 'text-white'
                                  }`}>
                                    {sp.stock_qty} {sp.stock_unit}
                                  </span>
                                )}
                              </td>

                              <td className="py-3 text-center">
                                {isEditing ? (
                                  <div className="flex gap-1 justify-center">
                                    <button
                                      onClick={() => saveInlineEdit(sp)}
                                      disabled={isSaving}
                                      className="p-1 bg-emerald-600 text-white rounded font-bold"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => setEditingPriceId(null)}
                                      className="p-1 bg-dark-800 text-dark-300 rounded font-bold"
                                    >
                                      X
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => startEditing(sp)}
                                    className="text-xs font-bold text-primary-400 hover:text-primary-300 underline"
                                  >
                                    Edit Stock
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
            {filteredSuppliers.length === 0 && (
              <div className="glass-panel p-8 text-center text-dark-500 italic rounded-2xl border border-dark-800">
                No suppliers found matching your search.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
