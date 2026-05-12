import { AlertTriangle, RefreshCw } from "lucide-react";

interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorBanner({ message, onRetry }: ErrorBannerProps) {
  return (
    <div
      className="flex items-center gap-3 rounded-lg border px-4 py-3 text-sm"
      style={{
        background: "#fef0ee",
        borderColor: "var(--color-state-absent)",
        color: "var(--color-content-primary)",
      }}
    >
      <AlertTriangle size={16} style={{ color: "var(--color-state-absent)", flexShrink: 0 }} />
      <span className="flex-1">{message}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-1 font-medium hover:underline"
          style={{ color: "var(--color-state-absent)" }}
          aria-label="Reintentar"
        >
          <RefreshCw size={14} />
          Reintentar
        </button>
      )}
    </div>
  );
}
