import { FileText, Cloud, RefreshCw, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { parseQuantity, roundMoney } from '../invoiceUtils';

/**
 * DraftTabsBar — The multi-draft strip showing open order tabs, cloud sync
 * status badge, Refresh button and New Invoice button.
 *
 * Props:
 *   drafts            — Draft[]
 *   activeDraftId     — string
 *   invoiceNumber     — string  (live value from active form, overrides draft's stored number)
 *   isCloudActive     — boolean
 *   isSyncingDraft    — boolean
 *   customers         — Customer[]
 *   onSwitchDraft(id)
 *   onNewDraft()
 *   onDeleteDraft(id)
 *   onManualSync()
 */
export default function DraftTabsBar({
  drafts,
  activeDraftId,
  invoiceNumber,
  isCloudActive,
  isSyncingDraft,
  customers,
  onSwitchDraft,
  onNewDraft,
  onDeleteDraft,
  onManualSync,
}) {
  return (
    <Card className="p-3.5 sm:p-4 bg-card/70 backdrop-blur-md border-border shadow-xs space-y-3">
      {/* Top Row: Title + Sync Badge + Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-foreground uppercase tracking-wider">
            <FileText className="w-4 h-4 text-primary" />
            <span>Open Drafts ({drafts.length})</span>
          </div>

          {/* Cloud Sync Status Badge */}
          {isCloudActive ? (
            <Badge
              variant="outline"
              className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 gap-1.5 text-[11px] py-0.5 px-2 font-medium"
            >
              {isSyncingDraft ? (
                <>
                  <RefreshCw className="w-3 h-3 animate-spin text-emerald-400" />
                  <span>Syncing...</span>
                </>
              ) : (
                <>
                  <Cloud className="w-3 h-3 text-emerald-400" />
                  <span className="hidden sm:inline">Cloud Synced (Multi-Device)</span>
                  <span className="sm:hidden">Online</span>
                </>
              )}
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="bg-amber-500/10 text-amber-400 border-amber-500/30 gap-1 text-[11px] py-0.5 px-2 font-medium"
            >
              <span>Local Drafts</span>
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onManualSync}
            disabled={isSyncingDraft}
            className="h-8 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
            title="Refresh drafts from cloud and other devices"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncingDraft ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>

          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={onNewDraft}
            className="h-8 text-xs gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-xs"
            title="Hold current invoice and start a new invoice with a new Invoice ID"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Invoice</span>
          </Button>
        </div>
      </div>

      {/* Draft Tabs Strip */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 scrollbar-thin scrollbar-thumb-muted">
        {drafts.map((d, index) => {
          const isActive = d.id === activeDraftId;
          const cust = customers.find((c) => c.id === d.customer_id);
          const itemCount = (d.line_items || []).filter(
            (i) => (i.product_id || (i.isCustom && i.custom_name)) && parseQuantity(i.quantity) > 0
          ).length;
          const draftSubtotal = (d.line_items || []).reduce(
            (sum, i) => sum + roundMoney(Number(i.unit_price || 0) * parseQuantity(i.quantity)),
            0
          );
          const displayLabel = d.name || (cust ? cust.name : `Order #${index + 1}`);
          // Show live invoice number for the active draft, persisted number for others
          const draftInvNo = isActive ? invoiceNumber : d.invoice_number;

          return (
            <div
              key={d.id}
              className={`group flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all border shrink-0 ${
                isActive
                  ? 'bg-primary/15 border-primary/60 text-foreground shadow-xs ring-1 ring-primary/30'
                  : 'bg-muted/40 hover:bg-muted/80 border-border text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => {
                if (!isActive) onSwitchDraft(d.id);
              }}
              title={`Switch to ${displayLabel}${draftInvNo ? ` (${draftInvNo})` : ''} (${itemCount} items • $${draftSubtotal.toFixed(2)})`}
            >
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-primary' : 'bg-muted-foreground/40'}`} />
                <span className="font-semibold max-w-[130px] truncate">{displayLabel}</span>
                {draftInvNo && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-background/70 border border-border/70 text-muted-foreground">
                    {draftInvNo}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <span>•</span>
                <span>
                  {itemCount} {itemCount === 1 ? 'item' : 'items'}
                </span>
                <span>•</span>
                <span className="font-semibold text-foreground">${draftSubtotal.toFixed(2)}</span>
              </div>

              {drafts.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteDraft(d.id);
                  }}
                  className="ml-1 p-0.5 rounded text-muted-foreground/50 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                  title="Discard this draft"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

