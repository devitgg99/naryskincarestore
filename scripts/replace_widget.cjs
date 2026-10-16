const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/modules/PricingTable.jsx');
const content = fs.readFileSync(filePath, 'utf8');

const startMarker = '// ─── Image Upload Widget with Cropping ─────────────────────────────────────────';
const endMarker = '\nexport default function PricingTable';

const startIdx = content.indexOf(startMarker);
const endIdx = content.indexOf(endMarker);

if (startIdx === -1 || endIdx === -1) {
  console.error('Markers not found!', startIdx, endIdx);
  process.exit(1);
}

const before = content.slice(0, startIdx);
const after = content.slice(endIdx); // starts with \nexport default...

const newWidget = `// ─── Image Upload Widget with Cropping ─────────────────────────────────────────
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

  const V = 300; // Viewport width/height px

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
      e.preventDefault();
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
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleDragEnd);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleDragEnd);
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
        className={\`rounded-2xl border-2 border-dashed transition-all duration-200 \${
          isDragActive
            ? 'border-primary bg-primary/10 shadow-lg shadow-primary/5'
            : 'border-border bg-card/40 hover:border-primary/50'
        }\`}
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
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
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
                style={{ width: \`\${V}px\`, height: \`\${V}px\`, touchAction: 'none' }}
              >
                {cropSrc && (
                  <img
                    ref={imageRef}
                    src={cropSrc}
                    alt="Crop source"
                    onLoad={handleImageLoad}
                    className="absolute select-none pointer-events-none max-w-none"
                    style={{
                      width: \`\${renderedWidth}px\`,
                      height: \`\${renderedHeight}px\`,
                      left: \`\${renderedX}px\`,
                      top: \`\${renderedY}px\`,
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
              <div className="w-full flex-shrink-0 space-y-1.5" style={{ maxWidth: \`\${V}px\` }}>
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

`;

const newContent = before + newWidget + after;
fs.writeFileSync(filePath, newContent, 'utf8');
console.log('Done! New file size:', newContent.length, 'bytes');
