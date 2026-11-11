import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { db } from '../services/db';
import { uploadProductImage, deleteProductImage } from '../services/imageStorage';
import { generateUniqueBarcode } from '../services/barcodeGenerator';
import BarcodePrintModal from '../components/BarcodePrintModal';
import BarcodeScannerModal from './invoice/components/BarcodeScannerModal';
import PricingToolbar from './pricing/components/PricingToolbar';
import ProductMobileCards from './pricing/components/ProductMobileCards';
import ProductMatrixTable from './pricing/components/ProductMatrixTable';
import EditPriceStockDialog from './pricing/components/EditPriceStockDialog';
import AddSupplierDialog from './pricing/components/AddSupplierDialog';
import ProductFormDialog from './pricing/components/ProductFormDialog';

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
  const [newProductBrandId, setNewProductBrandId] = useState('');
  const [newProductCategoryId, setNewProductCategoryId] = useState('');
  const [newProductSellingPrice, setNewProductSellingPrice] = useState('');
  const [newProductImageState, setNewProductImageState] = useState({ file: null, removed: false });

  const [printProductBarcodeModal, setPrintProductBarcodeModal] = useState(null);

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
  const showToastRef = useRef(showToast);

  useEffect(() => {
    showToastRef.current = showToast;
  }, [showToast]);

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

  const stopBarcodeCamera = useCallback(() => {
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
  }, []);

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
        showToastRef.current?.(userMsg, 'error');
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
  }, [isBarcodeCameraOpen, stopBarcodeCamera]);

  // ── Memoized lookup maps ────────────────────────────────────────────────────

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

  // Group prices by product_id → supplier_id for O(1) lookup
  const priceMap = useMemo(() => {
    const map = {};
    prices.forEach((sp) => {
      if (!map[sp.product_id]) map[sp.product_id] = {};
      map[sp.product_id][sp.supplier_id] = sp;
    });
    return map;
  }, [prices]);

  const getCheapestPrice = useCallback((productId) => {
    const productPrices = priceMap[productId];
    if (!productPrices) return null;
    let cheapest = null;
    Object.values(productPrices).forEach((sp) => {
      if (sp.price > 0 && (!cheapest || sp.price < cheapest.price)) cheapest = sp;
    });
    return cheapest;
  }, [priceMap]);

  const getHighestPrice = useCallback((productId) => {
    const productPrices = priceMap[productId];
    if (!productPrices) return null;
    let highest = null;
    Object.values(productPrices).forEach((sp) => {
      if (sp.price > 0 && (!highest || sp.price > highest.price)) highest = sp;
    });
    return highest;
  }, [priceMap]);

  const getExpectedSellingPrice = useCallback((productId, editingSpId, newPrice) => {
    const productPrices = priceMap[productId] || {};
    let maxPrice = 0;
    Object.values(productPrices).forEach((sp) => {
      const pVal = sp.id === editingSpId ? Number(newPrice || 0) : sp.price;
      if (pVal > maxPrice) maxPrice = pVal;
    });
    if (maxPrice === 0) maxPrice = Number(newPrice || 0);
    return maxPrice > 0 ? maxPrice + 0.20 : 0;
  }, [priceMap]);

  const filteredProducts = useMemo(() =>
    products.filter((product) => {
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        product.name_en.toLowerCase().includes(term) ||
        product.name_kh.includes(searchTerm);

      if (!matchesSearch) return false;

      if (selectedBrandFilter !== 'all') {
        if (selectedBrandFilter === 'none') {
          if (product.brand_id) return false;
        } else if (product.brand_id !== selectedBrandFilter) {
          return false;
        }
      }

      if (selectedCategoryFilter !== 'all') {
        if (selectedCategoryFilter === 'none') {
          if (product.category_id) return false;
        } else if (product.category_id !== selectedCategoryFilter) {
          return false;
        }
      }

      if (selectedSupplierFilter !== 'all') {
        if (!priceMap[product.id]?.[selectedSupplierFilter]) return false;
      }

      return true;
    }),
    [products, searchTerm, selectedBrandFilter, selectedCategoryFilter, selectedSupplierFilter, priceMap]
  );

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

  const handleCellClick = (product, supplier) => {
    const priceObj = (priceMap[product.id] && priceMap[product.id][supplier.id]) || {
      product_id: product.id,
      supplier_id: supplier.id,
      price: 0,
      stock_qty: 0,
      stock_unit: 'pcs',
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
          stock_unit: editUnit,
        });
      }
      showToast('Supplier price saved!', 'success');
      onRefresh();
      setEditingCell(null);
    } catch (err) {
      showToast('Error saving price: ' + err.message, 'error');
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
      showToast('Offer deleted successfully.', 'success');
      onRefresh();
      setEditingCell(null);
    } catch (err) {
      showToast('Error deleting offer: ' + err.message, 'error');
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

      if (editProductImageState.removed) {
        await deleteProductImage(imageUrl);
        imageUrl = null;
      } else {
        const final = resolveFinalBlob(editProductImageState);
        if (final) {
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
      showToast('Product updated successfully!', 'success');
      onRefresh();
      setEditingProduct(null);
    } catch (err) {
      showToast('Error updating product: ' + err.message, 'error');
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
      if (editingProduct.image_url) {
        await deleteProductImage(editingProduct.image_url);
      }
      await db.deleteProduct(editingProduct.id);
      showToast('Product deleted successfully.', 'success');
      onRefresh();
      setEditingProduct(null);
    } catch (err) {
      if (err.code === '23503') {
        showToast('Cannot delete this product because it has been used in past invoices. You can set its stock to 0 or delete its supplier prices instead.', 'warning');
      } else {
        showToast('Error deleting product: ' + err.message, 'error');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    if (!newProductNameKh || !newProductNameEn) return;

    setIsSavingProduct(true);
    try {
      let imageUrl = null;
      const final = resolveFinalBlob(newProductImageState);
      if (final) {
        const tempId = 'temp_' + Date.now();
        imageUrl = await uploadProductImage(final.blob, tempId, final.mime);
      }

      await db.saveProduct({
        name_kh: newProductNameKh,
        name_en: newProductNameEn,
        barcode: newProductBarcode,
        base_price: 0,
        brand_id: newProductBrandId || null,
        category_id: newProductCategoryId || null,
        selling_price: newProductSellingPrice ? Number(newProductSellingPrice) : null,
        image_url: imageUrl,
      });

      setNewProductNameKh('');
      setNewProductNameEn('');
      setNewProductBarcode('');
      setNewProductBrandId('');
      setNewProductCategoryId('');
      setNewProductSellingPrice('');
      setNewProductImageState({ file: null, removed: false });

      setIsAddProductOpen(false);
      showToast('Product added successfully!', 'success');
      onRefresh();
    } catch (err) {
      showToast('Error adding product: ' + err.message, 'error');
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
        contact_phone: newSupplierPhone,
      });
      setNewSupplierName('');
      setNewSupplierPhone('');
      setIsAddSupplierOpen(false);
      showToast('Supplier added successfully!', 'success');
      onRefresh();
    } catch (err) {
      showToast('Error adding supplier: ' + err.message, 'error');
    } finally {
      setIsSavingSupplier(false);
    }
  };

  const handleDeleteSupplier = async (supplier) => {
    const confirmed = confirm(`Are you sure you want to delete supplier "${supplier.name}"? This will remove all their prices and inventory records.`);
    if (!confirmed) return;

    try {
      await db.deleteSupplier(supplier.id);
      showToast('Supplier deleted successfully.', 'success');
      onRefresh();
    } catch (err) {
      showToast('Error deleting supplier: ' + err.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      <PricingToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        selectedBrandFilter={selectedBrandFilter}
        onBrandFilterChange={setSelectedBrandFilter}
        brands={brands}
        selectedCategoryFilter={selectedCategoryFilter}
        onCategoryFilterChange={setSelectedCategoryFilter}
        categories={categories}
        selectedSupplierFilter={selectedSupplierFilter}
        onSupplierFilterChange={setSelectedSupplierFilter}
        suppliers={suppliers}
        viewLayoutMode={viewLayoutMode}
        onViewLayoutModeChange={setViewLayoutMode}
        onOpenAddProduct={() => setIsAddProductOpen(true)}
        onOpenAddSupplier={() => setIsAddSupplierOpen(true)}
      />

      {viewLayoutMode === 'cards' ? (
        <ProductMobileCards
          filteredProducts={filteredProducts}
          suppliers={suppliers}
          selectedSupplierFilter={selectedSupplierFilter}
          brandMap={brandMap}
          categoryMap={categoryMap}
          priceMap={priceMap}
          getCheapestPrice={getCheapestPrice}
          getHighestPrice={getHighestPrice}
          onProductClick={handleProductClick}
          onCellClick={handleCellClick}
          onPrintBarcode={setPrintProductBarcodeModal}
        />
      ) : (
        <ProductMatrixTable
          filteredProducts={filteredProducts}
          suppliers={suppliers}
          selectedSupplierFilter={selectedSupplierFilter}
          brandMap={brandMap}
          categoryMap={categoryMap}
          priceMap={priceMap}
          getCheapestPrice={getCheapestPrice}
          getHighestPrice={getHighestPrice}
          onProductClick={handleProductClick}
          onCellClick={handleCellClick}
          onPrintBarcode={setPrintProductBarcodeModal}
          onDeleteSupplier={handleDeleteSupplier}
        />
      )}

      <EditPriceStockDialog
        editingCell={editingCell}
        onClose={() => setEditingCell(null)}
        editPrice={editPrice}
        onEditPriceChange={setEditPrice}
        editStock={editStock}
        onEditStockChange={setEditStock}
        editUnit={editUnit}
        onEditUnitChange={setEditUnit}
        isSaving={isSaving}
        getExpectedSellingPrice={getExpectedSellingPrice}
        onSubmit={handleSavePrice}
        onDeleteOffer={handleDeleteOffer}
      />

      <ProductFormDialog
        open={isAddProductOpen}
        onOpenChange={(open) => {
          setIsAddProductOpen(open);
          if (!open) setNewProductImageState({ file: null, removed: false });
        }}
        mode="add"
        existingImageUrl={null}
        onImageStateChange={setNewProductImageState}
        nameKh={newProductNameKh}
        onNameKhChange={setNewProductNameKh}
        nameEn={newProductNameEn}
        onNameEnChange={setNewProductNameEn}
        barcode={newProductBarcode}
        onBarcodeChange={setNewProductBarcode}
        onAutoGenerateBarcode={handleAutoGenerateBarcodeForAdd}
        onScanBarcode={() => openBarcodeCameraFor(setNewProductBarcode)}
        sellingPrice={newProductSellingPrice}
        onSellingPriceChange={setNewProductSellingPrice}
        brandId={newProductBrandId}
        onBrandIdChange={setNewProductBrandId}
        brands={brands}
        categoryId={newProductCategoryId}
        onCategoryIdChange={setNewProductCategoryId}
        categories={categories}
        isSaving={isSavingProduct}
        onSubmit={handleAddProduct}
      />

      <BarcodeScannerModal
        isCameraScannerOpen={isBarcodeCameraOpen}
        cameraVideoRef={barcodeCameraVideoRef}
        cameraScannerError={barcodeCameraError}
        onClose={() => {
          setIsBarcodeCameraOpen(false);
          stopBarcodeCamera();
        }}
        title="Scan Product Barcode"
      />

      <AddSupplierDialog
        open={isAddSupplierOpen}
        onOpenChange={setIsAddSupplierOpen}
        supplierName={newSupplierName}
        onSupplierNameChange={setNewSupplierName}
        supplierPhone={newSupplierPhone}
        onSupplierPhoneChange={setNewSupplierPhone}
        isSaving={isSavingSupplier}
        onSubmit={handleAddSupplier}
      />

      <ProductFormDialog
        open={!!editingProduct}
        onOpenChange={(open) => {
          if (!open) setEditingProduct(null);
        }}
        mode="edit"
        existingImageUrl={editingProduct?.image_url || null}
        onImageStateChange={setEditProductImageState}
        nameKh={editProductNameKh}
        onNameKhChange={setEditProductNameKh}
        nameEn={editProductNameEn}
        onNameEnChange={setEditProductNameEn}
        barcode={editProductBarcode}
        onBarcodeChange={setEditProductBarcode}
        onAutoGenerateBarcode={handleAutoGenerateBarcodeForEdit}
        onScanBarcode={() => openBarcodeCameraFor(setEditProductBarcode)}
        onPrintBarcode={() => setPrintProductBarcodeModal({ ...editingProduct, barcode: editProductBarcode })}
        basePrice={editProductBasePrice}
        onBasePriceChange={setEditProductBasePrice}
        sellingPrice={editProductSellingPrice}
        onSellingPriceChange={setEditProductSellingPrice}
        brandId={editProductBrandId}
        onBrandIdChange={setEditProductBrandId}
        brands={brands}
        categoryId={editProductCategoryId}
        onCategoryIdChange={setEditProductCategoryId}
        categories={categories}
        isSaving={isSaving}
        onSubmit={handleSaveProductEdit}
        onDelete={handleDeleteProduct}
      />

      <BarcodePrintModal
        product={printProductBarcodeModal}
        isOpen={!!printProductBarcodeModal}
        onClose={() => setPrintProductBarcodeModal(null)}
      />
    </div>
  );
}
