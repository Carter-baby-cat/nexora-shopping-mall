import { Link, useLocation } from "react-router-dom";

const pageTitles: Record<string, string> = {
  "/shop": "Night City Marketplace",
  "/cart": "Shopping Cart",
  "/checkout": "Order Overview",
  "/orders": "My Orders",
  "/account": "Account Balance",
  "/merchant/products": "Merchant Products",
};

export function PlaceholderPage({ title }: { title?: string }) {
  const location = useLocation();
  return (
    <main className="module-placeholder">
      <p className="eyebrow">NEXORA / MODULE IN PROGRESS</p>
      <h1>{title || pageTitles[location.pathname] || "Order Details"}</h1>
      <p>The shared route, role guard, and page shell are active.</p>
      <Link className="outline-button" to="/">
        BACK TO THE HORIZON
      </Link>
    </main>
  );
}
