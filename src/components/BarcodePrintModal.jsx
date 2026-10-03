import { useState } from 'react';
import { createPortal } from 'react-dom';
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
import { Printer } from 'lucide-react';

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
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-xl p-6 bg-card border-border text-foreground rounded-xl z-[200]">
          
          {/* Screen-only Modal Header */}
          <div className="space-y-4">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted text-[#000080] dark:text-blue-400 border border-border">
                  <Printer className="w-4 h-4" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-foreground">Print Barcode Labels</DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    Print scannable barcode sticker labels for your thermal printer or paper.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            {/* Settings Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-lg bg-muted/30 border border-border">
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
                    className="h-8.5 text-xs flex-1 font-mono"
                  />
                  <div className="flex gap-1">
                    {[1, 5, 10, 20].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setPrintQuantity(num)}
                        className={`px-2 py-1 rounded-md text-xs font-semibold border transition-colors cursor-pointer ${
                          Number(printQuantity) === num
                            ? 'bg-[#000080] text-white border-transparent'
                            : 'bg-card border-border text-muted-foreground hover:text-foreground'
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
                  className="flex h-8.5 w-full rounded-md border border-input bg-background px-3 py-1 text-xs text-foreground outline-none focus:border-[#000080]"
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
              <div className="p-5 rounded-xl bg-white text-black flex flex-col items-center justify-center border border-border shadow-xs max-w-xs mx-auto text-center space-y-1">
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
                className="gap-2 bg-[#000080] hover:bg-[#000066] text-white font-semibold"
              >
                <Printer className="w-4 h-4" /> Print {qty} Label{qty > 1 ? 's' : ''}
              </Button>
            </DialogFooter>
          </div>

        </DialogContent>
      </Dialog>

      {/* Dedicated Print Portal rendered directly into document.body for clean print output */}
      {isOpen && createPortal(
        <div className="barcode-print-portal">
          <div className={labelPreset === 'single' ? 'print-thermal-roll' : 'print-label-grid'}>
            {labelItems.map((_, idx) => (
              <div key={idx} className="barcode-label-sticker">
                <div className="label-title">{product.name_kh || product.name_en}</div>
                <div className="label-subtitle">{product.name_en}</div>
                <div className="label-barcode">
                  <BarcodeSvg value={product.barcode} height={38} barWidth={1.4} />
                </div>
                <div className="label-price">
                  ${Number(product.selling_price || (Number(product.base_price) + 0.20)).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
