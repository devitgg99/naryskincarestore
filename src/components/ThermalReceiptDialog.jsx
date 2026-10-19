import { useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function ThermalReceiptDialog({ open, onOpenChange, receiptText, onCopied }) {
  const textareaRef = useRef(null);
  const [copied, setCopied] = useState(false);

  const copyReceipt = async () => {
    if (!receiptText) return;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(receiptText);
      } else {
        textareaRef.current?.select();
        document.execCommand('copy');
      }
      setCopied(true);
      onCopied?.();
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      textareaRef.current?.focus();
      textareaRef.current?.select();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1.5rem)] max-w-md p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-5 pb-3 text-left">
          <DialogTitle>58 mm Text Receipt</DialogTitle>
          <DialogDescription>
            Copy this and paste it into your iPhone printer app. The one-item-per-line layout keeps the text easy to read on narrow paper.
          </DialogDescription>
        </DialogHeader>
        <div className="px-5 pb-5 space-y-3">
          <textarea
            ref={textareaRef}
            readOnly
            value={receiptText}
            onFocus={(event) => event.currentTarget.select()}
            className="h-[48vh] min-h-72 w-full resize-none rounded-lg border border-input bg-white p-4 font-mono text-[15px] font-semibold leading-6 text-black outline-none focus:ring-2 focus:ring-ring"
            aria-label="58 mm receipt text"
          />
          <Button type="button" className="w-full gap-2" onClick={copyReceipt}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copied' : 'Copy Receipt Text'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
