export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <div className="state-panel" role="status">
      <span className="state-spinner" />
      {label}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <section className="state-panel state-error" role="alert">
      <strong>ROUTE INTERRUPTED</strong>
      <p>{message}</p>
      {onRetry && (
        <button className="outline-button" type="button" onClick={onRetry}>
          RETRY
        </button>
      )}
    </section>
  );
}

export function EmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <section className="state-panel state-empty">
      <span className="empty-mark">✦</span>
      <strong>{title}</strong>
      <p>{message}</p>
      {action}
    </section>
  );
}
import type { ReactNode } from "react";
