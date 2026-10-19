import { useEffect, useRef, useState, type FormEvent } from "react";
import { normalizeApiError } from "../../api/types";
import { adjustMerchantStock, getMerchantItemImages, takeMerchantItemOffline } from "./merchantApi";
import type { MerchantItem } from "./merchantTypes";

const MAX_STOCK = 2_147_483_647;

function useMerchantDialog(dialogRef: React.RefObject<HTMLDialogElement | null>) {
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, [dialogRef]);
}

export function StockAdjustmentDialog({
  product,
  onClose,
  onSaved,
}: {
  product: MerchantItem;
  onClose: () => void;
  onSaved: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [deltaText, setDeltaText] = useState("5");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useMerchantDialog(dialogRef);

  const delta = Number(deltaText);
  const validDelta =
    deltaText.trim() !== "" &&
    Number.isSafeInteger(delta) &&
    delta >= -2_147_483_648 &&
    delta <= MAX_STOCK;
  const nextStock = validDelta ? product.stock + delta : NaN;
  const validNextStock = validDelta && nextStock >= 0 && nextStock <= MAX_STOCK;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!validNextStock) {
      setError("This adjustment must keep stock between 0 and 2,147,483,647.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      await adjustMerchantStock({ itemId: product.id, delta });
      onSaved();
    } catch (cause: unknown) {
      setError(normalizeApiError(cause).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="merchant-modal merchant-compact-modal"
      aria-labelledby="merchant-stock-title"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <form className="merchant-modal-form" onSubmit={(event) => void submit(event)} noValidate>
        <header className="merchant-modal-header">
          <div>
            <span className="merchant-modal-eyebrow">
              INVENTORY / {product.isSeckill ? "FLASH SALE" : "STANDARD"}
            </span>
            <h2 id="merchant-stock-title">Adjust stock</h2>
          </div>
          <button
            className="merchant-icon-button"
            type="button"
            aria-label="Close"
            disabled={busy}
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <p className="merchant-stock-product-name">{product.name}</p>
        <div className="merchant-stock-current">
          <span>Current stock</span>
          <strong>{product.stock.toLocaleString("en-US")}</strong>
        </div>
        <label className="merchant-field">
          <span>
            Change quantity <b>*</b>
          </span>
          <div className="merchant-delta-input">
            <span>±</span>
            <input
              type="number"
              step="1"
              value={deltaText}
              onChange={(event) => {
                setDeltaText(event.target.value);
                setError("");
              }}
              disabled={busy}
              aria-describedby="merchant-stock-preview"
            />
          </div>
        </label>
        <div className="merchant-delta-presets" aria-label="Stock adjustment shortcuts">
          {[5, 1, -1, -5].map((value) => (
            <button
              type="button"
              key={value}
              disabled={busy}
              onClick={() => {
                setDeltaText(String(value));
                setError("");
              }}
            >
              {value > 0 ? `+${value}` : `−${Math.abs(value)}`}
            </button>
          ))}
        </div>
        <div
          className={`merchant-stock-preview ${!validNextStock ? "invalid" : ""}`}
          id="merchant-stock-preview"
          aria-live="polite"
        >
          <span>New stock</span>
          <strong>{validNextStock ? nextStock.toLocaleString("en-US") : "INVALID"}</strong>
        </div>
        {error && (
          <div className="merchant-form-error" role="alert">
            {error}
          </div>
        )}
        <footer className="merchant-modal-actions">
          <button
            className="merchant-secondary-button"
            type="button"
            disabled={busy}
            onClick={onClose}
          >
            CANCEL
          </button>
          <button
            className="merchant-primary-button"
            type="submit"
            disabled={busy || !validNextStock}
          >
            {busy ? "UPDATING…" : "UPDATE STOCK"}
          </button>
        </footer>
      </form>
    </dialog>
  );
}

export function OfflineConfirmationDialog({
  product,
  onClose,
  onConfirmed,
}: {
  product: MerchantItem;
  onClose: () => void;
  onConfirmed: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useMerchantDialog(dialogRef);
  const imageUrl = getMerchantItemImages(product)[0];

  async function confirm() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await takeMerchantItemOffline(product.id);
      onConfirmed();
    } catch (cause: unknown) {
      setError(normalizeApiError(cause).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="merchant-modal merchant-compact-modal"
      aria-labelledby="merchant-offline-title"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <section className="merchant-modal-form">
        <header className="merchant-modal-header">
          <div>
            <span className="merchant-modal-eyebrow">REMOVE LISTING</span>
            <h2 id="merchant-offline-title">Take product offline?</h2>
          </div>
          <button
            className="merchant-icon-button"
            type="button"
            aria-label="Close"
            disabled={busy}
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <p className="merchant-confirm-copy">This product will be removed from your active list.</p>
        <div className="merchant-offline-product">
          {imageUrl ? (
            <img src={imageUrl} alt="" />
          ) : (
            <span className="merchant-image-fallback">NX</span>
          )}
          <span>{product.name}</span>
        </div>
        {error && (
          <div className="merchant-form-error" role="alert">
            {error}
          </div>
        )}
        <footer className="merchant-modal-actions">
          <button
            className="merchant-secondary-button"
            type="button"
            disabled={busy}
            onClick={onClose}
          >
            KEEP LISTED
          </button>
          <button
            className="merchant-danger-button"
            type="button"
            disabled={busy}
            onClick={() => void confirm()}
          >
            {busy ? "UPDATING…" : "TAKE OFFLINE"}
          </button>
        </footer>
      </section>
    </dialog>
  );
}

export function ProductUnavailableDialog({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useMerchantDialog(dialogRef);

  return (
    <dialog
      ref={dialogRef}
      className="merchant-modal merchant-compact-modal"
      aria-labelledby="merchant-unavailable-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <section className="merchant-modal-form">
        <header className="merchant-modal-header">
          <div>
            <span className="merchant-modal-eyebrow">PRODUCT DETAILS</span>
            <h2 id="merchant-unavailable-title">Product unavailable</h2>
          </div>
          <button
            className="merchant-icon-button"
            type="button"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <p className="merchant-confirm-copy">This product is not in your active product list.</p>
        <footer className="merchant-modal-actions">
          <button className="merchant-primary-button" type="button" onClick={onClose}>
            BACK TO PRODUCTS
          </button>
        </footer>
      </section>
    </dialog>
  );
}
