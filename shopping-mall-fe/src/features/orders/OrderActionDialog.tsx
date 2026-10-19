import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { normalizeApiError } from "../../api/types";
import { cancelOrder, createIdempotencyKey, payOrder } from "./orderApi";
import type { OrderRecord } from "./orderTypes";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function OrderActionDialog({
  action,
  order,
  onClose,
  onComplete,
}: {
  action: "pay" | "cancel";
  order: OrderRecord;
  onClose: () => void;
  onComplete: () => Promise<void> | void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [insufficientBalanceOpen, setInsufficientBalanceOpen] = useState(false);
  const idempotencyKey = useRef(createIdempotencyKey("cancel"));
  const isPay = action === "pay";

  useEffect(() => {
    document.body.classList.add("order-dialog-open");
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || busy) return;
      if (insufficientBalanceOpen) {
        setInsufficientBalanceOpen(false);
        return;
      }
      onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.classList.remove("order-dialog-open");
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [busy, insufficientBalanceOpen, onClose]);

  async function confirm() {
    if (busy || order.status !== "PENDING") return;
    setBusy(true);
    setError("");
    try {
      if (isPay) {
        await payOrder(order.id);
      } else {
        const result = await cancelOrder(order.id, idempotencyKey.current);
        if (!result.cancelled) {
          await onComplete();
          setError("This order could not be cancelled. Its latest status has been refreshed.");
          return;
        }
      }
      await onComplete();
      onClose();
    } catch (cause: unknown) {
      const message = normalizeApiError(cause).message;
      if (isPay && /insufficient balance/i.test(message)) {
        setInsufficientBalanceOpen(true);
        return;
      }
      await onComplete();
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="order-dialog-layer">
      <button
        className="order-dialog-scrim"
        type="button"
        aria-label="Close dialog"
        disabled={busy}
        onClick={onClose}
      />
      <section
        className="order-dialog-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-dialog-title"
        aria-describedby="order-dialog-description"
      >
        <button
          className="order-dialog-close"
          type="button"
          aria-label="Close"
          disabled={busy}
          onClick={onClose}
        >
          ×
        </button>
        <p className={`order-dialog-kicker ${isPay ? "pay" : "cancel"}`}>
          <i /> {isPay ? "PAYMENT / BUYER BALANCE" : "ORDER CONTROL / CANCELLATION"}
        </p>
        <h2 id="order-dialog-title">{isPay ? "Confirm payment" : "Cancel this order?"}</h2>
        <p id="order-dialog-description" className="order-dialog-description">
          {isPay
            ? "The order amount will be charged to your NEXORA buyer balance."
            : "This will close the pending order and release its reserved stock."}
        </p>
        <div className="order-dialog-summary">
          <span>{order.orderNo}</span>
          <strong>{money.format(Number(order.totalAmount))}</strong>
        </div>
        {error && (
          <div className="order-dialog-error" role="alert">
            <p>{error}</p>
          </div>
        )}
        <div className="order-dialog-actions">
          <button type="button" disabled={busy} onClick={onClose}>
            BACK
          </button>
          <button
            className={isPay ? "primary" : "danger"}
            type="button"
            disabled={busy || order.status !== "PENDING"}
            onClick={() => void confirm()}
          >
            {busy ? "PROCESSING…" : isPay ? "CONFIRM PAYMENT" : "CONFIRM CANCEL"}
          </button>
        </div>
      </section>
      {insufficientBalanceOpen && (
        <div className="balance-alert-layer">
          <button
            className="balance-alert-scrim"
            type="button"
            aria-label="Dismiss insufficient balance alert"
            onClick={() => setInsufficientBalanceOpen(false)}
          />
          <section
            className="balance-alert-card"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="balance-alert-title"
            aria-describedby="balance-alert-description"
          >
            <span className="balance-alert-icon" aria-hidden="true">
              !
            </span>
            <p className="balance-alert-kicker">PAYMENT NOT COMPLETED</p>
            <h2 id="balance-alert-title">Insufficient balance</h2>
            <p id="balance-alert-description">
              Your NEXORA balance is too low to pay this order. Add funds to your account, then try
              again.
            </p>
            <div className="balance-alert-actions">
              <button type="button" onClick={() => setInsufficientBalanceOpen(false)}>
                RETURN TO ORDER
              </button>
              <Link to="/account" onClick={onClose}>
                GO TO ACCOUNT <span>↗</span>
              </Link>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
