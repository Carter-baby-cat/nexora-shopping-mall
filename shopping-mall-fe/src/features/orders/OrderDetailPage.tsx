import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { normalizeApiError } from "../../api/types";
import { OrderActionDialog } from "./OrderActionDialog";
import { getOrderItems, getOrders } from "./orderApi";
import type { OrderLine, OrderRecord } from "./orderTypes";
import { OrderLineImage } from "./OrderVisuals";
import "./orders.css";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function formatDate(value: string) {
  const date = new Date(value.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return value;
  return date
    .toLocaleString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
    .toUpperCase();
}

function statusPresentation(status: OrderRecord["status"]) {
  if (status === "PENDING") {
    return {
      label: "PENDING",
      kicker: "ORDER STATUS / AWAITING PAYMENT",
      title: "Your order is ready for its next stop.",
      message: "Complete payment from your buyer balance to confirm this order.",
    };
  }
  if (status === "PAID") {
    return {
      label: "PAID",
      kicker: "ORDER STATUS / PAYMENT CONFIRMED",
      title: "Payment is recorded for this order.",
      message: "This page shows the latest order status and its recorded items.",
    };
  }
  return {
    label: "CANCELLED",
    kicker: "ORDER STATUS / ORDER CLOSED",
    title: "This order has been cancelled.",
    message: "Payment and cancellation actions are no longer available for this order.",
  };
}

export function OrderDetailPage() {
  const { orderId: orderIdParam } = useParams();
  const orderId = Number(orderIdParam);
  const [order, setOrder] = useState<OrderRecord | null>(null);
  const [items, setItems] = useState<OrderLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [dialogAction, setDialogAction] = useState<"pay" | "cancel" | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    if (!Number.isSafeInteger(orderId) || orderId <= 0) {
      setLoading(false);
      setError("This order address is not valid.");
      return () => controller.abort();
    }

    setLoading(true);
    setError("");
    setOrder(null);
    setItems([]);
    getOrders(controller.signal)
      .then(async (orders) => {
        const currentOrder = orders.find((entry) => entry.id === orderId);
        if (!currentOrder)
          throw new Error("Order not found or still processing. Refresh your orders shortly.");
        const orderItems = await getOrderItems(orderId, controller.signal);
        if (!controller.signal.aborted) {
          setOrder(currentOrder);
          setItems(orderItems);
        }
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setError(normalizeApiError(cause).message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [orderId, refreshKey]);

  const totalUnits = items.reduce((sum, item) => sum + Number(item.quantity), 0);
  const status = order ? statusPresentation(order.status) : null;

  return (
    <main className="order-page order-detail-page">
      <div className="order-page-shell">
        <div className="order-route-line">
          <span className="order-route-dot" /> NIGHT TRANSIT <i /> ORDER DETAILS
          <Link to="/orders">← ALL ORDERS</Link>
          <span className="order-city-tag">✦ NIGHT CITY / ALWAYS OPEN</span>
        </div>
        <section className="order-page-heading">
          <div>
            <p className="order-eyebrow">PURCHASE RECORD · YOUR NIGHT TRANSIT</p>
            <h1>
              Order <span>Details</span>
            </h1>
            <p>Every piece from this trip, gathered in one place.</p>
          </div>
          {order && (
            <div className="order-reference-display">
              <i />
              <strong>{order.orderNo.slice(-5)}</strong>
              <span>ORDER REFERENCE</span>
            </div>
          )}
        </section>

        {loading ? (
          <section className="order-load-state" role="status">
            <i className="order-spinner" />
            <p className="order-eyebrow">RETRIEVING ORDER RECORD</p>
          </section>
        ) : error || !order || !status ? (
          <section className="order-load-state error" role="alert">
            <span className="order-empty-symbol">!</span>
            <p className="order-eyebrow">ORDER RECORD UNAVAILABLE</p>
            <h2>We could not open this order.</h2>
            <p>{error || "The order is not available to this account."}</p>
            <div className="order-empty-actions">
              <button type="button" onClick={() => setRefreshKey((value) => value + 1)}>
                RETRY
              </button>
              <Link to="/orders">MY ORDERS</Link>
            </div>
          </section>
        ) : (
          <>
            <section className={`order-status-banner status-banner-${order.status.toLowerCase()}`}>
              <span className="order-status-emblem">✦</span>
              <div>
                <p className="order-eyebrow">{status.kicker}</p>
                <h2>{status.title}</h2>
                <p>{status.message}</p>
              </div>
              <strong className="order-banner-status">
                <i /> {status.label}
              </strong>
            </section>

            <div className="order-detail-layout">
              <section className="order-lines-panel">
                <div className="order-lines-heading">
                  <div>
                    <p className="order-eyebrow">01 / THE CARGO</p>
                    <h2>Items in this order</h2>
                  </div>
                  <span>
                    <strong>{String(items.length).padStart(2, "0")}</strong> PRODUCTS
                  </span>
                </div>
                <div className="order-meta-grid">
                  <div>
                    <span>ORDER NUMBER</span>
                    <strong>{order.orderNo}</strong>
                  </div>
                  <div>
                    <span>PLACED</span>
                    <strong>{formatDate(order.createdAt)}</strong>
                  </div>
                  <div>
                    <span>LAST UPDATED</span>
                    <strong>{formatDate(order.updatedAt)}</strong>
                  </div>
                </div>
                {items.length > 0 ? (
                  <div className="order-lines-list">
                    {items.map((item, index) => (
                      <article className="order-line" key={`${item.itemName}-${index}`}>
                        <OrderLineImage src={item.imageUrl} name={item.itemName} index={index} />
                        <div className="order-line-info">
                          <p>NEXORA OBJECT / {String(index + 1).padStart(2, "0")}</p>
                          <h3>{item.itemName}</h3>
                          <span>RECORDED IN THIS ORDER</span>
                        </div>
                        <strong className="order-line-quantity">× {item.quantity}</strong>
                        <div className="order-line-total">
                          <small>LINE TOTAL</small>
                          <strong>{money.format(Number(item.totalPrice))}</strong>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="order-lines-empty">
                    <p className="order-eyebrow">NO LINE ITEMS</p>
                    <p>There are no item details for this order.</p>
                  </div>
                )}
                <div className="order-lines-foot">
                  <i>✦</i> Item details show the price recorded when this order was created.
                </div>
              </section>

              <aside className="order-summary-panel">
                <div className="order-summary-topline">
                  <span>02 / PAYMENT ROUTE</span>
                  <b className={order.status === "PENDING" ? "open" : "closed"}>
                    <i /> {order.status === "PENDING" ? "PAYMENT OPEN" : status.label}
                  </b>
                </div>
                <h2>
                  Trip <span>summary</span>
                </h2>
                <p className="order-summary-copy">One clear view of this order.</p>
                <div className="order-route-card">
                  <i />
                  <div>
                    <strong>NEXORA NIGHT CITY</strong>
                    <small>
                      {items.length} items · {totalUnits} {totalUnits === 1 ? "unit" : "units"}
                    </small>
                  </div>
                  <span>↘</span>
                </div>
                <div className="order-summary-line">
                  <span>Products</span>
                  <strong>{items.length}</strong>
                </div>
                <div className="order-summary-line">
                  <span>Total units</span>
                  <strong>{totalUnits}</strong>
                </div>
                <div className="order-summary-line amount">
                  <span>Order amount</span>
                  <strong>{money.format(Number(order.totalAmount))}</strong>
                </div>
                <div className="order-total-rule">
                  <span /> ORDER TOTAL <span />
                </div>
                <div className="order-total">
                  <small>USD</small>
                  <strong>{money.format(Number(order.totalAmount))}</strong>
                </div>
                {order.status === "PENDING" && (
                  <>
                    <div className="order-balance-note">
                      <i>✦</i>
                      <p>
                        BUYER BALANCE<small>Payment uses your NEXORA account balance.</small>
                      </p>
                    </div>
                    <div className="order-expiry-note">
                      <strong>24H</strong>
                      <span>
                        Pending orders are automatically cancelled 24 hours after creation.
                      </span>
                    </div>
                    <button
                      className="order-pay-button"
                      type="button"
                      onClick={() => setDialogAction("pay")}
                    >
                      PAY WITH BALANCE <span>↗</span>
                    </button>
                    <button
                      className="order-cancel-button"
                      type="button"
                      onClick={() => setDialogAction("cancel")}
                    >
                      CANCEL ORDER
                    </button>
                  </>
                )}
                {order.status !== "PENDING" && (
                  <p className="order-closed-note">
                    {order.status === "PAID"
                      ? "Payment was completed using your buyer balance."
                      : "This order is closed."}
                  </p>
                )}
              </aside>
            </div>
          </>
        )}
        <footer className="orders-footer">
          <span>NEXORA / NIGHT TRANSIT</span>
          <span>
            ORDER DETAILS <i>✦</i>
          </span>
        </footer>
      </div>
      {dialogAction && order && (
        <OrderActionDialog
          action={dialogAction}
          order={order}
          onClose={() => setDialogAction(null)}
          onComplete={() => setRefreshKey((value) => value + 1)}
        />
      )}
    </main>
  );
}
