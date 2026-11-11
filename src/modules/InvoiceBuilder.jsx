import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
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
  Camera,
  ImageIcon,
  Download,
  Share2,
  Cloud,
  FileText,
  PauseCircle,
  ChevronUp,
  ChevronDown,
  FileDown,
  Clock,
  Edit2,
  Check
} from 'lucide-react';
import { toPng, toJpeg } from 'html-to-image';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { db, getSupabaseConfig, generateDraftId } from '../services/db';
import confetti from 'canvas-confetti';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { OldReceiptTemplate, KhmerInvoiceTemplate } from './invoice/templates';
import ThermalReceiptDialog from '../components/ThermalReceiptDialog';
import {
  roundMoney,
  parseQuantity,
  formatStockInTime,
  TEMPLATE_IDS,
  TEMPLATE_OPTIONS,
  KHMER_FONTS,
  ENGLISH_FONTS,
  PAGE_SIZES,
  DEFAULT_INVOICE_SETTINGS,
  createSampleCustomLineItems,
  downloadPdfFromJpeg,
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
  custom_name: ''
});

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
    updated_at: now
  };
};

const normalizeDraftsInvoiceNumbers = (draftList = [], existingOrders = []) => {
  const knownIds = [
    ...draftList.map(d => d.invoice_number),
    ...(Array.isArray(existingOrders) ? existingOrders.map(o => o.invoice_number) : [])
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
  lineItems
}) => ({
  id,
  name,
  invoice_number: invoiceNumber,
  customer_id: customerId,
  has_delivery: hasDelivery,
  delivery_fee: deliveryFee,
  discount_type: discountType,
  discount_value: discountValue,
  line_items: lineItems.map(item => ({ ...item, isDropdownOpen: false }))
});

export default function InvoiceBuilder({ customers, products, suppliers, prices, orders = [], brands = [], categories = [], onRefresh, showToast }) {
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

  const [selectedBrandFilter, setSelectedBrandFilter] = useState('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [hasDelivery, setHasDelivery] = useState(true);
  const [deliveryFee, setDeliveryFee] = useState('1.50');
  const [discountType, setDiscountType] = useState('fixed');
  const [discountValue, setDiscountValue] = useState('0');

  // Receipt custom header states
  const [shopName, setShopName] = useState(() => localStorage.getItem('wsp_shop_name') || 'ស្រីពៅ លក់ចាប់ហួយ (Zeii Pov Shop)');
  const [shopAddress, setShopAddress] = useState(() => localStorage.getItem('wsp_shop_address') || 'ផ្សារអូរឫស្សី, ភ្នំពេញ');
  const [shopPhone, setShopPhone] = useState(() => localStorage.getItem('wsp_shop_phone') || '012 345 678');
  const [customFooter, setCustomFooter] = useState(() => localStorage.getItem('wsp_custom_footer') || 'សូមអរគុណ ចំពោះការគាំទ្រ! (Thank you for your support!)');

  // Template + Khmer invoice meta / formatting (persisted)
  const [receiptTemplate, setReceiptTemplate] = useState(() => {
    return localStorage.getItem('wsp_receipt_template') || DEFAULT_INVOICE_SETTINGS.template;
  });
  const [invoiceNumber, setInvoiceNumber] = useState(() => localStorage.getItem('wsp_invoice_number') || '');
  const [invoiceDate, setInvoiceDate] = useState(() => {
    const saved = localStorage.getItem('wsp_invoice_date');
    if (saved) return saved;
    return new Date().toISOString().slice(0, 10);
  });
  const [invoiceCustomerName, setInvoiceCustomerName] = useState('');
  const [invoicePhone, setInvoicePhone] = useState('');
  const [invoiceFontSize, setInvoiceFontSize] = useState(() => Number(localStorage.getItem('wsp_invoice_font_size')) || DEFAULT_INVOICE_SETTINGS.fontSize);
  const [invoiceKhmerFont, setInvoiceKhmerFont] = useState(() => localStorage.getItem('wsp_invoice_khmer_font') || DEFAULT_INVOICE_SETTINGS.khmerFont);
  const [invoiceEnglishFont, setInvoiceEnglishFont] = useState(() => localStorage.getItem('wsp_invoice_english_font') || DEFAULT_INVOICE_SETTINGS.englishFont);
  const [invoiceBorderThickness, setInvoiceBorderThickness] = useState(() => Number(localStorage.getItem('wsp_invoice_border')) || DEFAULT_INVOICE_SETTINGS.borderThickness);
  const [invoiceWidth, setInvoiceWidth] = useState(() => Number(localStorage.getItem('wsp_invoice_width')) || DEFAULT_INVOICE_SETTINGS.invoiceWidth);
  const [invoicePageSize, setInvoicePageSize] = useState(() => localStorage.getItem('wsp_invoice_page_size') || DEFAULT_INVOICE_SETTINGS.pageSize);
  const [currencySymbol, setCurrencySymbol] = useState(() => localStorage.getItem('wsp_currency_symbol') || DEFAULT_INVOICE_SETTINGS.currencySymbol);

  const invoiceSettings = {
    fontSize: invoiceFontSize,
    khmerFont: invoiceKhmerFont,
    englishFont: invoiceEnglishFont,
    borderThickness: invoiceBorderThickness,
    invoiceWidth,
    pageSize: invoicePageSize,
    currencySymbol
  };

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
  useEffect(() => {
    localStorage.setItem('wsp_receipt_template', receiptTemplate);
  }, [receiptTemplate]);
  useEffect(() => {
    localStorage.setItem('wsp_invoice_number', invoiceNumber);
  }, [invoiceNumber]);
  useEffect(() => {
    localStorage.setItem('wsp_invoice_date', invoiceDate);
  }, [invoiceDate]);
  useEffect(() => {
    localStorage.setItem('wsp_invoice_font_size', String(invoiceFontSize));
  }, [invoiceFontSize]);
  useEffect(() => {
    localStorage.setItem('wsp_invoice_khmer_font', invoiceKhmerFont);
  }, [invoiceKhmerFont]);
  useEffect(() => {
    localStorage.setItem('wsp_invoice_english_font', invoiceEnglishFont);
  }, [invoiceEnglishFont]);
  useEffect(() => {
    localStorage.setItem('wsp_invoice_border', String(invoiceBorderThickness));
  }, [invoiceBorderThickness]);
  useEffect(() => {
    localStorage.setItem('wsp_invoice_width', String(invoiceWidth));
  }, [invoiceWidth]);
  useEffect(() => {
    localStorage.setItem('wsp_invoice_page_size', invoicePageSize);
  }, [invoicePageSize]);
  useEffect(() => {
    localStorage.setItem('wsp_currency_symbol', currencySymbol);
  }, [currencySymbol]);

  const [lineItems, setLineItems] = useState([createEmptyLineItem()]);

  const [isSaving, setIsSaving] = useState(false);
  const [savedOrder, setSavedOrder] = useState(null); // Saved order details for print receipt preview modal
  const [previewOrder, setPreviewOrder] = useState(null); // Draft preview receipt details

  // Image Export State & Refs
  const printableCardRef = useRef(null);
  const [isExporting, setIsExporting] = useState(false);
  const [imageExportModal, setImageExportModal] = useState(null);
  const [isTextReceiptOpen, setIsTextReceiptOpen] = useState(false);

  // POS Quick Add States
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

  // Batch Add Catalog Modal States
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [batchSearchQuery, setBatchSearchQuery] = useState('');
  const [batchQuantities, setBatchQuantities] = useState({}); // { product_id: quantity }

  // Supplier & Stock In Mobile Picker and Quick Edit States
  const [supplierPickerModal, setSupplierPickerModal] = useState(null); // { itemIndex, product, currentSupplierId }
  const [stockEditModal, setStockEditModal] = useState(null); // { itemIndex, product, supplier, priceObj }
  const [editStockPrice, setEditStockPrice] = useState('');
  const [editStockQty, setEditStockQty] = useState('');
  const [editStockUnit, setEditStockUnit] = useState('pcs');
  const [isSavingStock, setIsSavingStock] = useState(false);

  const collectKnownInvoiceIds = (extraIds = []) => [
    ...drafts.map(d => d.invoice_number),
    ...(Array.isArray(orders) ? orders.map(o => o.invoice_number) : []),
    invoiceNumber,
    ...extraIds
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
    lineItems
  });

  const applyDraftToForm = (draft, extraExistingIds = []) => {
    const resolvedInvoiceNumber =
      String(draft.invoice_number || '').trim() ||
      generateInvoiceId(collectKnownInvoiceIds(extraExistingIds));

    setDraftName(draft.name || 'Order #1');
    setInvoiceNumber(resolvedInvoiceNumber);
    setSelectedCustomerId(draft.customer_id || '');
    const draftCustomer = customers.find(c => String(c.id) === String(draft.customer_id));
    setInvoiceCustomerName(draftCustomer?.name || '');
    setInvoicePhone(draftCustomer?.phone || '');
    setHasDelivery(draft.has_delivery !== false);
    setDeliveryFee(draft.delivery_fee !== undefined && draft.delivery_fee !== null ? String(draft.delivery_fee) : '1.50');
    setDiscountType(draft.discount_type || 'fixed');
    setDiscountValue(draft.discount_value !== undefined && draft.discount_value !== null ? String(draft.discount_value) : '0');
    let loadedItems = Array.isArray(draft.line_items) && draft.line_items.length > 0
      ? draft.line_items
      : [createEmptyLineItem()];
    const lastItem = loadedItems[loadedItems.length - 1];
    if (lastItem && (lastItem.product_id || (lastItem.isCustom && lastItem.custom_name))) {
      loadedItems = [...loadedItems, createEmptyLineItem()];
    }
    setLineItems(loadedItems);
    return resolvedInvoiceNumber;
  };

  // 1. Initial load of drafts from Supabase (or LocalStorage fallback)
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
          const target = normalized.find(d => d.id === savedActiveId) || normalized[0];
          setActiveDraftId(target.id);
          applyDraftToForm(target, normalized.map(d => d.invoice_number));
          // Persist newly generated invoice IDs for any legacy drafts without one
          const originalTarget = fetched.find(d => d.id === target.id);
          if (originalTarget && !String(originalTarget.invoice_number || '').trim()) {
            db.saveDraft(target).catch(() => {});
          }
        }
      } catch (err) {
        console.error("Failed to load drafts:", err);
      } finally {
        if (isMounted) {
          setTimeout(() => {
            isInitialLoadRef.current = false;
          }, 200);
        }
      }
    };

    initDrafts();

    // Listen to tab storage sync on same device
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

    // Listen to window focus for cross-device updates
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

    // Supabase Realtime channel subscription
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

    const currentPayload = createDraftPayload({
      id: activeDraftId,
      name: draftName,
      invoiceNumber,
      customerId: selectedCustomerId,
      hasDelivery,
      deliveryFee,
      discountType,
      discountValue,
      lineItems
    });

    // Update in-memory draft immediately so tab labels/totals update smoothly
    setDrafts(prev => {
      const idx = prev.findIndex(d => d.id === activeDraftId);
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
        console.warn("Auto-save draft error:", e);
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
    showToast(`Generated new Invoice ID: ${nextId}`, "success");
  };

  // Draft Management Handlers
  const handleSwitchDraft = async (targetDraftId) => {
    if (targetDraftId === activeDraftId) return;

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    // Save current active draft immediately before switching
    if (activeDraftId) {
      const currentPayload = buildCurrentDraftPayload();
      try {
        await db.saveDraft(currentPayload);
      } catch (err) {
        console.debug(err);
      }
    }

    const target = drafts.find(d => d.id === targetDraftId);
    if (target) {
      setActiveDraftId(targetDraftId);
      localStorage.setItem('wsp_active_draft_id', targetDraftId);
      applyDraftToForm(target);
      showToast(`Switched to "${target.name || 'Draft Order'}"`, "info");
    }
  };

  const handleNewDraft = async () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    // Save current active draft first
    if (activeDraftId) {
      const currentPayload = buildCurrentDraftPayload();
      try {
        await db.saveDraft(currentPayload);
      } catch (err) {
        console.debug(err);
      }
    }

    const knownIds = collectKnownInvoiceIds();
    const newDraft = createEmptyDraft(`Order #${drafts.length + 1}`, knownIds);

    try {
      setIsSyncingDraft(true);
      await db.saveDraft(newDraft);
      setDrafts(prev => [newDraft, ...prev]);
      setActiveDraftId(newDraft.id);
      localStorage.setItem('wsp_active_draft_id', newDraft.id);
      applyDraftToForm(newDraft, knownIds);
      showToast(`Started new invoice ${newDraft.invoice_number}`, "success");
    } catch (err) {
      showToast("Error creating draft: " + err.message, "error");
    } finally {
      setIsSyncingDraft(false);
    }
  };

  const handleDeleteDraft = async (draftIdToDelete) => {
    const draftToDelete = drafts.find(d => d.id === draftIdToDelete);
    const itemsInDraft = draftToDelete?.line_items?.filter(i => (i.product_id || (i.isCustom && i.custom_name)) && parseQuantity(i.quantity) > 0) || [];

    if (itemsInDraft.length > 0) {
      const confirmDelete = window.confirm(`Discard "${draftToDelete?.name || 'this draft'}" with ${itemsInDraft.length} items?`);
      if (!confirmDelete) return;
    }

    try {
      await db.deleteDraft(draftIdToDelete);
      const remainingDrafts = drafts.filter(d => d.id !== draftIdToDelete);

      if (remainingDrafts.length > 0) {
        setDrafts(remainingDrafts);
        if (draftIdToDelete === activeDraftId) {
          const nextDraft = remainingDrafts[0];
          setActiveDraftId(nextDraft.id);
          localStorage.setItem('wsp_active_draft_id', nextDraft.id);
          applyDraftToForm(nextDraft);
        }
      } else {
        const knownIds = collectKnownInvoiceIds();
        const freshDraft = createEmptyDraft('Order #1', knownIds);
        await db.saveDraft(freshDraft);
        setDrafts([freshDraft]);
        setActiveDraftId(freshDraft.id);
        localStorage.setItem('wsp_active_draft_id', freshDraft.id);
        applyDraftToForm(freshDraft, knownIds);
      }
      showToast("Draft removed", "info");
    } catch (err) {
      showToast("Error deleting draft: " + err.message, "error");
    }
  };

  const handleManualSync = async () => {
    setIsSyncingDraft(true);
    try {
      const updated = await db.getDrafts();
      if (Array.isArray(updated) && updated.length > 0) {
        const normalized = normalizeDraftsInvoiceNumbers(updated, orders);
        setDrafts(normalized);
        const current = normalized.find(d => d.id === activeDraftId) || normalized[0];
        if (current && current.id !== activeDraftId) {
          setActiveDraftId(current.id);
          applyDraftToForm(current, normalized.map(d => d.invoice_number));
        }
        showToast("Drafts synchronized!", "success");
      }
    } catch (err) {
      showToast("Sync failed: " + err.message, "error");
    } finally {
      setIsSyncingDraft(false);
    }
  };


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

  const normalizeBarcode = (value = '') => String(value ?? '').trim().replace(/\s+/g, '');

  const getFilteredProducts = (query) => {
    return products.filter(p => {
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

  const findProductByBarcode = (query) => {
    const normalizedQuery = normalizeBarcode(query);
    if (!normalizedQuery) return null;
    return products.find((p) => normalizeBarcode(p.barcode || '') === normalizedQuery) || null;
  };

  const handleBarcodeSubmit = (overrideValue) => {
    const rawVal = overrideValue !== undefined ? overrideValue : quickSearchQuery;
    const value = String(rawVal ?? '').trim();
    if (!value) return;

    const now = Date.now();
    const sameRecentBarcode = value === lastProcessedBarcodeRef.current.code
      && now - lastProcessedBarcodeRef.current.timestamp < 1200;

    if (sameRecentBarcode) {
      // Quietly ignore rapid duplicate scans of the same barcode within 1.2s to prevent loop-adds
      setQuickSearchQuery('');
      if (quickInputRef.current) quickInputRef.current.value = '';
      return;
    }

    if (barcodeSubmittingRef.current) return;
    barcodeSubmittingRef.current = true;

    // Immediately clear input fields so subsequent events start fresh
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
            if (!active || sessionId !== barcodeSessionIdRef.current) {
              return;
            }

            if (result) {
              const scannedCode = result.getText()?.trim();
              if (!scannedCode) return;

              if (barcodeScanLockRef.current) {
                return;
              }

              barcodeScanLockRef.current = true;
              lastScannedCodeRef.current = scannedCode;

              // Immediately close modal and stop camera decoding
              setIsCameraScannerOpen(false);
              stopCameraScanner();

              // Submit product
              handleBarcodeSubmit(scannedCode);

              // Release lock after cooldown
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

        // If user closed modal while awaiting camera permission
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

    // Small delay ensures video element is mounted in DOM before accessing
    const timer = setTimeout(() => {
      startScanning();
    }, 100);

    return () => {
      active = false;
      clearTimeout(timer);
      stopCameraScanner();
    };
  }, [isCameraScannerOpen]);

  // Calculate row details
  const updateLineItem = (index, field, value) => {
    const updated = [...lineItems];
    const item = { ...updated[index] };
    if (!item) return;
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

      if (value) {
        // Automatically add a new empty row at the bottom if none exists
        const last = updated[updated.length - 1];
        const isLastEmpty = last && !last.product_id && !(last.isCustom && last.custom_name);
        if (!isLastEmpty) {
          updated.push(createEmptyLineItem());
        }
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
    updated[index] = item;
    setLineItems(updated);
  };

  const handleSelectProduct = (index, product) => {
    setLineItems(prevItems => {
      const updated = [...prevItems];
      const item = updated[index] ? { ...updated[index] } : createEmptyLineItem();
      const sps = productSupplierPrices[product.id] || [];
      const customSellingPrice = product.selling_price && Number(product.selling_price) > 0 ? Number(product.selling_price) : null;

      item.product_id = product.id;
      item.searchQuery = `${product.name_kh} (${product.name_en})`;
      item.isDropdownOpen = false;
      item.isCustom = false;
      item.custom_name = '';

      if (sps.length > 0) {
        const sortedSpsCheapest = [...sps].sort((a, b) => a.price - b.price);
        const cheapest = sortedSpsCheapest[0];
        const sortedSpsHighest = [...sps].sort((a, b) => b.price - a.price);
        const highest = sortedSpsHighest[0];

        item.supplier_id = cheapest.supplier_id;
        item.supplier_price = cheapest.price;
        item.unit_price = customSellingPrice !== null ? customSellingPrice : roundMoney(highest.price + 0.20);
        item.maxStock = cheapest.stock_qty;
        item.stockUnit = cheapest.stock_unit;
      } else {
        item.supplier_id = '';
        item.supplier_price = product.base_price || 0;
        item.unit_price = customSellingPrice !== null ? customSellingPrice : roundMoney((product.base_price || 0) + 0.20);
        item.maxStock = 0;
        item.stockUnit = 'pcs';
      }

      const qty = parseQuantity(item.quantity) || 1;
      item.quantity = qty;
      item.subtotal = roundMoney(Number(item.unit_price || 0) * qty);
      updated[index] = item;

      // Automatically add a new empty row at the bottom so the user never needs to click "+ Add Item"
      const last = updated[updated.length - 1];
      const isLastEmpty = last && !last.product_id && !(last.isCustom && last.custom_name);
      if (!isLastEmpty) {
        updated.push(createEmptyLineItem());
      }

      return updated;
    });
  };

  const openSupplierPicker = (itemIndex) => {
    const item = lineItems[itemIndex];
    if (!item || !item.product_id) return;
    const prod = products.find(p => p.id === item.product_id);
    if (!prod) return;
    setSupplierPickerModal({
      itemIndex,
      product: prod,
      currentSupplierId: item.supplier_id
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
        stock_unit: 'pcs'
      }
    });
    setEditStockPrice(priceObj && priceObj.price > 0 ? priceObj.price.toString() : (product.base_price ? product.base_price.toString() : '0'));
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
        stock_unit: editStockUnit || 'pcs'
      };

      await db.updateSupplierPrice(payload);
      showToast(`Stock & price updated for ${stockEditModal.supplier.name}!`, "success");

      // Update active line item if triggered from one
      if (stockEditModal.itemIndex !== null && stockEditModal.itemIndex !== undefined) {
        const updated = [...lineItems];
        const targetItem = updated[stockEditModal.itemIndex];
        if (targetItem && targetItem.product_id === stockEditModal.product.id) {
          targetItem.supplier_id = stockEditModal.supplier.id;
          targetItem.supplier_price = priceVal;
          targetItem.maxStock = stockVal;
          targetItem.stockUnit = editStockUnit || 'pcs';

          const customSellingPrice = stockEditModal.product.selling_price && Number(stockEditModal.product.selling_price) > 0 
            ? Number(stockEditModal.product.selling_price) 
            : null;
          if (customSellingPrice === null) {
            targetItem.unit_price = roundMoney(priceVal + 0.20);
          }
          targetItem.subtotal = roundMoney(Number(targetItem.unit_price || 0) * parseQuantity(targetItem.quantity));
          setLineItems(updated);
        }
      }

      if (onRefresh) {
        await onRefresh();
      }

      setStockEditModal(null);
    } catch (err) {
      showToast("Error updating stock: " + err.message, "error");
    } finally {
      setIsSavingStock(false);
    }
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
    if (updated.length === 0) {
      setLineItems([createEmptyLineItem()]);
    } else {
      const last = updated[updated.length - 1];
      const isLastEmpty = last && !last.product_id && !(last.isCustom && last.custom_name);
      if (!isLastEmpty) {
        setLineItems([...updated, createEmptyLineItem()]);
      } else {
        setLineItems(updated);
      }
    }
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

        // Auto ensure an empty item exists at the end
        const last = updated[updated.length - 1];
        const isLastEmpty = last && !last.product_id && !(last.isCustom && last.custom_name);
        if (!isLastEmpty) {
          updated.push(createEmptyLineItem());
        }
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
          isDropdownOpen: false,
          isCustom: false,
          custom_name: ''
        };

        const nonBlank = prevItems.filter(item => item.product_id || (item.isCustom && item.custom_name));
        return [...nonBlank, newItem, createEmptyLineItem()];
      }
    });
  };

  // Calculations with money precision rounding
  const subtotal = roundMoney(lineItems.reduce((sum, item) => {
    if (!item.product_id && !(item.isCustom && item.custom_name)) return sum;
    return sum + roundMoney(Number(item.unit_price || 0) * parseQuantity(item.quantity));
  }, 0));

  const parsedDiscountVal = parseQuantity(discountValue);
  const calculatedDiscount = discountType === 'percent'
    ? roundMoney((subtotal * Math.min(100, parsedDiscountVal)) / 100)
    : roundMoney(Math.min(subtotal, parsedDiscountVal));

  const effectiveDeliveryFee = hasDelivery ? Number(deliveryFee || 0) : 0;
  const totalAmount = roundMoney(Math.max(0, subtotal - calculatedDiscount) + effectiveDeliveryFee);

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
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }

      const finalInvoiceNumber = String(invoiceNumber || '').trim() || generateInvoiceId(collectKnownInvoiceIds());
      const orderObj = {
        invoice_number: finalInvoiceNumber,
        customer_id: selectedCustomerId,
        delivery_fee: effectiveDeliveryFee,
        discount: calculatedDiscount,
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
        order: {
          ...result,
          invoice_number: result.invoice_number || finalInvoiceNumber,
          discount: calculatedDiscount,
          delivery_fee: effectiveDeliveryFee
        },
        items: sanitizedItems,
        customer: customers.find(c => c.id === selectedCustomerId)
      });

      // Delete completed draft from database & localStorage
      if (activeDraftId) {
        try {
          await db.deleteDraft(activeDraftId);
        } catch (delErr) {
          console.warn("Could not delete completed draft:", delErr);
        }
      }

      const remainingDrafts = drafts.filter(d => d.id !== activeDraftId);
      if (remainingDrafts.length > 0) {
        setDrafts(remainingDrafts);
        const next = remainingDrafts[0];
        setActiveDraftId(next.id);
        localStorage.setItem('wsp_active_draft_id', next.id);
        applyDraftToForm(next, [finalInvoiceNumber]);
      } else {
        const knownIds = collectKnownInvoiceIds([finalInvoiceNumber]);
        const freshDraft = createEmptyDraft('Order #1', knownIds);
        await db.saveDraft(freshDraft);
        setDrafts([freshDraft]);
        setActiveDraftId(freshDraft.id);
        localStorage.setItem('wsp_active_draft_id', freshDraft.id);
        applyDraftToForm(freshDraft, knownIds);
      }
      showToast(`Invoice ${finalInvoiceNumber} saved successfully!`, "success");
    } catch (err) {
      showToast("Error creating order: " + err.message, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePreviewReceipt = () => {
    const customer = customers.find(c => c.id === selectedCustomerId);
    const activeItems = lineItems.filter(item => (item.product_id || (item.isCustom && item.custom_name)) && parseQuantity(item.quantity) > 0);

    if (activeItems.length === 0) {
      showToast("Please add at least one item with valid quantity to preview.", "warning");
      return;
    }

    const calcSubtotal = activeItems.reduce((sum, item) => sum + roundMoney(Number(item.unit_price || 0) * parseQuantity(item.quantity)), 0);
    const calcTotalAmount = roundMoney(Math.max(0, calcSubtotal - calculatedDiscount) + effectiveDeliveryFee);

    const resolvedCustomer = {
      name: invoiceCustomerName || customer?.name || 'Walk-in Customer',
      location_note: customer?.location_note || 'General Delivery',
      phone: invoicePhone || customer?.phone || ''
    };

    const orderedAt = invoiceDate
      ? new Date(`${invoiceDate}T12:00:00`).toISOString()
      : new Date().toISOString();

    const draftOrder = {
      order: {
        id: 'DRAFT_PREVIEW_' + Date.now().toString().slice(-4),
        delivery_fee: effectiveDeliveryFee,
        discount: calculatedDiscount,
        total_amount: calcTotalAmount,
        ordered_at: orderedAt,
        invoice_number: invoiceNumber
      },
      customer: resolvedCustomer,
      items: activeItems.map(item => ({
        id: item.id,
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

  const handlePrint = () => {
    if (!savedOrder && !previewOrder) {
      const activeItems = lineItems.filter(item => (item.product_id || (item.isCustom && item.custom_name)) && parseQuantity(item.quantity) > 0);
      if (activeItems.length === 0) {
        showToast("Please add at least one item with valid quantity to print.", "warning");
        return;
      }
      handlePreviewReceipt();
      setTimeout(() => window.print(), 250);
      return;
    }
    window.print();
  };

  const getExportWidth = () => {
    if (receiptTemplate === TEMPLATE_IDS.KHMER) {
      return Math.max(480, Number(invoiceWidth) || PAGE_SIZES.A4.widthPx);
    }
    return 460;
  };

  const buildExportFilename = (ext) => {
    const receiptData = savedOrder || previewOrder;
    const customer = receiptData?.customer || customers.find(c => c.id === selectedCustomerId);
    const nameSource = (!savedOrder ? invoiceCustomerName : '') || customer?.name || 'Customer';
    const safeName = nameSource.replace(/[^a-zA-Z0-9_\-\u0600-\u06FF\u1780-\u17FF]/g, '_');
    const idSource = String(receiptData?.order?.invoice_number || (!savedOrder ? invoiceNumber : '') || '').replace(/[^a-zA-Z0-9_-]/g, '');
    const suffix = idSource || new Date().toISOString().slice(0, 10);
    return `Invoice_${suffix}_${safeName}.${ext}`;
  };

  // Wait for Google Fonts to be ready so Khmer glyphs render in captures
  const waitForFonts = async () => {
    try {
      if (document.fonts?.ready) {
        await document.fonts.ready;
      }
    } catch {
      /* ignore */
    }
    await new Promise((r) => setTimeout(r, 80));
  };

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
    await new Promise(r => setTimeout(r, 150));
    await waitForFonts();

    try {
      const node = printableCardRef.current;
      if (!node) {
        throw new Error("Invoice template container element not found");
      }

      const exportWidth = getExportWidth();
      const options = {
        quality: 0.98,
        pixelRatio: 3,
        backgroundColor: '#ffffff',
        cacheBust: true,
        style: {
          margin: '0',
          transform: 'none',
          boxShadow: 'none',
          maxWidth: 'none',
          width: `${exportWidth}px`
        }
      };

      const dataUrl = format === 'jpeg' ? await toJpeg(node, options) : await toPng(node, options);
      const filename = buildExportFilename(format);

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
            text: `Wholesale Invoice - ${filename}`
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

  const handleDownloadPdf = async () => {
    if (isExporting) return;

    const activeItems = lineItems.filter(item => (item.product_id || (item.isCustom && item.custom_name)) && parseQuantity(item.quantity) > 0);
    if (activeItems.length === 0 && !savedOrder && !previewOrder) {
      showToast("Please add at least one valid product or item to export.", "warning");
      return;
    }

    if (!savedOrder && !previewOrder) {
      handlePreviewReceipt();
    }

    setIsExporting(true);
    await new Promise((r) => setTimeout(r, 150));
    await waitForFonts();

    try {
      const node = printableCardRef.current;
      if (!node) throw new Error("Invoice template container element not found");

      const exportWidth = getExportWidth();
      const jpegUrl = await toJpeg(node, {
        quality: 0.95,
        pixelRatio: 3,
        backgroundColor: '#ffffff',
        cacheBust: true,
        style: {
          margin: '0',
          transform: 'none',
          boxShadow: 'none',
          maxWidth: 'none',
          width: `${exportWidth}px`
        }
      });

      const page = PAGE_SIZES[invoicePageSize] || PAGE_SIZES.A4;
      const filename = buildExportFilename('pdf');
      await downloadPdfFromJpeg(jpegUrl, filename, page);
      showToast("Invoice PDF downloaded.", "success");
    } catch (err) {
      console.error("Export PDF error:", err);
      showToast("Failed to generate PDF: " + err.message, "error");
    } finally {
      setIsExporting(false);
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

          {/* Template picker + export */}
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
        <Card className="p-3.5 sm:p-4 bg-card/70 backdrop-blur-md border-border shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-foreground uppercase tracking-wider">
                <FileText className="w-4 h-4 text-primary" />
                <span>Open Drafts ({drafts.length})</span>
              </div>

              {/* Cloud Sync Status Badge */}
              {isCloudActive ? (
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 gap-1.5 text-[11px] py-0.5 px-2 font-medium">
                  {isSyncingDraft ? (
                    <>
                      <RefreshCw className="w-3 h-3 animate-spin text-emerald-400" />
                      <span>Syncing...</span>
                    </>
                  ) : (
                    <>
                      <Cloud className="w-3 h-3 text-emerald-400" />
                      <span className="hidden sm:inline">Cloud Synced (Multi-Device)</span>
                      <span className="sm:hidden">Online</span>
                    </>
                  )}
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30 gap-1 text-[11px] py-0.5 px-2 font-medium">
                  <span>Local Drafts</span>
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleManualSync}
                disabled={isSyncingDraft}
                className="h-8 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
                title="Refresh drafts from cloud and other devices"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncingDraft ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </Button>

              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={handleNewDraft}
                className="h-8 text-xs gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-xs"
                title="Hold current invoice and start a new invoice with a new Invoice ID"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Invoice</span>
              </Button>
            </div>
          </div>

          {/* Draft Tabs Strip */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 scrollbar-thin scrollbar-thumb-muted">
            {drafts.map((d, index) => {
              const isActive = d.id === activeDraftId;
              const cust = customers.find(c => c.id === d.customer_id);
              const itemCount = (d.line_items || []).filter(i => (i.product_id || (i.isCustom && i.custom_name)) && parseQuantity(i.quantity) > 0).length;
              const draftSubtotal = (d.line_items || []).reduce((sum, i) => sum + roundMoney(Number(i.unit_price || 0) * parseQuantity(i.quantity)), 0);
              const displayLabel = d.name || (cust ? cust.name : `Order #${index + 1}`);
              const draftInvNo = isActive ? invoiceNumber : d.invoice_number;

              return (
                <div
                  key={d.id}
                  className={`group flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all border shrink-0 ${isActive
                      ? 'bg-primary/15 border-primary/60 text-foreground shadow-xs ring-1 ring-primary/30'
                      : 'bg-muted/40 hover:bg-muted/80 border-border text-muted-foreground hover:text-foreground'
                    }`}
                  onClick={() => {
                    if (!isActive) handleSwitchDraft(d.id);
                  }}
                  title={`Switch to ${displayLabel}${draftInvNo ? ` (${draftInvNo})` : ''} (${itemCount} items • $${draftSubtotal.toFixed(2)})`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-primary' : 'bg-muted-foreground/40'}`} />
                    <span className="font-semibold max-w-[130px] truncate">{displayLabel}</span>
                    {draftInvNo && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-background/70 border border-border/70 text-muted-foreground">
                        {draftInvNo}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <span>•</span>
                    <span>{itemCount} {itemCount === 1 ? 'item' : 'items'}</span>
                    <span>•</span>
                    <span className="font-semibold text-foreground">${draftSubtotal.toFixed(2)}</span>
                  </div>

                  {drafts.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteDraft(d.id);
                      }}
                      className="ml-1 p-0.5 rounded text-muted-foreground/50 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      title="Discard this draft"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Side: Invoice Items Builder (2 cols) */}
          <form onSubmit={handleSaveInvoice} className="lg:col-span-2 space-y-6 min-w-0">
            <Card className="p-4 sm:p-6 bg-card/60 backdrop-blur-md border-border shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs sm:text-sm font-bold text-foreground uppercase tracking-wider">Invoice Header</h3>
                  <Badge variant="outline" className="text-[11px] text-muted-foreground border-border bg-muted/30">
                    {draftName || 'Order'}
                  </Badge>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">Draft Label:</span>
                  <Input
                    type="text"
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    placeholder="e.g. Table 2, Phone order..."
                    className="h-7 text-xs w-36 sm:w-44 bg-card border-input"
                    title="Customize label for this draft order"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleNewDraft}
                    className="h-7 text-xs px-2.5 gap-1 text-muted-foreground hover:text-foreground"
                    title="Park current invoice and start a new invoice with a fresh ID"
                  >
                    <PauseCircle className="w-3 h-3 text-amber-400" />
                    <span className="hidden sm:inline">Hold & New</span>
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Customer *</label>
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
                          setInvoiceCustomerName(customer.name || '');
                          setInvoicePhone(customer.phone || '');
                        }
                      }
                    }}
                    className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-foreground"
                  >
                    <option value="">-- Choose Customer --</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ''}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Invoice ID</label>
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="text"
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                      placeholder="INV-261111-001"
                      className="h-9 text-xs font-mono font-semibold"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={handleRegenerateInvoiceId}
                      className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
                      title="Generate a new Invoice ID"
                      aria-label="Generate a new Invoice ID"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {receiptTemplate === TEMPLATE_IDS.KHMER && (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Customer Name (Invoice)</label>
                      <Input
                        type="text"
                        value={invoiceCustomerName}
                        onChange={(e) => setInvoiceCustomerName(e.target.value)}
                        placeholder="អតិថិជន"
                        className="h-9 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Phone (Invoice)</label>
                      <Input
                        type="text"
                        value={invoicePhone}
                        onChange={(e) => setInvoicePhone(e.target.value)}
                        placeholder="លេខទូរស័ព្ទ"
                        className="h-9 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Invoice Date</label>
                      <Input
                        type="date"
                        value={invoiceDate}
                        onChange={(e) => setInvoiceDate(e.target.value)}
                        className="h-9 text-xs"
                      />
                    </div>
                  </>
                )}

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Delivery
                    </label>
                    <div className="flex items-center gap-1 bg-muted p-0.5 rounded-md border border-border">
                      <button
                        type="button"
                        onClick={() => setHasDelivery(false)}
                        className={`px-2 py-0.5 text-[10px] font-bold rounded transition-colors cursor-pointer ${!hasDelivery
                            ? 'bg-primary text-primary-foreground shadow-xs'
                            : 'text-muted-foreground hover:text-foreground'
                          }`}
                        title="No delivery fee (Pickup / In-store)"
                      >
                        No Delivery
                      </button>
                      <button
                        type="button"
                        onClick={() => setHasDelivery(true)}
                        className={`px-2 py-0.5 text-[10px] font-bold rounded transition-colors cursor-pointer ${hasDelivery
                            ? 'bg-primary text-primary-foreground shadow-xs'
                            : 'text-muted-foreground hover:text-foreground'
                          }`}
                        title="Include delivery fee"
                      >
                        Delivery
                      </button>
                    </div>
                  </div>
                  {hasDelivery ? (
                    <div className="relative animate-in fade-in duration-150">
                      <Truck className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-primary" />
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={deliveryFee}
                        onChange={(e) => setDeliveryFee(e.target.value)}
                        className="pl-9 h-9 text-xs"
                        placeholder="1.50"
                      />
                    </div>
                  ) : (
                    <div
                      onClick={() => setHasDelivery(true)}
                      className="h-9 px-3 border border-dashed border-border rounded-md bg-muted/30 text-muted-foreground text-xs flex items-center justify-between cursor-pointer hover:border-primary/40 hover:text-foreground transition-colors select-none"
                      title="Click to enable delivery option"
                    >
                      <span className="flex items-center gap-1.5">
                        <Truck className="w-3.5 h-3.5 opacity-40" />
                        <span>Pickup / In-Store</span>
                      </span>
                      <span className="font-mono text-[11px] font-semibold text-emerald-500">$0.00</span>
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">Discount</label>
                    <div className="flex items-center gap-1 bg-muted p-0.5 rounded-md border border-border">
                      <button
                        type="button"
                        onClick={() => setDiscountType('fixed')}
                        className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${discountType === 'fixed' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                      >
                        $
                      </button>
                      <button
                        type="button"
                        onClick={() => setDiscountType('percent')}
                        className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${discountType === 'percent' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                      >
                        %
                      </button>
                    </div>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-semibold">
                      {discountType === 'fixed' ? '$' : '%'}
                    </span>
                    <Input
                      type="number"
                      step="any"
                      min="0"
                      value={discountValue}
                      onChange={(e) => setDiscountValue(e.target.value)}
                      className="pl-8 h-9 text-xs font-semibold"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>
            </Card>

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
                    {brands.map(b => (
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
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
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

              {/* POS-Style Quick Search & Add Bar */}
              <div className={`relative z-30 ${isScannerMode ? 'sm:sticky sm:top-2' : ''}`}>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-dark-500" />
                    <input
                      ref={quickInputRef}
                      type="text"
                      inputMode="numeric"
                      placeholder={isScannerMode ? 'Scan barcode or type product name…' : '⚡ POS Quick Search & Add Product...'}
                      value={quickSearchQuery}
                      onChange={(e) => {
                        setQuickSearchQuery(e.target.value);
                        setIsQuickDropdownOpen(true);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (e.repeat) return;
                          handleBarcodeSubmit(e.target.value);
                        }
                      }}
                      onFocus={() => setIsQuickDropdownOpen(true)}
                      onBlur={() => {
                        setTimeout(() => setIsQuickDropdownOpen(false), 200);
                      }}
                      className={`w-full pl-11 pr-10 glass-input min-h-[44px] text-xs sm:text-sm font-medium border-primary-500/20 focus:border-primary-500/50 shadow-inner ${isScannerMode ? 'sm:min-h-[52px] text-sm' : ''}`}
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

                  <Button
                    type="button"
                    variant={isScannerMode ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setIsScannerMode((prev) => !prev);
                      setTimeout(() => quickInputRef.current?.focus(), 50);
                    }}
                    className="h-10 px-3 text-[11px] font-bold whitespace-nowrap"
                    title="Toggle barcode scanner mode"
                  >
                    {isScannerMode ? 'Scanner On' : 'Scan Barcode'}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={openBarcodeCamera}
                    className="h-10 px-3 text-[11px] font-bold whitespace-nowrap gap-1"
                    title="Open camera scan mode on your iPhone or tablet"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    Camera
                  </Button>

                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => handleBarcodeSubmit()}
                    className="h-10 px-3 text-[11px] font-bold whitespace-nowrap"
                    title="Add the current barcode or product match to the invoice"
                  >
                    Add
                  </Button>
                </div>

                {isQuickDropdownOpen && quickSearchQuery && (
                  <div
                    onMouseDown={(e) => e.preventDefault()}
                    className="absolute left-0 right-0 mt-1 max-h-60 overflow-y-auto z-50 rounded-xl bg-dark-900 border border-dark-800 shadow-2xl divide-y divide-dark-850 scrollbar-thin animate-in slide-in-from-top-2 duration-150"
                  >
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
                          className="p-3 hover:bg-dark-850/50 transition-colors flex justify-between items-center gap-3 min-h-[48px]"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 bg-dark-800 border border-dark-700 flex items-center justify-center">
                              {p.image_url ? (
                                <img src={p.image_url} alt={p.name_en} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-dark-600 text-xs">📦</div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1 space-y-0.5">
                              <div className="font-semibold text-white text-xs sm:text-sm leading-snug break-words">{p.name_kh}</div>
                              <div className="text-[10px] text-dark-400 leading-tight break-words">{p.name_en}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2.5 shrink-0">
                            <div className="text-right text-[10px] text-dark-400">
                              <span className="block font-medium text-white">${cheapestPrice.toFixed(2)}</span>
                              <span>{p.barcode ? `Barcode: ${p.barcode}` : 'Stock: ' + totalStock}</span>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                addProductToInvoice(p.id, 1);
                                setQuickSearchQuery('');
                                setIsQuickDropdownOpen(false);
                                quickInputRef.current?.focus();
                              }}
                              onTouchEnd={(e) => {
                                e.preventDefault();
                                addProductToInvoice(p.id, 1);
                                setQuickSearchQuery('');
                                setIsQuickDropdownOpen(false);
                                quickInputRef.current?.focus();
                              }}
                              onClick={(e) => {
                                e.preventDefault();
                                addProductToInvoice(p.id, 1);
                                setQuickSearchQuery('');
                                setIsQuickDropdownOpen(false);
                                quickInputRef.current?.focus();
                              }}
                              className={`h-7 px-2.5 text-[11px] font-bold rounded-md shadow-xs active:scale-95 transition-all ${
                                existingQty > 0
                                  ? 'bg-primary-500/20 text-primary-400 border border-primary-500/40 hover:bg-primary-500/30'
                                  : 'bg-primary text-primary-foreground hover:bg-primary/90'
                              }`}
                            >
                              {existingQty > 0 ? `+1 (${existingQty})` : '+ Add'}
                            </Button>
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

              {/* Barcode Camera Scanner Modal */}
              <Dialog 
                open={isCameraScannerOpen} 
                onOpenChange={(open) => {
                  if (!open) {
                    setIsCameraScannerOpen(false);
                    stopCameraScanner();
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
                        <DialogTitle className="text-base font-bold text-white">Barcode Scanner</DialogTitle>
                        <DialogDescription className="text-xs text-dark-300">Point your camera at the barcode</DialogDescription>
                      </div>
                    </div>
                  </DialogHeader>

                  <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-black my-2 shadow-inner">
                    <video ref={cameraVideoRef} autoPlay playsInline muted className="h-[320px] w-full object-cover bg-black" />
                    <div className="pointer-events-none absolute inset-x-8 top-1/2 h-28 -translate-y-1/2 rounded-2xl border-2 border-emerald-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] flex items-center justify-center">
                      <div className="w-full h-0.5 bg-emerald-400 shadow-[0_0_12px_#34d399] animate-pulse" />
                    </div>
                  </div>

                  {cameraScannerError && (
                    <div className="rounded-xl border border-rose-500/40 bg-rose-500/15 p-3 text-xs text-rose-200 font-medium">
                      {cameraScannerError}
                    </div>
                  )}
                </DialogContent>
              </Dialog>

              {/* Line Items Cards List - Fully Responsive for Mobile, Tablet & Desktop */}
              <div className="space-y-4">
                {lineItems.map((item, idx) => {
                  const sps = productSupplierPrices[item.product_id] || [];
                  const cheapestSp = [...sps].sort((a, b) => a.price - b.price)[0];
                  const numericQty = parseQuantity(item.quantity);
                  const isStockWarning = item.product_id && item.supplier_id && (numericQty > item.maxStock);
                  const prod = products.find(p => p.id === item.product_id);
                  const selectedSp = item.supplier_id ? sps.find(sp => sp.supplier_id === item.supplier_id) : (sps.length > 0 ? sps[0] : null);
                  const selectedSup = selectedSp ? suppliers.find(s => s.id === selectedSp.supplier_id) : null;
                  const isSelectedCheapest = selectedSp && cheapestSp && selectedSp.supplier_id === cheapestSp.supplier_id;
                  const selectedStockTime = selectedSp ? formatStockInTime(selectedSp.updated_at) : null;

                  return (
                    <div
                      key={item.id}
                      className="p-3.5 sm:p-4 rounded-xl border border-border bg-card/40 space-y-3 transition-colors hover:border-primary/30"
                    >
                      {/* Mobile Header Bar: Thumbnail, Item #, Mode Toggle & Actions */}
                      <div className="flex items-center justify-between gap-2 sm:hidden pb-1 border-b border-border/40">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-8 h-8 rounded-lg border border-border flex items-center justify-center overflow-hidden bg-muted shrink-0">
                            {item.isCustom ? (
                              <span className="text-[9px] text-violet-500 font-bold">Custom</span>
                            ) : prod && prod.image_url ? (
                              <img src={prod.image_url} alt="Product" className="w-full h-full object-cover rounded-lg" />
                            ) : (
                              <ImageIcon className="w-4 h-4 text-muted-foreground" />
                            )}
                          </div>
                          <span className="text-xs font-bold text-foreground">Item #{idx + 1}</span>
                          {prod && (
                            <span className="text-[10px] bg-primary/10 text-primary font-semibold px-2 py-0.5 rounded truncate max-w-[120px]">
                              {prod.brand || prod.category || 'Catalog'}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            type="button"
                            variant={item.isCustom ? "secondary" : "outline"}
                            size="sm"
                            onClick={() => updateLineItem(idx, 'isCustom', !item.isCustom)}
                            className={`h-8 px-2 text-[10px] font-bold ${
                              item.isCustom ? 'border-violet-500/30 text-violet-500 hover:bg-violet-500/20' : ''
                            }`}
                            title={item.isCustom ? "Switch to Catalog item select" : "Switch to freeform manual input"}
                          >
                            {item.isCustom ? "Custom" : "Catalog"}
                          </Button>

                          <div className="flex items-center">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => moveLineItem(idx, -1)}
                              disabled={idx === 0}
                              className="h-8 w-7 text-muted-foreground hover:text-foreground"
                              title="Move up"
                            >
                              <ChevronUp className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => moveLineItem(idx, 1)}
                              disabled={idx === lineItems.length - 1}
                              className="h-8 w-7 text-muted-foreground hover:text-foreground"
                              title="Move down"
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </Button>
                          </div>

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeLineItem(idx)}
                            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            title="Remove row"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Main Product Selector & Desktop Controls Row */}
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                        {/* Desktop Thumbnail */}
                        <div className="hidden sm:flex w-10 h-10 sm:w-11 sm:h-11 rounded-xl border border-border items-center justify-center overflow-hidden bg-muted shrink-0 shadow-xs">
                          {item.isCustom ? (
                            <span className="text-[10px] text-violet-500 font-bold bg-violet-500/10 w-full h-full flex items-center justify-center">Custom</span>
                          ) : prod && prod.image_url ? (
                            <img src={prod.image_url} alt="Product" className="w-full h-full object-cover rounded-xl" />
                          ) : (
                            <ImageIcon className="w-5 h-5 text-muted-foreground" />
                          )}
                        </div>

                        {/* Search / Select Product Input Container */}
                        <div className="flex-1 relative min-w-0">
                          {item.isCustom ? (
                            <Input
                              type="text"
                              placeholder="Custom item name..."
                              value={item.custom_name || ''}
                              onChange={(e) => updateLineItem(idx, 'custom_name', e.target.value)}
                              onBlur={() => {
                                if (item.custom_name?.trim() && idx === lineItems.length - 1) {
                                  setLineItems(prev => {
                                    const last = prev[prev.length - 1];
                                    if (last && (last.product_id || (last.isCustom && last.custom_name?.trim()))) {
                                      return [...prev, createEmptyLineItem()];
                                    }
                                    return prev;
                                  });
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  if (item.custom_name?.trim() && idx === lineItems.length - 1) {
                                    setLineItems(prev => {
                                      const last = prev[prev.length - 1];
                                      if (last && (last.product_id || (last.isCustom && last.custom_name?.trim()))) {
                                        return [...prev, createEmptyLineItem()];
                                      }
                                      return prev;
                                    });
                                  }
                                }
                              }}
                              className="w-full border-violet-500/30 focus-visible:border-violet-500/60 text-xs sm:text-sm font-medium h-10"
                            />
                          ) : (
                            <>
                              <div className="relative">
                                <Input
                                  type="text"
                                  placeholder="Search product by name or barcode..."
                                  value={item.searchQuery !== undefined ? item.searchQuery : (prod ? `${prod.name_kh} (${prod.name_en})` : '')}
                                  title={prod ? `${prod.name_kh} (${prod.name_en})` : (item.searchQuery || '')}
                                  onFocus={() => {
                                    setLineItems(prevItems => {
                                      return prevItems.map((li, i) => {
                                        if (i === idx) {
                                          const currentProd = products.find(p => p.id === li.product_id);
                                          return {
                                            ...li,
                                            isDropdownOpen: true,
                                            searchQuery: currentProd ? `${currentProd.name_kh} (${currentProd.name_en})` : (li.searchQuery || '')
                                          };
                                        }
                                        return { ...li, isDropdownOpen: false };
                                      });
                                    });
                                  }}
                                  onBlur={() => {
                                    setTimeout(() => {
                                      setLineItems(prevItems => {
                                        return prevItems.map((li, i) => {
                                          if (i === idx) {
                                            const currentProd = products.find(p => p.id === li.product_id);
                                            return {
                                              ...li,
                                              isDropdownOpen: false,
                                              searchQuery: currentProd ? `${currentProd.name_kh} (${currentProd.name_en})` : ''
                                            };
                                          }
                                          return li;
                                        });
                                      });
                                    }, 200);
                                  }}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setLineItems(prevItems => {
                                      return prevItems.map((li, i) => {
                                        if (i === idx) {
                                          return {
                                            ...li,
                                            searchQuery: val,
                                            isDropdownOpen: true
                                          };
                                        }
                                        return li;
                                      });
                                    });
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      const matches = getFilteredProducts(item.searchQuery || '');
                                      if (matches.length > 0) {
                                        handleSelectProduct(idx, matches[0]);
                                      }
                                    } else if (e.key === 'Escape') {
                                      e.preventDefault();
                                      setLineItems(prevItems => prevItems.map((li, i) => i === idx ? { ...li, isDropdownOpen: false } : li));
                                    }
                                  }}
                                  className="w-full text-xs sm:text-sm h-10 pr-8"
                                />
                                {item.searchQuery && (
                                  <button
                                    type="button"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => {
                                      setLineItems(prevItems => prevItems.map((li, i) => i === idx ? { ...li, searchQuery: '', isDropdownOpen: true } : li));
                                    }}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                                    title="Clear search"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>

                              {/* Selected Product Details Banner (Always shows full Khmer & English names with no cut-off) */}
                              {prod && (
                                <div className="mt-1.5 px-3 py-1.5 rounded-lg bg-muted/60 border border-border/70 flex flex-wrap items-center justify-between gap-1.5 text-xs animate-in fade-in-50 duration-150">
                                  <div className="flex-1 min-w-0">
                                    <div className="font-semibold text-foreground text-xs leading-snug break-words">
                                      {prod.name_kh}
                                      {prod.name_en && (
                                        <span className="text-muted-foreground font-normal ml-1.5 break-words">
                                          ({prod.name_en})
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground flex-wrap">
                                      {prod.barcode && <span>Barcode: <span className="font-mono">{prod.barcode}</span></span>}
                                      {prod.brand && <span>Brand: <span className="font-medium text-foreground">{prod.brand}</span></span>}
                                      {prod.category && <span>Category: <span className="font-medium text-foreground">{prod.category}</span></span>}
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Search Dropdown with Full Scroll Freedom (Clicking '+ Add' selects the item) */}
                              {item.isDropdownOpen && (
                                <div
                                  onMouseDown={(e) => {
                                    // Prevent input blur so scrolling or clicking in dropdown doesn't lose focus
                                    e.preventDefault();
                                  }}
                                  className="absolute left-0 right-0 sm:left-0 sm:right-auto w-full sm:w-[500px] md:w-[560px] max-w-[95vw] mt-1 max-h-72 overflow-y-auto z-50 rounded-xl bg-popover/98 backdrop-blur-md border border-border shadow-2xl divide-y divide-border/60 scrollbar-thin animate-in fade-in-50 zoom-in-95 duration-100 touch-pan-y overscroll-contain"
                                >
                                  {getFilteredProducts(item.searchQuery || '').map(p => {
                                    const sps = productSupplierPrices[p.id] || [];
                                    const cheapestPrice = sps.length > 0
                                      ? Math.min(...sps.map(sp => sp.price))
                                      : (p.base_price || 0);
                                    const totalStock = sps.reduce((sum, sp) => sum + (sp.stock_qty || 0), 0);

                                    return (
                                      <div
                                        key={p.id}
                                        className="p-3 hover:bg-muted/40 transition-colors flex items-center justify-between gap-3 min-h-[56px]"
                                      >
                                        {/* Product Info (Wraps naturally with no truncate so full name is visible) */}
                                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                          <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-muted border border-border/60 flex items-center justify-center">
                                            {p.image_url ? (
                                              <img src={p.image_url} alt={p.name_en || p.name_kh} className="w-full h-full object-cover" />
                                            ) : (
                                              <ImageIcon className="w-4 h-4 text-muted-foreground" />
                                            )}
                                          </div>
                                          <div className="min-w-0 flex-1 space-y-0.5">
                                            <div className="font-semibold text-foreground text-xs sm:text-sm leading-snug break-words">
                                              {p.name_kh}
                                            </div>
                                            {p.name_en && (
                                              <div className="text-[11px] text-muted-foreground leading-tight break-words">
                                                {p.name_en}
                                              </div>
                                            )}
                                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground flex-wrap">
                                              {p.barcode && <span className="font-mono">#{p.barcode}</span>}
                                              {p.brand && <span className="bg-muted px-1.5 py-0.2 rounded">{p.brand}</span>}
                                            </div>
                                          </div>
                                        </div>

                                        {/* Price, Stock and Dedicated Add Button */}
                                        <div className="flex items-center gap-2.5 shrink-0">
                                          <div className="text-right text-[10px] text-muted-foreground">
                                            <span className="block font-bold text-foreground text-xs sm:text-sm">${cheapestPrice.toFixed(2)}</span>
                                            <span className={totalStock <= 2 ? "text-destructive font-semibold" : ""}>
                                              Stock: {totalStock}
                                            </span>
                                          </div>

                                          <Button
                                            type="button"
                                            size="sm"
                                            onMouseDown={(e) => {
                                              e.preventDefault();
                                              handleSelectProduct(idx, p);
                                            }}
                                            onTouchEnd={(e) => {
                                              e.preventDefault();
                                              handleSelectProduct(idx, p);
                                            }}
                                            onClick={(e) => {
                                              e.preventDefault();
                                              handleSelectProduct(idx, p);
                                            }}
                                            className="h-8 px-3 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 shrink-0 rounded-lg shadow-sm active:scale-95 transition-transform"
                                          >
                                            + Add
                                          </Button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                  {getFilteredProducts(item.searchQuery || '').length === 0 && (
                                    <div className="p-4 text-muted-foreground text-xs italic text-center">No products found</div>
                                  )}
                                </div>
                              )}
                            </>
                          )}
                        </div>

                        {/* Desktop Controls (Mode toggle, Reorder, Remove) */}
                        <div className="hidden sm:flex items-center gap-2 shrink-0">
                          <Button
                            type="button"
                            variant={item.isCustom ? "secondary" : "outline"}
                            size="sm"
                            onClick={() => updateLineItem(idx, 'isCustom', !item.isCustom)}
                            className={`h-10 px-2.5 text-[11px] font-bold shrink-0 ${
                              item.isCustom ? 'border-violet-500/30 text-violet-500 hover:bg-violet-500/20' : ''
                            }`}
                            title={item.isCustom ? "Switch to Catalog item select" : "Switch to freeform manual input"}
                          >
                            {item.isCustom ? "Custom" : "Catalog"}
                          </Button>

                          <div className="flex flex-col gap-0.5 shrink-0">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => moveLineItem(idx, -1)}
                              disabled={idx === 0}
                              className="h-5 w-8 text-muted-foreground hover:text-foreground"
                              title="Move up"
                            >
                              <ChevronUp className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => moveLineItem(idx, 1)}
                              disabled={idx === lineItems.length - 1}
                              className="h-5 w-8 text-muted-foreground hover:text-foreground"
                              title="Move down"
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </Button>
                          </div>

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeLineItem(idx)}
                            className="h-10 w-10 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                            title="Remove row"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Controls Grid: Supplier, Unit Price, Decimal Quantity & Subtotal */}
                      <div className="grid grid-cols-2 sm:grid-cols-12 gap-3 items-end pt-1">
                        {/* Supplier Selector (Mobile full width / Desktop 5 cols) */}
                        <div className="col-span-2 sm:col-span-5 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                              Supplier &amp; Cost Price
                            </label>
                            {selectedStockTime && !item.isCustom && (
                              <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1 sm:hidden">
                                <Clock className="w-3 h-3 text-primary" />
                                In: {selectedStockTime.relativeShort || selectedStockTime.relative}
                              </span>
                            )}
                          </div>

                          {item.isCustom ? (
                            <div className="w-full border border-dashed border-border rounded-lg bg-muted/30 text-muted-foreground text-xs italic flex items-center justify-center h-10">
                              No Supplier (Ad-hoc)
                            </div>
                          ) : (
                            <>
                              {/* Mobile View: High-comfort thumb-friendly trigger card */}
                              <div className="sm:hidden">
                                <button
                                  type="button"
                                  disabled={!item.product_id}
                                  onClick={() => openSupplierPicker(idx)}
                                  className={`w-full min-h-[46px] p-2.5 rounded-xl border transition-all text-left flex items-center justify-between gap-2.5 active:scale-[0.99] ${
                                    !item.product_id
                                      ? 'opacity-40 border-input bg-background cursor-not-allowed'
                                      : isSelectedCheapest
                                      ? 'border-emerald-500/40 bg-emerald-500/5 hover:bg-emerald-500/10'
                                      : 'border-input bg-card hover:bg-muted/40'
                                  }`}
                                >
                                  {selectedSup ? (
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="font-bold text-xs text-foreground truncate">{selectedSup.name}</span>
                                        {isSelectedCheapest && (
                                          <Badge className="text-[9px] font-extrabold uppercase bg-emerald-600 text-white px-1.5 py-0 leading-tight shrink-0">
                                            Cheapest ★
                                          </Badge>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2 mt-1 text-[11px] flex-wrap">
                                        <span className={`font-bold font-mono ${isSelectedCheapest ? 'text-emerald-500' : 'text-foreground'}`}>
                                          ${Number(selectedSp.price || 0).toFixed(2)}
                                        </span>
                                        <span className={`text-[10px] ${selectedSp.stock_qty <= 2 ? 'text-destructive font-bold' : 'text-muted-foreground'}`}>
                                          (Qty: {selectedSp.stock_qty}{selectedSp.stock_unit && selectedSp.stock_unit !== 'pcs' ? ` ${selectedSp.stock_unit}` : ''})
                                        </span>
                                        {selectedStockTime && (
                                          <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-0.5 truncate">
                                            • In: {selectedStockTime.relativeShort || selectedStockTime.relative}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-xs text-muted-foreground italic">
                                      {sps.length === 0 ? 'No suppliers available' : 'Tap to select supplier...'}
                                    </span>
                                  )}

                                  <div className="flex items-center gap-1 shrink-0">
                                    <span className="text-[10px] font-semibold bg-primary/10 text-primary px-2 py-1 rounded-md">
                                      {sps.length > 1 ? `${sps.length} offers` : 'Change'}
                                    </span>
                                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                                  </div>
                                </button>
                              </div>

                              {/* Desktop View: Select with rich option text & quick edit button */}
                              <div className="hidden sm:flex items-center gap-1.5">
                                <select
                                  required={Boolean(item.product_id)}
                                  disabled={!item.product_id}
                                  value={item.supplier_id}
                                  onChange={(e) => updateLineItem(idx, 'supplier_id', e.target.value)}
                                  className="w-full border border-input bg-background text-foreground rounded-lg px-3 py-2 text-xs disabled:opacity-40 h-10 focus:ring-2 focus:ring-ring focus:outline-hidden"
                                >
                                  {sps.length === 0 ? (
                                    <option value="">No suppliers</option>
                                  ) : (
                                    sps.map(sp => {
                                      const sup = suppliers.find(s => s.id === sp.supplier_id);
                                      const name = sup ? sup.name : 'Unknown';
                                      const cheapestLabel = cheapestSp && cheapestSp.supplier_id === sp.supplier_id ? ' ★' : '';
                                      const timeInfo = formatStockInTime(sp.updated_at);
                                      const timeLabel = timeInfo ? ` • In: ${timeInfo.relative}` : '';
                                      const unitLabel = sp.stock_unit && sp.stock_unit !== 'pcs' ? ` ${sp.stock_unit}` : '';
                                      return (
                                        <option key={sp.supplier_id} value={sp.supplier_id}>
                                          {name}: ${Number(sp.price || 0).toFixed(2)} (Qty: {sp.stock_qty}{unitLabel}){timeLabel}{cheapestLabel}
                                        </option>
                                      );
                                    })
                                  )}
                                </select>

                                {selectedSp && prod && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    onClick={() => openStockEditModal(idx, prod, selectedSup, selectedSp)}
                                    className="h-10 w-10 shrink-0 text-muted-foreground hover:text-primary hover:border-primary/50"
                                    title="Quick update stock & cost price"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </Button>
                                )}
                              </div>

                              {/* Stock In History & Quick Update Sub-Bar (Responsive for both) */}
                              {selectedSp && prod && (
                                <div className="flex flex-wrap items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted/40 border border-border/50 text-[10px]">
                                  <div className="flex items-center gap-1.5 text-muted-foreground min-w-0">
                                    <Clock className="w-3 h-3 text-primary shrink-0" />
                                    <span className="font-medium">Stock In:</span>
                                    {selectedStockTime ? (
                                      <span className="font-semibold text-foreground truncate" title={selectedStockTime.full}>
                                        {selectedStockTime.relative} <span className="text-muted-foreground font-normal">({selectedStockTime.formattedDate})</span>
                                      </span>
                                    ) : (
                                      <span className="italic text-muted-foreground">Not recorded</span>
                                    )}
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => openStockEditModal(idx, prod, selectedSup, selectedSp)}
                                    className="text-primary hover:text-primary/80 font-bold flex items-center gap-1 shrink-0 ml-auto transition-colors"
                                  >
                                    <Edit2 className="w-2.5 h-2.5" />
                                    <span>Update Stock</span>
                                  </button>
                                </div>
                              )}
                            </>
                          )}
                        </div>

                        {/* Unit Price field */}
                        <div className="col-span-1 sm:col-span-2">
                          <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                            Unit Price ($)
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-semibold">$</span>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              required={Boolean(item.product_id || (item.isCustom && item.custom_name))}
                              value={item.unit_price}
                              onChange={(e) => updateLineItem(idx, 'unit_price', e.target.value)}
                              className="w-full pl-6 pr-2 h-10 text-left text-foreground text-xs font-semibold"
                            />
                          </div>
                        </div>

                        {/* Quantity Field Supporting Integers and Floating Point Decimals (0.5, 1.5, 2.25) */}
                        <div className="col-span-1 sm:col-span-2">
                          <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                            Qty (Float)
                          </label>
                          <Input
                            type="number"
                            step="any"
                            min="0"
                            inputMode="decimal"
                            required={Boolean(item.product_id || (item.isCustom && item.custom_name))}
                            placeholder="1"
                            value={item.quantity}
                            onChange={(e) => updateLineItem(idx, 'quantity', e.target.value)}
                            className="w-full h-10 text-center text-xs font-semibold text-foreground"
                          />
                        </div>

                        {/* Line Subtotal & Profit Badge */}
                        <div className="col-span-2 sm:col-span-3 text-right flex sm:flex-col justify-between sm:justify-end items-center sm:items-end pt-1 sm:pt-0">
                          <div>
                            <span className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider sm:mb-1">Line Total</span>
                            <span className="font-bold text-foreground text-sm sm:text-base font-mono">
                              ${roundMoney(Number(item.unit_price || 0) * numericQty).toFixed(2)}
                            </span>
                          </div>

                          {item.product_id && !item.isCustom && (
                            <div className="text-[10px] text-emerald-500 font-medium truncate" title={`Cost: $${Number(item.supplier_price || 0).toFixed(2)} / unit`}>
                              Profit: +${roundMoney((Number(item.unit_price || 0) - Number(item.supplier_price || 0)) * numericQty).toFixed(2)}
                            </div>
                          )}
                          {item.isCustom && (
                            <div className="text-[10px] text-muted-foreground font-medium">
                              Ad-hoc item
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Stock Warning alert */}
                      {!item.isCustom && isStockWarning && (
                        <div className="flex items-center gap-1.5 text-[11px] font-bold bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 px-3 py-1.5 rounded-lg mt-2">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>Stock Warning: Available stock is only {item.maxStock} {item.stockUnit}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          </form>

          {/* Right Side: Total Summary & Checkout Actions (1 col) */}
          <div className="space-y-6">
            <Card className="p-6 bg-card/60 backdrop-blur-md border-border shadow-xs space-y-6">
              <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Checkout Summary</h3>

              <div className="space-y-3 text-sm border-b border-border pb-4">
                <div className="flex justify-between text-muted-foreground">
                  <span>Items Subtotal</span>
                  <span className="font-semibold text-foreground font-mono">${subtotal.toFixed(2)}</span>
                </div>
                {calculatedDiscount > 0 && (
                  <div className="flex justify-between text-rose-500 font-medium">
                    <span>Discount {discountType === 'percent' ? `(${discountValue}%)` : ''}</span>
                    <span className="font-mono">-${calculatedDiscount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-muted-foreground">
                  <span>Delivery Fee {!hasDelivery && '(Pickup)'}</span>
                  <span className="font-semibold text-foreground font-mono">${effectiveDeliveryFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-emerald-500 font-medium">
                  <span>Estimated Profit</span>
                  <span className="font-mono">${totalProfit.toFixed(2)}</span>
                </div>
              </div>

              <div className="flex justify-between items-end">
                <div>
                  <span className="text-xs text-muted-foreground font-bold uppercase tracking-wider block">Grand Total</span>
                  <span className="text-2xl sm:text-3xl font-black text-foreground font-mono">${totalAmount.toFixed(2)}</span>
                </div>
                <Badge variant="outline" className="text-xs text-primary border-primary/30 bg-primary/10">
                  {lineItems.filter(item => item.product_id || (item.isCustom && item.custom_name)).length} Items
                </Badge>
              </div>

              {/* Action Buttons Bar */}
              <div className="flex flex-col gap-3">
                <div className="flex gap-2 flex-wrap">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handlePreviewReceipt}
                    className="flex-1 min-h-[44px] gap-2 font-semibold text-xs sm:text-sm min-w-[110px]"
                  >
                    <Eye className="w-4 h-4 text-muted-foreground" />
                    <span>Preview</span>
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={handlePrint}
                    className="flex-1 min-h-[44px] gap-2 font-semibold text-xs sm:text-sm min-w-[110px]"
                  >
                    <Printer className="w-4 h-4 text-muted-foreground" />
                    <span>Print</span>
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleDownloadImage('png')}
                    disabled={isExporting}
                    className="flex-1 min-h-[44px] gap-2 font-semibold text-xs sm:text-sm text-primary border-primary/30 hover:border-primary/60 min-w-[110px]"
                  >
                    {isExporting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Exporting...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        <span>PNG</span>
                      </>
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleDownloadPdf}
                    disabled={isExporting}
                    className="flex-1 min-h-[44px] gap-2 font-semibold text-xs sm:text-sm min-w-[110px]"
                  >
                    <FileDown className="w-4 h-4" />
                    <span>PDF</span>
                  </Button>
                </div>

                <Button
                  onClick={handleSaveInvoice}
                  disabled={isSaving}
                  className="w-full min-h-[44px] font-bold text-sm gap-2"
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
                </Button>
              </div>
            </Card>

            <div className="p-4 bg-muted/40 rounded-2xl border border-dashed border-border flex gap-3">
              <AlertCircle className="w-5 h-5 text-primary shrink-0" />
              <div className="text-xs text-muted-foreground">
                <span className="font-bold text-foreground block mb-0.5">Decimal Quantities Supported</span>
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
        const modalInvoiceNumber = savedOrder
          ? (receiptData.order?.invoice_number || '')
          : invoiceNumber;
        const updateModalInvoiceNumber = (nextVal) => {
          if (savedOrder) {
            setSavedOrder((prev) => prev ? { ...prev, order: { ...prev.order, invoice_number: nextVal } } : prev);
          } else {
            setInvoiceNumber(nextVal);
          }
        };
        const modalCustomerName = savedOrder
          ? (receiptData.customer?.name || '')
          : (invoiceCustomerName || receiptData.customer?.name);
        const modalCustomerPhone = savedOrder
          ? (receiptData.customer?.phone || '')
          : (invoicePhone || receiptData.customer?.phone);
        return (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-xs p-3 sm:p-6 flex items-center justify-center no-print">
            <div className={`bg-card border border-border w-full rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200 ${receiptTemplate === TEMPLATE_IDS.KHMER ? 'max-w-6xl' : 'max-w-4xl'}`}>

              {/* Top Bar controls */}
              <div className="p-4 border-b border-border flex justify-between items-center bg-card/60 flex-wrap gap-2">
                <h3 className="font-semibold text-foreground text-sm sm:text-base flex items-center gap-2">
                  <span>{isDraft ? 'Receipt Preview (Draft)' : 'Invoice Preview'}</span>
                </h3>

                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    value={receiptTemplate}
                    onChange={(e) => setReceiptTemplate(e.target.value)}
                    className="h-8 rounded-md border border-input bg-card px-2 text-xs text-foreground"
                    title="Receipt template"
                  >
                    {TEMPLATE_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>{opt.label}</option>
                    ))}
                  </select>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownloadImage('png')}
                    disabled={isExporting}
                    className="gap-1.5 text-xs text-primary border-primary/30 hover:border-primary/60"
                  >
                    {isExporting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                    <span>PNG</span>
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadPdf}
                    disabled={isExporting}
                    className="gap-1.5 text-xs"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    <span>PDF</span>
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsTextReceiptOpen(true)}
                    className="gap-1.5 text-xs"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>58 mm Text</span>
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    onClick={handlePrint}
                    className="gap-1.5 text-xs"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>{isDraft ? 'Print Draft' : 'Print'}</span>
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => { setSavedOrder(null); setPreviewOrder(null); }}
                    className="text-xs"
                  >
                    Close
                  </Button>
                </div>
              </div>

              {/* Modal Body container (two-column split on md sizes) */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 scrollbar-thin bg-muted/20">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">

                  {/* Left Column: Receipt Customization & Profit Card (5 cols) */}
                  <div className="md:col-span-5 space-y-6 no-print order-2 md:order-1">

                    {/* Header Customization Form */}
                    <div className="p-4 sm:p-5 rounded-2xl border border-border bg-card/80 space-y-4 shadow-sm text-left">
                      <h4 className="text-xs font-bold text-primary uppercase tracking-widest border-b border-border pb-2">
                        {receiptTemplate === TEMPLATE_IDS.KHMER ? 'Khmer Invoice Settings' : 'Edit Receipt Header'}
                      </h4>
                      <div className="space-y-3 text-xs">
                        {receiptTemplate === TEMPLATE_IDS.OLD ? (
                          <>
                            <div>
                              <label className="block font-semibold text-muted-foreground uppercase mb-1">Invoice ID / Number</label>
                              <div className="flex items-center gap-1.5">
                                <Input
                                  type="text"
                                  value={modalInvoiceNumber}
                                  onChange={(e) => updateModalInvoiceNumber(e.target.value)}
                                  placeholder="INV-261111-001"
                                  className="h-8 text-xs font-mono"
                                />
                                {!savedOrder && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={handleRegenerateInvoiceId}
                                    className="h-8 px-2 shrink-0"
                                    title="Generate new Invoice ID"
                                  >
                                    <RefreshCw className="w-3.5 h-3.5" />
                                  </Button>
                                )}
                              </div>
                            </div>
                            <div>
                              <label className="block font-semibold text-muted-foreground uppercase mb-1">Shop/Vendor Name</label>
                              <Input type="text" value={shopName} onChange={(e) => setShopName(e.target.value)} className="h-8 text-xs" />
                            </div>
                            <div>
                              <label className="block font-semibold text-muted-foreground uppercase mb-1">Shop Address / Landmark</label>
                              <Input type="text" value={shopAddress} onChange={(e) => setShopAddress(e.target.value)} className="h-8 text-xs" />
                            </div>
                            <div>
                              <label className="block font-semibold text-muted-foreground uppercase mb-1">Phone Number</label>
                              <Input type="text" value={shopPhone} onChange={(e) => setShopPhone(e.target.value)} className="h-8 text-xs" />
                            </div>
                            <div>
                              <label className="block font-semibold text-muted-foreground uppercase mb-1">Footer Message</label>
                              <textarea
                                value={customFooter}
                                onChange={(e) => setCustomFooter(e.target.value)}
                                rows="2"
                                className="w-full border border-input bg-background rounded-md px-3 py-1.5 text-xs text-foreground focus:ring-2 focus:ring-ring focus:outline-hidden resize-none"
                              />
                            </div>
                          </>
                        ) : (
                          <>
                            <div>
                              <label className="block font-semibold text-muted-foreground uppercase mb-1">Customer Name</label>
                              <Input type="text" value={invoiceCustomerName} onChange={(e) => setInvoiceCustomerName(e.target.value)} className="h-8 text-xs" />
                            </div>
                            <div>
                              <label className="block font-semibold text-muted-foreground uppercase mb-1">Phone</label>
                              <Input type="text" value={invoicePhone} onChange={(e) => setInvoicePhone(e.target.value)} className="h-8 text-xs" />
                            </div>
                            <div>
                              <label className="block font-semibold text-muted-foreground uppercase mb-1">Invoice Number</label>
                              <div className="flex items-center gap-1.5">
                                <Input type="text" value={modalInvoiceNumber} onChange={(e) => updateModalInvoiceNumber(e.target.value)} className="h-8 text-xs font-mono" />
                                {!savedOrder && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={handleRegenerateInvoiceId}
                                    className="h-8 px-2 shrink-0"
                                    title="Generate new Invoice ID"
                                  >
                                    <RefreshCw className="w-3.5 h-3.5" />
                                  </Button>
                                )}
                              </div>
                            </div>
                            <div>
                              <label className="block font-semibold text-muted-foreground uppercase mb-1">Date</label>
                              <Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className="h-8 text-xs" />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block font-semibold text-muted-foreground uppercase mb-1">Font Size</label>
                                <Input type="number" min="10" max="22" value={invoiceFontSize} onChange={(e) => setInvoiceFontSize(Number(e.target.value) || 13)} className="h-8 text-xs" />
                              </div>
                              <div>
                                <label className="block font-semibold text-muted-foreground uppercase mb-1">Border (px)</label>
                                <Input type="number" min="1" max="4" step="0.5" value={invoiceBorderThickness} onChange={(e) => setInvoiceBorderThickness(Number(e.target.value) || 1.5)} className="h-8 text-xs" />
                              </div>
                            </div>
                            <div>
                              <label className="block font-semibold text-muted-foreground uppercase mb-1">Khmer Font</label>
                              <select value={invoiceKhmerFont} onChange={(e) => setInvoiceKhmerFont(e.target.value)} className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs">
                                {KHMER_FONTS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="block font-semibold text-muted-foreground uppercase mb-1">English Font</label>
                              <select value={invoiceEnglishFont} onChange={(e) => setInvoiceEnglishFont(e.target.value)} className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs">
                                {ENGLISH_FONTS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                              </select>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block font-semibold text-muted-foreground uppercase mb-1">Width (px)</label>
                                <Input type="number" min="480" max="900" value={invoiceWidth} onChange={(e) => setInvoiceWidth(Number(e.target.value) || 794)} className="h-8 text-xs" />
                              </div>
                              <div>
                                <label className="block font-semibold text-muted-foreground uppercase mb-1">Page Size</label>
                                <select value={invoicePageSize} onChange={(e) => setInvoicePageSize(e.target.value)} className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs">
                                  {Object.values(PAGE_SIZES).map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                                </select>
                              </div>
                            </div>
                            <div>
                              <label className="block font-semibold text-muted-foreground uppercase mb-1">Currency Symbol</label>
                              <Input type="text" value={currencySymbol} onChange={(e) => setCurrencySymbol(e.target.value || '$')} className="h-8 text-xs" />
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Internal Profit Analysis Card (Owner Only) */}
                    <div className="p-4 sm:p-5 rounded-2xl border border-border bg-card/80 space-y-4 shadow-sm text-left">
                      <div className="flex justify-between items-center border-b border-border pb-3">
                        <h4 className="text-xs font-bold text-emerald-500 uppercase tracking-wider flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                          Internal Profit Analysis
                        </h4>
                        <span className="text-xs text-muted-foreground font-mono">
                          {isDraft ? 'DRAFT' : `#${receiptData.order.id.slice(-6).toUpperCase()}`}
                        </span>
                      </div>

                      <div className="divide-y divide-border max-h-48 overflow-y-auto scrollbar-thin">
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
                                <div className="font-semibold text-foreground">
                                  {prod ? `${prod.name_kh} (${prod.name_en})` : (item.custom_name || 'Custom Item')}
                                </div>
                                <div className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                                  {!isCustom && <span>Cost: ${cost.toFixed(2)}</span>}
                                  {!isCustom && <span>•</span>}
                                  <span>Sell: ${selling.toFixed(2)}</span>
                                  <span>•</span>
                                  <span>Qty: {qty}</span>
                                </div>
                              </div>
                              <div className="text-right font-mono">
                                {isCustom ? (
                                  <span className="font-semibold text-muted-foreground block">$0.00</span>
                                ) : (
                                  <>
                                    <span className="font-bold text-emerald-500 block">+${itemProfit.toFixed(2)}</span>
                                    <span className="text-[9px] text-muted-foreground">(${profitPerUnit.toFixed(2)}/unit)</span>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="border-t border-border pt-3 flex justify-between items-center text-sm font-bold">
                        <span className="text-foreground">Total Order Profit:</span>
                        <span className="text-lg text-emerald-500 font-mono">
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
                    <div
                      className={`bg-white border border-gray-300 shadow-xl text-black text-left my-1 ${
                        receiptTemplate === TEMPLATE_IDS.KHMER
                          ? 'w-full max-w-[840px] p-2 sm:p-4 rounded-sm'
                          : 'w-full max-w-md p-6 rounded-xl'
                      }`}
                    >
                      <div ref={printableCardRef} className="bg-white text-black">
                        {receiptTemplate === TEMPLATE_IDS.KHMER ? (
                          <KhmerInvoiceTemplate
                            receiptData={receiptData}
                            products={products}
                            invoiceNumber={modalInvoiceNumber}
                            invoiceDate={invoiceDate}
                            customerName={modalCustomerName}
                            phone={modalCustomerPhone}
                            isDraft={isDraft}
                            settings={invoiceSettings}
                          />
                        ) : (
                          <OldReceiptTemplate
                            receiptData={receiptData}
                            products={products}
                            shopName={shopName}
                            shopAddress={shopAddress}
                            shopPhone={shopPhone}
                            customFooter={customFooter}
                            invoiceNumber={modalInvoiceNumber}
                            isDraft={isDraft}
                            currencySymbol={currencySymbol}
                          />
                        )}
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
        const printInvoiceNumber = savedOrder
          ? (receiptData.order?.invoice_number || '')
          : invoiceNumber;
        const printCustomerName = savedOrder
          ? (receiptData.customer?.name || '')
          : (invoiceCustomerName || receiptData.customer?.name);
        const printCustomerPhone = savedOrder
          ? (receiptData.customer?.phone || '')
          : (invoicePhone || receiptData.customer?.phone);
        return (
          <div className={`hidden print-only bg-white text-black leading-normal ${receiptTemplate === TEMPLATE_IDS.KHMER ? 'print-a4 p-0' : 'p-4 font-sans'}`}>
            {receiptTemplate === TEMPLATE_IDS.KHMER ? (
              <KhmerInvoiceTemplate
                receiptData={receiptData}
                products={products}
                invoiceNumber={printInvoiceNumber}
                invoiceDate={invoiceDate}
                customerName={printCustomerName}
                phone={printCustomerPhone}
                isDraft={isDraft}
                showDraftBanner={false}
                settings={{ ...invoiceSettings, invoiceWidth: PAGE_SIZES[invoicePageSize]?.widthPx || 794 }}
              />
            ) : (
              <div className="max-w-md mx-auto border-0 p-2">
                <OldReceiptTemplate
                  receiptData={receiptData}
                  products={products}
                  shopName={shopName}
                  shopAddress={shopAddress}
                  shopPhone={shopPhone}
                  customFooter={customFooter}
                  invoiceNumber={printInvoiceNumber}
                  isDraft={isDraft}
                  showDraftBanner={false}
                  currencySymbol={currencySymbol}
                />
              </div>
            )}
          </div>
        );
      })()}

      {(() => {
        const receiptData = savedOrder || previewOrder;
        if (!receiptData) return null;
        const isDraft = receiptData.order.id.startsWith('DRAFT_PREVIEW');
        const thermalInvoiceNumber = savedOrder
          ? (receiptData.order?.invoice_number || '')
          : invoiceNumber;
        const thermalCustomerName = savedOrder
          ? (receiptData.customer?.name || '')
          : invoiceCustomerName;
        const thermalCustomerPhone = savedOrder
          ? (receiptData.customer?.phone || '')
          : invoicePhone;
        const receiptText = createThermalReceiptText({
          receiptData,
          getItemName: (item) => {
            const product = products.find((entry) => String(entry.id) === String(item.product_id));
            return product?.name_kh || product?.name_en || item.custom_name || 'Item';
          },
          shopName,
          shopAddress,
          shopPhone,
          footer: customFooter,
          invoiceNumber: thermalInvoiceNumber,
          invoiceDate: receiptTemplate === TEMPLATE_IDS.KHMER ? invoiceDate : '',
          customerName: receiptTemplate === TEMPLATE_IDS.KHMER ? thermalCustomerName : '',
          customerPhone: receiptTemplate === TEMPLATE_IDS.KHMER ? thermalCustomerPhone : '',
          currencySymbol,
          isDraft,
        });
        return (
          <ThermalReceiptDialog
            open={isTextReceiptOpen}
            onOpenChange={setIsTextReceiptOpen}
            receiptText={receiptText}
            onCopied={() => showToast('58 mm receipt copied. Paste it into your printer app.', 'success')}
          />
        );
      })()}

      {/* Batch Add Catalog Modal */}
      {isBatchModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-xs p-4 flex items-center justify-center no-print">
          <div className="bg-card border border-border w-full max-w-4xl rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">

            {/* Modal Header */}
            <div className="p-5 border-b border-border flex justify-between items-center bg-card/60">
              <div>
                <h3 className="font-bold text-foreground text-base sm:text-lg flex items-center gap-2">
                  <Grid className="w-5 h-5 text-primary" />
                  Batch Add Products from Catalog
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Adjust quantities for multiple products (including decimals like 0.5 or 1.5) and apply them in one batch.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setIsBatchModalOpen(false)}
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Modal Search Bar */}
            <div className="p-4 border-b border-border bg-card/40 flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search catalog by product name (English or Khmer)..."
                  value={batchSearchQuery}
                  onChange={(e) => setBatchSearchQuery(e.target.value)}
                  className="w-full pl-11 pr-4 text-sm h-10"
                />
              </div>
              <select
                value={selectedBrandFilter}
                onChange={(e) => setSelectedBrandFilter(e.target.value)}
                className="border border-input bg-background text-foreground rounded-lg px-3 py-2 text-sm min-w-[160px] h-10 focus:ring-2 focus:ring-ring focus:outline-hidden"
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
                className="border border-input bg-background text-foreground rounded-lg px-3 py-2 text-sm min-w-[160px] h-10 focus:ring-2 focus:ring-ring focus:outline-hidden"
              >
                <option value="all">All Categories</option>
                <option value="none">No Category</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Modal Product Grid */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 scrollbar-thin bg-muted/20">
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
                      className={`p-4 rounded-xl border transition-all ${qtyVal > 0
                          ? 'border-primary/40 bg-primary/5 shadow-xs'
                          : 'border-border bg-card/60 hover:border-primary/30'
                        }`}
                    >
                      <div className="flex items-start gap-3.5 min-h-[5rem]">
                        {/* Interactive Image */}
                        <div
                          onClick={increment}
                          className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden flex-shrink-0 bg-muted border border-border cursor-pointer hover:border-primary/50 hover:scale-105 active:scale-95 transition-all select-none"
                          title="Click to increase quantity"
                        >
                          {p.image_url ? (
                            <img src={p.image_url} alt={p.name_en} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-muted-foreground text-lg">📦</div>
                          )}
                        </div>

                        {/* Product Info */}
                        <div className="flex-1 min-w-0 text-left space-y-1">
                          <div className="flex justify-between items-start gap-1.5">
                            <h4 className="font-semibold text-foreground text-xs sm:text-sm line-clamp-2">{p.name_kh}</h4>
                            <span className="text-xs font-bold text-primary shrink-0 font-mono">
                              ${cheapestPrice.toFixed(2)}
                            </span>
                          </div>
                          <div className="text-[10px] text-muted-foreground flex flex-wrap items-center gap-1.5">
                            <span className="line-clamp-1 block w-full">{p.name_en}</span>
                            {p.brand_id && brands.find(b => b.id === p.brand_id) && (
                              <Badge variant="outline" className="px-1.5 py-0 text-[9px] border-primary/30 text-primary bg-primary/10">
                                {brands.find(b => b.id === p.brand_id).name}
                              </Badge>
                            )}
                            {p.category_id && categories.find(c => c.id === p.category_id) && (
                              <Badge variant="outline" className="px-1.5 py-0 text-[9px] border-violet-500/30 text-violet-500 bg-violet-500/10">
                                {categories.find(c => c.id === p.category_id).name}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-between items-center mt-3 pt-3 border-t border-border">
                        <div className="text-[10px] text-muted-foreground text-left">
                          <span className="block font-mono">Cost: ${cheapestPrice.toFixed(2)}</span>
                          <span className={`${totalStock <= 2 ? 'text-rose-500 font-semibold' : 'text-muted-foreground'}`}>
                            Stock: {totalStock}
                          </span>
                        </div>

                        {/* Qty Input Supporting Decimals */}
                        <div className="flex items-center gap-1 bg-background rounded-lg p-0.5 border border-input">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={decrement}
                            className="h-7 w-7 text-muted-foreground hover:text-foreground active:scale-90 transition-all cursor-pointer"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </Button>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            inputMode="decimal"
                            value={qtyRaw !== undefined ? qtyRaw : ''}
                            placeholder="0"
                            onChange={(e) => handleQtyChange(e.target.value)}
                            className="w-12 text-center bg-transparent border-0 outline-none text-xs font-bold text-foreground p-0 font-mono"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={increment}
                            className="h-7 w-7 text-muted-foreground hover:text-foreground active:scale-90 transition-all cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {getFilteredProducts(batchSearchQuery).length === 0 && (
                  <div className="col-span-full py-12 text-center text-muted-foreground italic text-sm">
                    No products found matching your search.
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-border flex flex-col sm:flex-row justify-between items-center gap-3 bg-card/60">
              <div className="text-xs text-muted-foreground text-center sm:text-left">
                Selected: <strong className="text-foreground">{Object.values(batchQuantities).filter(q => parseQuantity(q) > 0).length}</strong> products
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsBatchModalOpen(false)}
                  className="w-full sm:w-auto"
                >
                  Cancel
                </Button>
                <Button
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
                        updated.push(createEmptyLineItem());
                      } else {
                        const last = updated[updated.length - 1];
                        const isLastEmpty = last && !last.product_id && !(last.isCustom && last.custom_name);
                        if (!isLastEmpty) {
                          updated.push(createEmptyLineItem());
                        }
                      }

                      return updated;
                    });

                    setIsBatchModalOpen(false);
                  }}
                  className="w-full sm:w-auto"
                >
                  Apply to Invoice
                </Button>
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

      {/* Mobile-Friendly Supplier Selector Sheet / Dialog */}
      <Dialog open={!!supplierPickerModal} onOpenChange={(open) => !open && setSupplierPickerModal(null)}>
        <DialogContent className="max-w-md w-full max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden sm:rounded-2xl">
          <DialogHeader className="p-4 sm:p-5 border-b border-border bg-card/60">
            <DialogTitle className="text-base sm:text-lg flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              <span>Select Supplier &amp; Stock</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              {supplierPickerModal?.product?.name_kh} {supplierPickerModal?.product?.name_en ? `(${supplierPickerModal.product.name_en})` : ''}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 scrollbar-thin">
            {(() => {
              if (!supplierPickerModal?.product) return null;
              const productSps = productSupplierPrices[supplierPickerModal.product.id] || [];
              const cheapest = [...productSps].sort((a, b) => a.price - b.price)[0];

              return (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
                    <span>Available Offers ({productSps.length})</span>
                    <span className="text-[10px] text-muted-foreground/80 lowercase">tap card to select</span>
                  </div>

                  {productSps.length === 0 ? (
                    <div className="p-6 text-center text-muted-foreground space-y-3 bg-muted/20 rounded-xl border border-dashed border-border">
                      <p className="text-xs italic">No supplier offers found for this product.</p>
                      {suppliers.length > 0 && (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => {
                            const targetIdx = supplierPickerModal.itemIndex;
                            const targetProd = supplierPickerModal.product;
                            const firstSup = suppliers[0];
                            setSupplierPickerModal(null);
                            openStockEditModal(targetIdx, targetProd, firstSup, null);
                          }}
                          className="text-xs"
                        >
                          <Plus className="w-3.5 h-3.5 mr-1" /> Add Offer from {suppliers[0].name}
                        </Button>
                      )}
                    </div>
                  ) : (
                    productSps.map(sp => {
                      const sup = suppliers.find(s => s.id === sp.supplier_id);
                      const isCheapest = cheapest && cheapest.supplier_id === sp.supplier_id;
                      const isSelected = supplierPickerModal.currentSupplierId === sp.supplier_id;
                      const timeInfo = formatStockInTime(sp.updated_at);

                      return (
                        <div
                          key={sp.supplier_id}
                          className={`p-3.5 rounded-xl border transition-all ${
                            isSelected
                              ? 'border-primary bg-primary/5 ring-2 ring-primary/30 shadow-xs'
                              : isCheapest
                              ? 'border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500/60'
                              : 'border-border bg-card hover:border-primary/40'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div 
                              className="flex-1 cursor-pointer min-w-0"
                              onClick={() => {
                                updateLineItem(supplierPickerModal.itemIndex, 'supplier_id', sp.supplier_id);
                                setSupplierPickerModal(null);
                              }}
                            >
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-sm text-foreground">{sup ? sup.name : 'Unknown Supplier'}</span>
                                {isCheapest && (
                                  <Badge className="text-[9px] font-extrabold uppercase bg-emerald-600 text-white px-1.5 py-0 leading-tight">
                                    Cheapest ★
                                  </Badge>
                                )}
                                {isSelected && (
                                  <Badge variant="outline" className="text-[9px] font-bold uppercase border-primary text-primary px-1.5 py-0 leading-tight">
                                    Active In Invoice
                                  </Badge>
                                )}
                              </div>

                              <div className="flex items-center gap-3 mt-1.5">
                                <span className={`text-base font-extrabold font-mono ${isCheapest ? 'text-emerald-500' : 'text-foreground'}`}>
                                  ${Number(sp.price || 0).toFixed(2)}
                                </span>
                                <span className={`text-xs font-semibold ${sp.stock_qty <= 2 ? 'text-destructive font-bold' : 'text-muted-foreground'}`}>
                                  Stock: {sp.stock_qty} {sp.stock_unit || 'pcs'}
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-2">
                                <Clock className="w-3.5 h-3.5 text-primary shrink-0" />
                                <span>Stock In:</span>
                                {timeInfo ? (
                                  <strong className="text-foreground font-semibold">
                                    {timeInfo.relative} <span className="text-muted-foreground font-normal">({timeInfo.formattedDate})</span>
                                  </strong>
                                ) : (
                                  <span className="italic">Not recorded</span>
                                )}
                              </div>
                            </div>

                            <div className="flex flex-col gap-2 shrink-0 items-end">
                              <Button
                                type="button"
                                size="sm"
                                variant={isSelected ? "default" : "outline"}
                                onClick={() => {
                                  updateLineItem(supplierPickerModal.itemIndex, 'supplier_id', sp.supplier_id);
                                  setSupplierPickerModal(null);
                                }}
                                className="h-8 text-xs font-semibold px-3"
                              >
                                {isSelected ? (
                                  <>
                                    <Check className="w-3.5 h-3.5 mr-1" /> Selected
                                  </>
                                ) : (
                                  'Select'
                                )}
                              </Button>

                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  const targetIdx = supplierPickerModal.itemIndex;
                                  const targetProd = supplierPickerModal.product;
                                  setSupplierPickerModal(null);
                                  openStockEditModal(targetIdx, targetProd, sup, sp);
                                }}
                                className="h-7 text-[11px] text-muted-foreground hover:text-primary px-2"
                              >
                                <Edit2 className="w-3 h-3 mr-1" /> Update Stock
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}

                  {/* Add Offer from other available suppliers */}
                  {suppliers.filter(s => !productSps.some(sp => sp.supplier_id === s.id)).length > 0 && (
                    <div className="pt-3 border-t border-border mt-3">
                      <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                        Add Other Suppliers
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {suppliers
                          .filter(s => !productSps.some(sp => sp.supplier_id === s.id))
                          .map(sup => (
                            <Button
                              key={sup.id}
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const targetIdx = supplierPickerModal.itemIndex;
                                const targetProd = supplierPickerModal.product;
                                setSupplierPickerModal(null);
                                openStockEditModal(targetIdx, targetProd, sup, null);
                              }}
                              className="h-8 text-xs border-dashed text-foreground hover:text-primary"
                            >
                              <Plus className="w-3 h-3 mr-1 text-primary" /> {sup.name}
                            </Button>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          <div className="p-3 border-t border-border bg-card/60 flex items-center justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSupplierPickerModal(null)}
              className="text-xs"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick Stock-In / Update Stock & Price Dialog */}
      <Dialog open={!!stockEditModal} onOpenChange={(open) => !open && setStockEditModal(null)}>
        <DialogContent className="max-w-md w-full sm:rounded-2xl">
          {stockEditModal && (
            <form onSubmit={handleSaveStockEdit} className="space-y-4">
              <DialogHeader>
                <DialogTitle className="text-base sm:text-lg flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" />
                  <span>Update Stock &amp; Cost Price</span>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  For <strong className="text-foreground">{stockEditModal.product?.name_kh}</strong> from supplier <strong className="text-foreground">{stockEditModal.supplier?.name}</strong>
                </DialogDescription>
              </DialogHeader>

              {/* Previous Stock-In Info Banner */}
              {stockEditModal.priceObj?.updated_at && (
                <div className="p-2.5 rounded-xl bg-muted/50 border border-border flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span>Last Stock In:</span>
                  </div>
                  <strong className="text-foreground font-semibold">
                    {formatStockInTime(stockEditModal.priceObj.updated_at)?.relative} ({formatStockInTime(stockEditModal.priceObj.updated_at)?.formattedDate})
                  </strong>
                </div>
              )}

              {/* Cost Price */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Supplier Cost Price ($)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-semibold">$</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="0.00"
                    value={editStockPrice}
                    onChange={(e) => setEditStockPrice(e.target.value)}
                    className="pl-7 h-10 text-sm font-semibold"
                  />
                </div>
              </div>

              {/* Stock Quantity + Quick Increment Buttons for Mobile Convenience */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Stock Quantity
                  </label>
                  <span className="text-[11px] text-muted-foreground">
                    Current: <strong>{stockEditModal.priceObj?.stock_qty ?? 0}</strong> {editStockUnit}
                  </span>
                </div>

                <Input
                  type="number"
                  min="0"
                  step="any"
                  required
                  placeholder="E.g. 10, 25"
                  value={editStockQty}
                  onChange={(e) => setEditStockQty(e.target.value)}
                  className="h-10 text-sm font-bold"
                />

                {/* Quick Add Pills for Fast Mobile Restocking */}
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  <span className="text-[10px] text-muted-foreground font-semibold uppercase">Quick Add:</span>
                  {[1, 5, 10, 25, 50].map((addAmount) => (
                    <button
                      key={addAmount}
                      type="button"
                      onClick={() => {
                        const current = Number(editStockQty) || 0;
                        setEditStockQty((current + addAmount).toString());
                      }}
                      className="px-2 py-1 rounded-md text-[11px] font-bold bg-muted hover:bg-primary/10 hover:text-primary border border-border active:scale-95 transition-all"
                    >
                      +{addAmount}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setEditStockQty('0')}
                    className="px-2 py-1 rounded-md text-[11px] font-semibold text-muted-foreground hover:text-destructive hover:bg-destructive/10 border border-border active:scale-95 transition-all ml-auto"
                  >
                    Set 0
                  </button>
                </div>
              </div>

              {/* Stock Unit */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Stock Unit
                </label>
                <select
                  value={editStockUnit}
                  onChange={(e) => setEditStockUnit(e.target.value)}
                  className="w-full border border-input bg-background text-foreground rounded-lg px-3 py-2 text-sm h-10 focus:ring-2 focus:ring-ring focus:outline-hidden"
                >
                  <option value="pcs">Pieces (pcs)</option>
                  <option value="pack">Pack</option>
                  <option value="box">Box</option>
                  <option value="bottle">Bottle</option>
                  <option value="set">Set</option>
                  <option value="tube">Tube</option>
                  <option value="jar">Jar</option>
                  <option value="kg">Kilogram (kg)</option>
                  <option value="g">Gram (g)</option>
                  <option value="pair">Pair</option>
                </select>
              </div>

              <div className="text-[11px] text-muted-foreground bg-primary/5 border border-primary/20 rounded-xl p-2.5 flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary shrink-0" />
                <span>Saving will record <strong>now</strong> as the new stock-in time and update the invoice line item.</span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStockEditModal(null)}
                  disabled={isSavingStock}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSavingStock}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
                >
                  {isSavingStock ? 'Saving...' : 'Save & Stock In'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
