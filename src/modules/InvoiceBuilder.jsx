import { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Trash2, 
  Printer, 
  ShoppingCart, 
  Truck, 
  AlertTriangle, 
  AlertCircle, 
  RefreshCw, 
  Search, 
  Grid, 
  Minus, 
  X, 
  Eye, 
  ImageIcon, 
  Download, 
  FileImage, 
  Check, 
  Share2 
} from 'lucide-react';
import { toPng, toJpeg } from 'html-to-image';
import { db } from '../services/db';
import confetti from 'canvas-confetti';

// Floating-point precision math helper for currency calculations
const roundMoney = (num) => {
  const n = Number(num);
  if (isNaN(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
};

// Safe quantity parsing supporting floats/decimals
const parseQuantity = (val) => {
  if (val === '' || val === null || val === undefined) return 0;
  const parsed = parseFloat(val);
  return isNaN(parsed) || parsed < 0 ? 0 : parsed;
};

export default function InvoiceBuilder({ customers, products, suppliers, prices, brands = [], categories = [], onRefresh, showToast }) {
  const [selectedBrandFilter, setSelectedBrandFilter] = useState('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
  const [selectedCustomerId, setSelectedCustomerId] = useState(() => {
    return localStorage.getItem('wsp_draft_customer') || '';
  });
  const [deliveryFee, setDeliveryFee] = useState(() => {
    return localStorage.getItem('wsp_draft_delivery_fee') || '1.50';
  });

  // Receipt custom header states
  const [shopName, setShopName] = useState(() => localStorage.getItem('wsp_shop_name') || 'ស្រីពៅ លក់ចាប់ហួយ (Zeii Pov Shop)');
  const [shopAddress, setShopAddress] = useState(() => localStorage.getItem('wsp_shop_address') || 'ផ្សារអូរឫស្សី, ភ្នំពេញ');
  const [shopPhone, setShopPhone] = useState(() => localStorage.getItem('wsp_shop_phone') || '012 345 678');
  const [customFooter, setCustomFooter] = useState(() => localStorage.getItem('wsp_custom_footer') || 'សូមអរគុណ ចំពោះការគាំទ្រ! (Thank you for your support!)');

  useEffect(() => {
    localStorage.setItem('wsp_shop_name', shopName);
  }, [shopName]);
  useEffect(() => {
    localStorage.setItem('wsp_shop_address', shopAddress);
  }, [shopAddress]);
  useEffect(() => {
    localStorage.setItem('wsp_shop_phone', shopPhone);
  }, [shopPhone]);
  useEffect(() => {
    localStorage.setItem('wsp_custom_footer', customFooter);
  }, [customFooter]);

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
      { id: '1', product_id: '', supplier_id: '', supplier_price: 0, unit_price: 0, quantity: 1, subtotal: 0, maxStock: 0, stockUnit: 'pcs', searchQuery: '', isDropdownOpen: false, isCustom: false, custom_name: '' }
    ];
  });

  const [isSaving, setIsSaving] = useState(false);
  const [savedOrder, setSavedOrder] = useState(null); // Saved order details for print receipt preview modal
  const [previewOrder, setPreviewOrder] = useState(null); // Draft preview receipt details

  // Image Export State & Refs
  const printableCardRef = useRef(null);
  const [isExporting, setIsExporting] = useState(false);
  const [imageExportModal, setImageExportModal] = useState(null);

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
    return products.filter(p => {
      if (query) {
        const lower = query.toLowerCase();
        const matches = p.name_en.toLowerCase().includes(lower) || p.name_kh.includes(lower);
        if (!matches) return false;
      }
      if (selectedBrandFilter !== 'all') {
        if (selectedBrandFilter === 'none') {
          if (p.brand_id) return false;
        } else {
          if (p.brand_id !== selectedBrandFilter) return false;
        }
      }
      if (selectedCategoryFilter !== 'all') {
        if (selectedCategoryFilter === 'none') {
          if (p.category_id) return false;
        } else {
          if (p.category_id !== selectedCategoryFilter) return false;
        }
      }
      return true;
    });
  };

  // Calculate row details
  const updateLineItem = (index, field, value) => {
    const updated = [...lineItems];
    const item = updated[index];
    item[field] = value;

    if (field === 'product_id') {
      const prod = products.find(p => p.id === value);
      const sps = productSupplierPrices[value] || [];
      const customSellingPrice = prod && prod.selling_price && Number(prod.selling_price) > 0 ? Number(prod.selling_price) : null;

      if (sps.length > 0) {
        // Sort to find cheapest for inventory choice
        const sortedSpsCheapest = [...sps].sort((a, b) => a.price - b.price);
        const cheapest = sortedSpsCheapest[0];
        
        // Sort to find highest for selling price calculation
        const sortedSpsHighest = [...sps].sort((a, b) => b.price - a.price);
        const highest = sortedSpsHighest[0];
        
        item.supplier_id = cheapest.supplier_id;
        item.supplier_price = cheapest.price; // Set initial supplier price (cost price)
        item.unit_price = customSellingPrice !== null ? customSellingPrice : roundMoney(highest.price + 0.20);
        item.maxStock = cheapest.stock_qty;
        item.stockUnit = cheapest.stock_unit;
      } else {
        item.supplier_id = '';
        item.supplier_price = prod ? prod.base_price : 0;
        item.unit_price = prod ? (customSellingPrice !== null ? customSellingPrice : roundMoney(prod.base_price + 0.20)) : 0;
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
        
        // Update the selling price (unit_price) based on the new supplier cost
        const prod = products.find(p => p.id === item.product_id);
        const customSellingPrice = prod && prod.selling_price && Number(prod.selling_price) > 0 ? Number(prod.selling_price) : null;
        item.unit_price = customSellingPrice !== null ? customSellingPrice : roundMoney(match.price + 0.20);
      }
    }

    const qty = parseQuantity(item.quantity);
    item.subtotal = roundMoney(Number(item.unit_price || 0) * qty);
    setLineItems(updated);
  };

  const addLineItem = () => {
    setLineItems([...lineItems, { 
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5), 
      product_id: '', 
      supplier_id: '', 
      supplier_price: 0,
      unit_price: 0, 
      quantity: 1, 
      subtotal: 0, 
      maxStock: 0,
      stockUnit: 'pcs',
      searchQuery: '',
      isDropdownOpen: false,
      isCustom: false,
      custom_name: ''
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
      isDropdownOpen: false,
      isCustom: false,
      custom_name: ''
    }]);
  };

  const addProductToInvoice = (productId, qtyToAdd = 1) => {
    setLineItems(prevItems => {
      // Check if product is already in the invoice
      const existingIdx = prevItems.findIndex(item => item.product_id === productId && !item.isCustom);
      
      if (existingIdx > -1) {
        const updated = [...prevItems];
        const item = { ...updated[existingIdx] };
        const currentQty = parseQuantity(item.quantity);
        item.quantity = roundMoney(currentQty + parseQuantity(qtyToAdd));
        item.subtotal = roundMoney(Number(item.unit_price) * parseQuantity(item.quantity));
        updated[existingIdx] = item;
        return updated;
      } else {
        const sps = productSupplierPrices[productId] || [];
        const cheapest = sps.length > 0 ? [...sps].sort((a, b) => a.price - b.price)[0] : null;
        const highest = sps.length > 0 ? [...sps].sort((a, b) => b.price - a.price)[0] : null;
        const prod = products.find(p => p.id === productId);
        const customSellingPrice = prod && prod.selling_price && Number(prod.selling_price) > 0 ? Number(prod.selling_price) : null;

        const supplier_id = cheapest ? cheapest.supplier_id : '';
        const supplier_price = cheapest ? cheapest.price : (prod ? prod.base_price : 0);
        const unit_price = customSellingPrice !== null 
          ? customSellingPrice 
          : (cheapest && highest
            ? roundMoney(highest.price + 0.20)
            : (prod ? roundMoney(prod.base_price + 0.20) : 0));
        const maxStock = cheapest ? cheapest.stock_qty : 0;
        const stockUnit = cheapest ? cheapest.stock_unit : 'pcs';

        const newItem = {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          product_id: productId,
          supplier_id,
          supplier_price,
          unit_price,
          quantity: qtyToAdd,
          subtotal: roundMoney(Number(unit_price) * parseQuantity(qtyToAdd)),
          maxStock,
          stockUnit,
          searchQuery: prod ? `${prod.name_kh} (${prod.name_en})` : '',
          isDropdownOpen: false
        };
        
        if (prevItems.length === 1 && !prevItems[0].product_id && !prevItems[0].isCustom) {
          return [newItem];
        }
        
        return [...prevItems, newItem];
      }
    });
  };

  // Calculations with money precision rounding
  const subtotal = roundMoney(lineItems.reduce((sum, item) => {
    return sum + roundMoney(Number(item.unit_price || 0) * parseQuantity(item.quantity));
  }, 0));

  const totalAmount = roundMoney(subtotal + Number(deliveryFee || 0));

  const totalProfit = roundMoney(lineItems.reduce((sum, item) => {
    if (item.isCustom || !item.product_id) return sum;
    const qty = parseQuantity(item.quantity);
    const profit = (Number(item.unit_price || 0) - Number(item.supplier_price || 0)) * qty;
    return sum + profit;
  }, 0));

  const handleSaveInvoice = async (e) => {
    if (e) e.preventDefault();
    if (!selectedCustomerId) {
      showToast("Please select a customer first!", "warning");
      return;
    }

    const validItems = lineItems.filter(item => (item.product_id || (item.isCustom && item.custom_name)) && parseQuantity(item.quantity) > 0);
    if (validItems.length === 0) {
      showToast("Please add at least one valid product or custom line item with quantity > 0.", "warning");
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

      const sanitizedItems = validItems.map(item => ({
        ...item,
        quantity: parseQuantity(item.quantity),
        subtotal: roundMoney(Number(item.unit_price || 0) * parseQuantity(item.quantity))
      }));

      const result = await db.createOrder(orderObj, sanitizedItems);
      
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
        items: sanitizedItems,
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
        isDropdownOpen: false,
        isCustom: false,
        custom_name: ''
      }]);
      setDeliveryFee('1.50');
      showToast("Invoice saved successfully!", "success");
    } catch (err) {
      showToast("Error creating order: " + err.message, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handlePreviewReceipt = () => {
    const customer = customers.find(c => c.id === selectedCustomerId);
    const activeItems = lineItems.filter(item => (item.product_id || (item.isCustom && item.custom_name)) && parseQuantity(item.quantity) > 0);
    
    if (activeItems.length === 0) {
      showToast("Please add at least one item with valid quantity to preview.", "warning");
      return;
    }

    const calcSubtotal = activeItems.reduce((sum, item) => sum + roundMoney(Number(item.unit_price || 0) * parseQuantity(item.quantity)), 0);
    const calcTotalAmount = roundMoney(calcSubtotal + Number(deliveryFee || 0));

    const draftOrder = {
      order: {
        id: 'DRAFT_PREVIEW_' + Date.now().toString().slice(-4),
        delivery_fee: Number(deliveryFee || 0),
        total_amount: calcTotalAmount,
        ordered_at: new Date().toISOString()
      },
      customer: customer || { name: 'Walk-in Customer', location_note: 'General Delivery', phone: '' },
      items: activeItems.map(item => ({
        product_id: item.product_id || null,
        custom_name: item.custom_name || null,
        supplier_id: item.supplier_id || null,
        supplier_price: Number(item.supplier_price || 0),
        unit_price: Number(item.unit_price || 0),
        quantity: parseQuantity(item.quantity),
        subtotal: roundMoney(Number(item.unit_price || 0) * parseQuantity(item.quantity))
      }))
    };

    setPreviewOrder(draftOrder);
  };

  // Image Export Handler (PNG or JPEG) with Mobile Save to Photos & Native Share API
  const handleDownloadImage = async (format = 'png') => {
    if (isExporting) return;

    const activeItems = lineItems.filter(item => (item.product_id || (item.isCustom && item.custom_name)) && parseQuantity(item.quantity) > 0);
    
    if (activeItems.length === 0 && !savedOrder && !previewOrder) {
      showToast("Please add at least one valid product or item to export.", "warning");
      return;
    }

    // Ensure preview receipt data is ready
    if (!savedOrder && !previewOrder) {
      handlePreviewReceipt();
    }

    setIsExporting(true);

    // Allow state to settle and DOM element to render
    await new Promise(r => setTimeout(r, 120));

    try {
      const node = printableCardRef.current;
      if (!node) {
        throw new Error("Invoice template container element not found");
      }

      const options = {
        quality: 0.95,
        pixelRatio: 3, // Crisp 3x DPI high resolution suitable for Telegram / WhatsApp sharing
        backgroundColor: '#ffffff',
        cacheBust: true,
        style: {
          margin: '0',
          transform: 'none',
          boxShadow: 'none',
          maxWidth: 'none',
          width: '460px' // Optimal crisp standard receipt dimension
        }
      };

      const dataUrl = format === 'jpeg' ? await toJpeg(node, options) : await toPng(node, options);

      const customer = customers.find(c => c.id === selectedCustomerId);
      const safeName = customer ? customer.name.replace(/[^a-zA-Z0-9_\-\u0600-\u06FF\u1780-\u17FF]/g, '_') : 'Customer';
      const timestamp = new Date().toISOString().slice(0, 10);
      const filename = `Invoice_${safeName}_${timestamp}.${format}`;

      // Convert data URL to Blob and File for Mobile Native Share API & Blob Download
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
      const file = new File([blob], filename, { type: mimeType });

      // Display dedicated Mobile & Desktop Image Export Modal
      setImageExportModal({
        dataUrl,
        blobUrl,
        filename,
        file,
        format
      });

      // Try Native Web Share API if supported (iPhone Safari, Android Chrome)
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: filename,
            text: `Wholesale Invoice - ${safeName}`
          });
          showToast("Invoice image shared / saved to photos!", "success");
        } catch (shareErr) {
          if (shareErr.name !== 'AbortError') {
            console.warn("Native share failed, modal preview active", shareErr);
          }
        }
      } else {
        // Fallback link download for standard browsers
        const link = document.createElement('a');
        link.download = filename;
        link.href = blobUrl;
        link.click();
        showToast(`Invoice generated! Long-press image to Save to Photos.`, "success");
      }
    } catch (err) {
      console.error("Export Image error:", err);
      showToast("Failed to generate image: " + err.message, "error");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="no-print space-y-6">
        {/* Header Panel */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-dark-900/40 p-5 sm:p-6 rounded-2xl border border-dark-800/40 shadow-sm">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white tracking-wide flex items-center gap-2">
              Invoice Builder
            </h2>
            <p className="text-xs text-dark-400 mt-1">
              Build wholesale invoices, compare suppliers, check stock levels, and print or export invoices as crisp images.
            </p>
          </div>
          
          {/* Quick Action Badges for Mobile & Desktop */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => handleDownloadImage('png')}
              disabled={isExporting}
              className="flex-1 sm:flex-initial glass-button-secondary py-2 px-3 text-xs font-semibold flex items-center justify-center gap-1.5 min-h-[40px]"
              title="Download Invoice as high-resolution PNG image"
            >
              {isExporting ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-primary-400" />
              ) : (
                <Download className="w-3.5 h-3.5 text-primary-400" />
              )}
              <span>Export Image</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Side: Invoice Items Builder (2 cols) */}
          <form onSubmit={handleSaveInvoice} className="lg:col-span-2 space-y-6 min-w-0">
            <div className="glass-panel p-4 sm:p-6 rounded-2xl border border-dark-800 space-y-4">
              <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">Invoice Header</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-dark-300 uppercase tracking-wider mb-2">Customer *</label>
                  <select
                    required
                    value={selectedCustomerId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedCustomerId(val);
                      if (val) {
                        const customer = customers.find(c => c.id === val);
                        if (customer) {
                          setShopName(customer.name);
                          setShopAddress(customer.location_note || '');
                          setShopPhone(customer.phone || '');
                        }
                      }
                    }}
                    className="w-full glass-input min-h-[44px] text-xs sm:text-sm"
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
                      className="w-full pl-11 glass-input min-h-[44px] text-xs sm:text-sm"
                      placeholder="1.50"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Line Items Grid */}
            <div className="glass-panel p-4 sm:p-6 rounded-2xl border border-dark-800 space-y-4 min-w-0">
              <div className="flex justify-between items-center flex-wrap gap-2">
                <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">Line Items</h3>
                
                <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
                  <select
                    value={selectedBrandFilter}
                    onChange={(e) => setSelectedBrandFilter(e.target.value)}
                    className="bg-dark-900 border border-dark-800/50 hover:border-dark-700/60 rounded-xl px-2.5 py-1.5 text-xs text-dark-200 outline-none focus:border-primary-500 transition-all cursor-pointer flex-1 sm:flex-initial"
                  >
                    <option value="all">All Brands</option>
                    <option value="none">No Brand</option>
                    {brands.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
 
                  <select
                    value={selectedCategoryFilter}
                    onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                    className="bg-dark-900 border border-dark-800/50 hover:border-dark-700/60 rounded-xl px-2.5 py-1.5 text-xs text-dark-200 outline-none focus:border-primary-500 transition-all cursor-pointer flex-1 sm:flex-initial"
                  >
                    <option value="all">All Categories</option>
                    <option value="none">No Category</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => {
                      const currentQties = {};
                      lineItems.forEach(item => {
                        if (item.product_id) {
                          currentQties[item.product_id] = (currentQties[item.product_id] || 0) + parseQuantity(item.quantity);
                        }
                      });
                      setBatchQuantities(currentQties);
                      setBatchSearchQuery('');
                      setIsBatchModalOpen(true);
                    }}
                    className="glass-button-secondary py-1.5 px-3 flex items-center justify-center gap-1.5 text-xs border-primary-500/10 hover:border-primary-500/30 flex-1 sm:flex-initial"
                  >
                    <Grid className="w-3.5 h-3.5 text-primary-400" />
                    <span>Batch Add</span>
                  </button>

                  <button
                    type="button"
                    onClick={addLineItem}
                    className="glass-button-secondary py-1.5 px-3 flex items-center justify-center gap-1.5 text-xs flex-1 sm:flex-initial"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Item</span>
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
                    placeholder="⚡ POS Quick Search & Add Product..."
                    value={quickSearchQuery}
                    onChange={(e) => {
                      setQuickSearchQuery(e.target.value);
                      setIsQuickDropdownOpen(true);
                    }}
                    onFocus={() => setIsQuickDropdownOpen(true)}
                    onBlur={() => {
                      setTimeout(() => setIsQuickDropdownOpen(false), 200);
                    }}
                    className="w-full pl-11 pr-10 glass-input min-h-[44px] text-xs sm:text-sm font-medium border-primary-500/20 focus:border-primary-500/50 shadow-inner"
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
                        .reduce((sum, item) => sum + parseQuantity(item.quantity), 0);

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
                          className="p-3 hover:bg-primary-500/10 cursor-pointer text-left transition-colors flex justify-between items-center gap-4 min-h-[44px]"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 bg-dark-800 border border-dark-700">
                              {p.image_url ? (
                                <img src={p.image_url} alt={p.name_en} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-dark-600 text-xs">📦</div>
                              )}
                            </div>
                            <div>
                              <div className="font-semibold text-white text-xs sm:text-sm">{p.name_kh}</div>
                              <div className="text-[10px] text-dark-400 mt-0.5">{p.name_en}</div>
                            </div>
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

              {/* Line Items Cards List - Fully Responsive for Mobile, Tablet & Desktop */}
              <div className="space-y-4">
                {lineItems.map((item, idx) => {
                  const sps = productSupplierPrices[item.product_id] || [];
                  const cheapestSp = [...sps].sort((a, b) => a.price - b.price)[0];
                  const numericQty = parseQuantity(item.quantity);
                  const isStockWarning = item.product_id && item.supplier_id && (numericQty > item.maxStock);
                  const prod = products.find(p => p.id === item.product_id);

                  return (
                    <div 
                      key={item.id} 
                      className="p-3.5 sm:p-4 rounded-xl border border-dark-850 bg-dark-950/40 space-y-3 transition-colors hover:border-dark-800"
                    >
                      {/* Top Row: Thumbnail + Product Selector / Custom Name + Item Mode + Delete */}
                      <div className="flex items-center gap-3">
                        {/* Thumbnail */}
                        <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl border border-dark-800 flex items-center justify-center overflow-hidden bg-dark-900 flex-shrink-0 shadow-inner">
                          {item.isCustom ? (
                            <span className="text-[10px] text-violet-400 font-bold bg-violet-500/10 w-full h-full flex items-center justify-center">Custom</span>
                          ) : (
                            prod && prod.image_url ? (
                              <img src={prod.image_url} alt="Product" className="w-full h-full object-cover rounded-xl" />
                            ) : (
                              <ImageIcon className="w-5 h-5 text-dark-500" />
                            )
                          )}
                        </div>

                        {/* Search / Select Product Input */}
                        <div className="flex-1 relative min-w-0">
                          {item.isCustom ? (
                            <input
                              type="text"
                              required
                              placeholder="Custom item name..."
                              value={item.custom_name || ''}
                              onChange={(e) => updateLineItem(idx, 'custom_name', e.target.value)}
                              className="w-full glass-input border-violet-500/30 focus:border-violet-500/60 text-xs sm:text-sm font-medium min-h-[40px]"
                            />
                          ) : (
                            <>
                              <input
                                type="text"
                                required
                                placeholder="Search & select product..."
                                value={item.searchQuery !== undefined ? item.searchQuery : (prod ? `${prod.name_kh} (${prod.name_en})` : '')}
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
                                className="w-full glass-input text-xs sm:text-sm min-h-[40px]"
                              />
                              {item.isDropdownOpen && (
                                <div className="absolute left-0 right-0 mt-1 max-h-60 overflow-y-auto z-50 rounded-xl bg-dark-900 border border-dark-800 shadow-2xl divide-y divide-dark-850 scrollbar-thin">
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
                                      className="p-3 hover:bg-primary-500/10 cursor-pointer text-left transition-colors min-h-[44px]"
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
                            </>
                          )}
                        </div>

                        {/* Mode toggle button */}
                        <button
                          type="button"
                          onClick={() => updateLineItem(idx, 'isCustom', !item.isCustom)}
                          className={`px-2.5 py-2 rounded-xl text-[11px] font-bold border transition-all cursor-pointer shrink-0 min-h-[40px] ${
                            item.isCustom 
                              ? 'bg-violet-500/15 border-violet-500/30 text-violet-400 hover:bg-violet-500/20' 
                              : 'bg-dark-900/60 border-dark-800 text-dark-400 hover:text-white hover:bg-dark-800'
                          }`}
                          title={item.isCustom ? "Switch to Catalog item select" : "Switch to freeform manual input"}
                        >
                          {item.isCustom ? "Custom" : "Catalog"}
                        </button>

                        {/* Remove button */}
                        <button
                          type="button"
                          onClick={() => removeLineItem(idx)}
                          className="p-2.5 rounded-xl bg-dark-900 border border-dark-800 hover:bg-rose-500/10 hover:border-rose-500/30 text-dark-400 hover:text-rose-400 transition-colors cursor-pointer shrink-0 min-h-[40px] min-w-[40px] flex items-center justify-center"
                          title="Remove row"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Controls Grid: Supplier, Unit Price, Decimal Quantity & Subtotal */}
                      <div className="grid grid-cols-2 sm:grid-cols-12 gap-3 items-end pt-1">
                        {/* Supplier Selector (Mobile full width / Desktop 4 cols) */}
                        <div className="col-span-2 sm:col-span-4">
                          <label className="block text-[10px] font-bold text-dark-400 uppercase tracking-wider mb-1">
                            Supplier & Cost Price
                          </label>
                          {item.isCustom ? (
                            <div className="w-full glass-input bg-dark-900/40 text-dark-400 text-xs italic flex items-center justify-center border-dashed border-dark-800 h-[40px]">
                              No Supplier (Ad-hoc)
                            </div>
                          ) : (
                            <select
                              required
                              disabled={!item.product_id}
                              value={item.supplier_id}
                              onChange={(e) => updateLineItem(idx, 'supplier_id', e.target.value)}
                              className="w-full glass-input text-xs disabled:opacity-40 h-[40px]"
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
                          )}
                        </div>

                        {/* Unit Price field */}
                        <div className="col-span-1 sm:col-span-3">
                          <label className="block text-[10px] font-bold text-dark-400 uppercase tracking-wider mb-1">
                            Unit Price ($)
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400 text-xs font-semibold">$</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              required
                              value={item.unit_price}
                              onChange={(e) => updateLineItem(idx, 'unit_price', e.target.value)}
                              className="w-full pl-6 pr-2 h-[40px] glass-input text-left text-white text-xs font-semibold focus:border-primary-500/50"
                            />
                          </div>
                        </div>

                        {/* Quantity Field Supporting Integers and Floating Point Decimals (0.5, 1.5, 2.25) */}
                        <div className="col-span-1 sm:col-span-2">
                          <label className="block text-[10px] font-bold text-dark-400 uppercase tracking-wider mb-1">
                            Qty (Float)
                          </label>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            inputMode="decimal"
                            required
                            placeholder="1"
                            value={item.quantity}
                            onChange={(e) => updateLineItem(idx, 'quantity', e.target.value)}
                            className="w-full h-[40px] glass-input text-center text-xs font-semibold text-white focus:border-primary-500/50"
                          />
                        </div>

                        {/* Line Subtotal & Profit Badge */}
                        <div className="col-span-2 sm:col-span-3 text-right flex sm:flex-col justify-between sm:justify-end items-center sm:items-end pt-1 sm:pt-0">
                          <div>
                            <span className="block text-[10px] font-bold text-dark-400 uppercase tracking-wider sm:mb-1">Line Total</span>
                            <span className="font-bold text-white text-sm sm:text-base font-mono">
                              ${roundMoney(Number(item.unit_price || 0) * numericQty).toFixed(2)}
                            </span>
                          </div>

                          {item.product_id && !item.isCustom && (
                            <div className="text-[10px] text-emerald-400 font-medium truncate" title={`Cost: $${Number(item.supplier_price || 0).toFixed(2)} / unit`}>
                              Profit: +${roundMoney((Number(item.unit_price || 0) - Number(item.supplier_price || 0)) * numericQty).toFixed(2)}
                            </div>
                          )}
                          {item.isCustom && (
                            <div className="text-[10px] text-dark-500 font-medium">
                              Ad-hoc item
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Stock Warning alert */}
                      {!item.isCustom && isStockWarning && (
                        <div className="flex items-center gap-1.5 text-[11px] font-bold bg-amber-500/10 border border-amber-900/40 text-amber-400 px-3 py-1.5 rounded-lg mt-2">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span>Stock Warning: Available stock is only {item.maxStock} {item.stockUnit}</span>
                        </div>
                      )}
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
                  <span className="font-semibold text-dark-200 font-mono">${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-dark-400">
                  <span>Delivery Fee</span>
                  <span className="font-semibold text-dark-200 font-mono">${Number(deliveryFee || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-emerald-400 font-medium">
                  <span>Estimated Profit</span>
                  <span className="font-mono">${totalProfit.toFixed(2)}</span>
                </div>
              </div>

              <div className="flex justify-between items-end">
                <div>
                  <span className="text-xs text-dark-400 font-bold uppercase tracking-wider block">Grand Total</span>
                  <span className="text-2xl sm:text-3xl font-black text-white font-mono">${totalAmount.toFixed(2)}</span>
                </div>
                <span className="text-xs text-primary-400 font-semibold italic bg-primary-500/5 px-2.5 py-1 rounded border border-primary-500/15">
                  {lineItems.filter(item => item.product_id || (item.isCustom && item.custom_name)).length} Items
                </span>
              </div>

              {/* Action Buttons Bar */}
              <div className="flex flex-col gap-3">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handlePreviewReceipt}
                    className="flex-1 glass-button-secondary py-3 font-semibold text-xs sm:text-sm cursor-pointer min-h-[44px]"
                  >
                    <Eye className="w-4 h-4 text-dark-300" />
                    <span>Preview</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDownloadImage('png')}
                    disabled={isExporting}
                    className="flex-1 glass-button-secondary py-3 font-semibold text-xs sm:text-sm cursor-pointer border-primary-500/20 hover:border-primary-500/40 text-primary-300 min-h-[44px]"
                  >
                    {isExporting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Exporting...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4 text-primary-400" />
                        <span>Save Image</span>
                      </>
                    )}
                  </button>
                </div>

                <button
                  onClick={handleSaveInvoice}
                  disabled={isSaving}
                  className="w-full glass-button-primary py-3.5 font-bold text-sm cursor-pointer min-h-[44px]"
                >
                  {isSaving ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Saving Invoice...</span>
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="w-4 h-4" />
                      <span>Save & Print Invoice</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="p-4 bg-dark-900/30 rounded-2xl border border-dashed border-dark-800 flex gap-3">
              <AlertCircle className="w-5 h-5 text-primary-400 shrink-0" />
              <div className="text-xs text-dark-400">
                <span className="font-bold text-white block mb-0.5">Decimal Quantities Supported</span>
                Enter values like 0.5, 1.5, or 2.25. Use "Save Image" to export high-definition PNG invoice pictures ready for Telegram & WhatsApp sharing.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Invoice Print & Image Preview Modal Overlay */}
      {(() => {
        const receiptData = savedOrder || previewOrder;
        if (!receiptData) return null;
        const isDraft = receiptData.order.id.startsWith('DRAFT_PREVIEW');
        return (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-sm p-3 sm:p-6 flex items-center justify-center no-print">
            <div className="bg-dark-900 border border-dark-800 w-full max-w-4xl rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
              
              {/* Top Bar controls */}
              <div className="p-4 border-b border-dark-800 flex justify-between items-center bg-dark-950/40 flex-wrap gap-2">
                <h3 className="font-semibold text-white text-sm sm:text-base flex items-center gap-2">
                  <span>{isDraft ? 'Receipt Preview (Draft)' : 'Invoice Preview'}</span>
                </h3>

                <div className="flex items-center gap-2 flex-wrap">
                  <button 
                    type="button"
                    onClick={() => handleDownloadImage('png')} 
                    disabled={isExporting}
                    className="glass-button-secondary py-1.5 px-3 flex items-center gap-1.5 text-xs text-primary-300 border-primary-500/30 hover:border-primary-500/60"
                  >
                    {isExporting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5 text-primary-400" />}
                    <span>Save Image (PNG)</span>
                  </button>

                  <button 
                    type="button"
                    onClick={handlePrint} 
                    className="glass-button-primary py-1.5 px-3 flex items-center gap-1.5 text-xs"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>{isDraft ? 'Print Draft' : 'Print Invoice'}</span>
                  </button>

                  <button 
                    type="button"
                    onClick={() => { setSavedOrder(null); setPreviewOrder(null); }} 
                    className="glass-button-secondary py-1.5 px-3 text-xs"
                  >
                    Close
                  </button>
                </div>
              </div>

              {/* Modal Body container (two-column split on md sizes) */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 scrollbar-thin bg-dark-950/20">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                  
                  {/* Left Column: Receipt Customization & Profit Card (5 cols) */}
                  <div className="md:col-span-5 space-y-6 no-print order-2 md:order-1">
                    
                    {/* Header Customization Form */}
                    <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-dark-800 bg-dark-900/60 space-y-4 shadow-lg text-left">
                      <h4 className="text-xs font-bold text-primary-400 uppercase tracking-widest border-b border-dark-800 pb-2">
                        Edit Receipt Header
                      </h4>
                      <div className="space-y-3 text-xs">
                        <div>
                          <label className="block font-semibold text-dark-300 uppercase mb-1">Shop/Vendor Name</label>
                          <input 
                            type="text" 
                            value={shopName} 
                            onChange={(e) => setShopName(e.target.value)} 
                            className="w-full glass-input py-1.5 px-3 text-xs" 
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-dark-300 uppercase mb-1">Shop Address / Landmark</label>
                          <input 
                            type="text" 
                            value={shopAddress} 
                            onChange={(e) => setShopAddress(e.target.value)} 
                            className="w-full glass-input py-1.5 px-3 text-xs" 
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-dark-300 uppercase mb-1">Phone Number</label>
                          <input 
                            type="text" 
                            value={shopPhone} 
                            onChange={(e) => setShopPhone(e.target.value)} 
                            className="w-full glass-input py-1.5 px-3 text-xs" 
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-dark-300 uppercase mb-1">Footer Message</label>
                          <textarea 
                            value={customFooter} 
                            onChange={(e) => setCustomFooter(e.target.value)} 
                            rows="2"
                            className="w-full glass-input py-1.5 px-3 text-xs resize-none" 
                          />
                        </div>
                      </div>
                    </div>

                    {/* Internal Profit Analysis Card (Owner Only) */}
                    <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-dark-850 bg-dark-900/60 space-y-4 shadow-lg text-left">
                      <div className="flex justify-between items-center border-b border-dark-800 pb-3">
                        <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                          Internal Profit Analysis
                        </h4>
                        <span className="text-xs text-dark-400 font-mono">
                          {isDraft ? 'DRAFT' : `#${receiptData.order.id.slice(-6).toUpperCase()}`}
                        </span>
                      </div>
                      
                      <div className="divide-y divide-dark-850 max-h-48 overflow-y-auto scrollbar-thin">
                        {receiptData.items.map((item, idx) => {
                          const prod = products.find(p => p.id === item.product_id);
                          const isCustom = !item.product_id;
                          const cost = Number(item.supplier_price || 0);
                          const selling = Number(item.unit_price);
                          const qty = parseQuantity(item.quantity);
                          const profitPerUnit = selling - cost;
                          const itemProfit = roundMoney(profitPerUnit * qty);
                          
                          return (
                            <div key={idx} className="py-2.5 flex justify-between items-start gap-4 text-xs">
                              <div className="space-y-1">
                                <div className="font-semibold text-white">
                                  {prod ? `${prod.name_kh} (${prod.name_en})` : (item.custom_name || 'Custom Item')}
                                </div>
                                <div className="text-[10px] text-dark-400 flex items-center gap-1.5">
                                  {!isCustom && <span>Cost: ${cost.toFixed(2)}</span>}
                                  {!isCustom && <span>•</span>}
                                  <span>Sell: ${selling.toFixed(2)}</span>
                                  <span>•</span>
                                  <span>Qty: {qty}</span>
                                </div>
                              </div>
                              <div className="text-right font-mono">
                                {isCustom ? (
                                  <span className="font-semibold text-dark-400 block">$0.00</span>
                                ) : (
                                  <>
                                    <span className="font-bold text-emerald-400 block">+${itemProfit.toFixed(2)}</span>
                                    <span className="text-[9px] text-dark-500">(${profitPerUnit.toFixed(2)}/unit)</span>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      
                      <div className="border-t border-dark-800 pt-3 flex justify-between items-center text-sm font-bold">
                        <span className="text-dark-300">Total Order Profit:</span>
                        <span className="text-lg text-emerald-400 font-mono">
                          ${roundMoney(receiptData.items.reduce((sum, item) => {
                            if (!item.product_id) return sum;
                            return sum + (Number(item.unit_price) - Number(item.supplier_price || 0)) * parseQuantity(item.quantity);
                          }, 0)).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Printable Receipt Preview (7 cols) */}
                  <div className="md:col-span-7 flex flex-col justify-center items-center overflow-x-auto w-full order-1 md:order-2">
                    {/* Visual Container Card for Modal Display */}
                    <div className="w-full max-w-md bg-white border border-gray-300 p-6 shadow-xl rounded-xl text-black font-sans text-left my-1">
                      
                      {/* Ref node targeted for html-to-image export */}
                      <div ref={printableCardRef} className="bg-white p-2 text-black font-sans">
                        {isDraft && (
                          <div className="no-print text-center text-amber-700 bg-amber-500/10 border border-amber-500/30 rounded-lg p-2 mb-4 text-xs font-bold">
                            ⚠️ DRAFT INVOICE PREVIEW
                          </div>
                        )}
                        
                        {/* Receipt Header */}
                        <div className="text-center space-y-1.5 border-b pb-4 border-dashed border-gray-300">
                          <h1 className="text-xl font-bold uppercase tracking-wider text-black">វិក្កយបត្រ / INVOICE</h1>
                          <h2 className="text-base font-bold text-black font-mono leading-tight">
                            {shopName}
                          </h2>
                          <p className="text-[10px] text-gray-600">
                            {shopAddress}
                            {shopPhone ? ` • Tel: ${shopPhone}` : ''}
                          </p>
                          
                          <div className="text-left text-xs grid grid-cols-2 gap-y-1 pt-3 font-mono text-gray-800">
                            <div><strong>Invoice No:</strong> #{isDraft ? 'DRAFT_PREVIEW' : receiptData.order.id.slice(-6).toUpperCase()}</div>
                            <div><strong>Date:</strong> {new Date(receiptData.order.ordered_at).toLocaleDateString()}</div>
                            <div className="col-span-2"><strong>Customer:</strong> {receiptData.customer?.name}</div>
                            {receiptData.customer?.phone && <div className="col-span-2"><strong>Phone:</strong> {receiptData.customer.phone}</div>}
                            {receiptData.customer?.location_note && <div className="col-span-2"><strong>Address:</strong> {receiptData.customer.location_note}</div>}
                          </div>
                        </div>

                        {/* Table items */}
                        <table className="w-full text-xs text-left mt-4 border-b border-dashed border-gray-300 pb-4">
                          <thead>
                            <tr className="border-b border-gray-300 font-bold text-gray-900">
                              <th className="py-2">Description / ទំនិញ</th>
                              <th className="py-2 text-center">Qty</th>
                              <th className="py-2 text-right">Price</th>
                              <th className="py-2 text-right">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {receiptData.items.map((item, index) => {
                              const prod = products.find(p => p.id === item.product_id);
                              const qty = parseQuantity(item.quantity);
                              const sub = roundMoney(Number(item.unit_price) * qty);
                              return (
                                <tr key={index} className="text-gray-900">
                                  <td className="py-2">
                                    <div className="font-bold">{prod ? prod.name_kh : (item.custom_name || 'Custom Item')}</div>
                                    <div className="text-[10px] text-gray-500">{prod ? prod.name_en : 'Custom Item'}</div>
                                  </td>
                                  <td className="py-2 text-center font-mono font-medium">{qty}</td>
                                  <td className="py-2 text-right font-mono">${Number(item.unit_price).toFixed(2)}</td>
                                  <td className="py-2 text-right font-mono font-bold">${sub.toFixed(2)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>

                        {/* Totals block */}
                        <div className="mt-4 space-y-1.5 text-xs text-right font-mono">
                          <div className="flex justify-between text-gray-700">
                            <span>Subtotal / សរុបបណ្តោះអាសន្ន:</span>
                            <span>${(receiptData.order.total_amount - receiptData.order.delivery_fee).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-gray-700">
                            <span>Delivery / ថ្លៃដឹកជញ្ជូន:</span>
                            <span>${Number(receiptData.order.delivery_fee).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between border-t border-double pt-2 text-sm font-bold text-black">
                            <span>Grand Total / សរុបរួម:</span>
                            <span>${Number(receiptData.order.total_amount).toFixed(2)}</span>
                          </div>
                        </div>

                        {/* Footer terms */}
                        <div className="mt-6 text-center space-y-1 border-t border-dashed border-gray-300 pt-4 text-[10px] text-gray-500">
                          <p className="font-medium text-gray-700">{customFooter}</p>
                          <p className="font-mono text-[9px] text-gray-400">Wholesale Portal Invoice System</p>
                        </div>
                      </div>

                    </div>
                  </div>

                </div>
              </div>
              
            </div>
          </div>
        );
      })()}

      {/* Hidden print layout for standard window.print() */}
      {(() => {
        const receiptData = savedOrder || previewOrder;
        if (!receiptData) return null;
        const isDraft = receiptData.order.id.startsWith('DRAFT_PREVIEW');
        return (
          <div className="hidden print-only bg-white text-black p-4 font-sans leading-normal">
            <div className="max-w-md mx-auto border-0 p-2">
              
              {/* Header */}
              <div className="text-center space-y-1 pb-2 border-b border-dashed border-gray-400">
                <h1 className="text-lg font-bold tracking-wider">
                  {shopName}
                </h1>
                <p className="text-[10px]">
                  វិក្កយបត្រ / INVOICE {isDraft && '(DRAFT PREVIEW)'}
                  {receiptData.customer?.location_note ? ` • ${receiptData.customer.location_note}` : ''}
                  {receiptData.customer?.phone ? ` • Tel: ${receiptData.customer.phone}` : ''}
                </p>
                {shopPhone && <p className="text-[9px] text-gray-600">Tel: {shopPhone} | {shopAddress}</p>}
                
                <div className="text-left text-[10px] grid grid-cols-2 gap-y-0.5 pt-2 font-mono">
                  <div>No: #{isDraft ? 'DRAFT_PREVIEW' : receiptData.order.id.slice(-6).toUpperCase()}</div>
                  <div>Date: {new Date(receiptData.order.ordered_at).toLocaleDateString()}</div>
                  <div className="col-span-2">Customer: {receiptData.customer?.name}</div>
                  {receiptData.customer?.phone && <div className="col-span-2">Phone: {receiptData.customer.phone}</div>}
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
                  {receiptData.items.map((item, index) => {
                    const prod = products.find(p => p.id === item.product_id);
                    const qty = parseQuantity(item.quantity);
                    const sub = roundMoney(Number(item.unit_price) * qty);
                    return (
                      <tr key={index}>
                        <td className="py-1">
                          <div className="font-bold">{prod ? prod.name_kh : (item.custom_name || 'Custom Item')}</div>
                          <div className="text-[9px] text-gray-500">{prod ? prod.name_en : 'Custom Freeform Item'}</div>
                        </td>
                        <td className="py-1 text-center font-mono">{qty}</td>
                        <td className="py-1 text-right font-mono">${Number(item.unit_price).toFixed(2)}</td>
                        <td className="py-1 text-right font-mono">${sub.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Totals */}
              <div className="mt-2 space-y-1 text-[10px] text-right font-mono">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>${(receiptData.order.total_amount - receiptData.order.delivery_fee).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Delivery:</span>
                  <span>${Number(receiptData.order.delivery_fee).toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t border-double pt-1 font-bold">
                  <span>Grand Total:</span>
                  <span>${Number(receiptData.order.total_amount).toFixed(2)}</span>
                </div>
              </div>

              {/* Terms */}
              <div className="mt-4 text-center text-[9px] text-gray-500">
                <p>{customFooter}</p>
              </div>

            </div>
          </div>
        );
      })()}

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
                  Adjust quantities for multiple products (including decimals like 0.5 or 1.5) and apply them in one batch.
                </p>
              </div>
              <button 
                type="button"
                onClick={() => setIsBatchModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-dark-800 text-dark-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Search Bar */}
            <div className="p-4 border-b border-dark-850 bg-dark-900/40 flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-dark-500" />
                <input
                  type="text"
                  placeholder="Search catalog by product name (English or Khmer)..."
                  value={batchSearchQuery}
                  onChange={(e) => setBatchSearchQuery(e.target.value)}
                  className="w-full pl-11 pr-4 glass-input text-sm"
                />
              </div>
              <select
                value={selectedBrandFilter}
                onChange={(e) => setSelectedBrandFilter(e.target.value)}
                className="glass-input text-sm min-w-[160px]"
              >
                <option value="all">All Brands</option>
                <option value="none">No Brand</option>
                {brands.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
 
              <select
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                className="glass-input text-sm min-w-[160px]"
              >
                <option value="all">All Categories</option>
                <option value="none">No Category</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Modal Product Grid */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 scrollbar-thin bg-dark-950/10">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {getFilteredProducts(batchSearchQuery).map(p => {
                  const sps = productSupplierPrices[p.id] || [];
                  const cheapestPrice = sps.length > 0 
                    ? Math.min(...sps.map(sp => sp.price)) 
                    : p.base_price;
                  const totalStock = sps.reduce((sum, sp) => sum + sp.stock_qty, 0);
                  const qtyRaw = batchQuantities[p.id];
                  const qtyVal = parseQuantity(qtyRaw);

                  const handleQtyChange = (val) => {
                    if (val === '' || val === null) {
                      setBatchQuantities(prev => ({ ...prev, [p.id]: '' }));
                      return;
                    }
                    const parsed = parseFloat(val);
                    const newQty = isNaN(parsed) || parsed < 0 ? 0 : parsed;
                    setBatchQuantities(prev => ({
                      ...prev,
                      [p.id]: val
                    }));
                  };

                  const increment = () => {
                    setBatchQuantities(prev => {
                      const curr = parseQuantity(prev[p.id]);
                      return {
                        ...prev,
                        [p.id]: roundMoney(curr + 1)
                      };
                    });
                  };

                  const decrement = () => {
                    setBatchQuantities(prev => {
                      const curr = parseQuantity(prev[p.id]);
                      if (curr <= 0) return prev;
                      return {
                        ...prev,
                        [p.id]: roundMoney(Math.max(0, curr - 1))
                      };
                    });
                  };

                  return (
                    <div 
                      key={p.id} 
                      className={`p-4 rounded-xl border transition-all ${
                        qtyVal > 0 
                          ? 'border-primary-500/40 bg-primary-500/5 shadow-md shadow-primary-500/5' 
                          : 'border-dark-850 bg-dark-900/20 hover:border-dark-800'
                      }`}
                    >
                      <div className="flex items-start gap-3.5 min-h-[5rem]">
                        {/* Interactive Image */}
                        <div 
                          onClick={increment}
                          className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden flex-shrink-0 bg-dark-800 border border-dark-700 cursor-pointer hover:border-primary-500/50 hover:scale-105 active:scale-95 transition-all select-none"
                          title="Click to increase quantity"
                        >
                          {p.image_url ? (
                            <img src={p.image_url} alt={p.name_en} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-dark-600 text-lg">📦</div>
                          )}
                        </div>

                        {/* Product Info */}
                        <div className="flex-1 min-w-0 text-left space-y-1">
                          <div className="flex justify-between items-start gap-1.5">
                            <h4 className="font-semibold text-white text-xs sm:text-sm line-clamp-2">{p.name_kh}</h4>
                            <span className="text-xs font-bold text-primary-400 shrink-0 font-mono">
                              ${cheapestPrice.toFixed(2)}
                            </span>
                          </div>
                          <div className="text-[10px] text-dark-400 flex flex-wrap items-center gap-1.5">
                            <span className="line-clamp-1 block w-full">{p.name_en}</span>
                            {p.brand_id && brands.find(b => b.id === p.brand_id) && (
                              <span className="px-1.5 py-0.5 rounded bg-primary-500/10 text-primary-400 border border-primary-500/20 text-[8px] font-bold">
                                {brands.find(b => b.id === p.brand_id).name}
                              </span>
                            )}
                            {p.category_id && categories.find(c => c.id === p.category_id) && (
                              <span className="px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-400 border border-violet-500/20 text-[8px] font-bold">
                                {categories.find(c => c.id === p.category_id).name}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-between items-center mt-3 pt-3 border-t border-dark-850/60">
                        <div className="text-[10px] text-dark-500 text-left">
                          <span className="block font-mono">Cost: ${cheapestPrice.toFixed(2)}</span>
                          <span className={`${totalStock <= 2 ? 'text-rose-400 font-semibold' : 'text-dark-400'}`}>
                            Stock: {totalStock}
                          </span>
                        </div>

                        {/* Qty Input Supporting Decimals */}
                        <div className="flex items-center gap-1 bg-dark-950/80 rounded-lg p-0.5 border border-dark-800">
                          <button
                            type="button"
                            onClick={decrement}
                            className="p-1.5 rounded text-dark-400 hover:text-white hover:bg-dark-800 active:scale-90 transition-all cursor-pointer"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            inputMode="decimal"
                            value={qtyRaw !== undefined ? qtyRaw : ''}
                            placeholder="0"
                            onChange={(e) => handleQtyChange(e.target.value)}
                            className="w-12 text-center bg-transparent border-0 outline-none text-xs font-bold text-white p-0 font-mono"
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
                Selected: <strong className="text-white">{Object.values(batchQuantities).filter(q => parseQuantity(q) > 0).length}</strong> products
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
                      .map(([id, q]) => ({ productId: id, qty: parseQuantity(q) }))
                      .filter(item => item.qty > 0);

                    setLineItems(prevItems => {
                      let updated = [];
                      
                      itemsToApply.forEach(({ productId, qty }) => {
                        const existingItem = prevItems.find(item => item.product_id === productId && !item.isCustom);
                        if (existingItem) {
                          updated.push({
                            ...existingItem,
                            quantity: qty,
                            subtotal: roundMoney(Number(existingItem.unit_price) * qty)
                          });
                        } else {
                          const sps = productSupplierPrices[productId] || [];
                          const cheapest = sps.length > 0 ? [...sps].sort((a, b) => a.price - b.price)[0] : null;
                          const highest = sps.length > 0 ? [...sps].sort((a, b) => b.price - a.price)[0] : null;
                          const prod = products.find(p => p.id === productId);
                          const customSellingPrice = prod && prod.selling_price && Number(prod.selling_price) > 0 ? Number(prod.selling_price) : null;

                          const supplier_id = cheapest ? cheapest.supplier_id : '';
                          const supplier_price = cheapest ? cheapest.price : (prod ? prod.base_price : 0);
                          const unit_price = customSellingPrice !== null 
                            ? customSellingPrice 
                            : (cheapest && highest
                              ? roundMoney(highest.price + 0.20)
                              : (prod ? roundMoney(prod.base_price + 0.20) : 0));
                          const maxStock = cheapest ? cheapest.stock_qty : 0;
                          const stockUnit = cheapest ? cheapest.stock_unit : 'pcs';

                          updated.push({
                            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                            product_id: productId,
                            supplier_id,
                            supplier_price,
                            unit_price,
                            quantity: qty,
                            subtotal: roundMoney(Number(unit_price) * qty),
                            maxStock,
                            stockUnit,
                            searchQuery: prod ? `${prod.name_kh} (${prod.name_en})` : '',
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

      {/* Mobile-Optimized Save to Photos / Share Image Modal */}
      {imageExportModal && (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/85 backdrop-blur-md p-3 sm:p-6 flex items-center justify-center no-print animate-in fade-in duration-200">
          <div className="bg-dark-900 border border-dark-800 w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
            
            {/* Modal Top Bar */}
            <div className="p-4 border-b border-dark-800 flex justify-between items-center bg-dark-950/60">
              <h3 className="font-bold text-white text-sm sm:text-base flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-primary-400" />
                <span>Save Invoice to Photos</span>
              </h3>
              <button 
                type="button"
                onClick={() => {
                  if (imageExportModal.blobUrl) URL.revokeObjectURL(imageExportModal.blobUrl);
                  setImageExportModal(null);
                }}
                className="p-1.5 rounded-lg hover:bg-dark-800 text-dark-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Helper Banner for Mobile Users */}
            <div className="bg-primary-500/10 border-b border-primary-500/20 p-3 px-4 text-xs text-primary-300 flex items-start gap-2.5">
              <Share2 className="w-4 h-4 text-primary-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block text-white">Save to Mobile Photos / Gallery:</span>
                <span>Tap <strong>Share / Save</strong> below, or <strong>long-press (touch & hold)</strong> the image to save directly into your Photos app.</span>
              </div>
            </div>

            {/* Rendered Invoice Image Preview Node */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center justify-center bg-dark-950/40 min-h-[260px]">
              <img 
                src={imageExportModal.dataUrl} 
                alt="Generated Invoice" 
                className="w-full h-auto max-w-sm rounded-xl shadow-2xl border border-dark-700 select-all"
              />
            </div>

            {/* Modal Bottom Actions */}
            <div className="p-4 border-t border-dark-800 bg-dark-950/60 flex flex-col sm:flex-row gap-2">
              {navigator.canShare && imageExportModal.file && (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.share({
                        files: [imageExportModal.file],
                        title: imageExportModal.filename,
                        text: 'Wholesale Invoice'
                      });
                    } catch (err) {
                      if (err.name !== 'AbortError') {
                        console.warn("Share failed", err);
                      }
                    }
                  }}
                  className="flex-1 glass-button-primary py-2.5 text-xs font-bold min-h-[44px]"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Share / Save to Photos</span>
                </button>
              )}

              <a
                href={imageExportModal.blobUrl || imageExportModal.dataUrl}
                download={imageExportModal.filename}
                className="flex-1 glass-button-secondary py-2.5 text-xs font-semibold min-h-[44px] text-center flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4 text-primary-400" />
                <span>Download File</span>
              </a>

              <button
                type="button"
                onClick={() => {
                  if (imageExportModal.blobUrl) URL.revokeObjectURL(imageExportModal.blobUrl);
                  setImageExportModal(null);
                }}
                className="glass-button-secondary py-2.5 px-4 text-xs font-medium min-h-[44px]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
