import { CheckCircle2, Clock } from 'lucide-react';

/**
 * OrderPaymentToggle — Quick Paid / Unpaid segmented action buttons for an order/receipt.
 */
export default function OrderPaymentToggle({
  orderId,
  isPaid,
  isUpdating = false,
  onUpdateStatus,
  size = 'default',
}) {
  const isCompact = size === 'compact';
  const btnPadding = isCompact ? 'px-2 py-1 text-[10px]' : 'px-2.5 py-1.5 text-[11px] flex-1 justify-center';
  const iconClass = isCompact ? 'w-3 h-3' : 'w-3.5 h-3.5';

  return (
    <div
      className={`inline-flex items-center rounded-lg border border-border bg-muted/40 p-0.5 gap-0.5 ${
        isCompact ? '' : 'flex-1'
      }`}
      role="group"
      aria-label="Payment status"
    >
      <button
        type="button"
        disabled={isUpdating}
        onClick={() => {
          if (!isPaid && !isUpdating) onUpdateStatus(orderId, 'paid');
        }}
        className={`inline-flex items-center gap-1 rounded-md font-bold transition-all cursor-pointer disabled:opacity-50 ${btnPadding} ${
          isPaid
            ? 'bg-emerald-600 text-white shadow-xs'
            : 'text-muted-foreground hover:text-emerald-600 hover:bg-emerald-500/10'
        }`}
        title="Mark receipt as Paid"
      >
        <CheckCircle2 className={iconClass} />
        <span>Paid</span>
      </button>

      <button
        type="button"
        disabled={isUpdating}
        onClick={() => {
          if (isPaid && !isUpdating) onUpdateStatus(orderId, 'pending');
        }}
        className={`inline-flex items-center gap-1 rounded-md font-bold transition-all cursor-pointer disabled:opacity-50 ${btnPadding} ${
          !isPaid
            ? 'bg-amber-500 text-white dark:bg-amber-600 shadow-xs'
            : 'text-muted-foreground hover:text-amber-600 hover:bg-amber-500/10'
        }`}
        title="Mark receipt as Unpaid"
      >
        <Clock className={iconClass} />
        <span>Unpaid</span>
      </button>
    </div>
  );
}

