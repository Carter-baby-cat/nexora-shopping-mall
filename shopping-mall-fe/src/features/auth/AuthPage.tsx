import { type FormEvent, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { normalizeApiError } from "../../api/types";
import { login, register } from "./authApi";
import { useAuthStore, type UserRole } from "./authStore";
import "./auth.css";

type AuthLocationState = {
  from?: { pathname?: string; search?: string; state?: unknown };
  notice?: string;
};

const validRoles: UserRole[] = ["ROLE_USER", "ROLE_MERCHANT"];

function canAccessPath(pathname: string, role: UserRole) {
  if (pathname === "/account") return true;

  if (role === "ROLE_USER") {
    return (
      ["/shop", "/cart", "/checkout", "/orders"].includes(pathname) ||
      pathname === "/seckill-order" ||
      /^\/products\/[^/]+$/.test(pathname) ||
      /^\/orders\/[^/]+$/.test(pathname)
    );
  }

  return (
    pathname === "/merchant/products" ||
    pathname === "/merchant/products/new" ||
    /^\/merchant\/products\/[^/]+\/edit$/.test(pathname)
  );
}

export function AuthPage({ mode }: { mode: "login" | "register" }) {
  const location = useLocation();
  const navigate = useNavigate();
  const locationState = location.state as AuthLocationState | null;
  const requestedRole = new URLSearchParams(location.search).get("role");
  const initialRole: UserRole = validRoles.includes(requestedRole as UserRole)
    ? (requestedRole as UserRole)
    : "ROLE_USER";
  const [role, setRole] = useState<UserRole>(initialRole);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const setSession = useAuthStore((state) => state.setSession);
  const isBuyer = role === "ROLE_USER";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const request = { username: username.trim(), password, authority: role };
    try {
      if (mode === "register") {
        await register(request);
        navigate(`/login?role=${role}`, {
          replace: true,
          state: {
            from: locationState?.from,
            notice: "Account created. Sign in to continue.",
          },
        });
      } else {
        const accessToken = await login(request);
        setSession({ accessToken, username: request.username, role });
        const savedPath = locationState?.from?.pathname;
        const destination =
          savedPath && canAccessPath(savedPath, role)
            ? `${savedPath}${locationState?.from?.search || ""}`
            : isBuyer
              ? "/shop"
              : "/merchant/products";
        navigate(destination, { replace: true, state: locationState?.from?.state });
      }
    } catch (cause) {
      setError(normalizeApiError(cause).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={`auth-page ${isBuyer ? "auth-buyer" : "auth-merchant"}`}>
      <div className="auth-art" />
      <div className="auth-scrim" />
      <header className="auth-header">
        <Link className="auth-logo" to="/">
          NEXORA
        </Link>
        <span>{isBuyer ? "BUYER · EXPLORE" : "MERCHANT CENTER"}</span>
      </header>
      <section className="auth-card" aria-labelledby="auth-title">
        <p className="auth-kicker">{isBuyer ? "ENTER THE NIGHT CITY" : "BUILD YOUR CITY"}</p>
        <h1 id="auth-title">{mode === "login" ? "Welcome back." : "Create your account."}</h1>
        <p className="auth-intro">
          {mode === "login"
            ? "Sign in to continue your journey."
            : "Choose your world and get started."}
        </p>
        <div className="role-switch" role="group" aria-label="Choose account type">
          <button
            type="button"
            className={isBuyer ? "selected" : ""}
            onClick={() => setRole("ROLE_USER")}
          >
            BUYER
          </button>
          <button
            type="button"
            className={!isBuyer ? "selected" : ""}
            onClick={() => setRole("ROLE_MERCHANT")}
          >
            MERCHANT
          </button>
        </div>
        {mode === "login" && locationState?.notice && (
          <p className="auth-success" role="status">
            {locationState.notice}
          </p>
        )}
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            USERNAME
            <input
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
            />
          </label>
          <label>
            PASSWORD
            <input
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}
          <button className="auth-submit" type="submit" disabled={busy}>
            {busy ? "PLEASE WAIT…" : mode === "login" ? "SIGN IN" : "CREATE ACCOUNT"}
            <span>↗</span>
          </button>
        </form>
        <p className="auth-switch">
          {mode === "login" ? "New to NEXORA?" : "Already have an account?"}{" "}
          <Link
            to={`/${mode === "login" ? "register" : "login"}?role=${role}`}
            state={locationState?.from ? { from: locationState.from } : undefined}
          >
            {mode === "login" ? "Create account" : "Sign in"}
          </Link>
        </p>
      </section>
      <Link className="auth-back" to="/">
        ← BACK TO THE HORIZON
      </Link>
    </main>
  );
}
