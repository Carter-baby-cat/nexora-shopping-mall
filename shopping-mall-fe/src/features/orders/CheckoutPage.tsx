import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { normalizeApiError } from "../../api/types";
import { useAuthStore } from "../auth/authStore";
import type { CartCheckoutDraftItem } from "../cart/cartTypes";
import { CartProductImage } from "./OrderVisuals";
import { checkOrderPrices, createIdempotencyKey, createNormalOrder } from "./orderApi";
import "./orders.css";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

type CheckoutPhase =
  "empty" | "checking" | "changed" | "verified" | "creating" | "check-error" | "create-error";

function draftFromState(state: unknown): CartCheckoutDraftItem[] {
  if (!state || typeof state !== "object") return [];
  const data = state as {
    source?: string;
    items?: CartCheckoutDraftItem[];
    itemId?: number;
    itemName?: string;
    imageUrl?: string | null;
    unitPrice?: number;
    quantity?: number;
    isSeckill?: boolean;
    brand?: string;
    category?: string;
  };
  if (data.source === "cart" && Array.isArray(data.items)) {
    return data.items.filter(
      (item) =>
        Number.isSafeInteger(item.itemId) &&
        item.itemId > 0 &&
        Number.isSafeInteger(item.quantity) &&
        item.quantity > 0 &&
        Number.isFinite(Number(item.price)) &&
        Number(item.price) >= 0,
    );
  }
  if (
    data.source === "product-detail" &&
    Number.isSafeInteger(data.itemId) &&
    Number(data.itemId) > 0 &&
    Number.isSafeInteger(data.quantity) &&
    Number(data.quantity) > 0 &&
    Number.isFinite(Number(data.unitPrice)) &&
    !data.isSeckill
  ) {
    return [
      {
        itemId: Number(data.itemId),
        quantity: Number(data.quantity),
        price: Number(data.unitPrice),
        name: data.itemName || `Item #${data.itemId}`,
        brand: data.brand || "",
        category: data.category || "",
        imageUrl: data.imageUrl || null,
      },
    ];
  }
  return [];
}

export function CheckoutPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const username = useAuthStore((state) => state.username);
  const processedLocationKey = useRef<string | null>(null);
  const fallbackAttempt = useRef<{ storageKey: string; key: string } | null>(null);
  const [items, setItems] = useState<CartCheckoutDraftItem[]>([]);
  const [phase, setPhase] = useState<CheckoutPhase>("empty");
  const [verifiedTotal, setVerifiedTotal] = useState<number | null>(null);
  const [notice, setNotice] = useState("");

  async function verifyPrices(draft: CartCheckoutDraftItem[]) {
    if (draft.length === 0) return;
    setPhase("checking");
    setNotice("");
    setVerifiedTotal(null);
    try {
      const result = await checkOrderPrices(
        draft.map(({ itemId, quantity, price }) => ({ itemId, quantity, price })),
      );
      if ("updatedItems" in result) {
        const updated = new Map(result.updatedItems.map((item) => [item.itemId, item]));
        setItems((current) =>
          current.map((item) => {
            const latest = updated.get(item.itemId);
            return latest ? { ...item, price: Number(latest.price) } : item;
          }),
        );
        setNotice(
          result.attention || "One or more prices changed. Review and accept them to check again.",
        );
        setPhase("changed");
      } else {
        const total = Number(result.totalPrice);
        if (!Number.isFinite(total)) throw new Error("The price check returned an invalid total.");
        setVerifiedTotal(total);
        setNotice(result.info || "Prices verified.");
        setPhase("verified");
      }
    } catch (cause: unknown) {
      setNotice(normalizeApiError(cause).message);
      setPhase("check-error");
    }
  }

  useEffect(() => {
    if (processedLocationKey.current === location.key) return;
    processedLocationKey.current = location.key;
    const draft = draftFromState(location.state);
    setItems(draft);
    if (draft.length > 0) void verifyPrices(draft);
    else setPhase("empty");
  }, [location.key, location.state]);

  const unitCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const estimate = items.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
  const displayedTotal = verifiedTotal ?? estimate;
  const sourceState = location.state as { source?: string; itemId?: number } | null;
  const backTo =
    sourceState?.source === "cart"
      ? "/cart"
      : sourceState?.source === "product-detail" && sourceState.itemId
        ? `/products/${sourceState.itemId}`
        : "/shop";

  async function placeOrder() {
    if ((phase !== "verified" && phase !== "create-error") || items.length === 0) return;
    setPhase("creating");
    setNotice("");
    const storageKey = checkoutAttemptStorageKey(username, items);
    const idempotencyKey = getOrCreateCheckoutIdempotencyKey(storageKey, fallbackAttempt.current);
    fallbackAttempt.current = { storageKey, key: idempotencyKey };
    try {
      const result = await createNormalOrder(
        items.map(({ itemId, quantity }) => ({ itemId, quantity })),
        idempotencyKey,
      );
      try {
        localStorage.removeItem(storageKey);
      } catch {
        // The order is already created; storage cleanup is best-effort.
      }
      if (fallbackAttempt.current?.storageKey === storageKey) fallbackAttempt.current = null;
      navigate(`/orders/${result.order.id}`, { replace: true, state: { order: result.order } });
    } catch (cause: unknown) {
      setNotice(normalizeApiError(cause).message);
      setPhase("create-error");
    }
  }

  return (
    <main className="order-page checkout-page">
      <div className="order-page-shell">
        <OrderRouteLine title="ORDER REVIEW" backTo={backTo} backLabel="BACK" />
        <section className="order-page-heading">
          <div>
            <p className="order-eyebrow">FINAL CHECK · NORMAL ORDER</p>
            <h1>
              Order <span>overview</span>
            </h1>
            <p>Review the items and confirmed prices before placing your order.</p>
          </div>
          <ol className="checkout-steps" aria-label="Checkout progress">
            <li className="complete">
              <b>01</b>
              <span>Cart</span>
            </li>
            <li className="active">
              <b>02</b>
              <span>Review</span>
            </li>
            <li>
              <b>03</b>
              <span>Order</span>
            </li>
          </ol>
        </section>

        {phase === "empty" ? (
          <section className="order-empty-state">
            <span className="order-empty-symbol">∅</span>
            <p className="order-eyebrow">NO ITEMS TO REVIEW</p>
            <h2>Your checkout is empty.</h2>
            <p>Return to the market or choose items from your cart.</p>
            <div className="order-empty-actions">
              <Link to="/cart">RETURN TO CART</Link>
              <Link to="/shop">EXPLORE PRODUCTS</Link>
            </div>
          </section>
        ) : (
          <div className="checkout-layout">
            <section className="checkout-review-panel" aria-labelledby="checkout-items-title">
              <div className="checkout-panel-heading">
                <div>
                  <p className="order-eyebrow">01 / ORDER CONTENTS</p>
                  <h2 id="checkout-items-title">Review your items</h2>
                </div>
                <span>
                  {items.length} {items.length === 1 ? "ITEM" : "ITEMS"}
                </span>
              </div>
              <div className="checkout-item-list">
                {items.map((item, index) => (
                  <article className="checkout-item" key={item.itemId}>
                    <CartProductImage
                      src={item.imageUrl || undefined}
                      name={item.name}
                      itemId={item.itemId}
                      index={index}
                    />
                    <div className="checkout-item-info">
                      <p>
                        {[item.brand, item.category].filter(Boolean).join(" / ") || "NEXORA OBJECT"}
                      </p>
                      <h3>{item.name}</h3>
                      <span>
                        QTY {item.quantity}
                        <i /> UNIT {money.format(Number(item.price))}
                      </span>
                    </div>
                    <div className="checkout-item-total">
                      <small>LINE TOTAL</small>
                      <strong>{money.format(Number(item.price) * item.quantity)}</strong>
                    </div>
                  </article>
                ))}
              </div>
              <div className="checkout-panel-foot">
                <i>✦</i> Availability is checked when the order is placed.
              </div>
            </section>

            <aside className="checkout-summary-panel">
              <div className="checkout-summary-topline">
                <span>02 / CONFIRMATION</span>
                <b className={phase === "verified" ? "verified" : ""}>
                  <i />{" "}
                  {phase === "verified"
                    ? "PRICE CHECK PASSED"
                    : phase.toUpperCase().replace("-", " ")}
                </b>
              </div>
              <h2>
                Order <span>summary</span>
              </h2>
              <p className="checkout-summary-copy">
                {phase === "verified"
                  ? "Prices are verified. Confirm to create your order."
                  : "Confirm the latest prices before ordering."}
              </p>
              <div className="checkout-route-card">
                <i />
                <div>
                  <strong>NIGHT CITY</strong>
                  <small>
                    {items.length} items · {unitCount} {unitCount === 1 ? "unit" : "units"}
                  </small>
                </div>
                <span>↘</span>
              </div>
              <div className="checkout-summary-line">
                <span>Items subtotal</span>
                <strong>{money.format(estimate)}</strong>
              </div>
              <div className="checkout-summary-line muted">
                <span>Order status</span>
                <span>Pending payment</span>
              </div>
              <div className="checkout-total-rule">
                <span />
                {phase === "verified" ? "VERIFIED TOTAL" : "ESTIMATED TOTAL"}
                <span />
              </div>
              <div className="checkout-total">
                <small>USD</small>
                <strong>{money.format(displayedTotal)}</strong>
              </div>
              <p
                className={`checkout-state-note ${phase === "changed" || phase.endsWith("error") ? "attention" : ""}`}
                role="status"
              >
                {phase === "checking" ? (
                  <>
                    <i className="order-spinner" />
                    Checking current prices…
                  </>
                ) : (
                  notice
                )}
              </p>
              {phase === "create-error" ? (
                <div className="checkout-error-actions">
                  <p>
                    The request may still be processing. Retry this same order; if it was created,
                    the existing order will be returned.
                  </p>
                  <button
                    className="checkout-primary-action"
                    type="button"
                    onClick={() => void placeOrder()}
                  >
                    <span>RETRY SAME REQUEST</span>
                    <b>↗</b>
                  </button>
                  <Link to="/orders">
                    OPEN MY ORDERS <span>↗</span>
                  </Link>
                </div>
              ) : (
                <button
                  className="checkout-primary-action"
                  type="button"
                  disabled={phase === "checking" || phase === "creating"}
                  onClick={() => {
                    if (phase === "verified") void placeOrder();
                    else if (phase === "changed" || phase === "check-error")
                      void verifyPrices(items);
                  }}
                >
                  <span>
                    {phase === "checking"
                      ? "CHECKING PRICES"
                      : phase === "creating"
                        ? "CREATING ORDER"
                        : phase === "changed"
                          ? "ACCEPT & RECHECK"
                          : phase === "check-error"
                            ? "RETRY PRICE CHECK"
                            : "PLACE ORDER"}
                  </span>
                  <b>↗</b>
                </button>
              )}
              <Link className="checkout-secondary-action" to="/cart">
                BACK TO CART
              </Link>
              <div className="checkout-protection">
                <i>◇</i>
                <p>
                  ORDER PROTECTION<small>No order is created until you confirm.</small>
                </p>
              </div>
            </aside>
          </div>
        )}
        <footer className="orders-footer">
          <span>NEXORA / NIGHT TRANSIT</span>
          <span>
            ORDER REVIEW <i>✦</i>
          </span>
        </footer>
      </div>
    </main>
  );
}

function checkoutAttemptStorageKey(username: string | null, items: CartCheckoutDraftItem[]) {
  const fingerprint: string = items
    .map(({ itemId, quantity }) => ({ itemId, quantity }))
    .sort((a, b) => a.itemId - b.itemId || a.quantity - b.quantity)
    .map(({ itemId, quantity }) => `${itemId}:${quantity}`)
    .join(";");
  return `nexora:checkout-order:${encodeURIComponent(username || "buyer")}:${fingerprint}`;
}

function getOrCreateCheckoutIdempotencyKey(
  storageKey: string,
  fallbackAttempt: { storageKey: string; key: string } | null,
) {
  const expiresAfterMs = 24 * 60 * 60 * 1000;
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (
      stored &&
      typeof stored === "object" &&
      "key" in stored &&
      typeof stored.key === "string" &&
      "createdAt" in stored &&
      typeof stored.createdAt === "number" &&
      Date.now() - stored.createdAt >= 0 &&
      Date.now() - stored.createdAt < expiresAfterMs
    ) {
      return stored.key;
    }
  } catch {
    if (fallbackAttempt?.storageKey === storageKey) return fallbackAttempt.key;
  }

  if (fallbackAttempt?.storageKey === storageKey) return fallbackAttempt.key;
  const key = createIdempotencyKey("order");
  try {
    localStorage.setItem(storageKey, JSON.stringify({ key, createdAt: Date.now() }));
  } catch {
    // Keep the request usable when browser storage is unavailable.
  }
  return key;
}

function OrderRouteLine({
  title,
  backTo,
  backLabel,
}: {
  title: string;
  backTo: string;
  backLabel: string;
}) {
  return (
    <div className="order-route-line">
      <span className="order-route-dot" /> NIGHT TRANSIT <i /> {title}
      <Link to={backTo}>← {backLabel}</Link>
      <span className="order-city-tag">✦ NIGHT CITY / ALWAYS OPEN</span>
    </div>
  );
}
