import { ImageIcon, Share2, Download, X } from 'lucide-react';

/**
 * ImageExportModal — Mobile-first "Save to Photos / Share" overlay shown
 * after a PNG/JPEG invoice image is generated.
 *
 * Props:
 *   imageExportModal  — { dataUrl, blobUrl, filename, file, format } | null
 *   onClose()         — clears state and revokes blobUrl
 */
export default function ImageExportModal({ imageExportModal, onClose }) {
  if (!imageExportModal) return null;

  return (
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
            onClick={onClose}
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
            <span>
              Tap <strong>Share / Save</strong> below, or <strong>long-press (touch &amp; hold)</strong> the image to save directly into your Photos app.
            </span>
          </div>
        </div>

        {/* Invoice Image Preview */}
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
                    text: 'Wholesale Invoice',
                  });
                } catch (err) {
                  if (err.name !== 'AbortError') {
                    console.warn('Share failed', err);
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
            onClick={onClose}
            className="glass-button-secondary py-2.5 px-4 text-xs font-medium min-h-[44px]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

