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
  Camera,
  ImageIcon,
  Download,
  Share2,
  Cloud,
  FileText,
  PauseCircle,
  ChevronUp,
  ChevronDown,
  FileDown
} from 'lucide-react';
import { toPng, toJpeg } from 'html-to-image';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { db, getSupabaseConfig, generateDraftId } from '../services/db';
import confetti from 'canvas-confetti';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { OldReceiptTemplate, KhmerInvoiceTemplate } from './invoice/templates';
import {
  roundMoney,
  parseQuantity,
  TEMPLATE_IDS,
  TEMPLATE_OPTIONS,
  KHMER_FONTS,
  ENGLISH_FONTS,
  PAGE_SIZES,
  DEFAULT_INVOICE_SETTINGS,
  createSampleCustomLineItems,
  downloadPdfFromJpeg,
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

const createEmptyDraft = (name = 'Order #1') => {
  const now = new Date().toISOString();
  return {
    id: generateDraftId(),
    name,
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

export default function InvoiceBuilder({ customers, products, suppliers, prices, brands = [], categories = [], onRefresh, showToast }) {
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
  const [invoiceNumber, setInvoiceNumber] = useState(() => localStorage.getItem('wsp_invoice_number') || '02901');
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

  // POS Quick Add States
  const [quickSearchQuery, setQuickSearchQuery] = useState('');
  const [isQuickDropdownOpen, setIsQuickDropdownOpen] = useState(false);
  const [isScannerMode, setIsScannerMode] = useState(false);
  const [isCameraScannerOpen, setIsCameraScannerOpen] = useState(false);
  const [cameraScannerError, setCameraScannerError] = useState('');
  const quickInputRef = useRef(null);
  const cameraVideoRef = useRef(null);
  const barcodeReaderRef = useRef(null);
  const barcodeScanLockRef = useRef(false);
  const lastScannedCodeRef = useRef('');
  const lastProcessedBarcodeRef = useRef({ code: '', timestamp: 0 });

  const stopCameraScanner = () => {
    try {
      barcodeReaderRef.current?.stopContinuousDecode?.();
    } catch (err) {
      console.warn('Continuous decode stop failed:', err);
    }

    try {
      barcodeReaderRef.current?.reset();
    } catch (err) {
      console.warn('Camera reset failed:', err);
    }

    barcodeScanLockRef.current = false;
    lastScannedCodeRef.current = '';
    barcodeReaderRef.current = null;

    const tracks = cameraVideoRef.current?.srcObject instanceof MediaStream
      ? cameraVideoRef.current.srcObject.getTracks()
      : [];

    tracks.forEach((track) => track.stop());
    if (cameraVideoRef.current) {
      cameraVideoRef.current.srcObject = null;
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

  const applyDraftToForm = (draft) => {
    setDraftName(draft.name || 'Order #1');
    setSelectedCustomerId(draft.customer_id || '');
    setHasDelivery(draft.has_delivery !== false);
    setDeliveryFee(draft.delivery_fee !== undefined && draft.delivery_fee !== null ? String(draft.delivery_fee) : '1.50');
    setDiscountType(draft.discount_type || 'fixed');
    setDiscountValue(draft.discount_value !== undefined && draft.discount_value !== null ? String(draft.discount_value) : '0');
    setLineItems(
      Array.isArray(draft.line_items) && draft.line_items.length > 0
        ? draft.line_items
        : [createEmptyLineItem()]
    );
  };

  // 1. Initial load of drafts from Supabase (or LocalStorage fallback)
  useEffect(() => {
    let isMounted = true;
    const initDrafts = async () => {
      try {
        const fetched = await db.getDrafts();
        if (!isMounted) return;
        if (Array.isArray(fetched) && fetched.length > 0) {
          setDrafts(fetched);
          const savedActiveId = localStorage.getItem('wsp_active_draft_id');
          const target = fetched.find(d => d.id === savedActiveId) || fetched[0];
          setActiveDraftId(target.id);
          applyDraftToForm(target);
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

    const currentPayload = {
      id: activeDraftId,
      name: draftName,
      customer_id: selectedCustomerId,
      has_delivery: hasDelivery,
      delivery_fee: deliveryFee,
      discount_type: discountType,
      discount_value: discountValue,
      line_items: lineItems.map(item => ({ ...item, isDropdownOpen: false }))
    };

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
  }, [activeDraftId, draftName, selectedCustomerId, hasDelivery, deliveryFee, discountType, discountValue, lineItems]);

  // Draft Management Handlers
  const handleSwitchDraft = async (targetDraftId) => {
    if (targetDraftId === activeDraftId) return;

    // Save current active draft immediately before switching
    if (activeDraftId) {
      const currentPayload = {
        id: activeDraftId,
        name: draftName,
        customer_id: selectedCustomerId,
        has_delivery: hasDelivery,
        delivery_fee: deliveryFee,
        discount_type: discountType,
        discount_value: discountValue,
        line_items: lineItems.map(item => ({ ...item, isDropdownOpen: false }))
      };
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
    // Save current active draft first
    if (activeDraftId) {
      const currentPayload = {
        id: activeDraftId,
        name: draftName,
        customer_id: selectedCustomerId,
        has_delivery: hasDelivery,
        delivery_fee: deliveryFee,
        discount_type: discountType,
        discount_value: discountValue,
        line_items: lineItems.map(item => ({ ...item, isDropdownOpen: false }))
      };
      try {
        await db.saveDraft(currentPayload);
      } catch (err) {
        console.debug(err);
      }
    }

    const newDraft = createEmptyDraft(`Order #${drafts.length + 1}`);

    try {
      setIsSyncingDraft(true);
      await db.saveDraft(newDraft);
      setDrafts(prev => [newDraft, ...prev]);
      setActiveDraftId(newDraft.id);
      localStorage.setItem('wsp_active_draft_id', newDraft.id);
      applyDraftToForm(newDraft);
      showToast(`Started new draft "${newDraft.name}"`, "success");
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
        const freshDraft = createEmptyDraft('Order #1');
        await db.saveDraft(freshDraft);
        setDrafts([freshDraft]);
        setActiveDraftId(freshDraft.id);
        localStorage.setItem('wsp_active_draft_id', freshDraft.id);
        applyDraftToForm(freshDraft);
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
        setDrafts(updated);
        const current = updated.find(d => d.id === activeDraftId) || updated[0];
        if (current && current.id !== activeDraftId) {
          setActiveDraftId(current.id);
          applyDraftToForm(current);
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
    const value = String(overrideValue ?? quickSearchQuery ?? '').trim();
    if (!value) return;

    const now = Date.now();
    const sameRecentBarcode = value === lastProcessedBarcodeRef.current.code
      && now - lastProcessedBarcodeRef.current.timestamp < 1500;

    if (sameRecentBarcode) {
      const debugMessage = `Repeated scan detected for "${value}". Quantity add stopped to prevent a loop.`;
      setCameraScannerError(debugMessage);
      setIsCameraScannerOpen(false);
      stopCameraScanner();
      showToast(debugMessage, 'error');
      return;
    }

    lastProcessedBarcodeRef.current = { code: value, timestamp: now };

    const exactMatch = findProductByBarcode(value) || getFilteredProducts(value)[0];
    if (exactMatch) {
      addProductToInvoice(exactMatch.id, 1);
      setQuickSearchQuery('');
      setIsQuickDropdownOpen(false);
      setIsScannerMode(true);
      quickInputRef.current?.focus();
      return;
    }

    showToast('No matching product found for this barcode or product name.', 'warning');
  };

  const openBarcodeCamera = async () => {
    setCameraScannerError('');
    barcodeScanLockRef.current = false;
    lastScannedCodeRef.current = '';
    setIsCameraScannerOpen(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' }
        }
      });

      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = stream;
      }

      const reader = new BrowserMultiFormatReader();
      barcodeReaderRef.current = reader;

      const videoInputDevices = await BrowserMultiFormatReader.listVideoInputDevices();
      const preferredRearCamera = videoInputDevices.find((device) => {
        const label = (device.label || '').toLowerCase();
        return label.includes('back') || label.includes('rear') || label.includes('environment');
      });
      const selectedDeviceId = preferredRearCamera?.deviceId || videoInputDevices[0]?.deviceId || undefined;

      if (!selectedDeviceId) {
        throw new Error('No camera found on this device. Make sure the browser has camera access enabled.');
      }

      await reader.decodeFromVideoDevice(selectedDeviceId, cameraVideoRef.current, (result, error) => {
        if (result) {
          const scannedCode = result.getText()?.trim();

          if (!scannedCode) {
            return;
          }

          if (barcodeScanLockRef.current || scannedCode === lastScannedCodeRef.current) {
            const debugMessage = `Repeated barcode detected: "${scannedCode}". Scan stopped to prevent duplicate adds.`;
            setCameraScannerError(debugMessage);
            setIsCameraScannerOpen(false);
            stopCameraScanner();
            showToast(debugMessage, 'error');
            return;
          }

          lastScannedCodeRef.current = scannedCode;
          barcodeScanLockRef.current = true;
          setQuickSearchQuery(scannedCode);
          setIsQuickDropdownOpen(false);
          setIsCameraScannerOpen(false);
          stopCameraScanner();
          setTimeout(() => {
            handleBarcodeSubmit(scannedCode);
          }, 100);
        }

        if (error && error.name !== 'NotFoundException') {
          console.warn('Barcode scan warning:', error);
        }
      });
    } catch (err) {
      console.error('Camera barcode scan start failed:', err);
      setCameraScannerError(
        err?.message || 'Unable to access the camera. Please allow camera access in Safari and open the site over HTTPS.'
      );
      setIsCameraScannerOpen(false);
      stopCameraScanner();
      showToast('Camera access failed. Please allow camera permission in Safari and use the HTTPS site.', 'warning');
    }
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
    setLineItems(samples);
    setInvoiceCustomerName((prev) => prev || 'Yean Devit');
    setInvoicePhone((prev) => prev || '0884577039');
    setInvoiceNumber((prev) => prev || '02901');
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
      const orderObj = {
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
        order: { ...result, discount: calculatedDiscount, delivery_fee: effectiveDeliveryFee },
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
        applyDraftToForm(next);
      } else {
        const freshDraft = createEmptyDraft('Order #1');
        await db.saveDraft(freshDraft);
        setDrafts([freshDraft]);
        setActiveDraftId(freshDraft.id);
        localStorage.setItem('wsp_active_draft_id', freshDraft.id);
        applyDraftToForm(freshDraft);
      }
      showToast("Invoice saved successfully!", "success");
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
    const customer = customers.find(c => c.id === selectedCustomerId);
    const nameSource = invoiceCustomerName || customer?.name || 'Customer';
    const safeName = nameSource.replace(/[^a-zA-Z0-9_\-\u0600-\u06FF\u1780-\u17FF]/g, '_');
    const timestamp = new Date().toISOString().slice(0, 10);
    return `Invoice_${safeName}_${timestamp}.${ext}`;
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
                title="Hold current order and start a new blank draft"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ New Order / Draft</span>
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
                  title={`Switch to ${displayLabel} (${itemCount} items • $${draftSubtotal.toFixed(2)})`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-primary' : 'bg-muted-foreground/40'}`} />
                    <span className="font-semibold max-w-[130px] truncate">{displayLabel}</span>
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
                    title="Park current order and start another"
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
                      <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Invoice Number</label>
                      <Input
                        type="text"
                        value={invoiceNumber}
                        onChange={(e) => setInvoiceNumber(e.target.value)}
                        placeholder="វិក្កយបត្រលេខ"
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
                          handleBarcodeSubmit();
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
                              <span>{p.barcode ? `Barcode: ${p.barcode}` : 'Stock: ' + totalStock}</span>
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

              {isCameraScannerOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4">
                  <div className="w-full max-w-md rounded-2xl border border-white/20 bg-slate-900 p-3 shadow-2xl">
                    <div className="mb-3 flex items-center justify-between gap-3 text-white">
                      <div>
                        <div className="text-sm font-bold">Barcode Scanner</div>
                        <div className="text-[10px] text-slate-300">Point your iPhone camera at the barcode</div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setIsCameraScannerOpen(false);
                          stopCameraScanner();
                        }}
                        className="h-8 px-2.5 text-[11px] border-white/20 text-white hover:bg-white/10"
                      >
                        Close
                      </Button>
                    </div>

                    <div className="relative overflow-hidden rounded-xl border border-white/10 bg-black">
                      <video ref={cameraVideoRef} autoPlay playsInline muted className="h-[320px] w-full object-cover bg-black" />
                      <div className="pointer-events-none absolute inset-x-8 top-1/2 h-24 -translate-y-1/2 rounded-xl border-2 border-emerald-400/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
                    </div>

                    {cameraScannerError && (
                      <div className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                        {cameraScannerError}
                      </div>
                    )}
                  </div>
                </div>
              )}

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
                      className="p-3.5 sm:p-4 rounded-xl border border-border bg-card/40 space-y-3 transition-colors hover:border-primary/30"
                    >
                      {/* Top Row: Thumbnail + Product Selector / Custom Name + Item Mode + Delete */}
                      <div className="flex items-center gap-3">
                        {/* Thumbnail */}
                        <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl border border-border flex items-center justify-center overflow-hidden bg-muted flex-shrink-0 shadow-xs">
                          {item.isCustom ? (
                            <span className="text-[10px] text-violet-500 font-bold bg-violet-500/10 w-full h-full flex items-center justify-center">Custom</span>
                          ) : (
                            prod && prod.image_url ? (
                              <img src={prod.image_url} alt="Product" className="w-full h-full object-cover rounded-xl" />
                            ) : (
                              <ImageIcon className="w-5 h-5 text-muted-foreground" />
                            )
                          )}
                        </div>

                        {/* Search / Select Product Input */}
                        <div className="flex-1 relative min-w-0">
                          {item.isCustom ? (
                            <Input
                              type="text"
                              required
                              placeholder="Custom item name..."
                              value={item.custom_name || ''}
                              onChange={(e) => updateLineItem(idx, 'custom_name', e.target.value)}
                              className="w-full border-violet-500/30 focus-visible:border-violet-500/60 text-xs sm:text-sm font-medium h-10"
                            />
                          ) : (
                            <>
                              <Input
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
                                className="w-full text-xs sm:text-sm h-10"
                              />
                              {item.isDropdownOpen && (
                                <div className="absolute left-0 right-0 mt-1 max-h-60 overflow-y-auto z-50 rounded-xl bg-popover border border-border shadow-2xl divide-y divide-border scrollbar-thin">
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
                                      className="p-3 hover:bg-primary/10 cursor-pointer text-left transition-colors min-h-[44px]"
                                    >
                                      <div className="font-semibold text-foreground text-xs sm:text-sm">{p.name_kh}</div>
                                      <div className="text-[10px] text-muted-foreground mt-0.5">{p.name_en}</div>
                                    </div>
                                  ))}
                                  {getFilteredProducts(item.searchQuery || '').length === 0 && (
                                    <div className="p-3 text-muted-foreground text-xs italic text-center">No products found</div>
                                  )}
                                </div>
                              )}
                            </>
                          )}
                        </div>

                        {/* Mode toggle button */}
                        <Button
                          type="button"
                          variant={item.isCustom ? "secondary" : "outline"}
                          size="sm"
                          onClick={() => updateLineItem(idx, 'isCustom', !item.isCustom)}
                          className={`h-10 px-2.5 text-[11px] font-bold shrink-0 ${item.isCustom ? 'border-violet-500/30 text-violet-500 hover:bg-violet-500/20' : ''
                            }`}
                          title={item.isCustom ? "Switch to Catalog item select" : "Switch to freeform manual input"}
                        >
                          {item.isCustom ? "Custom" : "Catalog"}
                        </Button>

                        {/* Reorder */}
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

                        {/* Remove button */}
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

                      {/* Controls Grid: Supplier, Unit Price, Decimal Quantity & Subtotal */}
                      <div className="grid grid-cols-2 sm:grid-cols-12 gap-3 items-end pt-1">
                        {/* Supplier Selector (Mobile full width / Desktop 4 cols) */}
                        <div className="col-span-2 sm:col-span-4">
                          <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                            Supplier & Cost Price
                          </label>
                          {item.isCustom ? (
                            <div className="w-full border border-dashed border-border rounded-lg bg-muted/30 text-muted-foreground text-xs italic flex items-center justify-center h-10">
                              No Supplier (Ad-hoc)
                            </div>
                          ) : (
                            <select
                              required
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
                          <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                            Unit Price ($)
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-semibold">$</span>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              required
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
                            required
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
                              <Input type="text" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} className="h-8 text-xs" />
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
                            invoiceNumber={invoiceNumber}
                            invoiceDate={invoiceDate}
                            customerName={invoiceCustomerName || receiptData.customer?.name}
                            phone={invoicePhone || receiptData.customer?.phone}
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
        return (
          <div className={`hidden print-only bg-white text-black leading-normal ${receiptTemplate === TEMPLATE_IDS.KHMER ? 'print-a4 p-0' : 'p-4 font-sans'}`}>
            {receiptTemplate === TEMPLATE_IDS.KHMER ? (
              <KhmerInvoiceTemplate
                receiptData={receiptData}
                products={products}
                invoiceNumber={invoiceNumber}
                invoiceDate={invoiceDate}
                customerName={invoiceCustomerName || receiptData.customer?.name}
                phone={invoicePhone || receiptData.customer?.phone}
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
                  isDraft={isDraft}
                  showDraftBanner={false}
                  currencySymbol={currencySymbol}
                />
              </div>
            )}
          </div>
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
    </div>
  );
}
