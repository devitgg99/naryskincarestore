import { PauseCircle, RefreshCw, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { TEMPLATE_IDS } from '../invoiceUtils';

/**
 * InvoiceHeaderCard — Draft metadata, customer picker, Invoice ID with quick
 * regenerate button, Khmer invoice customer/date fields, delivery toggle & fee,
 * and discount controls.
 */
export default function InvoiceHeaderCard({
  draftName,
  setDraftName,
  onNewDraft,
  selectedCustomerId,
  customers,
  onCustomerChange,
  invoiceNumber,
  setInvoiceNumber,
  onRegenerateInvoiceId,
  receiptTemplate,
  invoiceCustomerName,
  setInvoiceCustomerName,
  invoicePhone,
  setInvoicePhone,
  invoiceDate,
  setInvoiceDate,
  hasDelivery,
  setHasDelivery,
  deliveryFee,
  setDeliveryFee,
  discountType,
  setDiscountType,
  discountValue,
  setDiscountValue,
}) {
  return (
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
            onClick={onNewDraft}
            className="h-7 text-xs px-2.5 gap-1 text-muted-foreground hover:text-foreground"
            title="Park current invoice and start a new invoice with a fresh ID"
          >
            <PauseCircle className="w-3 h-3 text-amber-400" />
            <span className="hidden sm:inline">Hold &amp; New</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Customer *</label>
          <select
            required
            value={selectedCustomerId}
            onChange={(e) => onCustomerChange(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-foreground"
          >
            <option value="">-- Choose Customer --</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ''}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Invoice ID</label>
          <div className="flex items-center gap-1.5">
            <Input
              type="text"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="INV-261111-001"
              className="h-9 text-xs font-mono font-semibold"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={onRegenerateInvoiceId}
              className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
              title="Generate a new Invoice ID"
              aria-label="Generate a new Invoice ID"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>
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
                className={`px-2 py-0.5 text-[10px] font-bold rounded transition-colors cursor-pointer ${
                  !hasDelivery
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
                className={`px-2 py-0.5 text-[10px] font-bold rounded transition-colors cursor-pointer ${
                  hasDelivery
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
                className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                  discountType === 'fixed' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                $
              </button>
              <button
                type="button"
                onClick={() => setDiscountType('percent')}
                className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                  discountType === 'percent' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
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
  );
}

