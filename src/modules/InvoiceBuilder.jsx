import { useState, useEffect, useRef } from 'react';
import {
  Plus,
  RefreshCw,
  Grid,
  Download,
  FileText,
} from 'lucide-react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { db, getSupabaseConfig, generateDraftId } from '../services/db';
import confetti from 'canvas-confetti';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import ThermalReceiptDialog from '../components/ThermalReceiptDialog';
import { useReceiptSettings } from '../hooks/useReceiptSettings';
import { useLocalStorageSetting } from '../hooks/useLocalStorageSetting';
import { useReceiptExport } from '../hooks/useReceiptExport';
import DraftTabsBar from './invoice/components/DraftTabsBar';
import InvoiceHeaderCard from './invoice/components/InvoiceHeaderCard';
import PosQuickSearchBar from './invoice/components/PosQuickSearchBar';
import BarcodeScannerModal from './invoice/components/BarcodeScannerModal';
import LineItemRow from './invoice/components/LineItemRow';
import CheckoutSummaryCard from './invoice/components/CheckoutSummaryCard';
import InvoicePreviewModal from './invoice/components/InvoicePreviewModal';
import PrintableReceiptLayout from './invoice/components/PrintableReceiptLayout';
import BatchAddModal from './invoice/components/BatchAddModal';
import ImageExportModal from './invoice/components/ImageExportModal';
import SupplierPickerDialog from './invoice/components/SupplierPickerDialog';
import StockEditDialog from './invoice/components/StockEditDialog';
import {
  roundMoney,
  parseQuantity,
  TEMPLATE_IDS,
  TEMPLATE_OPTIONS,
  createSampleCustomLineItems,
  createThermalReceiptText,
  generateInvoiceId,
} from './invoice/invoiceUtils';

const createEmptyLineItem = () => ({
  id: generateDraftId(),
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
  custom_name: '',
});

const hasLineItemContent = (item) =>
  Boolean(item && (item.product_id || (item.isCustom && item.custom_name)));

const ensureTrailingEmptyLineItem = (items) => {
  if (items.length === 0) return [createEmptyLineItem()];
  const last = items[items.length - 1];
  return hasLineItemContent(last) ? [...items, createEmptyLineItem()] : items;
};

const resolveCatalogItemPricing = (productId, products, productSupplierPrices) => {
  const prod = products.find((p) => p.id === productId);
  const sps = productSupplierPrices[productId] || [];
  const customSellingPrice =
    prod && prod.selling_price && Number(prod.selling_price) > 0
      ? Number(prod.selling_price)
      : null;

  if (sps.length > 0) {
    const cheapest = [...sps].sort((a, b) => a.price - b.price)[0];
    const highest = [...sps].sort((a, b) => b.price - a.price)[0];
    return {
      prod,
      supplier_id: cheapest.supplier_id,
      supplier_price: cheapest.price,
      unit_price: customSellingPrice !== null ? customSellingPrice : roundMoney(highest.price + 0.20),
      maxStock: cheapest.stock_qty,
      stockUnit: cheapest.stock_unit,
    };
  }

  const basePrice = prod ? (prod.base_price || 0) : 0;
  return {
    prod,
    supplier_id: '',
    supplier_price: basePrice,
    unit_price: prod
      ? (customSellingPrice !== null ? customSellingPrice : roundMoney(basePrice + 0.20))
      : 0,
    maxStock: 0,
    stockUnit: 'pcs',
  };
};

const createEmptyDraft = (name = 'Order #1', existingInvoiceIds = []) => {
  const now = new Date().toISOString();
  return {
    id: generateDraftId(),
    name,
    invoice_number: generateInvoiceId(existingInvoiceIds),
    customer_id: '',
    has_delivery: true,
    delivery_fee: '1.50',
    discount_type: 'fixed',
    discount_value: '0',
    line_items: [createEmptyLineItem()],
    created_at: now,
    updated_at: now,
  };
};

const normalizeDraftsInvoiceNumbers = (draftList = [], existingOrders = []) => {
  const knownIds = [
    ...draftList.map((d) => d.invoice_number),
    ...(Array.isArray(existingOrders) ? existingOrders.map((o) => o.invoice_number) : []),
  ].filter(Boolean);

  return draftList.map((d) => {
    if (String(d.invoice_number || '').trim()) return d;
    const assignedId = generateInvoiceId(knownIds);
    knownIds.push(assignedId);
    return { ...d, invoice_number: assignedId };
  });
};

const createDraftPayload = ({
  id,
  name,
  invoiceNumber,
  customerId,
  hasDelivery,
  deliveryFee,
  discountType,
  discountValue,
  lineItems,
}) => ({
  id,
  name,
  invoice_number: invoiceNumber,
  customer_id: customerId,
  has_delivery: hasDelivery,
  delivery_fee: deliveryFee,
  discount_type: discountType,
  discount_value: discountValue,
  line_items: lineItems.map((item) => ({ ...item, isDropdownOpen: false })),
});

const normalizeBarcode = (value = '') => String(value ?? '').trim().replace(/\s+/g, '');

export default function InvoiceBuilder({
  customers,
  products,
  suppliers,
  prices,
  orders = [],
  brands = [],
  categories = [],
  onRefresh,
  showToast,
}) {
  // Multi-draft & cross-device state
  const [drafts, setDrafts] = useState([]);
  const [activeDraftId, setActiveDraftId] = useState('');
  const [draftName, setDraftName] = useState('Order #1');
  const [isSyncingDraft, setIsSyncingDraft] = useState(false);
  const [isCloudActive] = useState(() => {
    const config = getSupabaseConfig();
    return !!(config.active && config.url && config.key);
  });
  const isInitialLoadRef = useRef(true);
  const saveTimerRef = useRef(null);

  // Invoice form state
  const [selectedBrandFilter, setSelectedBrandFilter] = useState('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [hasDelivery, setHasDelivery] = useState(true);
  const [deliveryFee, setDeliveryFee] = useState('1.50');
  const [discountType, setDiscountType] = useState('fixed');
  const [discountValue, setDiscountValue] = useState('0');
  const [invoiceNumber, setInvoiceNumber] = useLocalStorageSetting('wsp_invoice_number', '');
  const [invoiceCustomerName, setInvoiceCustomerName] = useState('');
  const [invoicePhone, setInvoicePhone] = useState('');
  const [lineItems, setLineItems] = useState([createEmptyLineItem()]);

  // Shared persisted receipt settings (header, template, fonts, sizing)
  const {
    shopName, setShopName,
    shopAddress, setShopAddress,
    shopPhone, setShopPhone,
    customFooter, setCustomFooter,
    receiptTemplate, setReceiptTemplate,
    invoiceDate, setInvoiceDate,
    invoiceFontSize, setInvoiceFontSize,
    invoiceKhmerFont, setInvoiceKhmerFont,
    invoiceEnglishFont, setInvoiceEnglishFont,
    invoiceBorderThickness, setInvoiceBorderThickness,
    invoiceWidth, setInvoiceWidth,
    invoicePageSize, setInvoicePageSize,
    currencySymbol, setCurrencySymbol,
    invoiceSettings,
  } = useReceiptSettings();

  // Save & Preview state
  const [isSaving, setIsSaving] = useState(false);
  const [savedOrder, setSavedOrder] = useState(null);
  const [previewOrder, setPreviewOrder] = useState(null);

  // Export & thermal receipt state
  const {
    printableCardRef,
    isExporting,
    imageExportModal,
    closeImageExportModal,
    exportImage,
    exportPdf,
  } = useReceiptExport({
    receiptTemplate,
    invoiceWidth,
    invoicePageSize,
    showToast,
  });
  const [isTextReceiptOpen, setIsTextReceiptOpen] = useState(false);

  // POS quick search & barcode camera scanner state
  const [quickSearchQuery, setQuickSearchQuery] = useState('');
  const [isQuickDropdownOpen, setIsQuickDropdownOpen] = useState(false);
  const [isScannerMode, setIsScannerMode] = useState(false);
  const [isCameraScannerOpen, setIsCameraScannerOpen] = useState(false);
  const [cameraScannerError, setCameraScannerError] = useState('');

  const quickInputRef = useRef(null);
  const cameraVideoRef = useRef(null);
  const barcodeReaderRef = useRef(null);
  const barcodeControlsRef = useRef(null);
  const barcodeScanLockRef = useRef(false);
  const lastScannedCodeRef = useRef('');
  const lastProcessedBarcodeRef = useRef({ code: '', timestamp: 0 });
  const barcodeSubmittingRef = useRef(false);
  const barcodeSessionIdRef = useRef(0);

  // Batch add & supplier stock edit modals
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [batchSearchQuery, setBatchSearchQuery] = useState('');
  const [batchQuantities, setBatchQuantities] = useState({});
  const [supplierPickerModal, setSupplierPickerModal] = useState(null);
  const [stockEditModal, setStockEditModal] = useState(null);
  const [editStockPrice, setEditStockPrice] = useState('');
  const [editStockQty, setEditStockQty] = useState('');
  const [editStockUnit, setEditStockUnit] = useState('pcs');
  const [isSavingStock, setIsSavingStock] = useState(false);

  const stopCameraScanner = () => {
    // Invalidate active session so trailing frames are ignored
    barcodeSessionIdRef.current += 1;

    try {
      barcodeControlsRef.current?.stop();
    } catch (err) {
      console.warn('Continuous decode stop failed:', err);
    }
    barcodeControlsRef.current = null;
    barcodeReaderRef.current = null;

    try {
      const tracks = cameraVideoRef.current?.srcObject instanceof MediaStream
        ? cameraVideoRef.current.srcObject.getTracks()
        : [];
      tracks.forEach((track) => track.stop());
      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = null;
      }
    } catch (err) {
      console.warn('Tracks stop failed:', err);
    }
  };

  useEffect(() => {
    const focusTimer = setTimeout(() => {
      quickInputRef.current?.focus();
    }, 250);

    return () => {
      clearTimeout(focusTimer);
      stopCameraScanner();
    };
  }, []);

  useEffect(() => {
    if (isScannerMode) {
      quickInputRef.current?.focus();
    }
  }, [isScannerMode]);

  const collectKnownInvoiceIds = (extraIds = []) => [
    ...drafts.map((d) => d.invoice_number),
    ...(Array.isArray(orders) ? orders.map((o) => o.invoice_number) : []),
    invoiceNumber,
    ...extraIds,
  ].filter(Boolean);

  const buildCurrentDraftPayload = () => createDraftPayload({
    id: activeDraftId,
    name: draftName,
    invoiceNumber,
    customerId: selectedCustomerId,
    hasDelivery,
    deliveryFee,
    discountType,
    discountValue,
    lineItems,
  });

  const applyDraftToForm = (draft, extraExistingIds = []) => {
    const resolvedInvoiceNumber =
      String(draft.invoice_number || '').trim() ||
      generateInvoiceId(collectKnownInvoiceIds(extraExistingIds));

    setDraftName(draft.name || 'Order #1');
    setInvoiceNumber(resolvedInvoiceNumber);
    setSelectedCustomerId(draft.customer_id || '');
    const draftCustomer = customers.find((c) => String(c.id) === String(draft.customer_id));
    setInvoiceCustomerName(draftCustomer?.name || '');
    setInvoicePhone(draftCustomer?.phone || '');
    setHasDelivery(draft.has_delivery !== false);
    setDeliveryFee(draft.delivery_fee !== undefined && draft.delivery_fee !== null ? String(draft.delivery_fee) : '1.50');
    setDiscountType(draft.discount_type || 'fixed');
    setDiscountValue(draft.discount_value !== undefined && draft.discount_value !== null ? String(draft.discount_value) : '0');
    const loadedItems = Array.isArray(draft.line_items) && draft.line_items.length > 0
      ? draft.line_items
      : [createEmptyLineItem()];
    setLineItems(ensureTrailingEmptyLineItem(loadedItems));
    return resolvedInvoiceNumber;
  };

  // 1. Initial load of drafts & multi-device sync listeners
  useEffect(() => {
    let isMounted = true;
    const initDrafts = async () => {
      try {
        const fetched = await db.getDrafts();
        if (!isMounted) return;
        if (Array.isArray(fetched) && fetched.length > 0) {
          const normalized = normalizeDraftsInvoiceNumbers(fetched, orders);
          setDrafts(normalized);
          const savedActiveId = localStorage.getItem('wsp_active_draft_id');
          const target = normalized.find((d) => d.id === savedActiveId) || normalized[0];
          setActiveDraftId(target.id);
          applyDraftToForm(target, normalized.map((d) => d.invoice_number));
          // Persist newly generated invoice IDs for any legacy drafts without one
          const originalTarget = fetched.find((d) => d.id === target.id);
          if (originalTarget && !String(originalTarget.invoice_number || '').trim()) {
            db.saveDraft(target).catch(() => {});
          }
        }
      } catch (err) {
        console.error('Failed to load drafts:', err);
      } finally {
        if (isMounted) {
          setTimeout(() => {
            isInitialLoadRef.current = false;
          }, 200);
        }
      }
    };

    initDrafts();

    const handleStorage = (e) => {
      if (e.key === 'wsp_invoice_drafts') {
        try {
          const updated = JSON.parse(e.newValue);
          if (Array.isArray(updated) && updated.length > 0) {
            setDrafts(updated);
          }
        } catch (err) {
          console.debug(err);
        }
      }
    };
    window.addEventListener('storage', handleStorage);

    const handleFocus = async () => {
      try {
        const updated = await db.getDrafts();
        if (Array.isArray(updated) && updated.length > 0) {
          setDrafts(updated);
        }
      } catch (err) {
        console.debug(err);
      }
    };
    window.addEventListener('focus', handleFocus);

    const channel = db.subscribeDrafts(async () => {
      try {
        const updated = await db.getDrafts();
        if (Array.isArray(updated) && updated.length > 0) {
          setDrafts(updated);
        }
      } catch (err) {
        console.debug(err);
      }
    });

    return () => {
      isMounted = false;
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('focus', handleFocus);
      if (channel) {
        db.unsubscribeChannel(channel);
      }
    };
  }, []);

  // 2. Debounced auto-save active draft on any form changes
  useEffect(() => {
    if (isInitialLoadRef.current || !activeDraftId) return;

    const currentPayload = buildCurrentDraftPayload();

    setDrafts((prev) => {
      const idx = prev.findIndex((d) => d.id === activeDraftId);
      if (idx !== -1) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], ...currentPayload };
        return copy;
      }
      return [currentPayload, ...prev];
    });

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    setIsSyncingDraft(true);
    saveTimerRef.current = setTimeout(async () => {
      try {
        await db.saveDraft(currentPayload);
      } catch (e) {
        console.warn('Auto-save draft error:', e);
      } finally {
        setIsSyncingDraft(false);
      }
    }, 600);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [activeDraftId, draftName, invoiceNumber, selectedCustomerId, hasDelivery, deliveryFee, discountType, discountValue, lineItems]);

  const handleRegenerateInvoiceId = () => {
    const nextId = generateInvoiceId(collectKnownInvoiceIds());
    setInvoiceNumber(nextId);
    showToast(`Generated new Invoice ID: ${nextId}`, 'success');
  };

  const handleCustomerChange = (val) => {
    setSelectedCustomerId(val);
    if (val) {
      const customer = customers.find((c) => c.id === val);
      if (customer) {
        setShopName(customer.name);
        setShopAddress(customer.location_note || '');
        setShopPhone(customer.phone || '');
        setInvoiceCustomerName(customer.name || '');
        setInvoicePhone(customer.phone || '');
      }
    }
  };

  // Draft management handlers
  const handleSwitchDraft = async (targetDraftId) => {
    if (targetDraftId === activeDraftId) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    if (activeDraftId) {
      try {
        await db.saveDraft(buildCurrentDraftPayload());
      } catch (err) {
        console.debug(err);
      }
    }

    const target = drafts.find((d) => d.id === targetDraftId);
    if (target) {
      setActiveDraftId(targetDraftId);
      localStorage.setItem('wsp_active_draft_id', targetDraftId);
      applyDraftToForm(target);
      showToast(`Switched to "${target.name || 'Draft Order'}"`, 'info');
    }
  };

  const activateFreshDraft = async (name = 'Order #1', extraKnownIds = []) => {
    const knownIds = collectKnownInvoiceIds(extraKnownIds);
    const freshDraft = createEmptyDraft(name, knownIds);
    await db.saveDraft(freshDraft);
    setDrafts([freshDraft]);
    setActiveDraftId(freshDraft.id);
    localStorage.setItem('wsp_active_draft_id', freshDraft.id);
    applyDraftToForm(freshDraft, knownIds);
    return freshDraft;
  };

  const handleNewDraft = async () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    if (activeDraftId) {
      try {
        await db.saveDraft(buildCurrentDraftPayload());
      } catch (err) {
        console.debug(err);
      }
    }

    const knownIds = collectKnownInvoiceIds();
    const newDraft = createEmptyDraft(`Order #${drafts.length + 1}`, knownIds);

    try {
      setIsSyncingDraft(true);
      await db.saveDraft(newDraft);
      setDrafts((prev) => [newDraft, ...prev]);
      setActiveDraftId(newDraft.id);
      localStorage.setItem('wsp_active_draft_id', newDraft.id);
      applyDraftToForm(newDraft, knownIds);
      showToast(`Started new invoice ${newDraft.invoice_number}`, 'success');
    } catch (err) {
      showToast('Error creating draft: ' + err.message, 'error');
    } finally {
      setIsSyncingDraft(false);
    }
  };

  const handleDeleteDraft = async (draftIdToDelete) => {
    const draftToDelete = drafts.find((d) => d.id === draftIdToDelete);
    const itemsInDraft =
      draftToDelete?.line_items?.filter((i) => hasLineItemContent(i) && parseQuantity(i.quantity) > 0) || [];

    if (itemsInDraft.length > 0) {
      const confirmDelete = window.confirm(`Discard "${draftToDelete?.name || 'this draft'}" with ${itemsInDraft.length} items?`);
      if (!confirmDelete) return;
    }

    try {
      await db.deleteDraft(draftIdToDelete);
      const remainingDrafts = drafts.filter((d) => d.id !== draftIdToDelete);

      if (remainingDrafts.length > 0) {
        setDrafts(remainingDrafts);
        if (draftIdToDelete === activeDraftId) {
          const nextDraft = remainingDrafts[0];
          setActiveDraftId(nextDraft.id);
          localStorage.setItem('wsp_active_draft_id', nextDraft.id);
          applyDraftToForm(nextDraft);
        }
      } else {
        await activateFreshDraft('Order #1');
      }
      showToast('Draft removed', 'info');
    } catch (err) {
      showToast('Error deleting draft: ' + err.message, 'error');
    }
  };

  const handleManualSync = async () => {
    setIsSyncingDraft(true);
    try {
      const updated = await db.getDrafts();
      if (Array.isArray(updated) && updated.length > 0) {
        const normalized = normalizeDraftsInvoiceNumbers(updated, orders);
        setDrafts(normalized);
        const current = normalized.find((d) => d.id === activeDraftId) || normalized[0];
        if (current && current.id !== activeDraftId) {
          setActiveDraftId(current.id);
          applyDraftToForm(current, normalized.map((d) => d.invoice_number));
        }
        showToast('Drafts synchronized!', 'success');
      }
    } catch (err) {
      showToast('Sync failed: ' + err.message, 'error');
    } finally {
      setIsSyncingDraft(false);
    }
  };

  // Group prices by product_id (only including active offers with non-zero price or stock)
  const productSupplierPrices = {};
  prices.forEach((sp) => {
    if (sp.price > 0 || sp.stock_qty > 0) {
      if (!productSupplierPrices[sp.product_id]) {
        productSupplierPrices[sp.product_id] = [];
      }
      productSupplierPrices[sp.product_id].push(sp);
    }
  });

  const getFilteredProducts = (query) => {
    return products.filter((p) => {
      if (query) {
        const lower = query.toLowerCase();
        const normalizedQuery = normalizeBarcode(query);
        const matches =
          p.name_en?.toLowerCase().includes(lower) ||
          (p.name_kh || '').includes(lower) ||
          normalizeBarcode(p.barcode || '').includes(normalizedQuery) ||
          (p.barcode || '').toLowerCase().includes(lower);
        if (!matches) return false;
      }
      if (selectedBrandFilter !== 'all') {
        if (selectedBrandFilter === 'none') {
          if (p.brand_id) return false;
        } else if (p.brand_id !== selectedBrandFilter) {
          return false;
        }
      }
      if (selectedCategoryFilter !== 'all') {
        if (selectedCategoryFilter === 'none') {
          if (p.category_id) return false;
        } else if (p.category_id !== selectedCategoryFilter) {
          return false;
        }
      }
      return true;
    });
  };

  const findProductByBarcode = (query) => {
    const normalizedQuery = normalizeBarcode(query);
    if (!normalizedQuery) return null;
    return products.find((p) => normalizeBarcode(p.barcode || '') === normalizedQuery) || null;
  };

  const addProductToInvoice = (productId, qtyToAdd = 1) => {
    setLineItems((prevItems) => {
      const existingIdx = prevItems.findIndex((item) => item.product_id === productId && !item.isCustom);

      if (existingIdx > -1) {
        const updated = [...prevItems];
        const item = { ...updated[existingIdx] };
        const currentQty = parseQuantity(item.quantity);
        item.quantity = roundMoney(currentQty + parseQuantity(qtyToAdd));
        item.subtotal = roundMoney(Number(item.unit_price) * parseQuantity(item.quantity));
        updated[existingIdx] = item;
        return ensureTrailingEmptyLineItem(updated);
      }

      const pricing = resolveCatalogItemPricing(productId, products, productSupplierPrices);
      const newItem = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        product_id: productId,
        supplier_id: pricing.supplier_id,
        supplier_price: pricing.supplier_price,
        unit_price: pricing.unit_price,
        quantity: qtyToAdd,
        subtotal: roundMoney(Number(pricing.unit_price) * parseQuantity(qtyToAdd)),
        maxStock: pricing.maxStock,
        stockUnit: pricing.stockUnit,
        searchQuery: pricing.prod ? `${pricing.prod.name_kh} (${pricing.prod.name_en})` : '',
        isDropdownOpen: false,
        isCustom: false,
        custom_name: '',
      };

      const nonBlank = prevItems.filter(hasLineItemContent);
      return [...nonBlank, newItem, createEmptyLineItem()];
    });
  };

  const handleBarcodeSubmit = (overrideValue) => {
    const rawVal = overrideValue !== undefined ? overrideValue : quickSearchQuery;
    const value = String(rawVal ?? '').trim();
    if (!value) return;

    const now = Date.now();
    const sameRecentBarcode =
      value === lastProcessedBarcodeRef.current.code &&
      now - lastProcessedBarcodeRef.current.timestamp < 1200;

    if (sameRecentBarcode) {
      setQuickSearchQuery('');
      if (quickInputRef.current) quickInputRef.current.value = '';
      return;
    }

    if (barcodeSubmittingRef.current) return;
    barcodeSubmittingRef.current = true;

    setQuickSearchQuery('');
    if (quickInputRef.current) quickInputRef.current.value = '';
    setIsQuickDropdownOpen(false);

    lastProcessedBarcodeRef.current = { code: value, timestamp: now };

    const exactMatch = findProductByBarcode(value) || getFilteredProducts(value)[0];
    if (exactMatch) {
      addProductToInvoice(exactMatch.id, 1);
      const prodName = exactMatch.name_kh || exactMatch.name_en || 'Product';
      showToast(`Added: ${prodName}`, 'success');
      setIsScannerMode(true);
      setTimeout(() => {
        quickInputRef.current?.focus();
        barcodeSubmittingRef.current = false;
      }, 300);
      return;
    }

    showToast('No matching product found for this barcode or product name.', 'warning');
    setTimeout(() => {
      barcodeSubmittingRef.current = false;
    }, 300);
  };

  const openBarcodeCamera = () => {
    setCameraScannerError('');
    setIsCameraScannerOpen(true);
  };

  useEffect(() => {
    if (!isCameraScannerOpen) {
      stopCameraScanner();
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
          throw new Error('Camera access is not supported by this browser. Please open in Safari or Chrome directly.');
        }

        const videoEl = cameraVideoRef.current;
        if (!videoEl) {
          console.warn('Camera video element not available');
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
            if (!active || sessionId !== barcodeSessionIdRef.current) return;

            if (result) {
              const scannedCode = result.getText()?.trim();
              if (!scannedCode || barcodeScanLockRef.current) return;

              barcodeScanLockRef.current = true;
              lastScannedCodeRef.current = scannedCode;

              setIsCameraScannerOpen(false);
              stopCameraScanner();
              handleBarcodeSubmit(scannedCode);

              setTimeout(() => {
                barcodeScanLockRef.current = false;
                lastScannedCodeRef.current = '';
              }, 1200);
            }

            if (error && error.name !== 'NotFoundException') {
              console.warn('Barcode scan warning:', error);
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
        console.error('Camera barcode scan start failed:', err);
        let userMsg = err?.message || 'Unable to open camera.';
        if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
          userMsg = 'Camera permission was denied. Please allow camera access in your browser site settings.';
        } else if (err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError') {
          userMsg = 'No camera found on this device.';
        } else if (err?.name === 'NotReadableError' || err?.name === 'TrackStartError') {
          userMsg = 'Camera is already in use by another app or browser tab.';
        }
        setCameraScannerError(userMsg);
        showToast(userMsg, 'error');
      }
    };

    const timer = setTimeout(startScanning, 100);

    return () => {
      active = false;
      clearTimeout(timer);
      stopCameraScanner();
    };
  }, [isCameraScannerOpen]);

  // Line item mutations
  const updateLineItem = (index, field, value) => {
    let updated = [...lineItems];
    const item = { ...updated[index] };
    if (!item) return;
    item[field] = value;

    if (field === 'product_id') {
      const pricing = resolveCatalogItemPricing(value, products, productSupplierPrices);
      item.supplier_id = pricing.supplier_id;
      item.supplier_price = pricing.supplier_price;
      item.unit_price = pricing.unit_price;
      item.maxStock = pricing.maxStock;
      item.stockUnit = pricing.stockUnit;
    } else if (field === 'supplier_id') {
      const sps = productSupplierPrices[item.product_id] || [];
      const match = sps.find((sp) => sp.supplier_id === value);
      if (match) {
        item.maxStock = match.stock_qty;
        item.stockUnit = match.stock_unit;
        item.supplier_price = match.price;

        const prod = products.find((p) => p.id === item.product_id);
        const customSellingPrice =
          prod && prod.selling_price && Number(prod.selling_price) > 0
            ? Number(prod.selling_price)
            : null;
        item.unit_price = customSellingPrice !== null ? customSellingPrice : roundMoney(match.price + 0.20);
      }
    }

    const qty = parseQuantity(item.quantity);
    item.subtotal = roundMoney(Number(item.unit_price || 0) * qty);
    updated[index] = item;
    if (field === 'product_id' && value) {
      updated = ensureTrailingEmptyLineItem(updated);
    }
    setLineItems(updated);
  };

  const handleSelectProduct = (index, product) => {
    setLineItems((prevItems) => {
      const updated = [...prevItems];
      const item = updated[index] ? { ...updated[index] } : createEmptyLineItem();
      const pricing = resolveCatalogItemPricing(product.id, products, productSupplierPrices);

      item.product_id = product.id;
      item.searchQuery = `${product.name_kh} (${product.name_en})`;
      item.isDropdownOpen = false;
      item.isCustom = false;
      item.custom_name = '';
      item.supplier_id = pricing.supplier_id;
      item.supplier_price = pricing.supplier_price;
      item.unit_price = pricing.unit_price;
      item.maxStock = pricing.maxStock;
      item.stockUnit = pricing.stockUnit;

      const qty = parseQuantity(item.quantity) || 1;
      item.quantity = qty;
      item.subtotal = roundMoney(Number(item.unit_price || 0) * qty);
      updated[index] = item;

      return ensureTrailingEmptyLineItem(updated);
    });
  };

  const openSupplierPicker = (itemIndex) => {
    const item = lineItems[itemIndex];
    if (!item || !item.product_id) return;
    const prod = products.find((p) => p.id === item.product_id);
    if (!prod) return;
    setSupplierPickerModal({
      itemIndex,
      product: prod,
      currentSupplierId: item.supplier_id,
    });
  };

  const openStockEditModal = (itemIndex, product, supplier, priceObj) => {
    if (!product || !supplier) return;
    setStockEditModal({
      itemIndex,
      product,
      supplier,
      priceObj: priceObj || {
        product_id: product.id,
        supplier_id: supplier.id,
        price: product.base_price || 0,
        stock_qty: 0,
        stock_unit: 'pcs',
      },
    });
    setEditStockPrice(
      priceObj && priceObj.price > 0
        ? priceObj.price.toString()
        : product.base_price
        ? product.base_price.toString()
        : '0'
    );
    setEditStockQty(priceObj ? priceObj.stock_qty.toString() : '0');
    setEditStockUnit(priceObj && priceObj.stock_unit ? priceObj.stock_unit : 'pcs');
  };

  const handleSaveStockEdit = async (e) => {
    e.preventDefault();
    if (!stockEditModal || !stockEditModal.product || !stockEditModal.supplier) return;

    setIsSavingStock(true);
    try {
      const priceVal = editStockPrice ? Number(editStockPrice) : 0;
      const stockVal = Number(editStockQty) || 0;

      const payload = {
        id: stockEditModal.priceObj?.id,
        product_id: stockEditModal.product.id,
        supplier_id: stockEditModal.supplier.id,
        price: priceVal,
        stock_qty: stockVal,
        stock_unit: editStockUnit || 'pcs',
      };

      await db.updateSupplierPrice(payload);
      showToast(`Stock & price updated for ${stockEditModal.supplier.name}!`, 'success');

      if (stockEditModal.itemIndex !== null && stockEditModal.itemIndex !== undefined) {
        const updated = [...lineItems];
        const targetItem = updated[stockEditModal.itemIndex];
        if (targetItem && targetItem.product_id === stockEditModal.product.id) {
          targetItem.supplier_id = stockEditModal.supplier.id;
          targetItem.supplier_price = priceVal;
          targetItem.maxStock = stockVal;
          targetItem.stockUnit = editStockUnit || 'pcs';

          const customSellingPrice =
            stockEditModal.product.selling_price && Number(stockEditModal.product.selling_price) > 0
              ? Number(stockEditModal.product.selling_price)
              : null;
          if (customSellingPrice === null) {
            targetItem.unit_price = roundMoney(priceVal + 0.20);
          }
          targetItem.subtotal = roundMoney(
            Number(targetItem.unit_price || 0) * parseQuantity(targetItem.quantity)
          );
          setLineItems(updated);
        }
      }

      if (onRefresh) {
        await onRefresh();
      }

      setStockEditModal(null);
    } catch (err) {
      showToast('Error updating stock: ' + err.message, 'error');
    } finally {
      setIsSavingStock(false);
    }
  };

  const addLineItem = () => {
    setLineItems((prev) => [...prev, createEmptyLineItem()]);
  };

  const removeLineItem = (index) => {
    const updated = lineItems.filter((_, idx) => idx !== index);
    setLineItems(ensureTrailingEmptyLineItem(updated));
  };

  const moveLineItem = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= lineItems.length) return;
    setLineItems((prev) => {
      const next = [...prev];
      const tmp = next[index];
      next[index] = next[target];
      next[target] = tmp;
      return next;
    });
  };

  const loadSampleKhmerInvoice = () => {
    const samples = createSampleCustomLineItems(generateDraftId);
    setLineItems([...samples, createEmptyLineItem()]);
    setInvoiceCustomerName((prev) => prev || 'Yean Devit');
    setInvoicePhone((prev) => prev || '0884577039');
    setInvoiceNumber((prev) => prev || generateInvoiceId(collectKnownInvoiceIds()));
    if (!invoiceDate) setInvoiceDate(new Date().toISOString().slice(0, 10));
    setReceiptTemplate(TEMPLATE_IDS.KHMER);
    showToast('Loaded sample Khmer invoice items. Edit freely.', 'success');
  };

  const applyBatchItems = (itemsToApply) => {
    setLineItems((prevItems) => {
      const updated = [];
      itemsToApply.forEach(({ productId, qty }) => {
        const existingItem = prevItems.find((item) => item.product_id === productId && !item.isCustom);
        if (existingItem) {
          updated.push({
            ...existingItem,
            quantity: qty,
            subtotal: roundMoney(Number(existingItem.unit_price) * qty),
          });
        } else {
          const pricing = resolveCatalogItemPricing(productId, products, productSupplierPrices);
          updated.push({
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            product_id: productId,
            supplier_id: pricing.supplier_id,
            supplier_price: pricing.supplier_price,
            unit_price: pricing.unit_price,
            quantity: qty,
            subtotal: roundMoney(Number(pricing.unit_price) * qty),
            maxStock: pricing.maxStock,
            stockUnit: pricing.stockUnit,
            searchQuery: pricing.prod ? `${pricing.prod.name_kh} (${pricing.prod.name_en})` : '',
            isDropdownOpen: false,
          });
        }
      });
      return ensureTrailingEmptyLineItem(updated);
    });
  };

  // Calculations with money precision rounding
  const subtotal = roundMoney(
    lineItems.reduce((sum, item) => {
      if (!hasLineItemContent(item)) return sum;
      return sum + roundMoney(Number(item.unit_price || 0) * parseQuantity(item.quantity));
    }, 0)
  );

  const parsedDiscountVal = parseQuantity(discountValue);
  const calculatedDiscount =
    discountType === 'percent'
      ? roundMoney((subtotal * Math.min(100, parsedDiscountVal)) / 100)
      : roundMoney(Math.min(subtotal, parsedDiscountVal));

  const effectiveDeliveryFee = hasDelivery ? Number(deliveryFee || 0) : 0;
  const totalAmount = roundMoney(Math.max(0, subtotal - calculatedDiscount) + effectiveDeliveryFee);

  const totalProfit = roundMoney(
    lineItems.reduce((sum, item) => {
      if (item.isCustom || !item.product_id) return sum;
      const qty = parseQuantity(item.quantity);
      const profit = (Number(item.unit_price || 0) - Number(item.supplier_price || 0)) * qty;
      return sum + profit;
    }, 0)
  );

  const handleSaveInvoice = async (e) => {
    if (e) e.preventDefault();
    if (!selectedCustomerId) {
      showToast('Please select a customer first!', 'warning');
      return;
    }

    const validItems = lineItems.filter(
      (item) => hasLineItemContent(item) && parseQuantity(item.quantity) > 0
    );
    if (validItems.length === 0) {
      showToast('Please add at least one valid product or custom line item with quantity > 0.', 'warning');
      return;
    }

    setIsSaving(true);
    try {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

      const finalInvoiceNumber =
        String(invoiceNumber || '').trim() || generateInvoiceId(collectKnownInvoiceIds());
      const orderObj = {
        invoice_number: finalInvoiceNumber,
        customer_id: selectedCustomerId,
        delivery_fee: effectiveDeliveryFee,
        discount: calculatedDiscount,
        total_amount: totalAmount,
        status: 'pending',
      };

      const sanitizedItems = validItems.map((item) => ({
        ...item,
        quantity: parseQuantity(item.quantity),
        subtotal: roundMoney(Number(item.unit_price || 0) * parseQuantity(item.quantity)),
      }));

      const result = await db.createOrder(orderObj, sanitizedItems);

      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });

      onRefresh();

      setSavedOrder({
        order: {
          ...result,
          invoice_number: result.invoice_number || finalInvoiceNumber,
          discount: calculatedDiscount,
          delivery_fee: effectiveDeliveryFee,
        },
        items: sanitizedItems,
        customer: customers.find((c) => c.id === selectedCustomerId),
      });

      if (activeDraftId) {
        try {
          await db.deleteDraft(activeDraftId);
        } catch (delErr) {
          console.warn('Could not delete completed draft:', delErr);
        }
      }

      const remainingDrafts = drafts.filter((d) => d.id !== activeDraftId);
      if (remainingDrafts.length > 0) {
        setDrafts(remainingDrafts);
        const next = remainingDrafts[0];
        setActiveDraftId(next.id);
        localStorage.setItem('wsp_active_draft_id', next.id);
        applyDraftToForm(next, [finalInvoiceNumber]);
      } else {
        await activateFreshDraft('Order #1', [finalInvoiceNumber]);
      }
      showToast(`Invoice ${finalInvoiceNumber} saved successfully!`, 'success');
    } catch (err) {
      showToast('Error creating order: ' + err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePreviewReceipt = () => {
    const customer = customers.find((c) => c.id === selectedCustomerId);
    const activeItems = lineItems.filter(
      (item) => hasLineItemContent(item) && parseQuantity(item.quantity) > 0
    );

    if (activeItems.length === 0) {
      showToast('Please add at least one item with valid quantity to preview.', 'warning');
      return;
    }

    const calcSubtotal = activeItems.reduce(
      (sum, item) => sum + roundMoney(Number(item.unit_price || 0) * parseQuantity(item.quantity)),
      0
    );
    const calcTotalAmount = roundMoney(Math.max(0, calcSubtotal - calculatedDiscount) + effectiveDeliveryFee);

    const resolvedCustomer = {
      name: invoiceCustomerName || customer?.name || 'Walk-in Customer',
      location_note: customer?.location_note || 'General Delivery',
      phone: invoicePhone || customer?.phone || '',
    };

    const orderedAt = invoiceDate
      ? new Date(`${invoiceDate}T12:00:00`).toISOString()
      : new Date().toISOString();

    setPreviewOrder({
      order: {
        id: 'DRAFT_PREVIEW_' + Date.now().toString().slice(-4),
        delivery_fee: effectiveDeliveryFee,
        discount: calculatedDiscount,
        total_amount: calcTotalAmount,
        ordered_at: orderedAt,
        invoice_number: invoiceNumber,
      },
      customer: resolvedCustomer,
      items: activeItems.map((item) => ({
        id: item.id,
        product_id: item.product_id || null,
        custom_name: item.custom_name || null,
        supplier_id: item.supplier_id || null,
        supplier_price: Number(item.supplier_price || 0),
        unit_price: Number(item.unit_price || 0),
        quantity: parseQuantity(item.quantity),
        subtotal: roundMoney(Number(item.unit_price || 0) * parseQuantity(item.quantity)),
      })),
    });
  };

  const handlePrint = () => {
    if (!savedOrder && !previewOrder) {
      const activeItems = lineItems.filter(
        (item) => hasLineItemContent(item) && parseQuantity(item.quantity) > 0
      );
      if (activeItems.length === 0) {
        showToast('Please add at least one item with valid quantity to print.', 'warning');
        return;
      }
      handlePreviewReceipt();
      setTimeout(() => window.print(), 250);
      return;
    }
    window.print();
  };

  const buildExportFilename = (ext) => {
    const receiptData = savedOrder || previewOrder;
    const customer = receiptData?.customer || customers.find((c) => c.id === selectedCustomerId);
    const nameSource = (!savedOrder ? invoiceCustomerName : '') || customer?.name || 'Customer';
    const safeName = nameSource.replace(/[^a-zA-Z0-9_\-\u0600-\u06FF\u1780-\u17FF]/g, '_');
    const idSource = String(
      receiptData?.order?.invoice_number || (!savedOrder ? invoiceNumber : '') || ''
    ).replace(/[^a-zA-Z0-9_-]/g, '');
    const suffix = idSource || new Date().toISOString().slice(0, 10);
    return `Invoice_${suffix}_${safeName}.${ext}`;
  };

  const ensurePreviewReadyForExport = () => {
    const activeItems = lineItems.filter(
      (item) => hasLineItemContent(item) && parseQuantity(item.quantity) > 0
    );
    if (activeItems.length === 0 && !savedOrder && !previewOrder) {
      showToast('Please add at least one valid product or item to export.', 'warning');
      return false;
    }
    if (!savedOrder && !previewOrder) {
      handlePreviewReceipt();
    }
    return true;
  };

  const handleDownloadImage = async (format = 'png') => {
    if (isExporting || !ensurePreviewReadyForExport()) return;
    const filename = buildExportFilename(format);
    await exportImage({ format, filename, shareText: `Wholesale Invoice - ${filename}` });
  };

  const handleDownloadPdf = async () => {
    if (isExporting || !ensurePreviewReadyForExport()) return;
    await exportPdf({ filename: buildExportFilename('pdf') });
  };

  const receiptData = savedOrder || previewOrder;
  const activeReceiptIsDraft = Boolean(receiptData?.order?.id?.startsWith('DRAFT_PREVIEW'));
  const resolvedReceiptInvoiceNumber = savedOrder
    ? (receiptData?.order?.invoice_number || '')
    : invoiceNumber;
  const resolvedReceiptCustomerName = savedOrder
    ? (receiptData?.customer?.name || '')
    : (invoiceCustomerName || receiptData?.customer?.name || '');
  const resolvedReceiptCustomerPhone = savedOrder
    ? (receiptData?.customer?.phone || '')
    : (invoicePhone || receiptData?.customer?.phone || '');

  const updateModalInvoiceNumber = (nextVal) => {
    if (savedOrder) {
      setSavedOrder((prev) =>
        prev ? { ...prev, order: { ...prev.order, invoice_number: nextVal } } : prev
      );
    } else {
      setInvoiceNumber(nextVal);
    }
  };

  return (
    <div className="space-y-6">
      <div className="no-print space-y-6">
        {/* Header Panel */}
        <Card className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card/60 backdrop-blur-md p-5 sm:p-6 border-border shadow-xs">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-foreground tracking-wide flex items-center gap-2">
              Invoice Builder
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Build wholesale invoices, compare suppliers, check stock levels, and print or export invoices as crisp images.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Template</label>
              <select
                value={receiptTemplate}
                onChange={(e) => setReceiptTemplate(e.target.value)}
                className="flex h-9 min-w-[160px] rounded-md border border-input bg-card px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-foreground"
              >
                {TEMPLATE_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
              </select>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleDownloadImage('png')}
              disabled={isExporting}
              className="flex-1 sm:flex-initial gap-1.5 text-xs font-semibold h-9"
              title="Download Invoice as high-resolution PNG image"
            >
              {isExporting ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-primary" />
              ) : (
                <Download className="w-3.5 h-3.5 text-primary" />
              )}
              <span>Export Image</span>
            </Button>
          </div>
        </Card>

        {/* Multi-Draft & Multi-Device Order Bar */}
        <DraftTabsBar
          drafts={drafts}
          activeDraftId={activeDraftId}
          invoiceNumber={invoiceNumber}
          isCloudActive={isCloudActive}
          isSyncingDraft={isSyncingDraft}
          customers={customers}
          onSwitchDraft={handleSwitchDraft}
          onNewDraft={handleNewDraft}
          onDeleteDraft={handleDeleteDraft}
          onManualSync={handleManualSync}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Side: Invoice Items Builder (2 cols) */}
          <form onSubmit={handleSaveInvoice} className="lg:col-span-2 space-y-6 min-w-0">
            <InvoiceHeaderCard
              draftName={draftName}
              setDraftName={setDraftName}
              onNewDraft={handleNewDraft}
              selectedCustomerId={selectedCustomerId}
              customers={customers}
              onCustomerChange={handleCustomerChange}
              invoiceNumber={invoiceNumber}
              setInvoiceNumber={setInvoiceNumber}
              onRegenerateInvoiceId={handleRegenerateInvoiceId}
              receiptTemplate={receiptTemplate}
              invoiceCustomerName={invoiceCustomerName}
              setInvoiceCustomerName={setInvoiceCustomerName}
              invoicePhone={invoicePhone}
              setInvoicePhone={setInvoicePhone}
              invoiceDate={invoiceDate}
              setInvoiceDate={setInvoiceDate}
              hasDelivery={hasDelivery}
              setHasDelivery={setHasDelivery}
              deliveryFee={deliveryFee}
              setDeliveryFee={setDeliveryFee}
              discountType={discountType}
              setDiscountType={setDiscountType}
              discountValue={discountValue}
              setDiscountValue={setDiscountValue}
            />

            {/* Line Items Grid */}
            <Card className="p-4 sm:p-6 bg-card/60 backdrop-blur-md border-border shadow-xs space-y-4 min-w-0">
              <div className="flex justify-between items-center flex-wrap gap-2">
                <h3 className="text-xs sm:text-sm font-bold text-foreground uppercase tracking-wider">Line Items</h3>

                <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
                  <select
                    value={selectedBrandFilter}
                    onChange={(e) => setSelectedBrandFilter(e.target.value)}
                    className="flex h-8 rounded-md border border-input bg-card px-2.5 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-foreground flex-1 sm:flex-initial"
                  >
                    <option value="all">All Brands</option>
                    <option value="none">No Brand</option>
                    {brands.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>

                  <select
                    value={selectedCategoryFilter}
                    onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                    className="flex h-8 rounded-md border border-input bg-card px-2.5 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-foreground flex-1 sm:flex-initial"
                  >
                    <option value="all">All Categories</option>
                    <option value="none">No Category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const currentQties = {};
                      lineItems.forEach((item) => {
                        if (item.product_id) {
                          currentQties[item.product_id] = (currentQties[item.product_id] || 0) + parseQuantity(item.quantity);
                        }
                      });
                      setBatchQuantities(currentQties);
                      setBatchSearchQuery('');
                      setIsBatchModalOpen(true);
                    }}
                    className="h-8 text-xs gap-1.5 flex-1 sm:flex-initial"
                  >
                    <Grid className="w-3.5 h-3.5 text-primary" />
                    <span>Batch Add</span>
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addLineItem}
                    className="h-8 text-xs gap-1.5 flex-1 sm:flex-initial"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Item</span>
                  </Button>

                  {receiptTemplate === TEMPLATE_IDS.KHMER && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={loadSampleKhmerInvoice}
                      className="h-8 text-xs gap-1.5 flex-1 sm:flex-initial"
                      title="Load sample items matching the Khmer invoice reference"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Sample Data</span>
                    </Button>
                  )}
                </div>
              </div>

              <PosQuickSearchBar
                quickInputRef={quickInputRef}
                quickSearchQuery={quickSearchQuery}
                setQuickSearchQuery={setQuickSearchQuery}
                isQuickDropdownOpen={isQuickDropdownOpen}
                setIsQuickDropdownOpen={setIsQuickDropdownOpen}
                isScannerMode={isScannerMode}
                setIsScannerMode={setIsScannerMode}
                onBarcodeSubmit={handleBarcodeSubmit}
                onOpenBarcodeCamera={openBarcodeCamera}
                getFilteredProducts={getFilteredProducts}
                productSupplierPrices={productSupplierPrices}
                lineItems={lineItems}
                onAddProduct={addProductToInvoice}
              />

              <BarcodeScannerModal
                isCameraScannerOpen={isCameraScannerOpen}
                cameraVideoRef={cameraVideoRef}
                cameraScannerError={cameraScannerError}
                onClose={() => {
                  setIsCameraScannerOpen(false);
                  stopCameraScanner();
                }}
              />

              {/* Line Items Cards List */}
              <div className="space-y-4">
                {lineItems.map((item, idx) => (
                  <LineItemRow
                    key={item.id}
                    item={item}
                    idx={idx}
                    isLast={idx === lineItems.length - 1}
                    products={products}
                    suppliers={suppliers}
                    productSupplierPrices={productSupplierPrices}
                    getFilteredProducts={getFilteredProducts}
                    onUpdateItem={updateLineItem}
                    onSelectProduct={handleSelectProduct}
                    onRemoveItem={removeLineItem}
                    onMoveItem={moveLineItem}
                    onOpenSupplierPicker={openSupplierPicker}
                    onOpenStockEdit={openStockEditModal}
                    setLineItems={setLineItems}
                    createEmptyLineItem={createEmptyLineItem}
                  />
                ))}
              </div>
            </Card>
          </form>

          {/* Right Side: Total Summary & Checkout Actions (1 col) */}
          <CheckoutSummaryCard
            subtotal={subtotal}
            calculatedDiscount={calculatedDiscount}
            discountType={discountType}
            discountValue={discountValue}
            hasDelivery={hasDelivery}
            effectiveDeliveryFee={effectiveDeliveryFee}
            totalProfit={totalProfit}
            totalAmount={totalAmount}
            lineItems={lineItems}
            isSaving={isSaving}
            isExporting={isExporting}
            onPreviewReceipt={handlePreviewReceipt}
            onPrint={handlePrint}
            onDownloadImage={handleDownloadImage}
            onDownloadPdf={handleDownloadPdf}
            onSaveInvoice={handleSaveInvoice}
          />
        </div>
      </div>

      {/* Invoice Print & Image Preview Modal */}
      {receiptData && (
        <InvoicePreviewModal
          receiptData={receiptData}
          products={products}
          printableCardRef={printableCardRef}
          receiptTemplate={receiptTemplate}
          setReceiptTemplate={setReceiptTemplate}
          shopName={shopName}
          setShopName={setShopName}
          shopAddress={shopAddress}
          setShopAddress={setShopAddress}
          shopPhone={shopPhone}
          setShopPhone={setShopPhone}
          customFooter={customFooter}
          setCustomFooter={setCustomFooter}
          invoiceNumber={resolvedReceiptInvoiceNumber}
          onInvoiceNumberChange={updateModalInvoiceNumber}
          invoiceCustomerName={invoiceCustomerName}
          setInvoiceCustomerName={setInvoiceCustomerName}
          invoicePhone={invoicePhone}
          setInvoicePhone={setInvoicePhone}
          invoiceDate={invoiceDate}
          setInvoiceDate={setInvoiceDate}
          invoiceSettings={invoiceSettings}
          invoiceFontSize={invoiceFontSize}
          setInvoiceFontSize={setInvoiceFontSize}
          invoiceKhmerFont={invoiceKhmerFont}
          setInvoiceKhmerFont={setInvoiceKhmerFont}
          invoiceEnglishFont={invoiceEnglishFont}
          setInvoiceEnglishFont={setInvoiceEnglishFont}
          invoiceBorderThickness={invoiceBorderThickness}
          setInvoiceBorderThickness={setInvoiceBorderThickness}
          invoiceWidth={invoiceWidth}
          setInvoiceWidth={setInvoiceWidth}
          invoicePageSize={invoicePageSize}
          setInvoicePageSize={setInvoicePageSize}
          currencySymbol={currencySymbol}
          setCurrencySymbol={setCurrencySymbol}
          savedOrder={savedOrder}
          isExporting={isExporting}
          onDownloadImage={handleDownloadImage}
          onDownloadPdf={handleDownloadPdf}
          onPrint={handlePrint}
          onOpenThermalReceipt={() => setIsTextReceiptOpen(true)}
          onClose={() => {
            setSavedOrder(null);
            setPreviewOrder(null);
          }}
          onRegenerateInvoiceId={handleRegenerateInvoiceId}
        />
      )}

      {/* Hidden print layout for standard window.print() */}
      <PrintableReceiptLayout
        receiptData={receiptData}
        products={products}
        receiptTemplate={receiptTemplate}
        invoiceNumber={resolvedReceiptInvoiceNumber}
        invoiceDate={invoiceDate}
        customerName={resolvedReceiptCustomerName}
        phone={resolvedReceiptCustomerPhone}
        shopName={shopName}
        shopAddress={shopAddress}
        shopPhone={shopPhone}
        customFooter={customFooter}
        currencySymbol={currencySymbol}
        invoiceSettings={invoiceSettings}
        invoicePageSize={invoicePageSize}
        isDraft={activeReceiptIsDraft}
      />

      {receiptData && (
        <ThermalReceiptDialog
          open={isTextReceiptOpen}
          onOpenChange={setIsTextReceiptOpen}
          receiptText={createThermalReceiptText({
            receiptData,
            getItemName: (item) => {
              const product = products.find((entry) => String(entry.id) === String(item.product_id));
              return product?.name_kh || product?.name_en || item.custom_name || 'Item';
            },
            shopName,
            shopAddress,
            shopPhone,
            footer: customFooter,
            invoiceNumber: resolvedReceiptInvoiceNumber,
            invoiceDate: receiptTemplate === TEMPLATE_IDS.KHMER ? invoiceDate : '',
            customerName: receiptTemplate === TEMPLATE_IDS.KHMER ? (savedOrder ? (receiptData.customer?.name || '') : invoiceCustomerName) : '',
            customerPhone: receiptTemplate === TEMPLATE_IDS.KHMER ? (savedOrder ? (receiptData.customer?.phone || '') : invoicePhone) : '',
            currencySymbol,
            isDraft: activeReceiptIsDraft,
          })}
          onCopied={() => showToast('58 mm receipt copied. Paste it into your printer app.', 'success')}
        />
      )}

      {/* Batch Add Catalog Modal */}
      <BatchAddModal
        isOpen={isBatchModalOpen}
        brands={brands}
        categories={categories}
        productSupplierPrices={productSupplierPrices}
        batchSearchQuery={batchSearchQuery}
        batchQuantities={batchQuantities}
        selectedBrandFilter={selectedBrandFilter}
        selectedCategoryFilter={selectedCategoryFilter}
        getFilteredProducts={getFilteredProducts}
        setBatchSearchQuery={setBatchSearchQuery}
        setBatchQuantities={setBatchQuantities}
        setSelectedBrandFilter={setSelectedBrandFilter}
        setSelectedCategoryFilter={setSelectedCategoryFilter}
        onClose={() => setIsBatchModalOpen(false)}
        onApply={applyBatchItems}
      />

      {/* Mobile-Optimized Save to Photos / Share Image Modal */}
      <ImageExportModal
        imageExportModal={imageExportModal}
        onClose={closeImageExportModal}
      />

      {/* Mobile-Friendly Supplier Selector Dialog */}
      <SupplierPickerDialog
        supplierPickerModal={supplierPickerModal}
        productSupplierPrices={productSupplierPrices}
        suppliers={suppliers}
        setSupplierPickerModal={setSupplierPickerModal}
        onSelectSupplier={(itemIndex, supplierId) => updateLineItem(itemIndex, 'supplier_id', supplierId)}
        onOpenStockEdit={openStockEditModal}
      />

      {/* Quick Stock-In / Update Stock & Price Dialog */}
      <StockEditDialog
        stockEditModal={stockEditModal}
        editStockPrice={editStockPrice}
        editStockQty={editStockQty}
        editStockUnit={editStockUnit}
        isSavingStock={isSavingStock}
        setStockEditModal={setStockEditModal}
        setEditStockPrice={setEditStockPrice}
        setEditStockQty={setEditStockQty}
        setEditStockUnit={setEditStockUnit}
        onSave={handleSaveStockEdit}
      />
    </div>
  );
}
