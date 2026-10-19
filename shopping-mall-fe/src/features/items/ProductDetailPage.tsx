import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { normalizeApiError } from "../../api/types";
import { ErrorState, LoadingState } from "../../components/States";
import { createIdempotencyKey } from "../orders/orderApi";
import { getItemDetail } from "./itemApi";
import { parseImageUrls, type ItemDetail, type ItemStatus } from "./itemTypes";
import "./items.css";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function statusText(item: ItemDetail) {
  if (item.status === "OFFLINE") return "OFFLINE";
  if (item.isSeckill && item.seckillEnded) return "SALE ENDED";
  if (item.status === "SOLD_OUT" || item.stock <= 0) return "SOLD OUT";
  return item.isSeckill ? "FLASH SALE" : "ONLINE";
}

function statusClass(status: ItemStatus) {
  return `detail-status-${status.toLowerCase()}`;
}

function ProductArtwork({
  src,
  alt,
  itemId,
  className = "",
}: {
  src?: string;
  alt: string;
  itemId: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);

  return (
    <div className={`detail-artwork ${className}`}>
      <div className="detail-artwork-fallback" aria-hidden="true">
        <span>NX / {String(itemId).padStart(4, "0")}</span>
      </div>
      {src && !failed && <img src={src} alt={alt} onError={() => setFailed(true)} />}
    </div>
  );
}

export function ProductDetailPage() {
  const { itemId: itemIdParam } = useParams();
  const navigate = useNavigate();
  const itemId = Number(itemIdParam);
  const [item, setItem] = useState<ItemDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  const [activeImage, setActiveImage] = useState(0);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (!Number.isSafeInteger(itemId) || itemId <= 0) {
      setItem(null);
      setError("This product address is not valid.");
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError("");
    setItem(null);
    getItemDetail(itemId, controller.signal)
      .then((detail) => {
        setItem(detail);
        setActiveImage(0);
        setQuantity(1);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setError(normalizeApiError(cause).message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [itemId, retryCount]);

  if (loading) {
    return (
      <main className="detail-page detail-state-page">
        <LoadingState label="LOCATING OBJECT…" />
      </main>
    );
  }

  if (error || !item) {
    return (
      <main className="detail-page detail-state-page">
        <div className="detail-state-content">
          <p className="item-eyebrow">NEXORA / OBJECT NOT FOUND</p>
          <ErrorState
            message={error || "This product could not be found."}
            onRetry={() => setRetryCount((count) => count + 1)}
          />
          <Link className="detail-back-link" to="/shop">
            ← BACK TO THE MARKET
          </Link>
        </div>
      </main>
    );
  }

  const images = parseImageUrls(item.imageUrls);
  const heroImage = images[0];
  const selectedImage = images[activeImage] || heroImage;
  const canBuy =
    item.status === "ONLINE" && item.stock > 0 && !(item.isSeckill && item.seckillEnded);
  const isSeckill = item.isSeckill;
  const endTimeLabel = item.endTime?.replace("T", " ");

  function continueTo(path: "/cart" | "/checkout" | "/seckill-order") {
    if (!item) return;
    navigate(path, {
      state: {
        source: "product-detail",
        itemId: item.id,
        itemName: item.name,
        imageUrl: heroImage,
        unitPrice: item.price,
        quantity: isSeckill ? 1 : quantity,
        isSeckill,
        ...(path === "/seckill-order" ? { idempotencyKey: createIdempotencyKey("seckill") } : {}),
      },
    });
  }

  return (
    <main className="detail-page">
      <div className="detail-page-inner">
        <div className="detail-page-topline">
          <Link to="/shop">← BACK TO MARKET</Link>
          <span>NEXORA / OBJECT {String(item.id).padStart(4, "0")}</span>
          <span className="detail-top-category">{item.category}</span>
        </div>

        <section className="detail-hero" aria-label="Product overview">
          <div className="detail-hero-copy">
            <p className="item-eyebrow">NEXORA / SELECTED OBJECT</p>
            <h1>Where discovery becomes desire.</h1>
            <p className="detail-hero-brand">
              {item.brand} / {item.category}
            </p>
            <p className="detail-hero-price">{money.format(item.price)}</p>
            <span className={`detail-hero-status ${statusClass(item.status)}`}>
              <i /> {statusText(item)}
            </span>
            {isSeckill && endTimeLabel && (
              <p className="detail-sale-end">
                {item.seckillEnded ? "SALE ENDED" : "SALE ENDS"} / {endTimeLabel}
              </p>
            )}
          </div>

          <div className="detail-billboard-scene">
            <div className="detail-billboard-box">
              <div className="billboard-face billboard-face-right" aria-hidden="true" />
              <div className="detail-billboard">
                <div className="billboard-meta">
                  <span>NEXORA SELECTED OBJECTS</span>
                  <span>{item.brand}</span>
                </div>
                <div className="billboard-copy">
                  <p>{item.category}</p>
                  <h2>{item.name}</h2>
                  <span>{money.format(item.price)}</span>
                </div>
                <ProductArtwork
                  src={heroImage}
                  alt={item.name}
                  itemId={item.id}
                  className="billboard-art"
                />
                <div className="billboard-footer">
                  <span>DISCOVER SOMETHING DIFFERENT</span>
                  <span className={statusClass(item.status)}>
                    <i /> {statusText(item)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="detail-scroll-cue" aria-hidden="true">
          <span>↓</span> SCROLL TO DISCOVER
        </div>

        <section className="detail-information" aria-labelledby="detail-title">
          <div className="detail-section-heading">
            <div>
              <p className="item-eyebrow">THE OBJECT / PRODUCT DETAIL</p>
              <h2 id="detail-title">Designed to be discovered.</h2>
            </div>
            <p>
              Only the essentials: what it is, who made it, what it costs, and whether it is
              available now.
            </p>
          </div>

          <div className="detail-product-grid">
            <div className="detail-gallery">
              <div className="detail-main-image">
                <span className="detail-image-index">
                  IMAGE / {String(activeImage + 1).padStart(2, "0")}
                </span>
                <ProductArtwork
                  src={selectedImage}
                  alt={item.name}
                  itemId={item.id}
                  className="detail-gallery-art"
                />
              </div>
              {images.length > 1 && (
                <div className="detail-thumbnails" aria-label="Product images">
                  {images.map((image, index) => (
                    <button
                      type="button"
                      key={`${image}-${index}`}
                      className={activeImage === index ? "active" : ""}
                      aria-label={`Show product image ${index + 1}`}
                      aria-pressed={activeImage === index}
                      onClick={() => setActiveImage(index)}
                    >
                      <ProductArtwork src={image} alt="" itemId={item.id} />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="detail-purchase-panel">
              <p className="detail-brand-label">{item.brand}</p>
              <h3>{item.name}</h3>
              <p className="detail-category-label">{item.category}</p>
              {item.description && <p className="detail-description">{item.description}</p>}
              <p className="detail-purchase-price">{money.format(item.price)}</p>
              <p className={`detail-stock-state ${statusClass(item.status)}`}>
                <i /> {statusText(item)}
                {item.status === "ONLINE" && item.stock > 0 && (
                  <span> / {item.stock} AVAILABLE</span>
                )}
              </p>
              {isSeckill && endTimeLabel && (
                <p className="detail-end-time">
                  FLASH SALE {item.seckillEnded ? "ENDED" : "ENDS"} / {endTimeLabel}
                </p>
              )}

              <div className="detail-rule" />
              <div className="detail-quantity-row">
                <div>
                  <span className="detail-field-label">QUANTITY</span>
                  <div className="quantity-control">
                    <button
                      type="button"
                      aria-label="Decrease quantity"
                      disabled={!canBuy || isSeckill || quantity <= 1}
                      onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                    >
                      −
                    </button>
                    <span aria-live="polite">{isSeckill ? 1 : quantity}</span>
                    <button
                      type="button"
                      aria-label="Increase quantity"
                      disabled={!canBuy || isSeckill || quantity >= item.stock}
                      onClick={() => setQuantity((value) => Math.min(item.stock, value + 1))}
                    >
                      +
                    </button>
                  </div>
                </div>
                <span className="quantity-hint">
                  {isSeckill
                    ? "ONE PER ORDER"
                    : canBuy
                      ? "ADJUST AS NEEDED"
                      : "CURRENTLY UNAVAILABLE"}
                </span>
              </div>

              <div className="detail-rule" />
              <div className="detail-actions">
                <button
                  type="button"
                  className="detail-buy-button"
                  disabled={!canBuy}
                  onClick={() => continueTo(isSeckill ? "/seckill-order" : "/checkout")}
                >
                  {isSeckill ? (item.seckillEnded ? "SALE ENDED" : "BUY FLASH ITEM") : "BUY NOW"}{" "}
                  <span>↗</span>
                </button>
                {!isSeckill && (
                  <button
                    type="button"
                    className="detail-cart-button"
                    disabled={!canBuy}
                    onClick={() => continueTo("/cart")}
                  >
                    ADD TO CART <span>＋</span>
                  </button>
                )}
              </div>
              {!canBuy && (
                <p className="detail-unavailable-note">
                  {item.status === "OFFLINE"
                    ? "This object is no longer available."
                    : item.isSeckill && item.seckillEnded
                      ? "This flash sale has ended."
                      : "This object is currently sold out."}
                </p>
              )}
            </div>
          </div>

          <div className="detail-facts">
            <article>
              <span>01 / IDENTITY</span>
              <p>Product name, brand, and category are shown as supplied by the catalog.</p>
            </article>
            <article>
              <span>02 / DESCRIPTION</span>
              <p>{item.description || "No product description provided."}</p>
            </article>
            <article>
              <span>03 / AVAILABILITY</span>
              <p>Availability and available actions follow the latest product status.</p>
            </article>
          </div>
        </section>
      </div>
    </main>
  );
}
