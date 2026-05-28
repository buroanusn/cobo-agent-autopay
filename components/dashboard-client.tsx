"use client";

import { useEffect, useState } from "react";
import type { DashboardSnapshot } from "@/lib/domain/types";
import { formatUsdc } from "@/lib/domain/money";

type ApiResult = {
  snapshot?: DashboardSnapshot;
  error?: string;
  status?: string;
  reason?: string;
};

export function DashboardClient({
  initialSnapshot
}: {
  initialSnapshot: DashboardSnapshot;
}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [busyAction, setBusyAction] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [prompt, setPrompt] = useState(
    "Analyze the user's portfolio and continue the agent task."
  );

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    const response = await fetch("/api/credits/balance", { cache: "no-store" });
    const nextSnapshot = (await response.json()) as DashboardSnapshot;
    setSnapshot(nextSnapshot);
  }

  async function callAction(action: string, path: string, body: Record<string, unknown> = {}) {
    setBusyAction(action);
    setMessage(undefined);
    setError(undefined);

    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      const result = (await response.json()) as ApiResult;

      if (!response.ok || result.error) {
        throw new Error(result.error ?? "Request failed.");
      }

      if (result.snapshot) {
        setSnapshot(result.snapshot);
      }

      setMessage(statusMessage(action, result));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Request failed.");
    } finally {
      setBusyAction(undefined);
    }
  }

  const authorization = snapshot.authorization;
  const account = snapshot.account;
  const walletConnected = Boolean(snapshot.user.cawWalletAddress);
  const authActive = authorization?.status === "active";

  return (
    <main className="page">
      <header className="topbar">
        <div>
          <h1 className="title">Agent Credits Wallet</h1>
          <p className="subtitle">
            CAW controls Base USDC spending, the backend enforces product limits, and
            the agent consumes internal credits without pausing for every small payment.
          </p>
        </div>
        <span className="pill">
          {snapshot.network.name} · {snapshot.pricing.creditsPerUsdc} credits / USDC
        </span>
      </header>

      <section className="grid">
        <div className="panel span-8">
          <div className="panel-title">
            <h2>Credits</h2>
            <span className={`status ${account.balanceCredits < account.lowBalanceThresholdCredits ? "blocked" : "active"}`}>
              {account.balanceCredits < account.lowBalanceThresholdCredits
                ? "Below threshold"
                : "Ready"}
            </span>
          </div>
          <div className="metric">{account.balanceCredits.toLocaleString()}</div>
          <div className="metric-label">
            Low balance threshold: {account.lowBalanceThresholdCredits.toLocaleString()} credits ·
            Auto top-up: {account.autoTopupCredits.toLocaleString()} credits
          </div>

          <div className="actions">
            <button
              onClick={() =>
                callAction("run", "/api/agent/run", {
                  prompt,
                  taskName: "wallet-aware-agent"
                })
              }
              disabled={busyAction === "run"}
            >
              Run Agent
            </button>
            <button
              className="secondary"
              onClick={() => callAction("topup", "/api/credits/topup/auto")}
              disabled={busyAction === "topup"}
            >
              Auto Top Up
            </button>
          </div>

          <label className="stack" style={{ marginTop: 14 }}>
            <span className="metric-label">Agent prompt</span>
            <input
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              style={{
                width: "100%",
                minHeight: 42,
                border: "1px solid var(--line)",
                borderRadius: 7,
                padding: "0 12px"
              }}
            />
          </label>
        </div>

        <div className="panel span-4">
          <div className="panel-title">
            <h2>CAW Authorization</h2>
            <span className={`status ${authorization?.status ?? "blocked"}`}>
              {authorization?.status ?? "not connected"}
            </span>
          </div>
          <div className="stack">
            <div className="row">
              <span>Wallet</span>
              <span className="value">{snapshot.user.cawWalletAddress ?? "Not connected"}</span>
            </div>
            <div className="row">
              <span>Pact</span>
              <span className="value">{authorization?.pactId ?? "Not created"}</span>
            </div>
            <div className="row">
              <span>Single limit</span>
              <span className="value">
                {authorization ? `${formatUsdc(authorization.singleLimitUsdcMinor)} USDC` : "-"}
              </span>
            </div>
            <div className="row">
              <span>Daily spent</span>
              <span className="value">
                {authorization
                  ? `${formatUsdc(authorization.spentTodayUsdcMinor)} / ${formatUsdc(
                      authorization.dailyLimitUsdcMinor
                    )} USDC`
                  : "-"}
              </span>
            </div>
          </div>
          <div className="actions">
            <button
              className="secondary"
              onClick={() => callAction("connect", "/api/wallet/caw/connect")}
              disabled={busyAction === "connect" || walletConnected}
            >
              Connect CAW
            </button>
            <button
              onClick={() => callAction("authorize", "/api/wallet/caw/authorization")}
              disabled={busyAction === "authorize" || authActive}
            >
              Enable Pact
            </button>
          </div>
        </div>

        {(message || error) && (
          <div className={`notice span-12 ${error ? "error" : ""}`}>{error ?? message}</div>
        )}

        <div className="panel span-6">
          <div className="panel-title">
            <h2>Top-Up Orders</h2>
          </div>
          <ul className="event-list">
            {snapshot.topupOrders.length === 0 ? (
              <li className="event">
                <strong>No top-ups yet</strong>
                <span>Run the agent below the threshold after enabling CAW.</span>
              </li>
            ) : (
              snapshot.topupOrders.map((order) => (
                <li className="event" key={order.id}>
                  <strong>
                    {order.status} · {formatUsdc(order.amountUsdcMinor)} USDC
                  </strong>
                  <span>
                    {order.credits.toLocaleString()} credits · {order.reason} · {order.orderId}
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="panel span-6">
          <div className="panel-title">
            <h2>Ledger</h2>
          </div>
          <ul className="event-list">
            {snapshot.ledgerEntries.map((entry) => (
              <li className="event" key={entry.id}>
                <strong>
                  {entry.type} · {entry.creditsDelta > 0 ? "+" : ""}
                  {entry.creditsDelta.toLocaleString()} credits
                </strong>
                <span>
                  Balance after: {entry.balanceAfterCredits.toLocaleString()} ·{" "}
                  {new Date(entry.createdAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}

function statusMessage(action: string, result: ApiResult) {
  if (action === "run") {
    return "Agent run finished. If credits crossed the threshold, auto top-up was attempted.";
  }

  if (action === "topup") {
    return result.reason ? `Top-up ${result.status}: ${result.reason}` : `Top-up ${result.status}.`;
  }

  if (action === "connect") {
    return "CAW wallet connected.";
  }

  if (action === "authorize") {
    return "CAW Pact authorization is active in mock mode.";
  }

  return "Done.";
}
