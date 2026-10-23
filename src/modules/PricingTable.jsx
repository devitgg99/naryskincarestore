import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { Search, SlidersHorizontal, Edit2, Info, Plus, Trash2, Camera, ImageIcon, X, LayoutGrid, List, Printer, Sparkles } from 'lucide-react';
import { db } from '../services/db';
import { uploadProductImage, deleteProductImage } from '../services/imageStorage';
import { generateUniqueBarcode } from '../services/barcodeGenerator';
import BarcodePrintModal from '../components/BarcodePrintModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';



// ─── Image Upload Widget (no crop) ───────────────────────────────────────────
function ImageUploadWidget({ existingImageUrl, onStateChange }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [removed, setRemoved] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const handleFileSelect = useCallback((selected) => {
    if (!selected) return;
    setPreview((prev) => { if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev); return URL.createObjectURL(selected); });
    setFile(selected);
    setRemoved(false);
    onStateChange({ file: selected, removed: false });
  }, [onStateChange]);

  // Paste support
  useEffect(() => {
    const handlePaste = (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const pasted = items[i].getAsFile();
          if (pasted) { handleFileSelect(pasted); break; }
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handleFileSelect]);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(e.type === 'dragenter' || e.type === 'dragover');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (e.dataTransfer.files?.[0]) handleFileSelect(e.dataTransfer.files[0]);
  };

  const handleRemove = () => {
    if (preview && preview.startsWith('blob:')) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
    setRemoved(true);
    onStateChange({ file: null, removed: true });
  };

  const displayUrl = preview || (!removed && existingImageUrl) || null;
  const hasImage = file || (existingImageUrl && !removed);

  return (
    <div
      onDragEnter={handleDrag}
      onDragOver={handleDrag}
      onDragLeave={handleDrag}
      onDrop={handleDrop}
      className={`rounded-2xl border-2 border-dashed transition-all duration-200 ${
        isDragActive
          ? 'border-primary bg-primary/10 shadow-lg shadow-primary/5'
          : 'border-border bg-card/40 hover:border-primary/50'
      }`}
    >
      <div className="flex items-center gap-3 p-3">
        {/* Thumbnail */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-[80px] h-[80px] rounded-xl border-2 border-border flex items-center justify-center overflow-hidden bg-muted/60 flex-shrink-0 shadow-inner hover:border-primary/60 transition-colors group relative"
          title="Click to upload image"
        >
          {displayUrl ? (
            <>
              <img src={displayUrl} alt="Product" className="w-full h-full object-cover rounded-xl" />
              <div className="absolute inset-0 rounded-xl bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <ImageIcon className="w-5 h-5 text-white" />
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-1 text-muted-foreground group-hover:text-primary transition-colors">
              <ImageIcon className="w-6 h-6" />
              <span className="text-[9px] font-semibold uppercase">Add Photo</span>
            </div>
          )}
        </button>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2 flex-1 min-w-0">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-1.5 h-10 rounded-xl border border-border bg-background/60 hover:bg-muted/60 hover:border-primary/50 text-xs font-semibold text-foreground transition-all active:scale-[0.97]"
            >
              <Camera className="w-4 h-4 text-primary" /> Camera
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-1.5 h-10 rounded-xl border border-border bg-background/60 hover:bg-muted/60 hover:border-violet-500/50 text-xs font-semibold text-foreground transition-all active:scale-[0.97]"
            >
              <ImageIcon className="w-4 h-4 text-violet-500" /> Gallery
            </button>
          </div>
          {hasImage ? (
            <button
              type="button"
              onClick={handleRemove}
              className="flex items-center justify-center gap-1.5 h-9 rounded-xl border border-destructive/30 bg-destructive/5 hover:bg-destructive/10 hover:border-destructive/60 text-xs font-semibold text-destructive transition-all active:scale-[0.97]"
            >
              <X className="w-3.5 h-3.5" /> Remove Photo
            </button>
          ) : (
            <p className="text-[10px] text-muted-foreground text-center px-1 leading-relaxed">
              Drag &amp; drop or paste an image here
            </p>
          )}
        </div>
      </div>

      {/* Hidden file inputs */}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { handleFileSelect(e.target.files[0]); e.target.value = ''; }} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={(e) => { handleFileSelect(e.target.files[0]); e.target.value = ''; }} />
    </div>
  );
}



export default function PricingTable({ products, suppliers, prices, brands = [], categories = [], onRefresh, showToast }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSupplierFilter, setSelectedSupplierFilter] = useState('all');
  const [selectedBrandFilter, setSelectedBrandFilter] = useState('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
  const [viewLayoutMode, setViewLayoutMode] = useState('matrix'); // 'matrix' or 'cards'
  const [editingCell, setEditingCell] = useState(null); // { product, supplier, priceObj }
  const [editPrice, setEditPrice] = useState('');
  const [editStock, setEditStock] = useState('');
  const [editUnit, setEditUnit] = useState('pcs');
  const [isSaving, setIsSaving] = useState(false);

  // States for adding a new product
  const [isAddProductOpen, setIsAddProductOpen] = useState(() => {
    const autoOpen = localStorage.getItem('wsp_auto_open_add_product');
    if (autoOpen === 'true') {
      localStorage.removeItem('wsp_auto_open_add_product');
      return true;
    }
    return false;
  });
  const [newProductNameKh, setNewProductNameKh] = useState('');
  const [newProductNameEn, setNewProductNameEn] = useState('');
  const [newProductBarcode, setNewProductBarcode] = useState('');
  const [newProductBasePrice, setNewProductBasePrice] = useState('');
  const [newProductBrandId, setNewProductBrandId] = useState('');
  const [newProductCategoryId, setNewProductCategoryId] = useState('');
  const [newProductSellingPrice, setNewProductSellingPrice] = useState('');
  const [newProductImageState, setNewProductImageState] = useState({ file: null, removed: false });

  const [printProductBarcodeModal, setPrintProductBarcodeModal] = useState(null);

  const handleAutoGenerateBarcodeForAdd = () => {
    const code = generateUniqueBarcode(products);
    setNewProductBarcode(code);
    showToast(`Auto-generated barcode: ${code}`, 'success');
  };

  const handleAutoGenerateBarcodeForEdit = () => {
    const code = generateUniqueBarcode(products);
    setEditProductBarcode(code);
    showToast(`Auto-generated barcode: ${code}`, 'success');
  };

  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [isBarcodeCameraOpen, setIsBarcodeCameraOpen] = useState(false);
  const [barcodeCameraError, setBarcodeCameraError] = useState('');
  const barcodeCameraVideoRef = useRef(null);
  const barcodeReaderRef = useRef(null);
  const barcodeControlsRef = useRef(null);
  const barcodeScanLockRef = useRef(false);
  const lastScannedCodeRef = useRef('');
  const barcodeSessionIdRef = useRef(0);
  const barcodeSetterRef = useRef(null);

  const stopBarcodeCamera = () => {
    barcodeSessionIdRef.current += 1;

    try {
      barcodeControlsRef.current?.stop();
    } catch (err) {
      console.warn('Barcode camera controls stop failed:', err);
    }
    barcodeControlsRef.current = null;
    barcodeReaderRef.current = null;

    try {
      const tracks = barcodeCameraVideoRef.current?.srcObject instanceof MediaStream
        ? barcodeCameraVideoRef.current.srcObject.getTracks()
        : [];
      tracks.forEach((track) => track.stop());
      if (barcodeCameraVideoRef.current) {
        barcodeCameraVideoRef.current.srcObject = null;
      }
    } catch (err) {
      console.warn('Tracks stop failed:', err);
    }
  };

  const openBarcodeCameraFor = (setter) => {
    barcodeSetterRef.current = setter;
    setBarcodeCameraError('');
    setIsBarcodeCameraOpen(true);
  };

  useEffect(() => {
    if (!isBarcodeCameraOpen) {
      stopBarcodeCamera();
      return;
    }

    let active = true;
    barcodeSessionIdRef.current += 1;
    const sessionId = barcodeSessionIdRef.current;
    barcodeScanLockRef.current = false;
    lastScannedCodeRef.current = '';

    const startScanning = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Camera access is not supported by your browser. Please open in Safari or Chrome directly.');
        }

        const videoEl = barcodeCameraVideoRef.current;
        if (!videoEl) {
          console.warn('Barcode camera video element not available');
          return;
        }

        const reader = new BrowserMultiFormatReader();
        barcodeReaderRef.current = reader;

        // Passing undefined as deviceId tells @zxing/browser to automatically request
        // the rear camera ({ facingMode: 'environment' }) and naturally triggers
        // the browser permission prompt without failing prematurely.
        const controls = await reader.decodeFromVideoDevice(
          undefined,
          videoEl,
          (result, error) => {
            if (!active || sessionId !== barcodeSessionIdRef.current) {
              return;
            }

            if (result) {
              const scanned = result.getText()?.trim();
              if (!scanned) return;

              if (barcodeScanLockRef.current) {
                return;
              }

              barcodeScanLockRef.current = true;
              lastScannedCodeRef.current = scanned;

              // Immediately close and stop camera
              setIsBarcodeCameraOpen(false);
              stopBarcodeCamera();

              barcodeSetterRef.current?.(scanned);

              setTimeout(() => {
                barcodeScanLockRef.current = false;
                lastScannedCodeRef.current = '';
              }, 800);
            }

            if (error && error.name !== 'NotFoundException') {
              console.warn('Barcode decode warning:', error);
            }
          }
        );

        if (!active || sessionId !== barcodeSessionIdRef.current) {
          controls.stop();
          return;
        }

        barcodeControlsRef.current = controls;
      } catch (err) {
        if (!active) return;
        console.error('Product barcode camera failed:', err);
        let userMsg = err?.message || 'Unable to open camera.';
        if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
          userMsg = 'Camera permission was denied. Please allow camera access in your browser site settings.';
        } else if (err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError') {
          userMsg = 'No camera found on this device.';
        } else if (err?.name === 'NotReadableError' || err?.name === 'TrackStartError') {
          userMsg = 'Camera is already in use by another app or browser tab.';
        }
        setBarcodeCameraError(userMsg);
        showToast(userMsg, 'error');
      }
    };

    const timer = setTimeout(() => {
      startScanning();
    }, 100);

    return () => {
      active = false;
      clearTimeout(timer);
      stopBarcodeCamera();
    };
  }, [isBarcodeCameraOpen]);

  // States for adding a new supplier
  const [isAddSupplierOpen, setIsAddSupplierOpen] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierPhone, setNewSupplierPhone] = useState('');
  const [isSavingSupplier, setIsSavingSupplier] = useState(false);

  // States for editing an existing product
  const [editingProduct, setEditingProduct] = useState(null);
  const [editProductNameKh, setEditProductNameKh] = useState('');
  const [editProductNameEn, setEditProductNameEn] = useState('');
  const [editProductBarcode, setEditProductBarcode] = useState('');
  const [editProductBasePrice, setEditProductBasePrice] = useState('');
  const [editProductBrandId, setEditProductBrandId] = useState('');
  const [editProductCategoryId, setEditProductCategoryId] = useState('');
  const [editProductSellingPrice, setEditProductSellingPrice] = useState('');
  const [editProductImageState, setEditProductImageState] = useState({ file: null, removed: false });

  // ── Memoized lookup maps ────────────────────────────────────────────────────
  // These only recompute when the source arrays change, not on every render.

  const brandMap = useMemo(() => {
    const map = {};
    brands.forEach(b => { map[b.id] = b.name; });
    return map;
  }, [brands]);

  const categoryMap = useMemo(() => {
    const map = {};
    categories.forEach(c => { map[c.id] = c.name; });
    return map;
  }, [categories]);

  // Group prices by product_id → supplier_id for O(1) lookup
  const priceMap = useMemo(() => {
    const map = {};
    prices.forEach(sp => {
      if (!map[sp.product_id]) map[sp.product_id] = {};
      map[sp.product_id][sp.supplier_id] = sp;
    });
    return map;
  }, [prices]);

  // Find cheapest price details for each product
  const getCheapestPrice = useCallback((productId) => {
    const productPrices = priceMap[productId];
    if (!productPrices) return null;
    let cheapest = null;
    Object.values(productPrices).forEach(sp => {
      if (sp.price > 0 && (!cheapest || sp.price < cheapest.price)) cheapest = sp;
    });
    return cheapest;
  }, [priceMap]);

  // Find highest price details for each product
  const getHighestPrice = useCallback((productId) => {
    const productPrices = priceMap[productId];
    if (!productPrices) return null;
    let highest = null;
    Object.values(productPrices).forEach(sp => {
      if (sp.price > 0 && (!highest || sp.price > highest.price)) highest = sp;
    });
    return highest;
  }, [priceMap]);

  const getExpectedSellingPrice = useCallback((productId, editingSpId, newPrice) => {
    const productPrices = priceMap[productId] || {};
    let maxPrice = 0;
    Object.values(productPrices).forEach(sp => {
      const pVal = sp.id === editingSpId ? Number(newPrice || 0) : sp.price;
      if (pVal > maxPrice) maxPrice = pVal;
    });
    if (maxPrice === 0) maxPrice = Number(newPrice || 0);
    return maxPrice > 0 ? maxPrice + 0.20 : 0;
  }, [priceMap]);

  // ── Memoized filtered product list ─────────────────────────────────────────
  // Only recalculates when products, filters, or priceMap change.
  const filteredProducts = useMemo(() =>
    products.filter(product => {
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        product.name_en.toLowerCase().includes(term) ||
        product.name_kh.includes(searchTerm);

      if (!matchesSearch) return false;

      // Brand filter
      if (selectedBrandFilter !== 'all') {
        if (selectedBrandFilter === 'none') {
          if (product.brand_id) return false;
        } else {
          if (product.brand_id !== selectedBrandFilter) return false;
        }
      }

      // Category filter
      if (selectedCategoryFilter !== 'all') {
        if (selectedCategoryFilter === 'none') {
          if (product.category_id) return false;
        } else {
          if (product.category_id !== selectedCategoryFilter) return false;
        }
      }

      // Supplier filter
      if (selectedSupplierFilter !== 'all') {
        if (!priceMap[product.id]?.[selectedSupplierFilter]) return false;
      }

      return true;
    }),
    [products, searchTerm, selectedBrandFilter, selectedCategoryFilter, selectedSupplierFilter, priceMap]
  );

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
      const priceVal = editPrice ? Number(editPrice) : 0;
      const stockVal = Number(editStock);

      if (priceVal === 0 && stockVal === 0) {
        if (editingCell.priceObj.id) {
          await db.deleteSupplierPrice(editingCell.product.id, editingCell.supplier.id);
        }
      } else {
        await db.updateSupplierPrice({
          ...editingCell.priceObj,
          price: priceVal,
          stock_qty: stockVal,
          stock_unit: editUnit
        });
      }
      showToast("Supplier price saved!", "success");
      onRefresh();
      setEditingCell(null);
    } catch (err) {
      showToast("Error saving price: " + err.message, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteOffer = async () => {
    if (!editingCell) return;
    const confirmed = confirm(`Are you sure you want to delete this product offer from supplier "${editingCell.supplier.name}"?`);
    if (!confirmed) return;

    setIsSaving(true);
    try {
      await db.deleteSupplierPrice(editingCell.product.id, editingCell.supplier.id);
      showToast("Offer deleted successfully.", "success");
      onRefresh();
      setEditingCell(null);
    } catch (err) {
      showToast("Error deleting offer: " + err.message, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleProductClick = (product) => {
    setEditingProduct(product);
    setEditProductNameKh(product.name_kh);
    setEditProductNameEn(product.name_en);
    setEditProductBarcode(product.barcode || '');
    setEditProductBasePrice(product.base_price.toString());
    setEditProductBrandId(product.brand_id || '');
    setEditProductCategoryId(product.category_id || '');
    setEditProductSellingPrice(product.selling_price ? product.selling_price.toString() : '');
    setEditProductImageState({ file: null, removed: false });
  };

  // Helper: get the final file to upload from image state
  const resolveFinalBlob = (imageState) => {
    const { file } = imageState;
    if (file) return { blob: file, mime: file.type || 'image/jpeg' };
    return null;
  };


  const handleSaveProductEdit = async (e) => {
    e.preventDefault();
    if (!editingProduct) return;

    setIsSaving(true);
    try {
      let imageUrl = editingProduct.image_url || null;

      // Handle image changes
      if (editProductImageState.removed) {
        // User explicitly removed the image
        await deleteProductImage(imageUrl);
        imageUrl = null;
      } else {
        const final = resolveFinalBlob(editProductImageState);
        if (final) {
          // Upload new image, delete old one
          await deleteProductImage(imageUrl);
          imageUrl = await uploadProductImage(final.blob, editingProduct.id, final.mime);
        }
      }

      await db.saveProduct({
        ...editingProduct,
        name_kh: editProductNameKh,
        name_en: editProductNameEn,
        barcode: editProductBarcode,
        base_price: Number(editProductBasePrice),
        brand_id: editProductBrandId || null,
        category_id: editProductCategoryId || null,
        selling_price: editProductSellingPrice ? Number(editProductSellingPrice) : null,
        image_url: imageUrl,
      });
      showToast("Product updated successfully!", "success");
      onRefresh();
      setEditingProduct(null);
    } catch (err) {
      showToast("Error updating product: " + err.message, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProduct = async () => {
    if (!editingProduct) return;
    const confirmed = confirm(`Are you sure you want to delete product "${editingProduct.name_kh}"? This will also remove all its prices and inventory counts.`);
    if (!confirmed) return;

    setIsSaving(true);
    try {
      // Clean up image in storage
      if (editingProduct.image_url) {
        await deleteProductImage(editingProduct.image_url);
      }
      await db.deleteProduct(editingProduct.id);
      showToast("Product deleted successfully.", "success");
      onRefresh();
      setEditingProduct(null);
    } catch (err) {
      if (err.code === '23503') {
        showToast("Cannot delete this product because it has been used in past invoices. You can set its stock to 0 or delete its supplier prices instead.", "warning");
      } else {
        showToast("Error deleting product: " + err.message, "error");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    if (!newProductNameKh || !newProductNameEn || !newProductBasePrice) return;
    
    setIsSavingProduct(true);
    try {
      // Upload image if one was selected
      let imageUrl = null;
      const final = resolveFinalBlob(newProductImageState);
      if (final) {
        // We upload after creating the product to get a real ID
        // For now use a temp ID and we'll update
        const tempId = 'temp_' + Date.now();
        imageUrl = await uploadProductImage(final.blob, tempId, final.mime);
      }

      await db.saveProduct({
        name_kh: newProductNameKh,
        name_en: newProductNameEn,
        barcode: newProductBarcode,
        base_price: Number(newProductBasePrice),
        brand_id: newProductBrandId || null,
        category_id: newProductCategoryId || null,
        selling_price: newProductSellingPrice ? Number(newProductSellingPrice) : null,
        image_url: imageUrl,
      });

      // Reset all fields
      setNewProductNameKh('');
      setNewProductNameEn('');
      setNewProductBarcode('');
      setNewProductBasePrice('');
      setNewProductBrandId('');
      setNewProductCategoryId('');
      setNewProductSellingPrice('');
      setNewProductImageState({ file: null, removed: false });

      setIsAddProductOpen(false);
      showToast("Product added successfully!", "success");
      onRefresh();
    } catch (err) {
      showToast("Error adding product: " + err.message, "error");
    } finally {
      setIsSavingProduct(false);
    }
  };

  const handleAddSupplier = async (e) => {
    e.preventDefault();
    if (!newSupplierName) return;
    
    setIsSavingSupplier(true);
    try {
      await db.saveSupplier({
        name: newSupplierName,
        contact_phone: newSupplierPhone
      });
      // Reset values
      setNewSupplierName('');
      setNewSupplierPhone('');
      setIsAddSupplierOpen(false);
      showToast("Supplier added successfully!", "success");
      onRefresh();
    } catch (err) {
      showToast("Error adding supplier: " + err.message, "error");
    } finally {
      setIsSavingSupplier(false);
    }
  };

  const handleDeleteSupplier = async (supplier) => {
    const confirmed = confirm(`Are you sure you want to delete supplier "${supplier.name}"? This will remove all their prices and inventory records.`);
    if (!confirmed) return;

    try {
      await db.deleteSupplier(supplier.id);
      showToast("Supplier deleted successfully.", "success");
      onRefresh();
    } catch (err) {
      showToast("Error deleting supplier: " + err.message, "error");
    }
  };


  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <Card className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-card/60 backdrop-blur-md p-6 border-border shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-foreground tracking-wide">Product + Supplier Pricing Table</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Compare prices across all suppliers and manage stock levels side-by-side.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={() => setIsAddProductOpen(true)}
            className="gap-2 text-xs font-bold"
          >
            <Plus className="w-4 h-4" />
            Add Product
          </Button>
          <Button
            variant="outline"
            onClick={() => setIsAddSupplierOpen(true)}
            className="gap-2 text-xs font-bold"
          >
            <Plus className="w-4 h-4" />
            Add Supplier
          </Button>
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-3.5 py-2 rounded-xl border border-border">
            <Info className="w-4 h-4 text-primary flex-shrink-0" />
            <span>Click any supplier cell in the table to edit pricing and stock levels.</span>
          </div>
        </div>
      </Card>

      {/* Filters bar */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by English or Khmer product name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 h-9 text-xs bg-background/50 border-input"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
          
          <select
            value={selectedBrandFilter}
            onChange={(e) => setSelectedBrandFilter(e.target.value)}
            className="flex h-9 rounded-md border border-input bg-card px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-foreground min-w-[150px]"
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
            className="flex h-9 rounded-md border border-input bg-card px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-foreground min-w-[150px]"
          >
            <option value="all">All Categories</option>
            <option value="none">No Category</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <select
            value={selectedSupplierFilter}
            onChange={(e) => setSelectedSupplierFilter(e.target.value)}
            className="flex h-9 rounded-md border border-input bg-card px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-foreground min-w-[180px]"
          >
            <option value="all">All Suppliers (Show Grid)</option>
            {suppliers.map(s => (
              <option key={s.id} value={s.id}>Only {s.name}</option>
            ))}
          </select>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg border border-border">
            <Button
              type="button"
              variant={viewLayoutMode === 'matrix' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewLayoutMode('matrix')}
              className="h-7 px-2.5 text-xs font-semibold gap-1.5"
              title="Matrix Table View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Matrix View</span>
            </Button>
            <Button
              type="button"
              variant={viewLayoutMode === 'cards' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewLayoutMode('cards')}
              className="h-7 px-2.5 text-xs font-semibold gap-1.5"
              title="Mobile Card List View"
            >
              <List className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Mobile Cards</span>
            </Button>
          </div>
        </div>
      </div>

      {viewLayoutMode === 'cards' ? (
        <div className="space-y-4">
          {filteredProducts.map(product => {
            const cheapestPrice = getCheapestPrice(product.id);
            const highestPrice = getHighestPrice(product.id);
            const sellingPrice = product.selling_price && Number(product.selling_price) > 0
              ? Number(product.selling_price)
              : (highestPrice ? (highestPrice.price + 0.20) : (product.base_price + 0.20));

            return (
              <Card key={product.id} className="p-5 bg-card/60 backdrop-blur-md border-border shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-border pb-3">
                  <div 
                    onClick={() => handleProductClick(product)}
                    className="flex items-center gap-3 cursor-pointer group"
                  >
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
                      <h4 className="font-bold text-foreground text-base group-hover:text-primary transition-colors flex items-center gap-1.5">
                        {product.name_kh}
                        <Edit2 className="w-3.5 h-3.5 opacity-60 text-primary" />
                      </h4>
                      <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
                        <span>{product.name_en}</span>
                        {product.brand_id && brandMap[product.brand_id] && (
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-primary/30 text-primary bg-primary/10">
                            {brandMap[product.brand_id]}
                          </Badge>
                        )}
                        {product.category_id && categoryMap[product.category_id] && (
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-violet-500/30 text-violet-500 bg-violet-500/10">
                            {categoryMap[product.category_id]}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 self-start sm:self-auto">
                    {product.barcode && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPrintProductBarcodeModal(product)}
                        className="h-8 px-2.5 text-xs text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 gap-1 font-bold"
                        title="Print Barcode Sticker"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        Label
                      </Button>
                    )}
                    <div className="text-left sm:text-right">
                      <span className="text-[10px] text-muted-foreground block font-semibold uppercase">Selling Price</span>
                      <span className="text-base font-bold text-foreground font-mono">${sellingPrice.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Supplier Offers List for Card */}
                <div className="space-y-2">
                  <h5 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Supplier Offers</h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {suppliers.map(supplier => {
                      if (selectedSupplierFilter !== 'all' && selectedSupplierFilter !== supplier.id) return null;
                      const priceObj = priceMap[product.id] && priceMap[product.id][supplier.id];
                      const isCheapest = cheapestPrice && priceObj && priceObj.id === cheapestPrice.id;

                      return (
                        <div
                          key={supplier.id}
                          onClick={() => handleCellClick(product, supplier)}
                          className={`p-3.5 rounded-xl border cursor-pointer transition-colors flex justify-between items-center ${
                            isCheapest 
                              ? 'bg-emerald-500/10 border-emerald-500/30' 
                              : 'bg-card/70 border-border hover:bg-muted/50'
                          }`}
                        >
                          <div className="space-y-0.5">
                            <span className="font-semibold text-xs text-foreground block">{supplier.name}</span>
                            {priceObj && (priceObj.price > 0 || priceObj.stock_qty > 0) ? (
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className={`font-bold text-sm ${isCheapest ? 'text-emerald-500' : 'text-foreground'}`}>
                                  ${priceObj.price.toFixed(2)}
                                </span>
                                <span className={`text-[10px] ${priceObj.stock_qty <= 2 ? 'text-destructive font-bold' : 'text-muted-foreground'}`}>
                                  (Stock: {priceObj.stock_qty} {priceObj.stock_unit})
                                </span>
                              </div>
                            ) : (
                              <span className="text-[11px] text-muted-foreground italic">No offer +</span>
                            )}
                          </div>

                          {isCheapest && (
                            <Badge className="text-[9px] font-extrabold uppercase bg-emerald-600 text-white leading-none shrink-0">
                              Cheapest ★
                            </Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Card>
            );
          })}

          {filteredProducts.length === 0 && (
            <Card className="p-8 text-center text-muted-foreground italic border-dashed">
              No products found matching your filters.
            </Card>
          )}
        </div>
      ) : (
        <Card className="rounded-xl overflow-hidden border-border shadow-xs">
          <div className="overflow-x-auto scrollbar-thin">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="p-4 min-w-[260px] text-xs font-bold uppercase">Product Details</TableHead>
                  <TableHead className="p-4 text-center text-xs font-bold uppercase">Selling Price</TableHead>
                  {suppliers.map(supplier => {
                    if (selectedSupplierFilter !== 'all' && selectedSupplierFilter !== supplier.id) return null;
                    return (
                      <TableHead key={supplier.id} className="p-4 text-center min-w-[140px] border-l border-border relative group text-xs font-bold uppercase">
                        <span className="inline-block">{supplier.name}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSupplier(supplier);
                          }}
                          className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 h-6 w-6 text-destructive hover:bg-destructive/10"
                          title={`Delete ${supplier.name}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </TableHead>
                    );
                  })}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map(product => {
                  const cheapestPrice = getCheapestPrice(product.id);
                  const highestPrice = getHighestPrice(product.id);
                  const sellingPrice = product.selling_price && Number(product.selling_price) > 0
                    ? Number(product.selling_price)
                    : (highestPrice ? (highestPrice.price + 0.20) : (product.base_price + 0.20));

                  return (
                    <TableRow key={product.id} className="hover:bg-muted/30 transition-colors group">
                      <TableCell 
                        onClick={() => handleProductClick(product)}
                        className="p-4 cursor-pointer hover:bg-primary/5 transition-colors relative group/prod-name"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-muted border border-border">
                            {product.image_url ? (
                              <img
                                src={product.image_url}
                                alt={product.name_en}
                                className="w-full h-full object-cover"
                                onError={(e) => { e.target.style.display = 'none'; }}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <ImageIcon className="w-4 h-4 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="font-semibold text-foreground group-hover/prod-name:text-primary flex items-center gap-1.5 transition-colors">
                              <span>{product.name_kh}</span>
                              <Edit2 className="w-3.5 h-3.5 opacity-0 group-hover/prod-name:opacity-60 transition-opacity text-primary" />
                              {product.barcode && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPrintProductBarcodeModal(product);
                                  }}
                                  className="h-6 w-6 text-emerald-400 opacity-0 group-hover/prod-name:opacity-100 transition-opacity hover:bg-emerald-500/10"
                                  title="Print Barcode Label"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-1.5">
                              <span>{product.name_en}</span>
                              {product.brand_id && brandMap[product.brand_id] && (
                                <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-primary/30 text-primary bg-primary/10">
                                  {brandMap[product.brand_id]}
                                </Badge>
                              )}
                              {product.category_id && categoryMap[product.category_id] && (
                                <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-violet-500/30 text-violet-500 bg-violet-500/10">
                                  {categoryMap[product.category_id]}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      
                      <TableCell className="p-4 text-center font-medium font-mono text-foreground">
                        ${sellingPrice.toFixed(2)}
                      </TableCell>

                      {suppliers.map(supplier => {
                        if (selectedSupplierFilter !== 'all' && selectedSupplierFilter !== supplier.id) return null;

                        const priceObj = priceMap[product.id] && priceMap[product.id][supplier.id];
                        const isCheapest = cheapestPrice && priceObj && priceObj.id === cheapestPrice.id;
                        
                        return (
                          <TableCell 
                            key={supplier.id}
                            onClick={() => handleCellClick(product, supplier)}
                            className={`p-4 text-center border-l border-border cursor-pointer transition-all duration-150 group/cell hover:bg-primary/5 ${
                              isCheapest 
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold' 
                                : ''
                            }`}
                          >
                            {priceObj && (priceObj.price > 0 || priceObj.stock_qty > 0) ? (
                              <div className="space-y-1 relative">
                                <div className="font-semibold flex items-center justify-center gap-1.5">
                                  <span className={isCheapest ? 'text-emerald-500 text-base font-bold' : 'text-foreground font-mono'}>
                                    ${priceObj.price.toFixed(2)}
                                  </span>
                                  {isCheapest && (
                                    <Badge className="text-[9px] font-extrabold uppercase bg-emerald-600 text-white px-1 py-0 leading-none">
                                      Cheapest
                                    </Badge>
                                  )}
                                </div>
                                <div className="space-y-0.5">
                                  <div className={`text-[11px] font-medium ${
                                    priceObj.stock_qty <= 2 
                                      ? 'text-destructive font-bold bg-destructive/10 px-1 py-0.5 rounded inline-block' 
                                      : 'text-muted-foreground'
                                  }`}>
                                    Stock: {priceObj.stock_qty} {priceObj.stock_unit}
                                  </div>
                                  {priceObj.updated_at && (
                                    <div className="text-[10px] text-muted-foreground font-medium group-hover/cell:text-foreground transition-colors">
                                      Updated: {new Date(priceObj.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                    </div>
                                  )}
                                </div>
                                
                                <Edit2 className="w-3.5 h-3.5 absolute right-0 top-0 opacity-0 group-hover/cell:opacity-60 transition-opacity text-primary" />
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground italic group-hover/cell:text-foreground">
                                No offer +
                              </span>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}

                {filteredProducts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={2 + suppliers.length} className="p-8 text-center text-muted-foreground italic">
                      No products found matching your filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Edit Price/Stock Dialog Modal */}
      <Dialog open={!!editingCell} onOpenChange={(open) => !open && setEditingCell(null)}>
        <DialogContent className="max-w-md">
          {editingCell && (
            <form onSubmit={handleSavePrice} className="space-y-4">
              <DialogHeader>
                <DialogTitle>Edit Price & Stock</DialogTitle>
                <DialogDescription>
                  For {editingCell.product.name_kh} from supplier <strong className="text-foreground">{editingCell.supplier.name}</strong>
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-2">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Price (USD)</label>
                  <Input 
                    type="number" 
                    step="0.01"
                    min="0"
                    required
                    placeholder="Enter supplier unit price"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    className="h-9 text-xs"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {editingCell.product.selling_price && Number(editingCell.product.selling_price) > 0
                      ? `Selling Price (Manual Override): $${Number(editingCell.product.selling_price).toFixed(2)}`
                      : `Expected Selling Price (Max Cost + $0.20): $${getExpectedSellingPrice(editingCell.product.id, editingCell.priceObj.id, editPrice).toFixed(2)}`}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Stock Quantity</label>
                    <Input 
                      type="number" 
                      min="0"
                      required
                      placeholder="E.g. 10, 24"
                      value={editStock}
                      onChange={(e) => setEditStock(e.target.value)}
                      className="h-9 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Stock Unit</label>
                    <select 
                      value={editUnit}
                      onChange={(e) => setEditUnit(e.target.value)}
                      className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-foreground"
                    >
                      <option value="pcs">Pieces (pcs)</option>
                      <option value="lo">Dozens (lo)</option>
                      <option value="cs">Cases (cs)</option>
                    </select>
                  </div>
                </div>
              </div>

              <DialogFooter className="flex justify-between items-center sm:justify-between w-full pt-2">
                {editingCell.priceObj.id ? (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={handleDeleteOffer}
                    disabled={isSaving}
                    className="text-xs"
                  >
                    Delete Offer
                  </Button>
                ) : (
                  <div></div>
                )}
                <div className="flex gap-2">
                  <Button 
                    type="button" 
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingCell(null)} 
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    size="sm"
                    disabled={isSaving}
                  >
                    {isSaving ? 'Saving...' : 'Save Price'}
                  </Button>
                </div>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Product Modal */}
      <Dialog 
        open={isAddProductOpen} 
        onOpenChange={(open) => {
          setIsAddProductOpen(open);
          if (!open) setNewProductImageState({ file: null, removed: false });
        }}
      >
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleAddProduct} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Add New Product</DialogTitle>
              <DialogDescription>Create a new product in the system catalog.</DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-2">
              {/* Product Image */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Product Image</label>
                <ImageUploadWidget
                  existingImageUrl={null}
                  onStateChange={setNewProductImageState}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Khmer Name (ឈ្មោះទំនិញ) *</label>
                <Input 
                  type="text" 
                  required
                  placeholder="E.g. កូកាកូឡា កំប៉ុង"
                  value={newProductNameKh}
                  onChange={(e) => setNewProductNameKh(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">English Name *</label>
                <Input 
                  type="text" 
                  required
                  placeholder="E.g. Coca Cola (330ml)"
                  value={newProductNameEn}
                  onChange={(e) => setNewProductNameEn(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Barcode (Optional)</label>
                <div className="flex items-center gap-2">
                  <Input 
                    type="text"
                    placeholder="Scan or enter barcode"
                    value={newProductBarcode}
                    onChange={(e) => setNewProductBarcode(e.target.value)}
                    className="h-9 text-xs flex-1"
                  />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAutoGenerateBarcodeForAdd}
                      title="Auto-generate a unique 13-digit barcode"
                      className="h-9 px-2 text-[10px] font-bold gap-1 border-primary/30 text-primary hover:bg-primary/10"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Auto
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openBarcodeCameraFor(setNewProductBarcode)}
                      className="h-9 px-2.5 text-[10px] font-bold gap-1"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      Scan
                    </Button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Reference Base Price ($) *</label>
                <Input 
                  type="number" 
                  step="0.01"
                  min="0"
                  required
                  placeholder="E.g. 13.50"
                  value={newProductBasePrice}
                  onChange={(e) => setNewProductBasePrice(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Custom Selling Price ($) (Optional)</label>
                <Input 
                  type="number" 
                  step="0.01"
                  min="0"
                  placeholder="Leave blank for automatic base+0.20"
                  value={newProductSellingPrice}
                  onChange={(e) => setNewProductSellingPrice(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Brand</label>
                <select
                  value={newProductBrandId}
                  onChange={(e) => setNewProductBrandId(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-foreground"
                >
                  <option value="">No Brand / General</option>
                  {brands.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
 
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Category</label>
                <select
                  value={newProductCategoryId}
                  onChange={(e) => setNewProductCategoryId(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-foreground"
                >
                  <option value="">No Category</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <DialogFooter className="flex justify-end gap-2 pt-2">
              <Button 
                type="button" 
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsAddProductOpen(false);
                  setNewProductImageState({ file: null, removed: false });
                }}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                size="sm"
                disabled={isSavingProduct}
              >
                {isSavingProduct ? 'Adding...' : 'Add Product'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Barcode Camera Scanner Modal */}
      <Dialog 
        open={isBarcodeCameraOpen} 
        onOpenChange={(open) => {
          if (!open) {
            setIsBarcodeCameraOpen(false);
            stopBarcodeCamera();
          }
        }}
      >
        <DialogContent className="max-w-md p-5 bg-dark-900/95 border-white/20 text-white rounded-3xl z-[200]">
          <DialogHeader className="flex flex-row items-center justify-between border-b border-white/10 pb-3 pr-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary-500/20 text-primary-400 border border-primary-500/30">
                <Camera className="w-5 h-5 animate-pulse" />
              </div>
              <div className="text-left">
                <DialogTitle className="text-base font-bold text-white">Scan Product Barcode</DialogTitle>
                <DialogDescription className="text-xs text-dark-300">Point your camera at the barcode</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-black my-2 shadow-inner">
            <video ref={barcodeCameraVideoRef} autoPlay playsInline muted className="h-[320px] w-full object-cover bg-black" />
            <div className="pointer-events-none absolute inset-x-8 top-1/2 h-28 -translate-y-1/2 rounded-2xl border-2 border-emerald-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] flex items-center justify-center">
              <div className="w-full h-0.5 bg-emerald-400 shadow-[0_0_12px_#34d399] animate-pulse" />
            </div>
          </div>

          {barcodeCameraError && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/15 p-3 text-xs text-rose-200 font-medium">
              {barcodeCameraError}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Supplier Modal */}
      <Dialog open={isAddSupplierOpen} onOpenChange={setIsAddSupplierOpen}>
        <DialogContent className="max-w-md">
          <form onSubmit={handleAddSupplier} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Add New Supplier</DialogTitle>
              <DialogDescription>Create a new supplier profile in the system.</DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-2">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Supplier Name *</label>
                <Input 
                  type="text" 
                  required
                  placeholder="E.g. Keo Pich Trading"
                  value={newSupplierName}
                  onChange={(e) => setNewSupplierName(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Contact Phone</label>
                <Input 
                  type="text" 
                  placeholder="E.g. 012 345 678"
                  value={newSupplierPhone}
                  onChange={(e) => setNewSupplierPhone(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <DialogFooter className="flex justify-end gap-2 pt-2">
              <Button 
                type="button" 
                variant="outline"
                size="sm"
                onClick={() => setIsAddSupplierOpen(false)} 
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                size="sm"
                disabled={isSavingSupplier}
              >
                {isSavingSupplier ? 'Adding...' : 'Add Supplier'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Product Modal */}
      <Dialog open={!!editingProduct} onOpenChange={(open) => !open && setEditingProduct(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          {editingProduct && (
            <form onSubmit={handleSaveProductEdit} className="space-y-4">
              <DialogHeader>
                <DialogTitle>Edit Product Details</DialogTitle>
                <DialogDescription>
                  Modify product name, image, or pricing details, or delete from portal.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-2">
                {/* Product Image */}
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Product Image</label>
                  <ImageUploadWidget
                    existingImageUrl={editingProduct.image_url || null}
                    onStateChange={setEditProductImageState}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Khmer Name *</label>
                  <Input 
                    type="text" 
                    required
                    placeholder="Khmer Product Name"
                    value={editProductNameKh}
                    onChange={(e) => setEditProductNameKh(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">English Name *</label>
                  <Input 
                    type="text" 
                    required
                    placeholder="English Product Name"
                    value={editProductNameEn}
                    onChange={(e) => setEditProductNameEn(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Barcode</label>
                  <div className="flex items-center gap-2">
                    <Input 
                      type="text"
                      placeholder="Scan or enter barcode"
                      value={editProductBarcode}
                      onChange={(e) => setEditProductBarcode(e.target.value)}
                      className="h-9 text-xs flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAutoGenerateBarcodeForEdit}
                      title="Auto-generate a unique 13-digit barcode"
                      className="h-9 px-2 text-[10px] font-bold gap-1 border-primary/30 text-primary hover:bg-primary/10"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Auto
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openBarcodeCameraFor(setEditProductBarcode)}
                      className="h-9 px-2.5 text-[10px] font-bold gap-1"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      Scan
                    </Button>
                    {editProductBarcode && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setPrintProductBarcodeModal({ ...editingProduct, barcode: editProductBarcode })}
                        title="Print Barcode Labels"
                        className="h-9 px-2.5 text-[10px] font-bold gap-1 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        Print
                      </Button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Base Price (USD) *</label>
                  <Input 
                    type="number" 
                    step="0.01"
                    min="0"
                    required
                    placeholder="Base Price"
                    value={editProductBasePrice}
                    onChange={(e) => setEditProductBasePrice(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Custom Selling Price ($) (Optional)</label>
                  <Input 
                    type="number" 
                    step="0.01"
                    min="0"
                    placeholder="Leave blank for automatic base+0.20"
                    value={editProductSellingPrice}
                    onChange={(e) => setEditProductSellingPrice(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Brand</label>
                  <select
                    value={editProductBrandId}
                    onChange={(e) => setEditProductBrandId(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-foreground"
                  >
                    <option value="">No Brand / General</option>
                    {brands.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
   
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Category</label>
                  <select
                    value={editProductCategoryId}
                    onChange={(e) => setEditProductCategoryId(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-foreground"
                  >
                    <option value="">No Category</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <DialogFooter className="flex justify-between items-center sm:justify-between w-full pt-2">
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteProduct}
                  disabled={isSaving}
                  className="text-xs"
                >
                  Delete Product
                </Button>
                <div className="flex gap-2">
                  <Button 
                    type="button" 
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingProduct(null)} 
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    size="sm"
                    disabled={isSaving}
                  >
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Barcode Sticker Label Printing Modal */}
      <BarcodePrintModal 
        product={printProductBarcodeModal} 
        isOpen={!!printProductBarcodeModal} 
        onClose={() => setPrintProductBarcodeModal(null)} 
      />
    </div>
  );
}
