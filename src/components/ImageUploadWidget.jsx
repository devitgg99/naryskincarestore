import { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, ImageIcon, X } from 'lucide-react';

/**
 * ImageUploadWidget — Drag-and-drop, clipboard paste, camera, and gallery
 * product photo selector without cropping.
 *
 * Props:
 *   existingImageUrl — optional string URL for currently saved product photo
 *   onStateChange({ file, removed }) — notifies parent when selection changes
 */
export default function ImageUploadWidget({ existingImageUrl, onStateChange }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [removed, setRemoved] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const handleFileSelect = useCallback((selected) => {
    if (!selected) return;
    setPreview((prev) => {
      if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
      return URL.createObjectURL(selected);
    });
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
          if (pasted) {
            handleFileSelect(pasted);
            break;
          }
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
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          handleFileSelect(e.target.files[0]);
          e.target.value = '';
        }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          handleFileSelect(e.target.files[0]);
          e.target.value = '';
        }}
      />
    </div>
  );
}

