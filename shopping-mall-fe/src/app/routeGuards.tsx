import { useEffect } from "react";
import { Link, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore, type UserRole } from "../features/auth/authStore";

type AuthLocationState = {
  from: { pathname: string; search: string; state: unknown };
};

export function RootRoute() {
  const { isAuthenticated, role } = useAuthStore();
  if (isAuthenticated && role === "ROLE_USER") return <Navigate to="/shop" replace />;
  if (isAuthenticated && role === "ROLE_MERCHANT")
    return <Navigate to="/merchant/products" replace />;
  return <Outlet />;
}

export function RoleGate({ roles }: { roles: UserRole[] }) {
  const { isAuthenticated, role } = useAuthStore();
  const location = useLocation();
  if (!isAuthenticated || !role) {
    const expectedRole = roles.length === 1 ? roles[0] : "ROLE_USER";
    const state: AuthLocationState = {
      from: { pathname: location.pathname, search: location.search, state: location.state },
    };
    return <Navigate to={`/login?role=${expectedRole}`} state={state} replace />;
  }
  if (!roles.includes(role)) return <AccessDenied />;
  return <Outlet />;
}

export function AccessDenied() {
  const role = useAuthStore((state) => state.role);
  const destination = role === "ROLE_MERCHANT" ? "/merchant/products" : "/shop";
  return (
    <main className="access-denied">
      <p className="eyebrow">ROUTE RESTRICTED</p>
      <h1>This world is not part of your account.</h1>
      <p>Switch to a matching account to continue.</p>
      <Link className="button-link" to={destination}>
        GO TO YOUR HOME
      </Link>
    </main>
  );
}

export function SessionExpiryListener() {
  const navigate = useNavigate();
  const location = useLocation();
  const role = useAuthStore((state) => state.role);
  useEffect(() => {
    const handleExpiry = () => {
      navigate(`/login?role=${role || "ROLE_USER"}`, {
        replace: true,
        state: {
          from: {
            pathname: location.pathname,
            search: location.search,
            state: location.state,
          },
        },
      });
    };
    window.addEventListener("nexora:auth-expired", handleExpiry);
    return () => window.removeEventListener("nexora:auth-expired", handleExpiry);
  }, [location.pathname, location.search, location.state, navigate, role]);
  return null;
}
