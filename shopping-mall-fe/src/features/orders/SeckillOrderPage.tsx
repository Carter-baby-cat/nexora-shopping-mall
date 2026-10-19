import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { normalizeApiError } from "../../api/types";
import { createIdempotencyKey, createSeckillOrder, getOrders } from "./orderApi";
import type { ProductDetailCheckoutState } from "./orderTypes";
import "./orders.css";

type Phase = "submitting" | "accepted" | "error";

export function SeckillOrderPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const submittedKey = useRef<string | null>(null);
  const [phase, setPhase] = useState<Phase>("submitting");
  const [orderNo, setOrderNo] = useState("");
  const [message, setMessage] = useState("Sending your request to the night market.");
  const [attempt, setAttempt] = useState(0);
  const data = location.state as ProductDetailCheckoutState | null;
  const idempotencyKey = useRef<string | null>(data?.idempotencyKey ?? null);

  async function submit(itemId: number) {
    const requestKey = idempotencyKey.current;
    if (!requestKey) return;
    setPhase("submitting");
    setMessage("Sending your request to the night market.");
    try {
      const result = await createSeckillOrder(itemId, requestKey);
      setOrderNo(result.orderNo);
      setMessage(result.info || "Order request accepted. Your order is being created.");
      setPhase("accepted");
      setAttempt((value) => value + 1);
    } catch (cause: unknown) {
      const error = normalizeApiError(cause).message;
      if (/previous seckill order failed/i.test(error)) {
        const nextKey = createIdempotencyKey("seckill");
        idempotencyKey.current = nextKey;
        submittedKey.current = nextKey;
        navigate(`${location.pathname}${location.search}`, {
          replace: true,
          state: { ...(data ?? {}), idempotencyKey: nextKey },
        });
      }
      setMessage(error);
      setPhase("error");
    }
  }

  useEffect(() => {
    if (
      !data ||
      data.source !== "product-detail" ||
      !data.isSeckill ||
      !Number.isSafeInteger(data.itemId)
    ) {
      setPhase("error");
      setMessage("This flash-sale request is not valid. Return to the product page and try again.");
      return;
    }
    if (!data.idempotencyKey) {
      const nextKey = createIdempotencyKey("seckill");
      idempotencyKey.current = nextKey;
      navigate(`${location.pathname}${location.search}`, {
        replace: true,
        state: { ...data, idempotencyKey: nextKey },
      });
      return;
    }
    idempotencyKey.current = data.idempotencyKey;
    if (submittedKey.current === data.idempotencyKey) return;
    submittedKey.current = data.idempotencyKey;
    void submit(data.itemId);
  }, [data, location.key, location.pathname, location.search, navigate]);

  useEffect(() => {
    if (phase !== "accepted" || !orderNo) return;
    let active = true;
    let timeout: number | undefined;
    let polls = 0;
    const poll = async () => {
      polls += 1;
      try {
        const orders = await getOrders();
        const order = orders.find((entry) => entry.orderNo === orderNo);
        if (active && order) {
          navigate(`/orders/${order.id}`, { replace: true, state: { order } });
          return;
        }
      } catch {
        // The accepted request remains valid; the orders list can be refreshed manually.
      }
      if (active && polls < 8) timeout = window.setTimeout(poll, 2500);
      else if (active) setMessage("Still processing. Check your orders in a moment.");
    };
    timeout = window.setTimeout(poll, 1500);
    return () => {
      active = false;
      if (timeout) window.clearTimeout(timeout);
    };
  }, [attempt, navigate, orderNo, phase]);

  const itemName = data?.itemName || "Flash-sale item";
  const itemId = data?.itemId;

  return (
    <main className="order-page seckill-page">
      <div className="order-page-shell">
        <div className="order-route-line">
          <span className="order-route-dot" /> NIGHT TRANSIT <i /> FLASH ORDER
          <Link to={itemId ? `/products/${itemId}` : "/shop"}>← BACK TO PRODUCT</Link>
          <span className="order-city-tag">✦ NIGHT CITY / ALWAYS OPEN</span>
        </div>
        <section className={`seckill-result-card ${phase}`} aria-live="polite">
          <div className="seckill-emblem">
            {phase === "error" ? "!" : phase === "accepted" ? "✓" : <i />}
          </div>
          <p className="order-eyebrow">
            {phase === "error" ? "REQUEST INTERRUPTED" : "FLASH SALE / ORDER QUEUE"}
          </p>
          <h1>
            {phase === "error"
              ? "Request not completed."
              : phase === "accepted"
                ? "Your place is in the queue."
                : "Claiming your item…"}
          </h1>
          <p className="seckill-item-name">{itemName}</p>
          {orderNo && <p className="seckill-order-number">ORDER REQUEST / {orderNo}</p>}
          <p className="seckill-message">{message}</p>
          {phase === "submitting" && <span className="order-spinner" />}
          <div className="seckill-actions">
            {phase === "error" && itemId && (
              <button type="button" onClick={() => void submit(itemId)}>
                TRY AGAIN <span>↗</span>
              </button>
            )}
            {phase === "accepted" && (
              <Link to="/orders" state={{ pendingSeckillOrderNo: orderNo }}>
                VIEW ORDERS <span>↗</span>
              </Link>
            )}
            <Link className="secondary" to={itemId ? `/products/${itemId}` : "/shop"}>
              BACK TO MARKET
            </Link>
          </div>
          <small className="seckill-footnote">
            The order will appear after the queue finishes processing.
          </small>
        </section>
      </div>
    </main>
  );
}
