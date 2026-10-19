import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { logout } from "../features/auth/authApi";
import { useAuthStore, type UserRole } from "../features/auth/authStore";

const menuByRole: Record<UserRole, { label: string; to: string }[]> = {
  ROLE_USER: [
    { label: "SHOP", to: "/shop" },
    { label: "CART", to: "/cart" },
    { label: "ORDERS", to: "/orders" },
    { label: "ACCOUNT", to: "/account" },
  ],
  ROLE_MERCHANT: [
    { label: "PRODUCTS", to: "/merchant/products" },
    { label: "ACCOUNT", to: "/account" },
  ],
};

export function MarketplaceLayout() {
  const username = useAuthStore((state) => state.username);
  const role = useAuthStore((state) => state.role) || "ROLE_USER";
  const clearSession = useAuthStore((state) => state.clearSession);
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleLogout() {
    try {
      await logout();
    } catch {
      /* The client session must clear even when logout cannot reach the server. */
    }
    clearSession();
    navigate("/", { replace: true });
  }

  return (
    <div className={`app-frame ${role === "ROLE_MERCHANT" ? "merchant-frame" : "buyer-frame"}`}>
      <header className="app-topbar">
        <Link className="app-brand" to="/">
          NEXORA
        </Link>
        <span className="app-brand-note">
          EXPLORE GOOD THINGS
          <br />
          IN ANOTHER WORLD
        </span>
        <button
          className="mobile-menu-toggle"
          type="button"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? "CLOSE" : "MENU"}
        </button>
        <nav className={`app-nav ${menuOpen ? "is-open" : ""}`} aria-label="Main navigation">
          {menuByRole[role].map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/shop" || item.to === "/merchant/products"}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              {item.label}
            </NavLink>
          ))}
          <span className="nav-user">{username || "ACCOUNT"}</span>
          <button type="button" className="nav-logout" onClick={handleLogout}>
            SIGN OUT
          </button>
        </nav>
      </header>
      <Outlet />
    </div>
  );
}
