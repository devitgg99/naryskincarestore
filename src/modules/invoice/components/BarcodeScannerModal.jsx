import { Camera } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/**
 * BarcodeScannerModal — Full-screen camera scanner overlay.
 * The parent is responsible for starting/stopping the camera via the
 * cameraVideoRef and the isCameraScannerOpen flag.
 *
 * Props:
 *   isCameraScannerOpen    — boolean
 *   cameraVideoRef         — React ref for the <video> element
 *   cameraScannerError     — string | ''
 *   onClose()              — called when the dialog wants to close
 *   title                  — optional dialog heading (defaults to 'Barcode Scanner')
 */
export default function BarcodeScannerModal({
  isCameraScannerOpen,
  cameraVideoRef,
  cameraScannerError,
  onClose,
  title = 'Barcode Scanner',
}) {
  return (
    <Dialog
      open={isCameraScannerOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-md p-5 bg-dark-900/95 border-white/20 text-white rounded-3xl z-[200]">
        <DialogHeader className="flex flex-row items-center justify-between border-b border-white/10 pb-3 pr-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary-500/20 text-primary-400 border border-primary-500/30">
              <Camera className="w-5 h-5 animate-pulse" />
            </div>
            <div className="text-left">
              <DialogTitle className="text-base font-bold text-white">{title}</DialogTitle>
              <DialogDescription className="text-xs text-dark-300">
                Point your camera at the barcode
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-black my-2 shadow-inner">
          <video
            ref={cameraVideoRef}
            autoPlay
            playsInline
            muted
            className="h-[320px] w-full object-cover bg-black"
          />
          {/* Scan frame overlay */}
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
  );
}

