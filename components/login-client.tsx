"use client";

import type { FormEvent } from "react";
import { useState } from "react";

export function LoginClient() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email })
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok || result.error) {
        throw new Error(result.error ?? "Login failed.");
      }
      window.location.href = "/dashboard";
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Login failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page auth-page">
      <section className="panel auth-panel">
        <div className="panel-title">
          <h1>登录</h1>
          <span className="status active">Database user</span>
        </div>
        <p className="metric-label">
          使用邮箱创建或进入应用账户。CAW 钱包绑定、Pact 和账单会保存到这个账户下。
        </p>
        <form className="auth-form" onSubmit={submit}>
          <label className="stack">
            <span className="metric-label">邮箱</span>
            <input
              type="email"
              value={email}
              autoComplete="email"
              placeholder="you@example.com"
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <button disabled={busy}>{busy ? "登录中..." : "登录 / 创建账户"}</button>
        </form>
        {error ? <p className="error">{error}</p> : null}
      </section>
    </main>
  );
}
