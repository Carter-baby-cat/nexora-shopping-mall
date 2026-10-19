import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { EmptyState, ErrorState, LoadingState } from "../../components/States";
import { normalizeApiError } from "../../api/types";
import { searchItems, suggestItems } from "./itemApi";
import type { ItemSearchResult, ItemStatus, SearchItem } from "./itemTypes";
import "./items.css";

const PAGE_SIZE = 12;

type Filters = {
  name: string;
  categories: string[];
  brands: string[];
  page: number;
};

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function formatStatus(status: ItemStatus) {
  if (status === "SOLD_OUT") return "SOLD OUT";
  if (status === "OFFLINE") return "OFFLINE";
  return "ONLINE";
}

function ProductCard({ item }: { item: SearchItem }) {
  const imageUrl = item.image_urls
    ?.split(",")
    .map((url) => url.trim())
    .find(Boolean);
  const content = (
    <>
      <div className="shop-product-visual">
        <div className="shop-object-placeholder" aria-hidden="true">
          <span>NX / {String(item.id).padStart(4, "0")}</span>
        </div>
        {imageUrl && (
          <img
            src={imageUrl}
            alt={item.name}
            loading="lazy"
            onError={(event) => {
              event.currentTarget.hidden = true;
            }}
          />
        )}
        <span className={`shop-status status-${item.status.toLowerCase()}`}>
          {formatStatus(item.status)}
        </span>
        {item.is_seckill && <span className="shop-sale-tag">FLASH SALE</span>}
      </div>
      <div className="shop-product-info">
        <p className="shop-product-brand">{item.brand || "NEXORA OBJECT"}</p>
        <h3>{item.name}</h3>
        <div className="shop-product-meta">
          <span>{item.category}</span>
          <span>{item.stock > 0 ? `${item.stock} IN STOCK` : "NO STOCK"}</span>
        </div>
        <div className="shop-product-bottom">
          <strong>{money.format(item.price)}</strong>
          <span className="shop-view-link">
            {item.status === "OFFLINE" ? "UNAVAILABLE" : "VIEW OBJECT"}
            {item.status !== "OFFLINE" && <span aria-hidden="true">↗</span>}
          </span>
        </div>
      </div>
    </>
  );

  if (item.status === "OFFLINE") {
    return <article className="shop-product-card is-offline">{content}</article>;
  }

  return (
    <Link className="shop-product-card" to={`/products/${item.id}`}>
      {content}
    </Link>
  );
}

function Pagination({
  page,
  pageCount,
  onChange,
}: {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
}) {
  if (pageCount <= 1) return null;

  const first = Math.max(1, page - 2);
  const last = Math.min(pageCount, page + 2);
  const pages = Array.from({ length: last - first + 1 }, (_, index) => first + index);

  return (
    <nav className="shop-pagination" aria-label="Product pages">
      <button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        ← PREVIOUS
      </button>
      {first > 1 && <span className="pagination-ellipsis">…</span>}
      {pages.map((number) => (
        <button
          key={number}
          type="button"
          aria-current={number === page ? "page" : undefined}
          className={number === page ? "current" : ""}
          onClick={() => onChange(number)}
        >
          {String(number).padStart(2, "0")}
        </button>
      ))}
      {last < pageCount && <span className="pagination-ellipsis">…</span>}
      <button type="button" disabled={page >= pageCount} onClick={() => onChange(page + 1)}>
        NEXT →
      </button>
    </nav>
  );
}

export function ShopPage() {
  const [searchText, setSearchText] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [suggestionsBusy, setSuggestionsBusy] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    name: "",
    categories: [],
    brands: [],
    page: 1,
  });
  const [result, setResult] = useState<ItemSearchResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  const [listMode, setListMode] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    searchItems({ ...filters, size: PAGE_SIZE }, controller.signal)
      .then(setResult)
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setError(normalizeApiError(cause).message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [filters, retryCount]);

  useEffect(() => {
    const prefix = searchText.trim();
    if (!prefix) {
      setSuggestions([]);
      setSuggestionsBusy(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setSuggestionsBusy(true);
      suggestItems(prefix, controller.signal)
        .then((items) => {
          if (!controller.signal.aborted) setSuggestions(items);
        })
        .catch(() => {
          // Suggestions are optional; a failed request should not block direct search.
          if (!controller.signal.aborted) setSuggestions([]);
        })
        .finally(() => {
          if (!controller.signal.aborted) setSuggestionsBusy(false);
        });
    }, 220);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [searchText]);

  const pageCount = useMemo(
    () => Math.max(1, Math.ceil((result?.total ?? 0) / PAGE_SIZE)),
    [result?.total],
  );
  const categories = useMemo(
    () => [...new Set([...(result?.categories ?? []), ...filters.categories])],
    [result?.categories, filters.categories],
  );
  const brands = useMemo(
    () => [...new Set([...(result?.brands ?? []), ...filters.brands])],
    [result?.brands, filters.brands],
  );

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSuggestionsOpen(false);
    setSuggestions([]);
    setFilters((current) => ({ ...current, name: searchText.trim(), page: 1 }));
  }

  function chooseSuggestion(suggestion: string) {
    setSearchText(suggestion);
    setSuggestionsOpen(false);
    setSuggestions([]);
    const matchedCategory = result?.categories.find(
      (category) => category.toLocaleLowerCase() === suggestion.toLocaleLowerCase(),
    );
    const matchedBrand = result?.brands.find(
      (brand) => brand.toLocaleLowerCase() === suggestion.toLocaleLowerCase(),
    );

    if (matchedCategory) {
      setFilters((current) => ({
        ...current,
        name: "",
        categories: current.categories.includes(matchedCategory)
          ? current.categories
          : [...current.categories, matchedCategory],
        page: 1,
      }));
    } else if (matchedBrand) {
      setFilters((current) => ({
        ...current,
        name: "",
        brands: current.brands.includes(matchedBrand)
          ? current.brands
          : [...current.brands, matchedBrand],
        page: 1,
      }));
    } else {
      setFilters((current) => ({ ...current, name: suggestion, page: 1 }));
    }
  }

  function toggleCategory(category: string) {
    setFilters((current) => ({
      ...current,
      page: 1,
      categories: current.categories.includes(category)
        ? current.categories.filter((value) => value !== category)
        : [...current.categories, category],
    }));
  }

  function toggleBrand(brand: string) {
    setFilters((current) => ({
      ...current,
      page: 1,
      brands: current.brands.includes(brand)
        ? current.brands.filter((value) => value !== brand)
        : [...current.brands, brand],
    }));
  }

  function resetFilters() {
    setSearchText("");
    setSuggestions([]);
    setSuggestionsOpen(false);
    setFilters({ name: "", categories: [], brands: [], page: 1 });
  }

  return (
    <main className="shop-page">
      <div className="shop-frame">
        <form className="shop-search" role="search" onSubmit={submitSearch}>
          <span className="shop-search-icon" aria-hidden="true">
            ⌕
          </span>
          <input
            type="search"
            value={searchText}
            placeholder="Search product names..."
            aria-label="Search product names"
            aria-autocomplete="list"
            aria-expanded={suggestionsOpen && suggestions.length > 0}
            onFocus={() => setSuggestionsOpen(true)}
            onBlur={() => window.setTimeout(() => setSuggestionsOpen(false), 120)}
            onChange={(event) => {
              setSearchText(event.target.value);
              setSuggestionsOpen(true);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") setSuggestionsOpen(false);
            }}
          />
          <button type="submit" aria-label="Submit search">
            →
          </button>
          {suggestionsOpen && (suggestions.length > 0 || suggestionsBusy) && (
            <div className="shop-suggestions" role="listbox" aria-label="Search suggestions">
              {suggestionsBusy && <span className="suggestion-loading">SEARCHING…</span>}
              {suggestions.map((suggestion) => (
                <button
                  type="button"
                  role="option"
                  key={suggestion}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => chooseSuggestion(suggestion)}
                >
                  <span aria-hidden="true">⌕</span>
                  {suggestion}
                  <span className="suggestion-arrow" aria-hidden="true">
                    ↗
                  </span>
                </button>
              ))}
            </div>
          )}
        </form>

        <div className="shop-layout">
          <aside className="shop-filters" aria-label="Filter products">
            <details className="shop-filter-section" open>
              <summary>
                CATEGORIES <span>⌄</span>
              </summary>
              <div className="shop-filter-list">
                <button
                  type="button"
                  className={filters.categories.length === 0 ? "selected" : ""}
                  aria-pressed={filters.categories.length === 0}
                  onClick={() => setFilters((current) => ({ ...current, categories: [], page: 1 }))}
                >
                  <span className="filter-marker">✦</span>
                  <span>All Products</span>
                </button>
                {categories.map((category) => (
                  <button
                    type="button"
                    key={category}
                    className={filters.categories.includes(category) ? "selected" : ""}
                    aria-pressed={filters.categories.includes(category)}
                    onClick={() => toggleCategory(category)}
                  >
                    <span className="filter-marker">◇</span>
                    <span>{category}</span>
                    <span className="filter-check">
                      {filters.categories.includes(category) ? "✓" : ""}
                    </span>
                  </button>
                ))}
                {categories.length === 0 && !loading && (
                  <p className="filter-empty">No categories in this result.</p>
                )}
              </div>
            </details>

            <details className="shop-filter-section" open>
              <summary>
                BRANDS <span>⌄</span>
              </summary>
              <div className="shop-filter-list brand-filter-list">
                {brands.map((brand) => (
                  <label key={brand} className="shop-brand-filter">
                    <input
                      type="checkbox"
                      checked={filters.brands.includes(brand)}
                      onChange={() => toggleBrand(brand)}
                    />
                    <span>{brand}</span>
                  </label>
                ))}
                {brands.length === 0 && !loading && (
                  <p className="filter-empty">No brands in this result.</p>
                )}
              </div>
            </details>

            {(filters.categories.length > 0 || filters.brands.length > 0 || filters.name) && (
              <button className="shop-clear-filters" type="button" onClick={resetFilters}>
                CLEAR ALL FILTERS <span>↗</span>
              </button>
            )}
          </aside>

          <section className="shop-main" aria-label="Products">
            <section className="shop-hero">
              <div className="shop-hero-copy">
                <p className="shop-eyebrow">NEXORA / NIGHT CITY MARKET</p>
                <h1>Discover the extraordinary.</h1>
                <p>Objects for a world that never stands still.</p>
                <button
                  type="button"
                  onClick={() =>
                    document.getElementById("shop-results")?.scrollIntoView({ behavior: "smooth" })
                  }
                >
                  EXPLORE THE COLLECTION <span>→</span>
                </button>
              </div>
              <div className="shop-hero-mark" aria-hidden="true">
                <span>NX</span>
                <i />
              </div>
              <span className="shop-hero-index">01 — CITY SELECTS</span>
            </section>

            <div className="shop-results-bar" id="shop-results">
              <div>
                <p className="shop-eyebrow">SEARCH / EXPLORE</p>
                <h2>
                  {filters.name
                    ? `Results for “${filters.name}”`
                    : filters.categories.length || filters.brands.length
                      ? [...filters.categories, ...filters.brands].join(" / ")
                      : "All Products"}
                  {result && <span> / {result.total.toLocaleString("en-US")}</span>}
                </h2>
                <p className="shop-result-page">
                  {result && result.total > 0
                    ? `PAGE ${String(result.page).padStart(2, "0")} OF ${String(pageCount).padStart(2, "0")}`
                    : "LIVE FROM THE NIGHT CITY"}
                </p>
              </div>
              <div className="shop-view-tools" aria-label="Product layout">
                <button
                  type="button"
                  className={!listMode ? "active" : ""}
                  aria-label="Grid view"
                  aria-pressed={!listMode}
                  onClick={() => setListMode(false)}
                >
                  ▦
                </button>
                <button
                  type="button"
                  className={listMode ? "active" : ""}
                  aria-label="List view"
                  aria-pressed={listMode}
                  onClick={() => setListMode(true)}
                >
                  ☷
                </button>
              </div>
            </div>

            {loading ? (
              <LoadingState label="TUNING INTO THE CITY…" />
            ) : error ? (
              <ErrorState message={error} onRetry={() => setRetryCount((count) => count + 1)} />
            ) : result && result.items.length > 0 ? (
              <>
                <div className={`shop-product-grid ${listMode ? "list-mode" : ""}`}>
                  {result.items.map((item) => (
                    <ProductCard key={item.id} item={item} />
                  ))}
                </div>
                <Pagination
                  page={filters.page}
                  pageCount={pageCount}
                  onChange={(page) => setFilters((current) => ({ ...current, page }))}
                />
              </>
            ) : (
              <EmptyState
                title="No signal found"
                message="Try another keyword or clear a filter."
                action={
                  <button className="outline-button" type="button" onClick={resetFilters}>
                    RESET SEARCH
                  </button>
                }
              />
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
