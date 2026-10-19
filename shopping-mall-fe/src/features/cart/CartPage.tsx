import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { normalizeApiError } from "../../api/types";
import { addCartItem, deleteCartItem, getCart, updateCartItem } from "./cartApi";
import type { CartCheckoutDraftItem, CartEntry } from "./cartTypes";
import "./cart.css";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function imageFor(entry: CartEntry) {
  const url = entry.itemDTO.imageUrls
    .split(",")
    .map((part) => part.trim())
    .find(Boolean);
  return url || undefined;
}

function CartProductImage({ src, name, itemId }: { src?: string; name: string; itemId: number }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);

  if (!src || failed) {
    return <span className="cart-item-fallback">NX / {String(itemId).padStart(4, "0")}</span>;
  }

  return <img src={src} alt={name} onError={() => setFailed(true)} />;
}

function canSelect(entry: CartEntry) {
  const product = entry.itemDTO;
  return product.status === "ONLINE" && !product.isSeckill && product.stock > 0;
}

function statusLabel(entry: CartEntry) {
  const product = entry.itemDTO;
  if (product.isSeckill) return "FLASH SALE · REMOVE ONLY";
  if (product.status === "OFFLINE") return "OFFLINE · REMOVE ONLY";
  if (product.status === "SOLD_OUT" || product.stock <= 0) return "SOLD OUT · REMOVE ONLY";
  return "ONLINE · READY TO SHIP";
}

type ProductDetailCartState = {
  source?: string;
  itemId?: number;
  quantity?: number;
  isSeckill?: boolean;
};

export function CartPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const processedHandoffKey = useRef<string | null>(null);
  const [entries, setEntries] = useState<CartEntry[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const [pendingIds, setPendingIds] = useState<Set<number>>(() => new Set());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState<{ message: string; kind: "success" | "error" } | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogItems, setDialogItems] = useState<CartCheckoutDraftItem[]>([]);

  useEffect(() => {
    const incoming = location.state as ProductDetailCartState | null;
    const hasCartHandoff = incoming?.source === "product-detail";

    if (hasCartHandoff) {
      if (processedHandoffKey.current === location.key) return;
      processedHandoffKey.current = location.key;
      setLoading(true);
      setLoadError("");

      const clearHandoff = () => navigate(location.pathname, { replace: true, state: null });
      if (incoming.isSeckill) {
        setNotice({ message: "Flash-sale products cannot be added to the cart.", kind: "error" });
        clearHandoff();
        return;
      }
      if (
        !Number.isSafeInteger(incoming.itemId) ||
        !incoming.itemId ||
        !Number.isSafeInteger(incoming.quantity) ||
        !incoming.quantity ||
        incoming.quantity < 1
      ) {
        setNotice({ message: "The product could not be added. Please try again.", kind: "error" });
        clearHandoff();
        return;
      }

      void getCart()
        .then((currentCart) => {
          const existing = currentCart.find((entry) => entry.itemDTO.id === incoming.itemId);
          const targetQuantity = (existing?.quantity ?? 0) + incoming.quantity!;
          if (existing && targetQuantity > existing.itemDTO.stock) {
            throw new Error("Your cart already contains this product up to its available stock.");
          }
          return addCartItem({ itemId: incoming.itemId!, quantity: targetQuantity });
        })
        .then(() => {
          setNotice({ message: "Product added to your cart.", kind: "success" });
          clearHandoff();
        })
        .catch((cause: unknown) => {
          const error = normalizeApiError(cause);
          if (error.status === 401) return;

          setNotice({ message: error.message, kind: "error" });
          clearHandoff();
        });
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setLoadError("");
    getCart(controller.signal)
      .then((result) => {
        setEntries(result);
        setSelectedIds(new Set(result.filter(canSelect).map((entry) => entry.itemDTO.id)));
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setLoadError(normalizeApiError(cause).message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [location.key, location.pathname, location.state, navigate]);

  useEffect(() => {
    if (dialogOpen) {
      document.body.classList.add("cart-dialog-open");
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape") setDialogOpen(false);
      };
      document.addEventListener("keydown", onKeyDown);
      return () => {
        document.body.classList.remove("cart-dialog-open");
        document.removeEventListener("keydown", onKeyDown);
      };
    }
    document.body.classList.remove("cart-dialog-open");
    return undefined;
  }, [dialogOpen]);

  const selectableEntries = useMemo(() => entries.filter(canSelect), [entries]);
  const selectedEntries = useMemo(
    () => entries.filter((entry) => selectedIds.has(entry.itemDTO.id) && canSelect(entry)),
    [entries, selectedIds],
  );
  const selectedQuantity = selectedEntries.reduce((total, entry) => total + entry.quantity, 0);
  const selectedTotal = selectedEntries.reduce(
    (total, entry) => total + Number(entry.itemDTO.price) * entry.quantity,
    0,
  );
  const allSelected =
    selectableEntries.length > 0 &&
    selectableEntries.every((entry) => selectedIds.has(entry.itemDTO.id));
  const someSelected = selectedEntries.length > 0 && !allSelected;

  function toggleAll(checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      selectableEntries.forEach((entry) => {
        if (checked) next.add(entry.itemDTO.id);
        else next.delete(entry.itemDTO.id);
      });
      return next;
    });
  }

  function toggleItem(itemId: number, checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(itemId);
      else next.delete(itemId);
      return next;
    });
  }

  function markPending(itemId: number, pending: boolean) {
    setPendingIds((current) => {
      const next = new Set(current);
      if (pending) next.add(itemId);
      else next.delete(itemId);
      return next;
    });
  }

  async function removeItem(itemId: number) {
    if (pendingIds.has(itemId)) return;
    markPending(itemId, true);
    setNotice(null);
    try {
      await deleteCartItem(itemId);
      setEntries((current) => current.filter((entry) => entry.itemDTO.id !== itemId));
      setSelectedIds((current) => {
        const next = new Set(current);
        next.delete(itemId);
        return next;
      });
      setNotice({ message: "Item removed from your cart.", kind: "success" });
    } catch (cause: unknown) {
      setNotice({ message: normalizeApiError(cause).message, kind: "error" });
    } finally {
      markPending(itemId, false);
    }
  }

  async function changeQuantity(entry: CartEntry, delta: number) {
    const itemId = entry.itemDTO.id;
    if (pendingIds.has(itemId) || !canSelect(entry)) return;
    const nextQuantity = entry.quantity + delta;
    if (nextQuantity > entry.itemDTO.stock) {
      setNotice({ message: "Quantity exceeds the available stock.", kind: "error" });
      return;
    }
    if (nextQuantity <= 0) {
      await removeItem(itemId);
      return;
    }

    markPending(itemId, true);
    setNotice(null);
    try {
      await updateCartItem({ itemId, quantity: nextQuantity });
      setEntries((current) =>
        current.map((item) =>
          item.itemDTO.id === itemId ? { ...item, quantity: nextQuantity } : item,
        ),
      );
    } catch (cause: unknown) {
      setNotice({ message: normalizeApiError(cause).message, kind: "error" });
    } finally {
      markPending(itemId, false);
    }
  }

  function beginCheckoutReview() {
    if (selectedEntries.length === 0) return;
    setDialogItems(
      selectedEntries.map((entry) => ({
        itemId: entry.itemDTO.id,
        quantity: entry.quantity,
        price: Number(entry.itemDTO.price),
        name: entry.itemDTO.name,
        brand: entry.itemDTO.brand,
        category: entry.itemDTO.category,
        imageUrl: imageFor(entry) || null,
      })),
    );
    setDialogOpen(true);
  }

  function continueToCheckout() {
    const estimatedTotal = dialogItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    setDialogOpen(false);
    navigate("/checkout", {
      state: { source: "cart", items: dialogItems, estimatedTotal },
    });
  }

  function retryLoad() {
    setLoadError("");
    setLoading(true);
    const controller = new AbortController();
    getCart(controller.signal)
      .then((result) => {
        setEntries(result);
        setSelectedIds(new Set(result.filter(canSelect).map((entry) => entry.itemDTO.id)));
      })
      .catch((cause: unknown) => setLoadError(normalizeApiError(cause).message))
      .finally(() => setLoading(false));
  }

  return (
    <main className="cart-page">
      <div className="cart-page-shell">
        <div className="cart-route-line">
          <span className="cart-route-dot" />
          <span>NIGHT TRANSIT</span>
          <i />
          <span>YOUR CART</span>
          <Link to="/shop">← CONTINUE SHOPPING</Link>
          <span className="cart-city-status">
            <i /> NIGHT CITY / ALWAYS OPEN
          </span>
        </div>

        <section className="cart-heading-row">
          <div>
            <p className="cart-eyebrow">YOUR PICKS · READY FOR THE NEXT STOP</p>
            <h1>
              Shopping <span>Cart</span>
            </h1>
            <p className="cart-subtitle">A few good things, gathered from across the city.</p>
          </div>
          <div className="cart-count-display">
            <span className="cart-count-signal" />
            <strong>{String(entries.length).padStart(2, "0")}</strong>
            <span>ITEMS IN TRANSIT</span>
          </div>
        </section>

        {notice && (
          <p className={`cart-notice ${notice.kind}`} role="status">
            <i /> {notice.message}
          </p>
        )}

        {loadError ? (
          <section className="cart-load-state" role="alert">
            <span className="cart-state-mark">!</span>
            <p className="cart-eyebrow">ROUTE INTERRUPTED</p>
            <h2>Your cart could not be reached.</h2>
            <p>{loadError}</p>
            <button className="cart-outline-action" type="button" onClick={retryLoad}>
              RETRY
            </button>
          </section>
        ) : loading ? (
          <section className="cart-load-state" role="status">
            <span className="cart-spinner" />
            <p className="cart-eyebrow">SCANNING YOUR CART</p>
          </section>
        ) : entries.length === 0 ? (
          <section className="cart-empty-state">
            <span className="cart-empty-orbit" aria-hidden="true">
              ↗
            </span>
            <p className="cart-eyebrow">NO CARGO DETECTED</p>
            <h2>Your cart is quiet.</h2>
            <p>Explore the city and bring something back.</p>
            <Link className="cart-outline-action" to="/shop">
              EXPLORE PRODUCTS <span>↗</span>
            </Link>
          </section>
        ) : (
          <div className="cart-layout">
            <section className="cart-list-panel" aria-label="Cart items">
              <div className="cart-list-head">
                <label className="cart-select-all">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(input) => {
                      if (input) input.indeterminate = someSelected;
                    }}
                    disabled={selectableEntries.length === 0}
                    onChange={(event) => toggleAll(event.target.checked)}
                  />
                  <span className="cart-checkbox-mark" />
                  <span>
                    SELECT ALL <em>{selectedEntries.length} selected</em>
                  </span>
                </label>
                <span className="cart-column-label">ITEM / QUANTITY / PRICE</span>
              </div>

              <div className="cart-items">
                {entries.map((entry, index) => {
                  const product = entry.itemDTO;
                  const selectable = canSelect(entry);
                  const selected = selectedIds.has(product.id) && selectable;
                  const image = imageFor(entry);
                  const pending = pendingIds.has(product.id);
                  return (
                    <article
                      className={`cart-item ${selected ? "selected" : ""} ${selectable ? "" : "item-unavailable"}`}
                      key={product.id}
                    >
                      <label className="cart-item-select" aria-label={`Select ${product.name}`}>
                        <input
                          type="checkbox"
                          checked={selected}
                          disabled={!selectable}
                          onChange={(event) => toggleItem(product.id, event.target.checked)}
                        />
                        <span className="cart-checkbox-mark" />
                      </label>
                      <div className="cart-item-visual">
                        <span className="cart-item-number">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <CartProductImage src={image} name={product.name} itemId={product.id} />
                      </div>
                      <div className="cart-item-info">
                        <p className="cart-item-kicker">
                          {product.brand} / {product.category}
                        </p>
                        <h2>{product.name}</h2>
                        {product.description && (
                          <p className="cart-item-description">{product.description}</p>
                        )}
                        <p className="cart-item-unit-price">
                          Unit price <strong>{money.format(product.price)}</strong>
                        </p>
                        <span className={`cart-item-status ${selectable ? "" : "unavailable"}`}>
                          <i /> {statusLabel(entry)}
                        </span>
                      </div>
                      <div className="cart-quantity-block">
                        <span className="cart-field-label">QUANTITY</span>
                        {selectable ? (
                          <div className="cart-quantity-control">
                            <button
                              type="button"
                              aria-label={`Decrease ${product.name} quantity`}
                              disabled={pending}
                              onClick={() => void changeQuantity(entry, -1)}
                            >
                              −
                            </button>
                            <output aria-live="polite">{entry.quantity}</output>
                            <button
                              type="button"
                              aria-label={`Increase ${product.name} quantity`}
                              disabled={pending || entry.quantity >= product.stock}
                              onClick={() => void changeQuantity(entry, 1)}
                            >
                              +
                            </button>
                          </div>
                        ) : (
                          <span className="cart-quantity-locked">Quantity locked</span>
                        )}
                      </div>
                      <div className="cart-item-price-block">
                        <span>LINE TOTAL</span>
                        <strong>{money.format(Number(product.price) * entry.quantity)}</strong>
                        <button
                          className="cart-remove-button"
                          type="button"
                          disabled={pending}
                          onClick={() => void removeItem(product.id)}
                        >
                          <b>×</b> REMOVE
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
              <div className="cart-list-foot">
                <span /> ITEMS ARE HELD IN YOUR CART, NOT RESERVED <span />
              </div>
            </section>

            <aside className="cart-summary-panel" aria-label="Order summary">
              <div className="cart-panel-topline">
                <span>01 / ORDER SUMMARY</span>
                <span className="cart-live-mark">
                  <i /> LIVE
                </span>
              </div>
              <h2>
                Trip <span>details</span>
              </h2>
              <p className="cart-summary-caption">Your route, before checkout.</p>
              <div className="cart-summary-route">
                <span className="cart-route-node" />
                <div>
                  <strong>NIGHT CITY</strong>
                  <small>Selected items</small>
                </div>
                <span className="cart-route-arrow">↘</span>
              </div>
              <div className="cart-summary-line">
                <span>Selected items</span>
                <strong>
                  {selectedQuantity} {selectedQuantity === 1 ? "unit" : "units"}
                </strong>
              </div>
              <div className="cart-summary-line">
                <span>Merchandise subtotal</span>
                <strong>{money.format(selectedTotal)}</strong>
              </div>
              <div className="cart-summary-line muted">
                <span>Shipping</span>
                <span>Calculated next</span>
              </div>
              <div className="cart-summary-line muted">
                <span>Price check</span>
                <span>At checkout</span>
              </div>
              <div className="cart-summary-divider">
                <span /> ESTIMATED TOTAL <span />
              </div>
              <div className="cart-total-row">
                <span>USD</span>
                <strong>{money.format(selectedTotal)}</strong>
              </div>
              <p className="cart-price-note">
                <span>✦</span> Final prices and availability are checked before order creation.
              </p>
              <button
                className="cart-checkout-button"
                type="button"
                disabled={selectedEntries.length === 0}
                onClick={beginCheckoutReview}
              >
                <span>PROCEED TO CHECKOUT</span>
                <b>↗</b>
              </button>
              <p className="cart-checkout-hint">
                {selectedEntries.length === 0
                  ? "Select at least one available item to continue."
                  : `${selectedEntries.length} item${selectedEntries.length === 1 ? "" : "s"} selected · prices will be checked next.`}
              </p>
              <div className="cart-secure-note">
                <span aria-hidden="true">◇</span>
                <p>
                  SECURE ROUTE <small>Price validation happens at checkout.</small>
                </p>
              </div>
            </aside>
          </div>
        )}

        <footer className="cart-footer">
          <span>NEXORA / NIGHT TRANSIT</span>
          <span>
            YOUR NEXT STOP IS YOURS <i>✦</i>
          </span>
        </footer>
      </div>

      {dialogOpen && (
        <div className="cart-review-dialog">
          <button
            className="cart-review-scrim"
            type="button"
            aria-label="Close checkout review"
            onClick={() => setDialogOpen(false)}
          />
          <section
            className="cart-review-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cart-review-title"
            aria-describedby="cart-review-message"
          >
            <button
              className="cart-review-close"
              type="button"
              aria-label="Close"
              onClick={() => setDialogOpen(false)}
            >
              ×
            </button>
            <p className="cart-review-kicker">
              <i /> CHECKOUT / ORDER PREVIEW
            </p>
            <h2 id="cart-review-title">Review your picks</h2>
            <p className="cart-review-message" id="cart-review-message">
              Your selected items are ready for the final price check.
            </p>
            <div className="cart-review-items">
              {dialogItems.map((item) => (
                <div className="cart-review-row" key={item.itemId}>
                  <div>
                    <strong>{item.name}</strong>
                    <span>
                      {item.quantity} × {money.format(item.price)}
                    </span>
                  </div>
                  <b>{money.format(item.price * item.quantity)}</b>
                </div>
              ))}
            </div>
            <div className="cart-review-total">
              <span>ESTIMATED TOTAL</span>
              <strong>
                {money.format(
                  dialogItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
                )}
              </strong>
            </div>
            <p className="cart-review-note">
              Prices are verified on the next step. No order has been created.
            </p>
            <div className="cart-review-actions">
              <button type="button" onClick={() => setDialogOpen(false)}>
                BACK TO CART
              </button>
              <button className="primary" type="button" onClick={continueToCheckout}>
                CONTINUE
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
