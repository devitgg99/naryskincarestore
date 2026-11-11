import {
  Eye, Printer, Download, FileDown, ShoppingCart, RefreshCw, AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

/**
 * CheckoutSummaryCard — Right-side sticky summary card showing subtotal,
 * discount, delivery fee, profit, and grand total; plus the action buttons
 * (Preview, Print, PNG, PDF, Save & Print Invoice).
 *
 * Props:
 *   subtotal           — number
 *   calculatedDiscount — number
 *   discountType       — 'fixed' | 'percent'
 *   discountValue      — string
 *   hasDelivery        — boolean
 *   effectiveDeliveryFee — number
 *   totalProfit        — number
 *   totalAmount        — number
 *   lineItems          — LineItem[]
 *   isSaving           — boolean
 *   isExporting        — boolean
 *   onPreviewReceipt()
 *   onPrint()
 *   onDownloadImage(format: 'png'|'jpeg')
 *   onDownloadPdf()
 *   onSaveInvoice()
 */
export default function CheckoutSummaryCard({
  subtotal,
  calculatedDiscount,
  discountType,
  discountValue,
  hasDelivery,
  effectiveDeliveryFee,
  totalProfit,
  totalAmount,
  lineItems,
  isSaving,
  isExporting,
  onPreviewReceipt,
  onPrint,
  onDownloadImage,
  onDownloadPdf,
  onSaveInvoice,
}) {
  const itemCount = lineItems.filter(
    (item) => item.product_id || (item.isCustom && item.custom_name)
  ).length;

  return (
    <div className="space-y-6">
      <Card className="p-6 bg-card/60 backdrop-blur-md border-border shadow-xs space-y-6">
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Checkout Summary</h3>

        {/* Line items breakdown */}
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

        {/* Grand Total */}
        <div className="flex justify-between items-end">
          <div>
            <span className="text-xs text-muted-foreground font-bold uppercase tracking-wider block">Grand Total</span>
            <span className="text-2xl sm:text-3xl font-black text-foreground font-mono">${totalAmount.toFixed(2)}</span>
          </div>
          <Badge variant="outline" className="text-xs text-primary border-primary/30 bg-primary/10">
            {itemCount} Items
          </Badge>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3">
          <div className="flex gap-2 flex-wrap">
            <Button
              type="button"
              variant="outline"
              onClick={onPreviewReceipt}
              className="flex-1 min-h-[44px] gap-2 font-semibold text-xs sm:text-sm min-w-[110px]"
            >
              <Eye className="w-4 h-4 text-muted-foreground" />
              <span>Preview</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={onPrint}
              className="flex-1 min-h-[44px] gap-2 font-semibold text-xs sm:text-sm min-w-[110px]"
            >
              <Printer className="w-4 h-4 text-muted-foreground" />
              <span>Print</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => onDownloadImage('png')}
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
              onClick={onDownloadPdf}
              disabled={isExporting}
              className="flex-1 min-h-[44px] gap-2 font-semibold text-xs sm:text-sm min-w-[110px]"
            >
              <FileDown className="w-4 h-4" />
              <span>PDF</span>
            </Button>
          </div>

          <Button
            onClick={onSaveInvoice}
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
                <span>Save &amp; Print Invoice</span>
              </>
            )}
          </Button>
        </div>
      </Card>

      {/* Tip card */}
      <div className="p-4 bg-muted/40 rounded-2xl border border-dashed border-border flex gap-3">
        <AlertCircle className="w-5 h-5 text-primary shrink-0" />
        <div className="text-xs text-muted-foreground">
          <span className="font-bold text-foreground block mb-0.5">Decimal Quantities Supported</span>
          Enter values like 0.5, 1.5, or 2.25. Use &quot;Save Image&quot; to export high-definition PNG invoice pictures ready for Telegram &amp; WhatsApp sharing.
        </div>
      </div>
    </div>
  );
}

