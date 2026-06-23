import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Printer, ShoppingCart, Truck, AlertTriangle, AlertCircle, RefreshCw, Search, Grid, Minus, X } from 'lucide-react';
import { db } from '../services/db';
import confetti from 'canvas-confetti';

export default function InvoiceBuilder({ customers, products, suppliers, prices, onRefresh }) {
  const [selectedCustomerId, setSelectedCustomerId] = useState(() => {
    return localStorage.getItem('wsp_draft_customer') || '';
  });
  const [deliveryFee, setDeliveryFee] = useState(() => {
    return localStorage.getItem('wsp_draft_delivery_fee') || '1.50';
  });
  const [lineItems, setLineItems] = useState(() => {
    const saved = localStorage.getItem('wsp_draft_line_items');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {
        // Ignored
      }
    }

    return [
      { id: '1', product_id: '', supplier_id: '', supplier_price: 0, unit_price: 0, quantity: 1, subtotal: 0, maxStock: 0, stockUnit: 'pcs', searchQuery: '', isDropdownOpen: false }
    ];
  });
  const [isSaving, setIsSaving] = useState(false);
  const [savedOrder, setSavedOrder] = useState(null); // Saved order details for print receipt preview modal

  // POS Quick Add States
  const [quickSearchQuery, setQuickSearchQuery] = useState('');
  const [isQuickDropdownOpen, setIsQuickDropdownOpen] = useState(false);
  const quickInputRef = useRef(null);

  // Batch Add Catalog Modal States
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [batchSearchQuery, setBatchSearchQuery] = useState('');
  const [batchQuantities, setBatchQuantities] = useState({}); // { product_id: quantity }

  // Auto-save draft inputs to localStorage to prevent data loss on tab changes
  useEffect(() => {
    localStorage.setItem('wsp_draft_customer', selectedCustomerId);
  }, [selectedCustomerId]);

  useEffect(() => {
    localStorage.setItem('wsp_draft_delivery_fee', deliveryFee);
  }, [deliveryFee]);

  useEffect(() => {
    const cleanItems = lineItems.map(item => ({
      ...item,
      isDropdownOpen: false
    }));
    localStorage.setItem('wsp_draft_line_items', JSON.stringify(cleanItems));
  }, [lineItems]);
  
  // Group prices by product_id (only including active offers with non-zero price or stock)
  const productSupplierPrices = {};
  prices.forEach(sp => {
    if (sp.price > 0 || sp.stock_qty > 0) {
      if (!productSupplierPrices[sp.product_id]) {
        productSupplierPrices[sp.product_id] = [];
      }
      productSupplierPrices[sp.product_id].push(sp);
    }
  });

  const getFilteredProducts = (query) => {
    if (!query) return products;
    const lower = query.toLowerCase();
    return products.filter(p => 
      p.name_en.toLowerCase().includes(lower) || 
      p.name_kh.includes(lower)
    );
  };

  // Calculate row details
  const updateLineItem = (index, field, value) => {
    const updated = [...lineItems];
    const item = updated[index];
    item[field] = value;

    if (field === 'product_id') {
      const sps = productSupplierPrices[value] || [];
      if (sps.length > 0) {
        // Sort to find cheapest for inventory choice
        const sortedSpsCheapest = [...sps].sort((a, b) => a.price - b.price);
        const cheapest = sortedSpsCheapest[0];
        
        // Sort to find highest for selling price calculation
        const sortedSpsHighest = [...sps].sort((a, b) => b.price - a.price);
        const highest = sortedSpsHighest[0];
        
        item.supplier_id = cheapest.supplier_id;
        item.supplier_price = cheapest.price; // Set initial supplier price (cost price)
        item.unit_price = Math.round((highest.price + 0.20) * 100) / 100; // Selling Price: Max Cost + $0.20
        item.maxStock = cheapest.stock_qty;
        item.stockUnit = cheapest.stock_unit;
      } else {
        const prod = products.find(p => p.id === value);
        item.supplier_id = '';
        item.supplier_price = prod ? prod.base_price : 0;
        item.unit_price = prod ? Math.round((prod.base_price + 0.20) * 100) / 100 : 0;
        item.maxStock = 0;
        item.stockUnit = 'pcs';
      }
    } else if (field === 'supplier_id') {
      const sps = productSupplierPrices[item.product_id] || [];
      const match = sps.find(sp => sp.supplier_id === value);
      if (match) {
        item.maxStock = match.stock_qty;
        item.stockUnit = match.stock_unit;
        item.supplier_price = match.price; // Update supplier price (cost price)
      }
    }

    item.subtotal = Number(item.unit_price) * Number(item.quantity);
    setLineItems(updated);
  };

  const addLineItem = () => {
    setLineItems([...lineItems, { 
      id: Date.now().toString(), 
      product_id: '', 
      supplier_id: '', 
      supplier_price: 0,
      unit_price: 0, 
      quantity: 1, 
      subtotal: 0, 
      maxStock: 0,
      stockUnit: 'pcs',
      searchQuery: '',
      isDropdownOpen: false
    }]);
  };

  const removeLineItem = (index) => {
    const updated = lineItems.filter((_, idx) => idx !== index);
    setLineItems(updated.length > 0 ? updated : [{ 
      id: Date.now().toString(), 
      product_id: '', 
      supplier_id: '', 
      supplier_price: 0,
      unit_price: 0, 
      quantity: 1, 
      subtotal: 0, 
      maxStock: 0,
      stockUnit: 'pcs',
      searchQuery: '',
      isDropdownOpen: false
    }]);
  };

  const addProductToInvoice = (productId, qtyToAdd = 1) => {
    setLineItems(prevItems => {
      // 1. Check if the product is already in the invoice
      const existingIdx = prevItems.findIndex(item => item.product_id === productId);
      
      if (existingIdx > -1) {
        // Increment quantity of existing item
        const updated = [...prevItems];
        const item = { ...updated[existingIdx] };
        item.quantity = Number(item.quantity) + Number(qtyToAdd);
        item.subtotal = Number(item.unit_price) * item.quantity;
        updated[existingIdx] = item;
        return updated;
      } else {
        // Create new item
        const sps = productSupplierPrices[productId] || [];
        const cheapest = sps.length > 0 ? [...sps].sort((a, b) => a.price - b.price)[0] : null;
        const highest = sps.length > 0 ? [...sps].sort((a, b) => b.price - a.price)[0] : null;
        const prod = products.find(p => p.id === productId);

        const supplier_id = cheapest ? cheapest.supplier_id : '';
        const supplier_price = cheapest ? cheapest.price : (prod ? prod.base_price : 0);
        const unit_price = cheapest && highest
          ? Math.round((highest.price + 0.20) * 100) / 100
          : (prod ? Math.round((prod.base_price + 0.20) * 100) / 100 : 0);
        const maxStock = cheapest ? cheapest.stock_qty : 0;
        const stockUnit = cheapest ? cheapest.stock_unit : 'pcs';

        
        const newItem = {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          product_id: productId,
          supplier_id,
          supplier_price,
          unit_price,
          quantity: qtyToAdd,
          subtotal: Number(unit_price) * qtyToAdd,
          maxStock,
          stockUnit,
          searchQuery: '',
          isDropdownOpen: false
        };
        
        // If the first item in the list is empty (no product selected yet), replace it
        if (prevItems.length === 1 && !prevItems[0].product_id) {
          return [newItem];
        }
        
        return [...prevItems, newItem];
      }
    });
  };


  // Calculations
  const subtotal = lineItems.reduce((sum, item) => sum + item.subtotal, 0);
  const totalAmount = subtotal + Number(deliveryFee || 0);
  const totalProfit = lineItems.reduce((sum, item) => {
    if (!item.product_id) return sum;
    const profit = (Number(item.unit_price || 0) - Number(item.supplier_price || 0)) * Number(item.quantity || 0);
    return sum + profit;
  }, 0);

  const handleSaveInvoice = async (e) => {
    e.preventDefault();
    if (!selectedCustomerId) {
      alert("Please select a customer first!");
      return;
    }

    const validItems = lineItems.filter(item => item.product_id && item.quantity > 0);
    if (validItems.length === 0) {
      alert("Please add at least one valid product line item.");
      return;
    }

    setIsSaving(true);
    try {
      const orderObj = {
        customer_id: selectedCustomerId,
        delivery_fee: Number(deliveryFee),
        total_amount: totalAmount,
        status: 'pending'
      };

      const result = await db.createOrder(orderObj, validItems);
      
      // Trigger canvas confetti celebration
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });

      // Fetch refreshed database list
      onRefresh();

      // Show print modal
      setSavedOrder({
        order: result,
        items: validItems,
        customer: customers.find(c => c.id === selectedCustomerId)
      });

      // Clear form and drafts
      localStorage.removeItem('wsp_draft_customer');
      localStorage.removeItem('wsp_draft_delivery_fee');
      localStorage.removeItem('wsp_draft_line_items');

      setSelectedCustomerId('');
      setLineItems([{ 
        id: Date.now().toString(), 
        product_id: '', 
        supplier_id: '', 
        supplier_price: 0,
        unit_price: 0, 
        quantity: 1, 
        subtotal: 0, 
        maxStock: 0,
        stockUnit: 'pcs',
        searchQuery: '',
        isDropdownOpen: false
      }]);
      setDeliveryFee('1.50');
    } catch (err) {
      alert("Error creating order: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <div className="no-print space-y-6">
        {/* Header Panel */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-dark-900/30 p-6 rounded-2xl border border-dark-800">
          <div>
            <h2 className="text-xl font-bold text-white tracking-wide">Invoice Builder</h2>
            <p className="text-xs text-dark-400 mt-1">
              Build wholesale invoices, compare and select suppliers, check stock levels, and print invoices.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Side: Invoice Items Builder (2 cols) */}
          <form onSubmit={handleSaveInvoice} className="lg:col-span-2 space-y-6">
            <div className="glass-panel p-6 rounded-2xl border border-dark-800 space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Invoice Header</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-dark-300 uppercase tracking-wider mb-2">Customer *</label>
                  <select
                    required
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    className="w-full glass-input"
                  >
                    <option value="">-- Choose Customer --</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ''}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-dark-300 uppercase tracking-wider mb-2">Delivery Fee (USD)</label>
                  <div className="relative">
                    <Truck className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-dark-500" />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={deliveryFee}
                      onChange={(e) => setDeliveryFee(e.target.value)}
                      className="w-full pl-11 glass-input"
                      placeholder="1.50"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Line Items Grid */}
            <div className="glass-panel p-6 rounded-2xl border border-dark-800 space-y-4">
              <div className="flex justify-between items-center flex-wrap gap-2">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Line Items</h3>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const currentQties = {};
                      lineItems.forEach(item => {
                        if (item.product_id) {
                          currentQties[item.product_id] = (currentQties[item.product_id] || 0) + item.quantity;
                        }
                      });
                      setBatchQuantities(currentQties);
                      setBatchSearchQuery('');
                      setIsBatchModalOpen(true);
                    }}
                    className="glass-button-secondary py-1.5 px-3 flex items-center gap-1.5 text-xs border-primary-500/10 hover:border-primary-500/30"
                  >
                    <Grid className="w-3.5 h-3.5 text-primary-400" />
                    Batch Add Catalog
                  </button>
                  <button
                    type="button"
                    onClick={addLineItem}
                    className="glass-button-secondary py-1.5 px-3 flex items-center gap-1.5 text-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Product
                  </button>
                </div>
              </div>

              {/* POS-Style Quick Search & Add Bar */}
              <div className="relative z-30">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-dark-500" />
                  <input
                    ref={quickInputRef}
                    type="text"
                    placeholder="⚡ POS Quick Search & Add Product (Search name & select to instantly add)..."
                    value={quickSearchQuery}
                    onChange={(e) => {
                      setQuickSearchQuery(e.target.value);
                      setIsQuickDropdownOpen(true);
                    }}
                    onFocus={() => setIsQuickDropdownOpen(true)}
                    onBlur={() => {
                      setTimeout(() => setIsQuickDropdownOpen(false), 200);
                    }}
                    className="w-full pl-11 pr-10 glass-input text-xs sm:text-sm font-medium border-primary-500/20 focus:border-primary-500/50 shadow-inner"
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

                {isQuickDropdownOpen && quickSearchQuery && (
                  <div className="absolute left-0 right-0 mt-1 max-h-60 overflow-y-auto z-50 rounded-xl bg-dark-900 border border-dark-800 shadow-2xl divide-y divide-dark-850 scrollbar-thin animate-in slide-in-from-top-2 duration-150">
                    {getFilteredProducts(quickSearchQuery).map(p => {
                      const sps = productSupplierPrices[p.id] || [];
                      const cheapestPrice = sps.length > 0 
                        ? Math.min(...sps.map(sp => sp.price)) 
                        : p.base_price;
                      const totalStock = sps.reduce((sum, sp) => sum + sp.stock_qty, 0);
                      const existingQty = lineItems
                        .filter(item => item.product_id === p.id)
                        .reduce((sum, item) => sum + Number(item.quantity), 0);

                      return (
                        <div
                          key={p.id}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            addProductToInvoice(p.id, 1);
                            setQuickSearchQuery('');
                            setIsQuickDropdownOpen(false);
                            quickInputRef.current?.focus();
                          }}
                          className="p-3 hover:bg-primary-500/10 cursor-pointer text-left transition-colors flex justify-between items-center gap-4"
                        >
                          <div>
                            <div className="font-semibold text-white text-xs sm:text-sm">{p.name_kh}</div>
                            <div className="text-[10px] text-dark-400 mt-0.5">{p.name_en}</div>
                          </div>
                          <div className="flex items-center gap-2.5">
                            <div className="text-right text-[10px] text-dark-400">
                              <span className="block font-medium text-white">${cheapestPrice.toFixed(2)}</span>
                              <span>Stock: {totalStock}</span>
                            </div>
                            {existingQty > 0 ? (
                              <span className="text-[10px] bg-primary-500/20 text-primary-400 font-semibold px-2 py-0.5 rounded border border-primary-500/30">
                                {existingQty} added
                              </span>
                            ) : (
                              <span className="text-[10px] bg-dark-950 text-dark-400 font-medium px-2 py-0.5 rounded border border-dark-800 hover:text-white">
                                Add +
                              </span>
                            )}
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


              <div className="space-y-3">
                {lineItems.map((item, idx) => {
                  const sps = productSupplierPrices[item.product_id] || [];
                  const cheapestSp = [...sps].sort((a, b) => a.price - b.price)[0];
                  const isStockWarning = item.product_id && item.supplier_id && (item.quantity > item.maxStock);

                  return (
                    <div key={item.id} className="p-4 rounded-xl border border-dark-850 bg-dark-950/20 space-y-4 sm:space-y-0 sm:flex sm:items-center sm:gap-3 transition-colors hover:border-dark-800">
                      
                      {/* Product Selector */}
                      <div className="flex-1 min-w-[180px] relative">
                        <label className="block text-[10px] font-bold text-dark-500 uppercase tracking-wider mb-1 sm:hidden">Product</label>
                        <input
                          type="text"
                          required
                          placeholder="Search product..."
                          value={item.searchQuery !== undefined ? item.searchQuery : (products.find(p => p.id === item.product_id) ? `${products.find(p => p.id === item.product_id).name_kh} (${products.find(p => p.id === item.product_id).name_en})` : '')}
                          onFocus={() => {
                            const updated = [...lineItems];
                            updated[idx].isDropdownOpen = true;
                            const currentProd = products.find(p => p.id === item.product_id);
                            updated[idx].searchQuery = currentProd ? `${currentProd.name_kh} (${currentProd.name_en})` : '';
                            setLineItems(updated);
                          }}
                          onBlur={() => {
                            setTimeout(() => {
                              const updated = [...lineItems];
                              if (updated[idx]) {
                                updated[idx].isDropdownOpen = false;
                                const currentProd = products.find(p => p.id === updated[idx].product_id);
                                updated[idx].searchQuery = currentProd ? `${currentProd.name_kh} (${currentProd.name_en})` : '';
                                setLineItems(updated);
                              }
                            }, 250);
                          }}
                          onChange={(e) => {
                            const updated = [...lineItems];
                            updated[idx].searchQuery = e.target.value;
                            updated[idx].isDropdownOpen = true;
                            setLineItems(updated);
                          }}
                          className="w-full glass-input"
                        />
                        {item.isDropdownOpen && (
                          <div className="absolute left-0 right-0 mt-1 max-h-60 overflow-y-auto z-50 rounded-xl bg-dark-900 border border-dark-800 shadow-xl divide-y divide-dark-850 scrollbar-thin">
                            {getFilteredProducts(item.searchQuery || '').map(p => (
                              <div
                                key={p.id}
                                onClick={() => {
                                  updateLineItem(idx, 'product_id', p.id);
                                  const updated = [...lineItems];
                                  updated[idx].searchQuery = `${p.name_kh} (${p.name_en})`;
                                  updated[idx].isDropdownOpen = false;
                                  setLineItems(updated);
                                }}
                                className="p-3 hover:bg-primary-500/10 cursor-pointer text-left transition-colors"
                              >
                                <div className="font-semibold text-white text-xs sm:text-sm">{p.name_kh}</div>
                                <div className="text-[10px] text-dark-400 mt-0.5">{p.name_en}</div>
                              </div>
                            ))}
                            {getFilteredProducts(item.searchQuery || '').length === 0 && (
                              <div className="p-3 text-dark-500 text-xs italic text-center">No products found</div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Supplier Selector */}
                      <div className="w-full sm:w-[170px]">
                        <label className="block text-[10px] font-bold text-dark-500 uppercase tracking-wider mb-1 sm:hidden">Supplier & Price</label>
                        <select
                          required
                          disabled={!item.product_id}
                          value={item.supplier_id}
                          onChange={(e) => updateLineItem(idx, 'supplier_id', e.target.value)}
                          className="w-full glass-input disabled:opacity-40"
                        >
                          {sps.length === 0 ? (
                            <option value="">No suppliers</option>
                          ) : (
                            sps.map(sp => {
                              const sup = suppliers.find(s => s.id === sp.supplier_id);
                              const name = sup ? sup.name : 'Unknown';
                              const cheapestLabel = cheapestSp && cheapestSp.supplier_id === sp.supplier_id ? ' ★' : '';
                              return (
                                <option key={sp.supplier_id} value={sp.supplier_id}>
                                  {name}: ${sp.price.toFixed(2)} (Qty: {sp.stock_qty}){cheapestLabel}
                                </option>
                              );
                            })
                          )}
                        </select>
                      </div>

                      {/* Price field (editable input) */}
                      <div className="w-28 relative">
                        <label className="block text-[10px] font-bold text-dark-500 uppercase tracking-wider mb-1 sm:hidden">Selling Price</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400 text-xs font-semibold">$</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            required
                            value={item.unit_price}
                            onChange={(e) => updateLineItem(idx, 'unit_price', e.target.value)}
                            className="w-full pl-6 pr-2 py-2 glass-input text-left text-white text-xs font-semibold focus:border-primary-500/50"
                          />
                        </div>
                      </div>

                      {/* Quantity Input */}
                      <div className="w-20 relative">
                        <label className="block text-[10px] font-bold text-dark-500 uppercase tracking-wider mb-1 sm:hidden">Qty</label>
                        <input
                          type="number"
                          min="1"
                          required
                          value={item.quantity}
                          onChange={(e) => updateLineItem(idx, 'quantity', e.target.value)}
                          className="w-full glass-input text-center text-xs"
                        />
                      </div>

                      {/* Subtotal */}
                      <div className="w-28 text-right pr-2">
                        <label className="block text-[10px] font-bold text-dark-500 uppercase tracking-wider mb-1 sm:hidden text-right">Subtotal</label>
                        <span className="font-semibold text-white block text-sm">${Number(item.subtotal || 0).toFixed(2)}</span>
                        {item.product_id && (
                          <div className="text-[10px] text-emerald-400 font-medium mt-1 truncate" title={`Cost: $${Number(item.supplier_price || 0).toFixed(2)} / unit`}>
                            Profit: +${((Number(item.unit_price || 0) - Number(item.supplier_price || 0)) * Number(item.quantity || 0)).toFixed(2)}
                          </div>
                        )}
                      </div>

                      {/* Remove Action */}
                      <div className="flex items-center gap-2 pt-2 sm:pt-0">
                        <button
                          type="button"
                          onClick={() => removeLineItem(idx)}
                          className="p-2 rounded bg-dark-900 border border-dark-800 hover:bg-dark-800 text-dark-400 hover:text-white"
                          title="Remove row"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>

                        {isStockWarning && (
                          <div className="flex items-center gap-1 text-[10px] font-bold bg-amber-500/10 border border-amber-900/40 text-amber-400 px-1.5 py-1 rounded" title={`Available stock is only ${item.maxStock} ${item.stockUnit}`}>
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                            <span>Stock: {item.maxStock}</span>
                          </div>
                        )}
                      </div>

                    </div>
                  );
                })}
              </div>
            </div>
          </form>

          {/* Right Side: Total Summary & Checkout Actions (1 col) */}
          <div className="space-y-6">
            <div className="glass-panel p-6 rounded-2xl border border-dark-800 space-y-6">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Checkout Summary</h3>
              
              <div className="space-y-3 text-sm border-b border-dark-800/80 pb-4">
                <div className="flex justify-between text-dark-400">
                  <span>Items Subtotal</span>
                  <span className="font-semibold text-dark-200">${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-dark-400">
                  <span>Delivery Fee</span>
                  <span className="font-semibold text-dark-200">${Number(deliveryFee || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-emerald-400 font-medium">
                  <span>Estimated Profit</span>
                  <span>${totalProfit.toFixed(2)}</span>
                </div>
              </div>

              <div className="flex justify-between items-end">
                <div>
                  <span className="text-xs text-dark-400 font-bold uppercase tracking-wider block">Grand Total</span>
                  <span className="text-2xl font-black text-white">${totalAmount.toFixed(2)}</span>
                </div>
                <span className="text-xs text-primary-400 font-semibold italic bg-primary-500/5 px-2.5 py-1 rounded border border-primary-500/15">
                  {lineItems.filter(item => item.product_id).length} Products
                </span>
              </div>

              <button
                onClick={handleSaveInvoice}
                disabled={isSaving}
                className="w-full glass-button-primary py-3 font-bold text-base cursor-pointer"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    Saving Invoice...
                  </>
                ) : (
                  <>
                    <ShoppingCart className="w-5 h-5" />
                    Save & Print Invoice
                  </>
                )}
              </button>
            </div>

            <div className="p-4 bg-dark-900/30 rounded-2xl border border-dashed border-dark-800 flex gap-3">
              <AlertCircle className="w-5 h-5 text-primary-400 flex-shrink-0" />
              <div className="text-xs text-dark-400">
                <span className="font-bold text-white block mb-0.5">Auto-Pricing Rule</span>
                cheapest supplier price is auto-filled. To edit suppliers, use the dropdown. Stocks decrement automatically.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Invoice Print Preview Modal Overlay */}
      {savedOrder && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-sm p-4 flex items-center justify-center no-print">
          <div className="bg-dark-900 border border-dark-800 w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            
            {/* Top Bar controls */}
            <div className="p-4 border-b border-dark-800 flex justify-between items-center bg-dark-950/40">
              <h3 className="font-semibold text-white">Invoice Details</h3>
              <div className="flex gap-2">
                <button onClick={handlePrint} className="glass-button-primary py-1.5 px-3 flex items-center gap-1.5 text-xs">
                  <Printer className="w-4 h-4" />
                  Print Invoice
                </button>
                <button onClick={() => setSavedOrder(null)} className="glass-button-secondary py-1.5 px-3 text-xs">
                  Close
                </button>
              </div>
            </div>

            {/* Paper Receipt Box */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin bg-dark-950/20">
              
              {/* Internal Profit Analysis Card (Owner Only) - Hidden on print */}
              <div className="no-print glass-panel p-5 rounded-xl border border-dark-850 bg-dark-900/60 max-w-md mx-auto space-y-4 shadow-lg text-left">
                <div className="flex justify-between items-center border-b border-dark-800 pb-3">
                  <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    Internal Profit Analysis (Owner Only)
                  </h4>
                  <span className="text-xs text-dark-400 font-mono">
                    Order: #{savedOrder.order.id.slice(-6).toUpperCase()}
                  </span>
                </div>
                
                <div className="divide-y divide-dark-850 max-h-48 overflow-y-auto scrollbar-thin">
                  {savedOrder.items.map((item, idx) => {
                    const prod = products.find(p => p.id === item.product_id);
                    const cost = Number(item.supplier_price || 0);
                    const selling = Number(item.unit_price);
                    const qty = Number(item.quantity);
                    const profitPerUnit = selling - cost;
                    const itemProfit = profitPerUnit * qty;
                    
                    return (
                      <div key={idx} className="py-2.5 flex justify-between items-start gap-4 text-xs">
                        <div className="space-y-1">
                          <div className="font-semibold text-white">
                            {prod ? `${prod.name_kh} (${prod.name_en})` : 'Unknown Product'}
                          </div>
                          <div className="text-[10px] text-dark-400 flex items-center gap-1.5">
                            <span>Cost: ${cost.toFixed(2)}</span>
                            <span>•</span>
                            <span>Sell: ${selling.toFixed(2)}</span>
                            <span>•</span>
                            <span>Qty: {qty}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-emerald-400 block">+${itemProfit.toFixed(2)}</span>
                          <span className="text-[9px] text-dark-500">(${profitPerUnit.toFixed(2)}/unit)</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                <div className="border-t border-dark-800 pt-3 flex justify-between items-center text-sm font-bold">
                  <span className="text-dark-300">Total Order Profit:</span>
                  <span className="text-lg text-emerald-400">
                    ${savedOrder.items.reduce((sum, item) => sum + (Number(item.unit_price) - Number(item.supplier_price || 0)) * Number(item.quantity), 0).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Paper Receipt Box */}
              <div className="max-w-md mx-auto border border-gray-300 p-6 bg-white shadow-sm print-card text-black font-sans text-left">
                
                {/* Receipt Header */}
                <div className="text-center space-y-2 border-b pb-4 border-dashed border-gray-300">
                  <h1 className="text-xl font-bold uppercase tracking-wider text-black">វិក្កយបត្រ / INVOICE</h1>
                  <h2 className="text-lg font-bold text-black font-mono">
                    {savedOrder.customer?.name || 'ស្រីពៅ លក់ចាប់ហួយ (Zeii Pov Shop)'}
                  </h2>
                  <p className="text-[10px] text-gray-500">
                    {savedOrder.customer?.location_note || 'ផ្សារអូរឫស្សី, ភ្នំពេញ'}
                    {savedOrder.customer?.phone ? ` • ទូរស័ព្ទ: ${savedOrder.customer.phone}` : ''}
                  </p>
                  
                  <div className="text-left text-xs grid grid-cols-2 gap-y-1 pt-2 font-mono text-gray-700">
                    <div><strong>Invoice No:</strong> #{savedOrder.order.id.slice(-6).toUpperCase()}</div>
                    <div><strong>Date:</strong> {new Date(savedOrder.order.ordered_at).toLocaleDateString()}</div>
                    <div className="col-span-2"><strong>Customer:</strong> {savedOrder.customer?.name}</div>
                    {savedOrder.customer?.phone && <div className="col-span-2"><strong>Phone:</strong> {savedOrder.customer.phone}</div>}
                    {savedOrder.customer?.location_note && <div className="col-span-2"><strong>Address:</strong> {savedOrder.customer.location_note}</div>}
                  </div>
                </div>

                {/* Table items */}
                <table className="w-full text-xs text-left mt-4 border-b border-dashed border-gray-300 pb-4">
                  <thead>
                    <tr className="border-b border-gray-300 font-bold text-gray-800">
                      <th className="py-2">Description / ទំនិញ</th>
                      <th className="py-2 text-center">Qty / 数量</th>
                      <th className="py-2 text-right">Price / តម្លៃ</th>
                      <th className="py-2 text-right">Total / សរុប</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {savedOrder.items.map((item, index) => {
                      const prod = products.find(p => p.id === item.product_id);
                      return (
                        <tr key={index} className="text-gray-800">
                          <td className="py-2">
                            <div className="font-bold">{prod?.name_kh}</div>
                            <div className="text-[10px] text-gray-500">{prod?.name_en}</div>
                          </td>
                          <td className="py-2 text-center font-mono">{item.quantity}</td>
                          <td className="py-2 text-right font-mono">${Number(item.unit_price).toFixed(2)}</td>
                          <td className="py-2 text-right font-mono">${Number(item.subtotal).toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Totals block */}
                <div className="mt-4 space-y-1.5 text-xs text-right font-mono">
                  <div className="flex justify-between text-gray-700">
                    <span>Subtotal / សរុបបណ្តោះអាសន្ន:</span>
                    <span>${(savedOrder.order.total_amount - savedOrder.order.delivery_fee).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-gray-700">
                    <span>Delivery / ថ្លៃដឹកជញ្ជូន:</span>
                    <span>${Number(savedOrder.order.delivery_fee).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-t border-double pt-2 text-sm font-bold text-black">
                    <span>Grand Total / សរុបរួម:</span>
                    <span>${Number(savedOrder.order.total_amount).toFixed(2)}</span>
                  </div>
                </div>

                {/* Footer terms */}
                <div className="mt-6 text-center space-y-1 border-t border-dashed border-gray-300 pt-4 text-[10px] text-gray-500">
                  <p>សូមអរគុណ ចំពោះការគាំទ្រ! (Thank you for your support!)</p>
                  <p className="font-mono">Wholesale Portal Invoice System</p>
                </div>

              </div>
            </div>
            
          </div>
        </div>
      )}

      {/* Actual Hidden print layout for window.print() */}
      {savedOrder && (
        <div className="hidden print-only bg-white text-black p-4 font-sans leading-normal">
          <div className="max-w-md mx-auto border-0 p-2">
            
            {/* Header */}
            <div className="text-center space-y-1 pb-2 border-b border-dashed border-gray-400">
              <h1 className="text-lg font-bold tracking-wider">
                {savedOrder.customer?.name || 'ស្រីពៅ លក់ចាប់ហួយ (Zeii Pov Shop)'}
              </h1>
              <p className="text-[10px]">
                វិក្កយបត្រ / INVOICE
                {savedOrder.customer?.location_note ? ` • ${savedOrder.customer.location_note}` : ''}
                {savedOrder.customer?.phone ? ` • Tel: ${savedOrder.customer.phone}` : ''}
              </p>
              
              <div className="text-left text-[10px] grid grid-cols-2 gap-y-0.5 pt-2 font-mono">
                <div>No: #{savedOrder.order.id.slice(-6).toUpperCase()}</div>
                <div>Date: {new Date(savedOrder.order.ordered_at).toLocaleDateString()}</div>
                <div className="col-span-2">Customer: {savedOrder.customer?.name}</div>
                {savedOrder.customer?.phone && <div className="col-span-2">Phone: {savedOrder.customer.phone}</div>}
              </div>
            </div>

            {/* Table */}
            <table className="w-full text-[10px] text-left mt-2 border-b border-dashed border-gray-400 pb-2">
              <thead>
                <tr className="border-b border-gray-400 font-bold">
                  <th className="py-1">Product</th>
                  <th className="py-1 text-center">Qty</th>
                  <th className="py-1 text-right">Price</th>
                  <th className="py-1 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-150">
                {savedOrder.items.map((item, index) => {
                  const prod = products.find(p => p.id === item.product_id);
                  return (
                    <tr key={index}>
                      <td className="py-1">
                        <div className="font-bold">{prod?.name_kh}</div>
                        <div className="text-[9px] text-gray-500">{prod?.name_en}</div>
                      </td>
                      <td className="py-1 text-center font-mono">{item.quantity}</td>
                      <td className="py-1 text-right font-mono">${Number(item.unit_price).toFixed(2)}</td>
                      <td className="py-1 text-right font-mono">${Number(item.subtotal).toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Totals */}
            <div className="mt-2 space-y-1 text-[10px] text-right font-mono">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>${(savedOrder.order.total_amount - savedOrder.order.delivery_fee).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Delivery:</span>
                <span>${Number(savedOrder.order.delivery_fee).toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t border-double pt-1 font-bold">
                <span>Grand Total:</span>
                <span>${Number(savedOrder.order.total_amount).toFixed(2)}</span>
              </div>
            </div>

            {/* Terms */}
            <div className="mt-4 text-center text-[9px] text-gray-500">
              <p>សូមអរគុណ ចំពោះការគាំទ្រ! (Thank you!)</p>
            </div>

          </div>
        </div>
      )}
      {/* Batch Add Catalog Modal */}
      {isBatchModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm p-4 flex items-center justify-center no-print">
          <div className="bg-dark-900 border border-dark-800 w-full max-w-4xl rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-dark-800 flex justify-between items-center bg-dark-950/40">
              <div>
                <h3 className="font-bold text-white text-base sm:text-lg flex items-center gap-2">
                  <Grid className="w-5 h-5 text-primary-400" />
                  Batch Add Products from Catalog
                </h3>
                <p className="text-xs text-dark-400 mt-1">
                  Adjust quantities for multiple products and apply them to the invoice in one batch.
                </p>
              </div>
              <button 
                type="button"
                onClick={() => setIsBatchModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-dark-805 text-dark-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Search Bar */}
            <div className="p-4 border-b border-dark-850 bg-dark-900/40">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-dark-500" />
                <input
                  type="text"
                  placeholder="Search catalog by product name (English or Khmer)..."
                  value={batchSearchQuery}
                  onChange={(e) => setBatchSearchQuery(e.target.value)}
                  className="w-full pl-11 pr-4 glass-input text-sm"
                />
              </div>
            </div>

            {/* Modal Product Grid */}
            <div className="flex-1 overflow-y-auto p-6 scrollbar-thin bg-dark-950/10">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {getFilteredProducts(batchSearchQuery).map(p => {
                  const sps = productSupplierPrices[p.id] || [];
                  const cheapestPrice = sps.length > 0 
                    ? Math.min(...sps.map(sp => sp.price)) 
                    : p.base_price;
                  const totalStock = sps.reduce((sum, sp) => sum + sp.stock_qty, 0);
                  const qty = batchQuantities[p.id] || 0;

                  const handleQtyChange = (val) => {
                    const parsed = parseInt(val, 10);
                    const newQty = isNaN(parsed) || parsed < 0 ? 0 : parsed;
                    setBatchQuantities(prev => ({
                      ...prev,
                      [p.id]: newQty
                    }));
                  };

                  const increment = () => {
                    setBatchQuantities(prev => ({
                      ...prev,
                      [p.id]: (prev[p.id] || 0) + 1
                    }));
                  };

                  const decrement = () => {
                    setBatchQuantities(prev => {
                      const current = prev[p.id] || 0;
                      if (current <= 0) return prev;
                      return {
                        ...prev,
                        [p.id]: current - 1
                      };
                    });
                  };

                  return (
                    <div 
                      key={p.id} 
                      className={`p-4 rounded-xl border transition-all ${
                        qty > 0 
                          ? 'border-primary-500/40 bg-primary-500/5 shadow-md shadow-primary-500/2' 
                          : 'border-dark-850 bg-dark-900/20 hover:border-dark-800'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2 h-12">
                        <div className="text-left">
                          <h4 className="font-semibold text-white text-xs sm:text-sm line-clamp-1">{p.name_kh}</h4>
                          <p className="text-[10px] text-dark-400 mt-0.5 line-clamp-1">{p.name_en}</p>
                        </div>
                        <span className="text-xs font-bold text-primary-400 shrink-0">
                          ${cheapestPrice.toFixed(2)}
                        </span>
                      </div>

                      <div className="flex justify-between items-center mt-3 pt-3 border-t border-dark-850/60">
                        <div className="text-[10px] text-dark-500 text-left">
                          <span className="block">Cost: ${cheapestPrice.toFixed(2)}</span>
                          <span className={`${totalStock <= 2 ? 'text-rose-400' : 'text-dark-400'}`}>
                            Stock: {totalStock}
                          </span>
                        </div>

                        {/* Qty Selector */}
                        <div className="flex items-center gap-1 bg-dark-950/80 rounded-lg p-0.5 border border-dark-800">
                          <button
                            type="button"
                            onClick={decrement}
                            className="p-1.5 rounded text-dark-400 hover:text-white hover:bg-dark-800 active:scale-90 transition-all cursor-pointer"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={qty || ''}
                            placeholder="0"
                            onChange={(e) => handleQtyChange(e.target.value)}
                            className="w-10 text-center bg-transparent border-0 outline-none text-xs font-bold text-white p-0"
                          />
                          <button
                            type="button"
                            onClick={increment}
                            className="p-1.5 rounded text-dark-400 hover:text-white hover:bg-dark-800 active:scale-90 transition-all cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {getFilteredProducts(batchSearchQuery).length === 0 && (
                  <div className="col-span-full py-12 text-center text-dark-500 italic text-sm">
                    No products found matching your search.
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-dark-800 flex flex-col sm:flex-row justify-between items-center gap-3 bg-dark-950/40">
              <div className="text-xs text-dark-400 text-center sm:text-left">
                Selected: <strong className="text-white">{Object.values(batchQuantities).filter(q => q > 0).length}</strong> products
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setIsBatchModalOpen(false)}
                  className="w-full sm:w-auto glass-button-secondary py-2 px-4 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const itemsToApply = Object.entries(batchQuantities)
                      .map(([id, q]) => ({ productId: id, qty: q }));

                    setLineItems(prevItems => {
                      let updated = [];
                      
                      itemsToApply.forEach(({ productId, qty }) => {
                        if (qty <= 0) return;
                        
                        const existingItem = prevItems.find(item => item.product_id === productId);
                        if (existingItem) {
                          updated.push({
                            ...existingItem,
                            quantity: qty,
                            subtotal: Number(existingItem.unit_price) * qty
                          });
                        } else {
                          const sps = productSupplierPrices[productId] || [];
                          const cheapest = sps.length > 0 ? [...sps].sort((a, b) => a.price - b.price)[0] : null;
                          const highest = sps.length > 0 ? [...sps].sort((a, b) => b.price - a.price)[0] : null;
                          const prod = products.find(p => p.id === productId);

                          const supplier_id = cheapest ? cheapest.supplier_id : '';
                          const supplier_price = cheapest ? cheapest.price : (prod ? prod.base_price : 0);
                          const unit_price = cheapest && highest
                            ? Math.round((highest.price + 0.20) * 100) / 100
                            : (prod ? Math.round((prod.base_price + 0.20) * 100) / 100 : 0);
                          const maxStock = cheapest ? cheapest.stock_qty : 0;
                          const stockUnit = cheapest ? cheapest.stock_unit : 'pcs';


                          updated.push({
                            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                            product_id: productId,
                            supplier_id,
                            supplier_price,
                            unit_price,
                            quantity: qty,
                            subtotal: Number(unit_price) * qty,
                            maxStock,
                            stockUnit,
                            searchQuery: '',
                            isDropdownOpen: false
                          });
                        }
                      });

                      if (updated.length === 0) {
                        updated.push({
                          id: Date.now().toString(),
                          product_id: '',
                          supplier_id: '',
                          supplier_price: 0,
                          unit_price: 0,
                          quantity: 1,
                          subtotal: 0,
                          maxStock: 0,
                          stockUnit: 'pcs',
                          searchQuery: '',
                          isDropdownOpen: false
                        });
                      }

                      return updated;
                    });

                    setIsBatchModalOpen(false);
                  }}
                  className="w-full sm:w-auto glass-button-primary py-2 px-4 cursor-pointer"
                >
                  Apply to Invoice
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

