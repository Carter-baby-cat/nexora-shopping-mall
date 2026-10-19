import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { normalizeApiError } from "../../api/types";
import { OrderActionDialog } from "./OrderActionDialog";
import { getOrders } from "./orderApi";
import type { OrderRecord, OrderStatus } from "./orderTypes";
import "./orders.css";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
type StatusFilter = "ALL" | OrderStatus;

function formatDate(value: string) {
  const date = new Date(value.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return value;
  return date
    .toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })
    .toUpperCase();
}

function formatTime(value: string) {
  const date = new Date(value.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function statusLabel(status: OrderStatus) {
  if (status === "PENDING") return "PENDING PAYMENT";
  return status;
}

export function OrdersPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [query, setQuery] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [dialog, setDialog] = useState<{ action: "pay" | "cancel"; order: OrderRecord } | null>(
    null,
  );
  const routeState = location.state as { pendingSeckillOrderNo?: string } | null;

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    getOrders(controller.signal)
      .then(setOrders)
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setError(normalizeApiError(cause).message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [refreshKey]);

  const counts = useMemo(
    () => ({
      ALL: orders.length,
      PENDING: orders.filter((order) => order.status === "PENDING").length,
      PAID: orders.filter((order) => order.status === "PAID").length,
      CANCELLED: orders.filter((order) => order.status === "CANCELLED").length,
    }),
    [orders],
  );
  const filteredOrders = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return orders.filter((order) => {
      const matchesStatus = statusFilter === "ALL" || order.status === statusFilter;
      const matchesQuery =
        !normalizedQuery || order.orderNo.toLowerCase().includes(normalizedQuery);
      return matchesStatus && matchesQuery;
    });
  }, [orders, query, statusFilter]);

  function reload() {
    setRefreshKey((value) => value + 1);
  }

  return (
    <main className="order-page orders-list-page">
      <div className="order-page-shell">
        <div className="order-route-line">
          <span className="order-route-dot" /> NIGHT TRANSIT <i /> YOUR ORDERS
          <Link to="/cart">← CART</Link>
          <span className="order-city-tag">✦ NIGHT CITY / ALWAYS OPEN</span>
        </div>
        <section className="order-page-heading">
          <div>
            <p className="order-eyebrow">PURCHASE RECORD · NIGHT TRANSIT</p>
            <h1>
              My <span>Orders</span>
            </h1>
            <p>Every order, one clear route back.</p>
          </div>
          <div className="orders-count-display">
            <i />
            <strong>{String(orders.length).padStart(2, "0")}</strong>
            <span>ORDER RECORDS</span>
          </div>
        </section>

        {routeState?.pendingSeckillOrderNo && (
          <div className="seckill-pending-notice" role="status">
            <i />
            <span>FLASH ORDER {routeState.pendingSeckillOrderNo} IS STILL PROCESSING.</span>
            <button type="button" onClick={reload}>
              REFRESH
            </button>
          </div>
        )}

        <section className="orders-table-panel" aria-label="Your orders">
          <div className="orders-panel-heading">
            <div>
              <p className="order-eyebrow">01 / YOUR PURCHASES</p>
              <h2>Order ledger</h2>
            </div>
            <label className="orders-search">
              <span aria-hidden="true">⌕</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search order number"
                aria-label="Search order number"
              />
              <kbd>⌘ K</kbd>
            </label>
          </div>
          <div className="orders-filter-row">
            <div className="orders-filters" role="tablist" aria-label="Filter by order status">
              {(["ALL", "PENDING", "PAID", "CANCELLED"] as StatusFilter[]).map((filter) => (
                <button
                  type="button"
                  key={filter}
                  role="tab"
                  aria-selected={statusFilter === filter}
                  className={statusFilter === filter ? "active" : ""}
                  onClick={() => setStatusFilter(filter)}
                >
                  {filter === "ALL"
                    ? "All"
                    : filter === "PENDING"
                      ? "Pending"
                      : filter === "PAID"
                        ? "Paid"
                        : "Cancelled"}
                  <span>{String(counts[filter]).padStart(2, "0")}</span>
                </button>
              ))}
            </div>
            <span className="orders-sort-label">
              <i /> NEWEST FIRST
            </span>
          </div>
          <div className="orders-table-head">
            <span>ORDER / REFERENCE</span>
            <span>PLACED</span>
            <span>AMOUNT</span>
            <span>STATUS</span>
            <span>ACTIONS</span>
          </div>
          {loading ? (
            <div className="orders-state">
              <i className="order-spinner" />
              <p className="order-eyebrow">LOADING PURCHASE RECORDS</p>
            </div>
          ) : error ? (
            <div className="orders-state error" role="alert">
              <p className="order-eyebrow">ROUTE INTERRUPTED</p>
              <h3>Orders could not be loaded.</h3>
              <p>{error}</p>
              <button type="button" onClick={reload}>
                RETRY
              </button>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="orders-state">
              <span className="order-empty-symbol">∅</span>
              <h3>{orders.length === 0 ? "No orders yet." : "No matching orders."}</h3>
              <p>
                {orders.length === 0
                  ? "Your orders will appear here after checkout."
                  : "Try another order number or status."}
              </p>
              {orders.length === 0 && (
                <Link to="/shop">
                  EXPLORE PRODUCTS <span>↗</span>
                </Link>
              )}
            </div>
          ) : (
            <div className="orders-table-body">
              {filteredOrders.map((order) => (
                <article className="order-table-row" key={order.id}>
                  <div className="order-reference-cell">
                    <strong>{order.orderNo}</strong>
                    <small>REFERENCE / {String(order.id).padStart(5, "0")}</small>
                  </div>
                  <div className="order-date-cell">
                    <strong>{formatDate(order.createdAt)}</strong>
                    <small>{formatTime(order.createdAt)}</small>
                  </div>
                  <strong className="order-amount-cell">
                    {money.format(Number(order.totalAmount))}
                  </strong>
                  <span className={`order-status status-${order.status.toLowerCase()}`}>
                    <i />
                    {statusLabel(order.status)}
                  </span>
                  <div className="order-actions-cell">
                    <button
                      type="button"
                      className="order-detail-action"
                      onClick={() => navigate(`/orders/${order.id}`, { state: { order } })}
                    >
                      VIEW DETAILS
                    </button>
                    {order.status === "PENDING" && (
                      <>
                        <button
                          type="button"
                          className="order-pay-action"
                          onClick={() => setDialog({ action: "pay", order })}
                        >
                          PAY
                        </button>
                        <button
                          type="button"
                          className="order-cancel-action"
                          onClick={() => setDialog({ action: "cancel", order })}
                        >
                          CANCEL
                        </button>
                      </>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
          <div className="orders-table-foot">
            <span /> ORDERS ARE SORTED BY THE LATEST ACTIVITY <span />
          </div>
        </section>

        <footer className="orders-footer">
          <span>NEXORA / NIGHT TRANSIT</span>
          <span>
            YOUR PURCHASE RECORD <i>✦</i>
          </span>
        </footer>
      </div>
      {dialog && (
        <OrderActionDialog
          action={dialog.action}
          order={dialog.order}
          onClose={() => setDialog(null)}
          onComplete={reload}
        />
      )}
    </main>
  );
}
