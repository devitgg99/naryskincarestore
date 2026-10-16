import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { Search, SlidersHorizontal, Edit2, Info, Plus, Trash2, Camera, ImageIcon, X, Crop, LayoutGrid, List, Printer, Sparkles } from 'lucide-react';
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



// ─── Image Upload Widget with Cropping ─────────────────────────────────────────
function ImageUploadWidget({ existingImageUrl, onStateChange }) {
  const [file, setFile] = useState(null);
  const [originalFile, setOriginalFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [removed, setRemoved] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);

  // Cropper States
  const [isCropping, setIsCropping] = useState(false);
  const [cropSrc, setCropSrc] = useState(null);
  const [cropZoom, setCropZoom] = useState(1);
  const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 });
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [cropImageName, setCropImageName] = useState('product_image.jpg');
  const [isSavingCrop, setIsSavingCrop] = useState(false);

  // Dragging States
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragOffsetStart, setDragOffsetStart] = useState({ x: 0, y: 0 });

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const viewportRef = useRef(null);
  const imageRef = useRef(null);
  // Use a ref to hold latest cropSrc so paste/callbacks don't go stale
  const cropSrcRef = useRef(null);

  const V = 300; // Viewport width/height px (CSS clamps to actual screen width)

  // ── Body scroll-lock while crop modal is open (prevents iOS page freeze) ──
  useEffect(() => {
    if (!isCropping) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isCropping]);

  const handleFileSelect = useCallback((selected) => {
    if (!selected) return;
    setOriginalFile(selected);
    if (cropSrcRef.current && cropSrcRef.current.startsWith('blob:')) {
      URL.revokeObjectURL(cropSrcRef.current);
    }
    const objectUrl = URL.createObjectURL(selected);
    cropSrcRef.current = objectUrl;
    setCropSrc(objectUrl);
    setCropImageName(selected.name || 'product_image.jpg');
    setIsCropping(true);
    setRemoved(false);
  }, []); // No dep on cropSrc — use ref

  useEffect(() => {
    const handlePaste = (e) => {
      if (isCropping) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const pastedFile = items[i].getAsFile();
          if (pastedFile) { handleFileSelect(pastedFile); break; }
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handleFileSelect, isCropping]);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setIsDragActive(true);
    else if (e.type === 'dragleave') setIsDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleRemove = () => {
    if (preview && preview.startsWith('blob:')) URL.revokeObjectURL(preview);
    if (cropSrcRef.current && cropSrcRef.current.startsWith('blob:')) URL.revokeObjectURL(cropSrcRef.current);
    cropSrcRef.current = null;
    setFile(null);
    setOriginalFile(null);
    setPreview(null);
    setRemoved(true);
    onStateChange({ file: null, removed: true });
  };

  const handleOpenCropper = () => {
    if (originalFile) {
      if (cropSrcRef.current && cropSrcRef.current.startsWith('blob:')) URL.revokeObjectURL(cropSrcRef.current);
      const objectUrl = URL.createObjectURL(originalFile);
      cropSrcRef.current = objectUrl;
      setCropSrc(objectUrl);
      setCropImageName(originalFile.name || 'product_image.jpg');
      setIsCropping(true);
    } else if (existingImageUrl && !removed) {
      cropSrcRef.current = existingImageUrl;
      setCropSrc(existingImageUrl);
      setCropImageName('product_image.jpg');
      setIsCropping(true);
    }
  };

  const handleCancelCrop = () => {
    if (cropSrcRef.current && cropSrcRef.current.startsWith('blob:')) URL.revokeObjectURL(cropSrcRef.current);
    cropSrcRef.current = null;
    setCropSrc(null);
    setIsCropping(false);
  };

  // "Use Original" — skip cropping, use the file as-is
  const handleUseOriginal = () => {
    if (!originalFile) { handleCancelCrop(); return; }
    const url = URL.createObjectURL(originalFile);
    setPreview((prev) => { if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev); return url; });
    setFile(originalFile);
    setRemoved(false);
    onStateChange({ file: originalFile, removed: false });
    if (cropSrcRef.current && cropSrcRef.current.startsWith('blob:')) URL.revokeObjectURL(cropSrcRef.current);
    cropSrcRef.current = null;
    setCropSrc(null);
    setIsCropping(false);
  };

  const handleImageLoad = (e) => {
    const { naturalWidth, naturalHeight } = e.target;
    setImageDimensions({ width: naturalWidth, height: naturalHeight });
    setCropZoom(1);
    setCropOffset({ x: 0, y: 0 });
  };

  const baseScale = imageDimensions.width > 0
    ? Math.max(V / imageDimensions.width, V / imageDimensions.height)
    : 1;

  const renderedWidth = imageDimensions.width * baseScale * cropZoom;
  const renderedHeight = imageDimensions.height * baseScale * cropZoom;
  const initX = (V - renderedWidth) / 2;
  const initY = (V - renderedHeight) / 2;
  const renderedX = initX + cropOffset.x;
  const renderedY = initY + cropOffset.y;

  const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

  const handleZoomChange = (newZoom) => {
    setCropZoom(newZoom);
    const wRendered = imageDimensions.width * baseScale * newZoom;
    const hRendered = imageDimensions.height * baseScale * newZoom;
    const maxOffsetX = Math.max(0, (wRendered - V) / 2);
    const maxOffsetY = Math.max(0, (hRendered - V) / 2);
    setCropOffset((prev) => ({
      x: clamp(prev.x, -maxOffsetX, maxOffsetX),
      y: clamp(prev.y, -maxOffsetY, maxOffsetY),
    }));
  };

  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setDragOffsetStart({ ...cropOffset });
  };

  const handleTouchStart = (e) => {
    if (e.touches.length !== 1) return;
    // Do NOT call e.preventDefault() here — let touchAction: 'none' on the element handle it
    setIsDragging(true);
    setDragStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    setDragOffsetStart({ ...cropOffset });
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e) => {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      const wRendered = imageDimensions.width * baseScale * cropZoom;
      const hRendered = imageDimensions.height * baseScale * cropZoom;
      const maxOffsetX = Math.max(0, (wRendered - V) / 2);
      const maxOffsetY = Math.max(0, (hRendered - V) / 2);
      setCropOffset({
        x: clamp(dragOffsetStart.x + dx, -maxOffsetX, maxOffsetX),
        y: clamp(dragOffsetStart.y + dy, -maxOffsetY, maxOffsetY),
      });
    };

    const handleTouchMove = (e) => {
      if (e.touches.length !== 1) return;
      // passive: true is safe here because touch-action: none on the viewport element
      // already suppresses scroll — we do NOT call e.preventDefault() to avoid the
      // non-passive listener freezing the page on iOS after the modal closes.
      const dx = e.touches[0].clientX - dragStart.x;
      const dy = e.touches[0].clientY - dragStart.y;
      const wRendered = imageDimensions.width * baseScale * cropZoom;
      const hRendered = imageDimensions.height * baseScale * cropZoom;
      const maxOffsetX = Math.max(0, (wRendered - V) / 2);
      const maxOffsetY = Math.max(0, (hRendered - V) / 2);
      setCropOffset({
        x: clamp(dragOffsetStart.x + dx, -maxOffsetX, maxOffsetX),
        y: clamp(dragOffsetStart.y + dy, -maxOffsetY, maxOffsetY),
      });
    };

    const handleDragEnd = () => setIsDragging(false);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleDragEnd);
    // Use passive: true — touch-action: none on the element prevents scroll without e.preventDefault()
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleDragEnd);
    // Safety: cancel also ends drag (e.g. when iOS pulls focus away)
    window.addEventListener('touchcancel', handleDragEnd);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleDragEnd);
      window.removeEventListener('touchcancel', handleDragEnd);
    };
  }, [isDragging, dragStart, dragOffsetStart, cropZoom, imageDimensions, baseScale]);

  const handleSaveCrop = () => {
    if (imageDimensions.width === 0) return;
    setIsSavingCrop(true);

    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');
    if (!ctx) { setIsSavingCrop(false); return; }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvasBaseScale = Math.max(600 / imageDimensions.width, 600 / imageDimensions.height);
        const canvasScale = canvasBaseScale * cropZoom;
        const wCanvas = imageDimensions.width * canvasScale;
        const hCanvas = imageDimensions.height * canvasScale;
        const canvasCenterX = cropOffset.x * (600 / V);
        const canvasCenterY = cropOffset.y * (600 / V);
        const canvasX = (600 - wCanvas) / 2 + canvasCenterX;
        const canvasY = (600 - hCanvas) / 2 + canvasCenterY;
        ctx.drawImage(img, canvasX, canvasY, wCanvas, hCanvas);

        canvas.toBlob((blob) => {
          setIsSavingCrop(false);
          if (!blob) { setIsCropping(false); return; }
          const croppedFile = new File([blob], cropImageName, { type: blob.type || 'image/jpeg' });
          setPreview((prev) => { if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev); return URL.createObjectURL(croppedFile); });
          setFile(croppedFile);
          setRemoved(false);
          onStateChange({ file: croppedFile, removed: false });
          if (cropSrcRef.current && cropSrcRef.current.startsWith('blob:')) URL.revokeObjectURL(cropSrcRef.current);
          cropSrcRef.current = null;
          setCropSrc(null);
          setIsCropping(false);
        }, 'image/jpeg', 0.9);
      } catch (err) {
        setIsSavingCrop(false);
        console.error('Crop error:', err);
        if (originalFile) {
          setFile(originalFile);
          setPreview((prev) => { if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev); return URL.createObjectURL(originalFile); });
          onStateChange({ file: originalFile, removed: false });
        }
        setIsCropping(false);
      }
    };
    img.onerror = () => {
      setIsSavingCrop(false);
      if (originalFile) {
        setFile(originalFile);
        setPreview((prev) => { if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev); return URL.createObjectURL(originalFile); });
        onStateChange({ file: originalFile, removed: false });
      }
      setIsCropping(false);
    };
    img.src = cropSrc;
  };

  const displayUrl = preview || (!removed && existingImageUrl) || null;
  const hasImage = file || (existingImageUrl && !removed);

  return (
    <>
      {/* ── Upload Zone ─────────────────────────────── */}
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
          {/* Thumbnail — clicking it opens cropper if image exists */}
          <button
            type="button"
            onClick={hasImage ? handleOpenCropper : () => fileInputRef.current?.click()}
            className="w-[80px] h-[80px] rounded-xl border-2 border-border flex items-center justify-center overflow-hidden bg-muted/60 flex-shrink-0 shadow-inner hover:border-primary/60 transition-colors group relative"
            title={hasImage ? 'Click to re-crop image' : 'Click to upload image'}
          >
            {displayUrl ? (
              <>
                <img src={displayUrl} alt="Product" className="w-full h-full object-cover rounded-xl" />
                <div className="absolute inset-0 rounded-xl bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Crop className="w-5 h-5 text-white" />
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
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleOpenCropper}
                  className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl border border-primary/30 bg-primary/5 hover:bg-primary/10 hover:border-primary/60 text-xs font-semibold text-primary transition-all active:scale-[0.97]"
                >
                  <Crop className="w-3.5 h-3.5" /> Crop / Adjust
                </button>
                <button
                  type="button"
                  onClick={handleRemove}
                  className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl border border-destructive/30 bg-destructive/5 hover:bg-destructive/10 hover:border-destructive/60 text-xs font-semibold text-destructive transition-all active:scale-[0.97]"
                >
                  <X className="w-3.5 h-3.5" /> Remove
                </button>
              </div>
            ) : (
              <p className="text-[10px] text-muted-foreground text-center px-1 leading-relaxed">
                Drag & drop or paste an image here
              </p>
            )}
          </div>
        </div>

        {/* Hidden file inputs — reset value so same file can be re-selected */}
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => { handleFileSelect(e.target.files[0]); e.target.value = ''; }} />
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden"
          onChange={(e) => { handleFileSelect(e.target.files[0]); e.target.value = ''; }} />
      </div>

      {/* ── Crop Modal ──────────────────────────────── */}
      {isCropping && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 bg-black/85 backdrop-blur-md animate-in fade-in duration-150" style={{ touchAction: 'none' }}>
          <div
            className="w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-[#0f0f0f] shadow-2xl animate-in zoom-in-95 duration-150 flex flex-col"
            style={{ maxHeight: 'min(95dvh, 620px)' }}
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-white/10 flex justify-between items-center flex-shrink-0">
              <div>
                <h3 className="font-bold text-sm text-white">Crop Image</h3>
                <p className="text-[11px] text-white/45 mt-0.5">Drag to reposition · slide to zoom</p>
              </div>
              <button
                type="button"
                onClick={handleCancelCrop}
                className="p-1.5 hover:bg-white/10 rounded-lg text-white/50 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Cropper body */}
            <div className="flex-1 overflow-auto flex flex-col items-center justify-center p-4 gap-4 bg-black/40">
              {/* Viewport */}
              <div
                ref={viewportRef}
                onMouseDown={handleMouseDown}
                onTouchStart={handleTouchStart}
                className="rounded-xl border border-white/15 bg-black/60 cursor-grab active:cursor-grabbing select-none overflow-hidden relative flex-shrink-0"
                style={{
                  width: `min(${V}px, calc(100vw - 48px))`,
                  height: `min(${V}px, calc(100vw - 48px))`,
                  touchAction: 'none',
                }}
              >
                {cropSrc && (
                  <img
                    ref={imageRef}
                    src={cropSrc}
                    alt="Crop source"
                    onLoad={handleImageLoad}
                    className="absolute select-none pointer-events-none max-w-none"
                    style={{
                      width: `${renderedWidth}px`,
                      height: `${renderedHeight}px`,
                      left: `${renderedX}px`,
                      top: `${renderedY}px`,
                    }}
                  />
                )}
                {/* Grid overlay */}
                <div className="absolute inset-0 pointer-events-none border border-white/25 rounded-xl">
                  <div className="absolute inset-x-0 top-1/3 border-t border-white/15"></div>
                  <div className="absolute inset-x-0 top-2/3 border-t border-white/15"></div>
                  <div className="absolute inset-y-0 left-1/3 border-l border-white/15"></div>
                  <div className="absolute inset-y-0 left-2/3 border-l border-white/15"></div>
                  {/* Corner accents */}
                  <div className="absolute top-2 left-2 w-5 h-5 border-t-2 border-l-2 border-white/60 rounded-tl"></div>
                  <div className="absolute top-2 right-2 w-5 h-5 border-t-2 border-r-2 border-white/60 rounded-tr"></div>
                  <div className="absolute bottom-2 left-2 w-5 h-5 border-b-2 border-l-2 border-white/60 rounded-bl"></div>
                  <div className="absolute bottom-2 right-2 w-5 h-5 border-b-2 border-r-2 border-white/60 rounded-br"></div>
                </div>
              </div>

              {/* Zoom slider */}
              <div className="w-full flex-shrink-0 space-y-1.5" style={{ maxWidth: `min(${V}px, calc(100vw - 48px))` }}>
                <div className="flex justify-between text-[11px] text-white/50 font-medium">
                  <span>Zoom</span>
                  <span>{Math.round(cropZoom * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="4"
                  step="0.02"
                  value={cropZoom}
                  onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-white"
                />
                <div className="flex justify-between text-[10px] text-white/25">
                  <span>1×</span><span>4×</span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-white/10 flex gap-2 flex-shrink-0">
              {originalFile && (
                <button
                  type="button"
                  onClick={handleUseOriginal}
                  disabled={isSavingCrop}
                  className="flex-1 py-2.5 rounded-xl border border-white/20 text-white/60 hover:text-white hover:bg-white/10 text-xs font-semibold transition-all disabled:opacity-40 active:scale-[0.97]"
                >
                  Use Original
                </button>
              )}
              <button
                type="button"
                onClick={handleCancelCrop}
                disabled={isSavingCrop}
                className="flex-1 py-2.5 rounded-xl border border-white/20 text-white/60 hover:text-white hover:bg-white/10 text-xs font-semibold transition-all disabled:opacity-40 active:scale-[0.97]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveCrop}
                disabled={isSavingCrop || imageDimensions.width === 0}
                className="flex-[1.5] py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 active:scale-[0.97]"
              >
                {isSavingCrop ? (
                  <>
                    <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    Saving…
                  </>
                ) : (
                  <><Crop className="w-3.5 h-3.5" /> Apply Crop</>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
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

  // Map brands & categories for lookup
  const brandMap = {};
  brands.forEach(b => {
    brandMap[b.id] = b.name;
  });

  const categoryMap = {};
  categories.forEach(c => {
    categoryMap[c.id] = c.name;
  });

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
      const hasSupplierOffer = priceMap[product.id] && priceMap[product.id][selectedSupplierFilter];
      if (!hasSupplierOffer) return false;
    }

    return true;
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
