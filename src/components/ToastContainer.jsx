import { CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';

const TOAST_STYLES = {
  success: {
    container: 'bg-card text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    iconClass: 'text-emerald-600 dark:text-emerald-400',
    Icon: CheckCircle,
  },
  error: {
    container: 'bg-card text-rose-700 dark:text-rose-300 border-rose-500/30',
    iconClass: 'text-rose-600 dark:text-rose-400',
    Icon: AlertCircle,
  },
  warning: {
    container: 'bg-card text-amber-700 dark:text-amber-300 border-amber-500/30',
    iconClass: 'text-amber-600 dark:text-amber-400',
    Icon: AlertTriangle,
  },
  info: {
    container: 'bg-card text-foreground border-border',
    iconClass: 'text-[#000080] dark:text-blue-400',
    Icon: Info,
  },
};

/**
 * ToastContainer — Floating bottom-right notification stack shared across
 * auth, customer catalog, and admin views.
 */
export default function ToastContainer({ toasts }) {
  return (
    <div className="fixed bottom-5 right-5 z-[200] flex flex-col gap-2 max-w-sm pointer-events-none">
      {toasts.map((t) => {
        const style = TOAST_STYLES[t.type] || TOAST_STYLES.info;
        const { Icon } = style;
        return (
          <div
            key={t.id}
            className={`p-3.5 rounded-lg shadow-md flex items-center gap-3 border text-xs font-semibold pointer-events-auto animate-in slide-in-from-bottom-3 fade-in duration-200 ${style.container}`}
          >
            <Icon className={`w-4 h-4 flex-shrink-0 ${style.iconClass}`} />
            <span>{t.message}</span>
          </div>
        );
      })}
    </div>
  );
}

