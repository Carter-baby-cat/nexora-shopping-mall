import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { normalizeApiError } from "../../api/types";
import { useAuthStore } from "../auth/authStore";
import { createRechargeUuid, getAccountBalance, rechargeAccount } from "./accountApi";
import "./account.css";

const money = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const quickAmounts = [50, 100, 200, 500];

type PendingRecharge = { account: number; uuid: string };

function rechargeStorageKey(username: string | null) {
  return username ? `nexora:pending-recharge:${encodeURIComponent(username)}` : null;
}

function readPendingRecharge(key: string | null): PendingRecharge | null {
  if (!key) return null;
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) || "null");
    if (
      typeof value === "object" &&
      value !== null &&
      "account" in value &&
      "uuid" in value &&
      typeof value.account === "number" &&
      Number.isFinite(value.account) &&
      Number(value.account) >= 0.01 &&
      typeof value.uuid === "string" &&
      value.uuid.length > 0
    ) {
      return { account: Number(value.account), uuid: value.uuid };
    }
  } catch {
    // A malformed or unavailable local entry must not block account access.
  }
  return null;
}

function clearPendingRecharge(key: string | null) {
  if (!key) return;
  try {
    localStorage.removeItem(key);
  } catch {
    // The in-memory state is still cleared when browser storage is unavailable.
  }
}

export function AccountPage() {
  const role = useAuthStore((state) => state.role);
  const username = useAuthStore((state) => state.username);
  const isBuyer = role === "ROLE_USER";
  const pendingRechargeKey = rechargeStorageKey(username);
  const [pendingRecharge, setPendingRecharge] = useState<PendingRecharge | null>(() =>
    readPendingRecharge(pendingRechargeKey),
  );
  const [balance, setBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [balanceError, setBalanceError] = useState("");
  const [amount, setAmount] = useState(() => {
    const pending = readPendingRecharge(pendingRechargeKey);
    return pending ? pending.account.toFixed(2) : "";
  });
  const [amountError, setAmountError] = useState("");
  const [formMessage, setFormMessage] = useState<{
    text: string;
    kind: "success" | "error";
  } | null>(() =>
    readPendingRecharge(pendingRechargeKey)
      ? {
          text: "A previous recharge is awaiting confirmation. Retry the same amount to safely resolve it.",
          kind: "error",
        }
      : null,
  );
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const loadBalance = useCallback(async (signal?: AbortSignal) => {
    setBalanceLoading(true);
    setBalanceError("");
    try {
      const data = await getAccountBalance(signal);
      if (!Number.isFinite(data.balance)) throw new Error("The balance response was invalid.");
      setBalance(data.balance);
      return true;
    } catch (cause: unknown) {
      if (signal?.aborted) return false;
      setBalanceError(normalizeApiError(cause).message);
      return false;
    } finally {
      if (!signal?.aborted) setBalanceLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadBalance(controller.signal);
    return () => controller.abort();
  }, [loadBalance]);

  function updateAmount(value: string) {
    if (pendingRecharge) return;
    setAmount(value);
    setAmountError("");
    setFormMessage(null);
  }

  function validateAmount() {
    const parsed = Number(amount);
    const hasAtMostTwoDecimals = /^\d+(?:\.\d{1,2})?$/.test(amount.trim());
    if (!amount.trim() || !Number.isFinite(parsed) || parsed < 0.01 || !hasAtMostTwoDecimals) {
      setAmountError("Enter a valid amount of at least $0.01, with up to two decimal places.");
      return null;
    }
    return Math.round(parsed * 100) / 100;
  }

  async function handleRecharge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isBuyer || submittingRef.current) return;

    const account = validateAmount();
    if (account === null) return;

    if (
      pendingRecharge &&
      Math.round(pendingRecharge.account * 100) !== Math.round(account * 100)
    ) {
      setFormMessage({
        text: "Resolve the pending recharge before starting another amount.",
        kind: "error",
      });
      return;
    }

    submittingRef.current = true;
    const attempt = pendingRecharge ?? { account, uuid: createRechargeUuid() };
    setPendingRecharge(attempt);
    if (pendingRechargeKey) {
      try {
        localStorage.setItem(pendingRechargeKey, JSON.stringify(attempt));
      } catch {
        // The in-memory attempt still protects retries for the current page session.
      }
    }

    setSubmitting(true);
    setFormMessage(null);
    try {
      await rechargeAccount(attempt);
      clearPendingRecharge(pendingRechargeKey);
      setPendingRecharge(null);
      setAmount("");
      const refreshed = await loadBalance();
      setFormMessage({
        text: refreshed
          ? "Funds added. Your balance is up to date."
          : "Funds added. Refresh the balance to see the latest amount.",
        kind: "success",
      });
    } catch (cause: unknown) {
      const error = normalizeApiError(cause);
      const stillProcessing =
        error.status === 409 && /recharge request is still processing/i.test(error.message);
      const definitiveRejection =
        error.status !== undefined && error.status >= 400 && error.status < 500 && !stillProcessing;
      if (definitiveRejection) {
        clearPendingRecharge(pendingRechargeKey);
        setPendingRecharge(null);
      }
      setFormMessage({
        text: stillProcessing
          ? "This recharge is still processing. Retry the same amount in a moment."
          : error.message,
        kind: "error",
      });
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <main className="account-page">
      <div className="account-page-shell">
        <div className="account-route-line">
          <span className="account-route-dot" /> NIGHT TRANSIT <i /> ACCOUNT
          <span className="account-role-tag">{isBuyer ? "BUYER ACCOUNT" : "MERCHANT ACCOUNT"}</span>
        </div>

        <section className="account-content" aria-label="Account balance">
          <div className="account-heading-row">
            <div>
              <p className="account-eyebrow">
                ACCOUNT / {isBuyer ? "BUYER VAULT" : "MERCHANT VAULT"}
              </p>
              <h1>
                Account <span>Balance</span>
              </h1>
            </div>
            <button
              className="account-refresh-button"
              type="button"
              onClick={() => void loadBalance()}
              disabled={balanceLoading || submitting}
              aria-label="Refresh balance"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M20 7v5h-5M4 17v-5h5M5.6 9a7 7 0 0 1 11.8-2L20 12M4 12l2.6 5a7 7 0 0 0 11.8-2" />
              </svg>
              {balanceLoading ? "UPDATING" : "REFRESH"}
            </button>
          </div>

          <div className="account-panels">
            <section className={`account-balance-panel ${balanceLoading ? "is-loading" : ""}`}>
              <div className="account-panel-topline">
                <span>AVAILABLE BALANCE</span>
                <span className={`account-live-state ${balanceError ? "is-error" : ""}`}>
                  <i /> {balanceError ? "UNAVAILABLE" : balanceLoading ? "SYNCING" : "CURRENT"}
                </span>
              </div>
              <div className="account-balance-content" aria-live="polite" aria-atomic="true">
                <div className="account-balance-amount">
                  <span>$</span>
                  <output>{balance === null ? "— — —" : money.format(balance)}</output>
                </div>
                <div className="account-balance-baseline">
                  <span /> USD / NEXORA ACCOUNT
                </div>
              </div>
              {balanceLoading && (
                <div className="account-loading-overlay" role="status" aria-label="Loading balance">
                  <span />
                </div>
              )}
              {balanceError && (
                <div className="account-balance-error" role="alert">
                  <span>{balanceError}</span>
                  <button
                    type="button"
                    onClick={() => void loadBalance()}
                    disabled={balanceLoading}
                  >
                    RETRY ↗
                  </button>
                </div>
              )}
              <span className="account-panel-corner top" aria-hidden="true" />
              <span className="account-panel-corner bottom" aria-hidden="true" />
            </section>

            {isBuyer && (
              <section className="account-recharge-panel" aria-labelledby="recharge-title">
                <div className="account-recharge-heading">
                  <span className="account-section-mark" aria-hidden="true">
                    <i />
                  </span>
                  <h2 id="recharge-title">Add funds</h2>
                </div>
                <form onSubmit={(event) => void handleRecharge(event)} noValidate>
                  <label className="account-field-label" htmlFor="recharge-amount">
                    <span>AMOUNT</span>
                    <span>USD</span>
                  </label>
                  <div className={`account-amount-field ${amountError ? "invalid" : ""}`}>
                    <span aria-hidden="true">$</span>
                    <input
                      id="recharge-amount"
                      name="account"
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      placeholder="0.00"
                      value={amount}
                      onChange={(event) => updateAmount(event.target.value)}
                      disabled={submitting || Boolean(pendingRecharge)}
                      aria-invalid={Boolean(amountError)}
                      aria-describedby={amountError ? "recharge-amount-error" : undefined}
                    />
                    <span className="account-field-unit">USD</span>
                  </div>
                  {amountError && (
                    <p className="account-amount-error" id="recharge-amount-error" role="alert">
                      {amountError}
                    </p>
                  )}
                  <div className="account-quick-amounts" aria-label="Quick amounts">
                    {quickAmounts.map((value) => (
                      <button
                        key={value}
                        className={Number(amount) === value ? "active" : ""}
                        type="button"
                        disabled={submitting || Boolean(pendingRecharge)}
                        onClick={() => updateAmount(String(value))}
                      >
                        ${value}
                      </button>
                    ))}
                  </div>
                  <button className="account-submit-button" type="submit" disabled={submitting}>
                    <span>
                      {submitting ? "PROCESSING…" : pendingRecharge ? "RETRY SAFELY" : "ADD FUNDS"}
                    </span>
                    <span aria-hidden="true">↗</span>
                  </button>
                  <div
                    className={`account-form-status ${formMessage?.kind ?? ""}`}
                    role="status"
                    aria-live="polite"
                  >
                    {formMessage?.text ?? ""}
                  </div>
                </form>
                <span className="account-panel-corner top" aria-hidden="true" />
                <span className="account-panel-corner bottom" aria-hidden="true" />
              </section>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
