import { useState } from 'react';
import { BarcodeSvg } from '../services/barcodeGenerator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Printer, Tag, Sparkles } from 'lucide-react';

export default function BarcodePrintModal({ product, isOpen, onClose }) {
  const [printQuantity, setPrintQuantity] = useState(1);
  const [labelPreset, setLabelPreset] = useState('single'); // 'single' (Thermal Roll) or 'sheet' (Grid Sheet)

  if (!product) return null;

  const handlePrint = () => {
    window.print();
  };

  const qty = Math.max(1, Math.min(200, parseInt(printQuantity, 10) || 1));
  const labelItems = Array.from({ length: qty });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl p-6 bg-dark-900 border-dark-800 text-foreground rounded-3xl z-[200]">
        
        {/* Screen-only Modal Header */}
        <div className="no-print space-y-4">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary-500/20 text-primary-400 border border-primary-500/30">
                <Printer className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-white">Print Barcode Labels</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Print scannable barcode sticker labels for your thermal printer or paper.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Settings Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-dark-950/60 border border-dark-800/80">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Number of Copies
              </label>
              <div className="flex items-center gap-2">
                <Input 
                  type="number"
                  min="1"
                  max="200"
                  value={printQuantity}
                  onChange={(e) => setPrintQuantity(e.target.value)}
                  className="h-9 text-xs flex-1 font-mono"
                />
                <div className="flex gap-1">
                  {[1, 5, 10, 20].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setPrintQuantity(num)}
                      className={`px-2 py-1 rounded-lg text-xs font-semibold border transition-all ${
                        Number(printQuantity) === num
                          ? 'bg-primary-500/20 text-primary-400 border-primary-500/40'
                          : 'bg-dark-900 border-dark-800 text-muted-foreground hover:text-white'
                      }`}
                    >
                      {num}x
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Printer Format
              </label>
              <select
                value={labelPreset}
                onChange={(e) => setLabelPreset(e.target.value)}
                className="flex h-9 w-full rounded-xl border border-dark-800 bg-dark-900 px-3 py-1 text-xs text-white outline-none focus:border-primary-500"
              >
                <option value="single">Thermal Sticker Roll (Single Label per page)</option>
                <option value="sheet">Sticker Sheet Grid (Multi-label page)</option>
              </select>
            </div>
          </div>

          {/* On-Screen Label Preview Box */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
              Live Label Preview
            </span>
            <div className="p-6 rounded-2xl bg-white text-black flex flex-col items-center justify-center border border-slate-300 shadow-inner max-w-xs mx-auto text-center space-y-1">
              <span className="text-xs font-bold text-slate-900 line-clamp-1 leading-tight font-sans">
                {product.name_kh || product.name_en}
              </span>
              <span className="text-[10px] text-slate-600 line-clamp-1 font-sans">
                {product.name_en}
              </span>
              
              <div className="py-1 text-black">
                <BarcodeSvg value={product.barcode} height={45} barWidth={1.8} />
              </div>

              {product.selling_price || product.base_price ? (
                <div className="pt-1 flex items-center justify-center gap-1.5 border-t border-slate-200 w-full">
                  <span className="text-[10px] uppercase font-bold text-slate-500">PRICE:</span>
                  <span className="text-sm font-black text-slate-900 font-mono">
                    ${Number(product.selling_price || (Number(product.base_price) + 0.20)).toFixed(2)}
                  </span>
                </div>
              ) : null}
            </div>
          </div>

          <DialogFooter className="flex justify-between items-center pt-2">
            <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
              Cancel
            </Button>
            <Button 
              size="sm" 
              onClick={handlePrint}
              className="gap-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold"
            >
              <Printer className="w-4 h-4" /> Print {qty} Label{qty > 1 ? 's' : ''}
            </Button>
          </DialogFooter>
        </div>

        {/* Print-Only Template Rendered for Browser Printer */}
        <div className="print-only hidden">
          <div className={labelPreset === 'single' ? 'print-thermal-roll' : 'print-label-grid'}>
            {labelItems.map((_, idx) => (
              <div key={idx} className="barcode-label-sticker">
                <div className="label-title">{product.name_kh || product.name_en}</div>
                <div className="label-subtitle">{product.name_en}</div>
                <div className="label-barcode">
                  <BarcodeSvg value={product.barcode} height={40} barWidth={1.5} />
                </div>
                <div className="label-price">
                  ${Number(product.selling_price || (Number(product.base_price) + 0.20)).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>

      </DialogContent>
    </Dialog>
  );
}
