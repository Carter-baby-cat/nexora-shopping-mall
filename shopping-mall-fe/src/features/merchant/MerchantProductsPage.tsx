import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { normalizeApiError } from "../../api/types";
import { ErrorState, LoadingState } from "../../components/States";
import { MerchantProductFormDialog } from "./MerchantProductFormDialog";
import {
  OfflineConfirmationDialog,
  ProductUnavailableDialog,
  StockAdjustmentDialog,
} from "./MerchantActionDialogs";
import { getMerchantItems } from "./merchantApi";
import type { MerchantItem } from "./merchantTypes";
import "./merchant.css";

type ProductFilter = "all" | "online" | "sold-out" | "low-stock";
type ProductSort = "newest" | "price-low" | "price-high" | "stock-low";

const LOW_STOCK_LIMIT = 5;
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const numberFormat = new Intl.NumberFormat("en-US");

function isLowStock(product: MerchantItem) {
  return product.stock > 0 && product.stock <= LOW_STOCK_LIMIT;
}

function getStatusLabel(status: MerchantItem["status"]) {
  return status === "SOLD_OUT" ? "SOLD OUT" : "ONLINE";
}

function ProductImage({ item, className }: { item: MerchantItem; className: string }) {
  const [failed, setFailed] = useState(false);
  const imageUrl = item.imageUrls
    .split(",")
    .map((url) => url.trim())
    .find(Boolean);

  useEffect(() => setFailed(false), [imageUrl]);

  if (!imageUrl || failed) {
    return <span className={`${className} merchant-product-image-fallback`}>NX / {item.id}</span>;
  }
  return (
    <img
      className={className}
      src={imageUrl}
      alt={item.name}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

export function MerchantProductsPage() {
  const { itemId: itemIdParam } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [items, setItems] = useState<MerchantItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ProductFilter>("all");
  const [sort, setSort] = useState<ProductSort>("newest");
  const [stockTarget, setStockTarget] = useState<MerchantItem | null>(null);
  const [offlineTarget, setOfflineTarget] = useState<MerchantItem | null>(null);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<number | null>(null);

  const loadItems = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setLoadError("");
    try {
      const result = await getMerchantItems(signal);
      setItems(result);
      return true;
    } catch (cause: unknown) {
      if (signal?.aborted) return false;
      setLoadError(normalizeApiError(cause).message);
      return false;
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadItems(controller.signal);
    return () => controller.abort();
  }, [loadItems]);

  useEffect(
    () => () => {
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    },
    [],
  );

  const isCreateRoute = location.pathname === "/merchant/products/new";
  const wantsEdit = itemIdParam !== undefined;
  const editId = wantsEdit ? Number(itemIdParam) : null;
  const editingProduct = wantsEdit ? (items.find((item) => item.id === editId) ?? null) : null;
  const editTargetMissing =
    wantsEdit && !loading && !loadError && (!Number.isSafeInteger(editId) || !editingProduct);

  const counts = useMemo(
    () => ({
      total: items.length,
      online: items.filter((item) => item.status === "ONLINE").length,
      low: items.filter(isLowStock).length,
      flash: items.filter((item) => item.isSeckill).length,
      soldOut: items.filter((item) => item.status === "SOLD_OUT").length,
    }),
    [items],
  );

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const matchesFilter = (item: MerchantItem) => {
      if (filter === "online") return item.status === "ONLINE";
      if (filter === "sold-out") return item.status === "SOLD_OUT";
      if (filter === "low-stock") return isLowStock(item);
      return true;
    };
    const result = items.filter((item) => {
      const matchesQuery =
        !normalizedQuery ||
        `${item.name} ${item.brand} ${item.category} ${item.id}`
          .toLowerCase()
          .includes(normalizedQuery);
      return matchesQuery && matchesFilter(item);
    });
    if (sort === "price-low") result.sort((a, b) => a.price - b.price);
    else if (sort === "price-high") result.sort((a, b) => b.price - a.price);
    else if (sort === "stock-low") result.sort((a, b) => a.stock - b.stock || b.id - a.id);
    else result.sort((a, b) => b.id - a.id);
    return result;
  }, [filter, items, query, sort]);

  const shelfItems = useMemo(
    () => items.filter((item) => item.status === "ONLINE").slice(0, 5),
    [items],
  );

  function showToast(message: string) {
    setToast(message);
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 2800);
  }

  async function finishMutation(message: string) {
    await loadItems();
    showToast(message);
  }

  function handleProductSaved(message: string) {
    navigate("/merchant/products", { replace: true });
    void finishMutation(message);
  }

  function handleStockSaved() {
    setStockTarget(null);
    void finishMutation("Stock updated.");
  }

  function handleOfflineConfirmed() {
    setOfflineTarget(null);
    void finishMutation("Product taken offline.");
  }

  const filters: { id: ProductFilter; label: string; count: number }[] = [
    { id: "all", label: "All", count: counts.total },
    { id: "online", label: "Online", count: counts.online },
    { id: "sold-out", label: "Sold out", count: counts.soldOut },
    { id: "low-stock", label: "Low stock", count: counts.low },
  ];

  return (
    <main className="merchant-products-page">
      <div className="merchant-products-shell">
        <div className="merchant-route-line">
          <span>MERCHANT SPACE</span>
          <i>/</i>
          <strong>PRODUCTS</strong>
          <span className="merchant-live-state">
            <i /> LIVE
          </span>
        </div>

        <header className="merchant-page-heading">
          <div>
            <p className="merchant-eyebrow">
              COLLECTION ROOM <span>/</span> 01
            </p>
            <h1>Product Gallery</h1>
          </div>
          <button
            className="merchant-primary-button merchant-add-button"
            type="button"
            onClick={() => navigate("/merchant/products/new")}
          >
            <span aria-hidden="true">＋</span> ADD PRODUCT
          </button>
        </header>

        <section className="merchant-metrics" aria-label="Product summary">
          <article>
            <span>LISTED PRODUCTS</span>
            <strong>{String(counts.total).padStart(2, "0")}</strong>
          </article>
          <article>
            <span>ONLINE</span>
            <strong>{String(counts.online).padStart(2, "0")}</strong>
          </article>
          <article>
            <span>
              LOW STOCK <small>≤ 5</small>
            </span>
            <strong>{String(counts.low).padStart(2, "0")}</strong>
          </article>
          <article>
            <span>FLASH SALE</span>
            <strong>{String(counts.flash).padStart(2, "0")}</strong>
          </article>
        </section>

        <section className="merchant-shelf-section" aria-labelledby="merchant-shelf-title">
          <div className="merchant-section-heading">
            <div>
              <h2 id="merchant-shelf-title">
                The <span>Amber</span> Shelf
              </h2>
              <p>ONLINE COLLECTION</p>
            </div>
            <span>{String(shelfItems.length).padStart(2, "0")} DISPLAYED</span>
          </div>
          <div className="merchant-shelf-frame">
            {loading ? (
              <div className="merchant-shelf-state">
                <span className="merchant-spinner" /> Loading shelf
              </div>
            ) : loadError ? (
              <div className="merchant-shelf-state">Shelf unavailable</div>
            ) : shelfItems.length ? (
              <div className="merchant-shelf-items">
                {shelfItems.map((item) => (
                  <article className="merchant-shelf-card" key={item.id}>
                    {item.isSeckill && <span className="merchant-shelf-tag">FLASH SALE</span>}
                    <div className="merchant-shelf-image">
                      <ProductImage item={item} className="" />
                    </div>
                    <div className="merchant-shelf-card-copy">
                      <span>{item.name}</span>
                      <strong>{money.format(Number(item.price))}</strong>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="merchant-shelf-state">No online products</div>
            )}
          </div>
        </section>

        <section className="merchant-inventory-section" aria-labelledby="merchant-inventory-title">
          <div className="merchant-inventory-header">
            <div className="merchant-inventory-title-group">
              <h2 id="merchant-inventory-title">Product Registry</h2>
              <span>{String(filteredItems.length).padStart(2, "0")}</span>
            </div>
            <div className="merchant-list-tools">
              <label className="merchant-search-box">
                <span aria-hidden="true">⌕</span>
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search products"
                  aria-label="Search products"
                />
              </label>
              <label className="merchant-sort-label" htmlFor="merchant-product-sort">
                SORT
              </label>
              <select
                id="merchant-product-sort"
                className="merchant-sort-select"
                value={sort}
                onChange={(event) => setSort(event.target.value as ProductSort)}
                aria-label="Sort products"
              >
                <option value="newest">Newest</option>
                <option value="price-low">Price: low to high</option>
                <option value="price-high">Price: high to low</option>
                <option value="stock-low">Stock: low to high</option>
              </select>
              <button
                className="merchant-refresh-button"
                type="button"
                onClick={() => void loadItems()}
                disabled={loading}
                aria-label="Refresh products"
              >
                ↻
              </button>
            </div>
          </div>

          <div className="merchant-filter-bar" role="tablist" aria-label="Filter products">
            {filters.map((entry) => (
              <button
                key={entry.id}
                className={filter === entry.id ? "active" : ""}
                type="button"
                role="tab"
                aria-selected={filter === entry.id}
                onClick={() => setFilter(entry.id)}
              >
                {entry.label} <span>{String(entry.count).padStart(2, "0")}</span>
              </button>
            ))}
          </div>

          {loading ? (
            <LoadingState label="Loading products" />
          ) : loadError ? (
            <div className="merchant-products-state">
              <ErrorState message={loadError} onRetry={() => void loadItems()} />
            </div>
          ) : filteredItems.length ? (
            <div className="merchant-product-list" aria-live="polite">
              {filteredItems.map((item) => (
                <article className="merchant-product-row" key={item.id}>
                  <div className="merchant-product-identity">
                    <ProductImage item={item} className="merchant-product-thumb" />
                    <div className="merchant-product-copy">
                      <strong>{item.name}</strong>
                      <span>
                        {item.brand} · {item.category} · #{item.id}
                      </span>
                      {item.isSeckill && <small>FLASH SALE</small>}
                    </div>
                  </div>
                  <div className="merchant-price-cell">
                    <span className="merchant-row-label">PRICE</span>
                    <strong>{money.format(Number(item.price))}</strong>
                  </div>
                  <div className="merchant-stock-cell">
                    <span className="merchant-row-label">STOCK</span>
                    <strong className={isLowStock(item) ? "low" : ""}>
                      {numberFormat.format(item.stock)}
                    </strong>
                    <button type="button" onClick={() => setStockTarget(item)}>
                      Adjust
                    </button>
                  </div>
                  <div className="merchant-status-cell">
                    <span className="merchant-row-label">STATUS</span>
                    <span
                      className={`merchant-status-pill ${item.status === "SOLD_OUT" ? "sold-out" : ""}`}
                    >
                      {getStatusLabel(item.status)}
                    </span>
                  </div>
                  <div className="merchant-row-actions">
                    <button
                      type="button"
                      onClick={() => navigate(`/merchant/products/${item.id}/edit`)}
                    >
                      EDIT
                    </button>
                    <button
                      type="button"
                      className="offline"
                      onClick={() => setOfflineTarget(item)}
                    >
                      OFFLINE
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="merchant-empty-state">
              <span>⌕</span>
              <strong>No products found</strong>
              {(query || filter !== "all") && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setFilter("all");
                  }}
                >
                  CLEAR SEARCH AND FILTERS
                </button>
              )}
            </div>
          )}
        </section>

        <footer className="merchant-page-footer">
          <span>NEXORA MERCHANT ATELIER</span>
          <Link to="/account">ACCOUNT BALANCE</Link>
        </footer>
      </div>

      {isCreateRoute && (
        <MerchantProductFormDialog
          key="create-product"
          product={null}
          onClose={() => navigate("/merchant/products")}
          onSaved={handleProductSaved}
        />
      )}
      {editingProduct && (
        <MerchantProductFormDialog
          key={`edit-product-${editingProduct.id}`}
          product={editingProduct}
          onClose={() => navigate("/merchant/products")}
          onSaved={handleProductSaved}
        />
      )}
      {editTargetMissing && (
        <ProductUnavailableDialog onClose={() => navigate("/merchant/products")} />
      )}
      {stockTarget && (
        <StockAdjustmentDialog
          key={`stock-${stockTarget.id}`}
          product={stockTarget}
          onClose={() => setStockTarget(null)}
          onSaved={handleStockSaved}
        />
      )}
      {offlineTarget && (
        <OfflineConfirmationDialog
          key={`offline-${offlineTarget.id}`}
          product={offlineTarget}
          onClose={() => setOfflineTarget(null)}
          onConfirmed={handleOfflineConfirmed}
        />
      )}
      {toast && (
        <div className="merchant-toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </main>
  );
}
