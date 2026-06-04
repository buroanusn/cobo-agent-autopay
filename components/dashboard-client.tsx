"use client";

import { useEffect, useState } from "react";
import type { DashboardSnapshot } from "@/lib/domain/types";
import { formatUsdc } from "@/lib/domain/money";

type ApiResult = {
  snapshot?: DashboardSnapshot;
  error?: string;
  status?: string;
  reason?: string;
  note?: string;
  trace?: Array<{
    step: string;
    status: number;
    recordId?: string;
    note: string;
  }>;
  paymentCredential?: {
    credentialId: string;
    orderId: string;
  };
  resource?: {
    title: string;
    content: string;
  };
};

type CawStatusResult = {
  runtime: {
    mode: "mock" | "http";
    environment: "dev" | "prod" | "unknown";
    apiConfigured: boolean;
    walletConfigured: boolean;
    walletId?: string;
    walletName?: string;
    walletStatus?: string;
    walletAddress?: string;
    walletPaired: boolean;
    pairTokenStatus?: string;
    chainId: string;
    chainName: string;
    faucetTokenId: string;
    paymentContractConfigured: boolean;
    treasuryConfigured: boolean;
    missing: string[];
    error?: string;
  };
  app: {
    connectedWalletAddress?: string;
    authorizationStatus: string;
    pactId?: string;
    activeAuthorization: boolean;
  };
  readyForRealPayment: boolean;
  missing: string[];
};

type Lang = "zh" | "en";

const copy = {
  zh: {
    language: "English",
    title: "CAW 小额免密支付 Demo",
    subtitle:
      "Agent 自动监控 Token 余额；小额充值在 CAW Pact 和用户 Guardrails 范围内自动执行，大额或高风险请求转为人工审批。",
    ready: "余额充足",
    belowThreshold: "低于阈值",
    credits: "Token 余额",
    threshold: "触发阈值",
    autoTopup: "每次自动充值",
    runAgent: "运行 Agent",
    topupNow: "立即充值",
    prompt: "Agent 任务说明",
    authorization: "CAW 授权",
    notConnected: "未连接",
    wallet: "钱包",
    pact: "Pact",
    notCreated: "未创建",
    singleLimit: "单笔上限",
    dailySpent: "今日支出",
    pair: "生成配对码",
    connect: "连接 CAW",
    enablePact: "启用 Pact",
    refreshPact: "刷新 Pact",
    faucet: "领取测试币",
    onboarding: "Onboarding",
    notStarted: "未开始",
    pairingCode: "配对码",
    generateFirst: "先生成",
    expires: "过期时间",
    onboardingHint: "用户在 Cobo Agentic Wallet App 内完成配对、Guardrails 设置和 Pact 审批。",
    guardrails: "用户 Guardrails",
    noReviewLimit: "免审批上限",
    chains: "允许链",
    aiRecommend: "生成 AI 推荐",
    stats: "支付统计",
    spent24h: "24小时支出",
    spent30d: "30天支出",
    tx24h30d: "24h / 30d 笔数",
    autoManual: "自动 / 人工",
    pactManagement: "Pact 管理",
    inactive: "未激活",
    reviewAbove: "超过需审批",
    denyAbove: "超过直接拒绝",
    remainingSpend: "剩余额度",
    daysLeft: "剩余天数",
    enablePactHint: "启用 Pact 后，Agent 才能在限定范围内发起小额自动支付。",
    pendingApprovals: "待审批",
    noPending: "暂无待审批",
    pendingHint: "大额支付会显示在这里；审批动作在 Cobo App 内完成。",
    waitingApproval: "等待审批",
    orders: "充值订单",
    noTopups: "暂无充值",
    noTopupsHint: "启用 CAW 后，当 Agent 消耗到低余额会自动充值。",
    ledger: "账本",
    balanceAfter: "余额",
    runOk: "Agent 已运行；如果余额低于阈值，系统会尝试自动充值。",
    topupOk: "充值",
    connectOk: "CAW 钱包已连接。",
    authorizeOk: "Pact 已启用。mock 模式会立即激活；真实模式需用户在 App 内审批。",
    refreshPactOk: "Pact 状态已刷新。如果用户已在 Cobo App 审批，系统会保存 pact-scoped API key。",
    faucetOk: "测试币请求已提交。真实模式会调用 CAW Faucet；mock 模式只返回模拟结果。",
    pairOk: "配对码已生成。请在 Cobo Agentic Wallet App 内完成绑定。",
    guardrailsOk: "Guardrails 推荐已生成。最终设置需在 Cobo App 内确认。",
    x402Demo: "运行 x402 付费资源",
    x402Panel: "x402 + CAW 演示",
    x402Hint:
      "模拟收费资源先返回 HTTP 402；后端解析付款要求并调用 CAW mock 支付，随后带付款凭证重试并获取资源。",
    x402Ok: "x402 资源已返回，CAW 付款记录已写入订单和账本。",
    x402Credential: "付款凭证",
    x402Resource: "资源",
    x402Trace: "流程记录",
    integrationStatus: "真实 CAW 接入状态",
    environment: "环境",
    mode: "模式",
    configured: "已配置",
    missing: "缺少",
    walletStatus: "钱包状态",
    paired: "已配对",
    notPaired: "未配对",
    appWallet: "应用钱包",
    readyForPayment: "可真实支付",
    notReady: "未就绪",
    noMissing: "关键配置已齐",
    statusHint: "这里只展示脱敏状态，API key 和私钥不会返回到浏览器。",
    done: "完成。"
  },
  en: {
    language: "中文",
    title: "CAW Small Auto-Payment Demo",
    subtitle:
      "The agent monitors token balance and triggers small top-ups under CAW Pact and user Guardrails; larger or risky requests move to manual approval.",
    ready: "Ready",
    belowThreshold: "Below threshold",
    credits: "Token Balance",
    threshold: "Trigger threshold",
    autoTopup: "Auto top-up",
    runAgent: "Run Agent",
    topupNow: "Top Up Now",
    prompt: "Agent task prompt",
    authorization: "CAW Authorization",
    notConnected: "not connected",
    wallet: "Wallet",
    pact: "Pact",
    notCreated: "Not created",
    singleLimit: "Single limit",
    dailySpent: "Daily spent",
    pair: "Generate Pairing Code",
    connect: "Connect CAW",
    enablePact: "Enable Pact",
    refreshPact: "Refresh Pact",
    faucet: "Request Test Tokens",
    onboarding: "Onboarding",
    notStarted: "not started",
    pairingCode: "Pairing code",
    generateFirst: "Generate first",
    expires: "Expires",
    onboardingHint: "The user completes pairing, Guardrails setup, and Pact approval in Cobo Agentic Wallet App.",
    guardrails: "User Guardrails",
    noReviewLimit: "No-review limit",
    chains: "Allowed chains",
    aiRecommend: "Generate AI Recommendation",
    stats: "Payment Stats",
    spent24h: "24h spent",
    spent30d: "30d spent",
    tx24h30d: "24h / 30d tx",
    autoManual: "Auto / manual",
    pactManagement: "Pact Management",
    inactive: "inactive",
    reviewAbove: "Review if above",
    denyAbove: "Deny if above",
    remainingSpend: "Remaining spend",
    daysLeft: "Days left",
    enablePactHint: "Enable Pact before the agent can initiate scoped automatic payments.",
    pendingApprovals: "Pending Approvals",
    noPending: "No pending approvals",
    pendingHint: "Large payments appear here; approval happens in Cobo App.",
    waitingApproval: "waiting approval",
    orders: "Top-Up Orders",
    noTopups: "No top-ups yet",
    noTopupsHint: "After CAW is enabled, low balance will trigger automatic top-up.",
    ledger: "Ledger",
    balanceAfter: "Balance after",
    runOk: "Agent run finished. If credits crossed the threshold, auto top-up was attempted.",
    topupOk: "Top-up",
    connectOk: "CAW wallet connected.",
    authorizeOk: "Pact is enabled. Mock mode activates immediately; real mode requires app approval.",
    refreshPactOk: "Pact status refreshed. If approved in Cobo App, the pact-scoped API key is now stored.",
    faucetOk: "Test token request submitted. Real mode calls CAW Faucet; mock mode returns a simulated result.",
    pairOk: "Pairing code generated. Complete pairing in Cobo Agentic Wallet App.",
    guardrailsOk: "Guardrails recommendation generated. Final settings must be confirmed in Cobo App.",
    x402Demo: "Run x402 Paid Resource",
    x402Panel: "x402 + CAW Demo",
    x402Hint:
      "Simulates a paid resource returning HTTP 402; the backend parses payment requirements, pays through CAW mock, retries with a credential, and receives the resource.",
    x402Ok: "x402 resource returned; CAW payment records were written to orders and ledger.",
    x402Credential: "Payment credential",
    x402Resource: "Resource",
    x402Trace: "Trace",
    integrationStatus: "Real CAW Integration Status",
    environment: "Environment",
    mode: "Mode",
    configured: "Configured",
    missing: "Missing",
    walletStatus: "Wallet status",
    paired: "Paired",
    notPaired: "Not paired",
    appWallet: "App wallet",
    readyForPayment: "Ready for real payment",
    notReady: "Not ready",
    noMissing: "Core configuration is ready",
    statusHint: "Only redacted status is shown here. API keys and private keys never reach the browser.",
    done: "Done."
  }
} as const;

export function DashboardClient({
  initialSnapshot
}: {
  initialSnapshot: DashboardSnapshot;
}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [busyAction, setBusyAction] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [x402Result, setX402Result] = useState<ApiResult>();
  const [cawStatus, setCawStatus] = useState<CawStatusResult>();
  const [lang, setLang] = useState<Lang>("zh");
  const [prompt, setPrompt] = useState(
    "Analyze the user's portfolio and continue the agent task."
  );

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    const [snapshotResponse, cawStatusResponse] = await Promise.all([
      fetch("/api/credits/balance", { cache: "no-store" }),
      fetch("/api/wallet/caw/status", { cache: "no-store" })
    ]);
    const nextSnapshot = (await snapshotResponse.json()) as DashboardSnapshot;
    setSnapshot(nextSnapshot);

    if (cawStatusResponse.ok) {
      setCawStatus((await cawStatusResponse.json()) as CawStatusResult);
    }
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

      if (action === "x402") {
        setX402Result(result);
      }

      setMessage(statusMessage(action, result, lang));
      void refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Request failed.");
    } finally {
      setBusyAction(undefined);
    }
  }

  const authorization = snapshot.authorization;
  const t = copy[lang];
  const account = snapshot.account;
  const guardrails = snapshot.guardrails;
  const stats = snapshot.paymentStats;
  const walletConnected = Boolean(snapshot.user.cawWalletAddress);
  const authActive = authorization?.status === "active";

  return (
    <main className="page">
      <header className="topbar">
        <div>
          <h1 className="title">{t.title}</h1>
          <p className="subtitle">{t.subtitle}</p>
        </div>
        <div className="top-actions">
          <button className="secondary compact" onClick={() => setLang(lang === "zh" ? "en" : "zh")}>
            {t.language}
          </button>
          <span className="pill">
            {snapshot.network.name} · {snapshot.pricing.creditsPerUsdc} credits / USDC
          </span>
        </div>
      </header>

      <section className="grid">
        <div className="panel span-8">
          <div className="panel-title">
            <h2>{t.credits}</h2>
            <span className={`status ${account.balanceCredits < account.lowBalanceThresholdCredits ? "blocked" : "active"}`}>
              {account.balanceCredits < account.lowBalanceThresholdCredits
                ? t.belowThreshold
                : t.ready}
            </span>
          </div>
          <div className="metric">{account.balanceCredits.toLocaleString()}</div>
          <div className="metric-label">
            {t.threshold}: {account.lowBalanceThresholdCredits.toLocaleString()} credits ·
            {t.autoTopup}: {account.autoTopupCredits.toLocaleString()} credits
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
              {t.runAgent}
            </button>
            <button
              className="secondary"
              onClick={() => callAction("topup", "/api/credits/topup/auto")}
              disabled={busyAction === "topup"}
            >
              {t.topupNow}
            </button>
          </div>

          <label className="stack" style={{ marginTop: 14 }}>
            <span className="metric-label">{t.prompt}</span>
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
            <h2>{t.authorization}</h2>
            <span className={`status ${authorization?.status ?? "blocked"}`}>
              {authorization?.status ?? t.notConnected}
            </span>
          </div>
          <div className="stack">
            <div className="row">
              <span>{t.wallet}</span>
              <span className="value">{snapshot.user.cawWalletAddress ?? t.notConnected}</span>
            </div>
            <div className="row">
              <span>{t.pact}</span>
              <span className="value">{authorization?.pactId ?? t.notCreated}</span>
            </div>
            <div className="row">
              <span>{t.singleLimit}</span>
              <span className="value">
                {authorization ? `${formatUsdc(authorization.singleLimitUsdcMinor)} USDC` : "-"}
              </span>
            </div>
            <div className="row">
              <span>{t.dailySpent}</span>
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
              onClick={() => callAction("pair", "/api/wallet/caw/pairing-code")}
              disabled={busyAction === "pair"}
            >
              {t.pair}
            </button>
            <button
              className="secondary"
              onClick={() => callAction("connect", "/api/wallet/caw/connect")}
              disabled={busyAction === "connect" || walletConnected}
            >
              {t.connect}
            </button>
            <button
              className="secondary"
              onClick={() => callAction("faucet", "/api/wallet/caw/faucet")}
              disabled={busyAction === "faucet"}
            >
              {t.faucet}
            </button>
            <button
              onClick={() => callAction("authorize", "/api/wallet/caw/authorization")}
              disabled={busyAction === "authorize" || authActive}
            >
              {t.enablePact}
            </button>
            <button
              className="secondary"
              onClick={() => callAction("refresh-pact", "/api/wallet/caw/authorization/refresh")}
              disabled={busyAction === "refresh-pact" || !authorization}
            >
              {t.refreshPact}
            </button>
          </div>
        </div>

        <div className="panel span-12">
          <div className="panel-title">
            <h2>{t.integrationStatus}</h2>
            <span className={`status ${cawStatus?.readyForRealPayment ? "active" : "blocked"}`}>
              {cawStatus?.readyForRealPayment ? t.readyForPayment : t.notReady}
            </span>
          </div>
          <div className="status-grid">
            <StatusItem label={t.environment} value={cawStatus?.runtime.environment ?? "-"} />
            <StatusItem label={t.mode} value={cawStatus?.runtime.mode ?? "-"} />
            <StatusItem
              label="API"
              value={cawStatus?.runtime.apiConfigured ? t.configured : t.missing}
              active={Boolean(cawStatus?.runtime.apiConfigured)}
            />
            <StatusItem
              label={t.walletStatus}
              value={cawStatus?.runtime.walletStatus ?? "-"}
              active={cawStatus?.runtime.walletStatus === "active" || cawStatus?.runtime.mode === "mock"}
            />
            <StatusItem
              label={t.paired}
              value={cawStatus?.runtime.walletPaired ? t.paired : t.notPaired}
              active={Boolean(cawStatus?.runtime.walletPaired)}
            />
            <StatusItem
              label="Pact"
              value={cawStatus?.app.authorizationStatus ?? "-"}
              active={Boolean(cawStatus?.app.activeAuthorization)}
            />
          </div>
          <div className="stack" style={{ marginTop: 14 }}>
            <div className="row">
              <span>Wallet ID</span>
              <span className="value">{cawStatus?.runtime.walletId ?? "-"}</span>
            </div>
            <div className="row">
              <span>{t.wallet}</span>
              <span className="value">{cawStatus?.runtime.walletAddress ?? "-"}</span>
            </div>
            <div className="row">
              <span>{t.appWallet}</span>
              <span className="value">{cawStatus?.app.connectedWalletAddress ?? "-"}</span>
            </div>
            <div className="row">
              <span>{t.chains}</span>
              <span className="value">
                {cawStatus
                  ? `${cawStatus.runtime.chainName} · ${cawStatus.runtime.chainId}`
                  : "-"}
              </span>
            </div>
            <div className="row">
              <span>{t.missing}</span>
              <span className="value">
                {cawStatus?.missing.length ? cawStatus.missing.join(", ") : t.noMissing}
              </span>
            </div>
          </div>
          <p className="metric-label">{cawStatus?.runtime.error ?? t.statusHint}</p>
        </div>

        <div className="panel span-4">
          <div className="panel-title">
            <h2>{t.onboarding}</h2>
            <span className={`status ${snapshot.pairingSession ? "active" : "blocked"}`}>
              {snapshot.pairingSession ? snapshot.pairingSession.status : t.notStarted}
            </span>
          </div>
          <div className="stack">
            <div className="row">
              <span>{t.pairingCode}</span>
              <span className="value">{snapshot.pairingSession?.code ?? t.generateFirst}</span>
            </div>
            <div className="row">
              <span>{t.expires}</span>
              <span className="value">
                {snapshot.pairingSession
                  ? new Date(snapshot.pairingSession.expiresAt).toLocaleTimeString()
                  : "-"}
              </span>
            </div>
            <p className="metric-label">
              {t.onboardingHint}
            </p>
          </div>
        </div>

        <div className="panel span-4">
          <div className="panel-title">
            <h2>{t.guardrails}</h2>
            <span className="status active">{guardrails.generatedBy}</span>
          </div>
          <div className="stack">
            <div className="row">
              <span>{t.noReviewLimit}</span>
              <span className="value">{formatUsdc(guardrails.reviewThresholdUsdcMinor)} USDC</span>
            </div>
            <div className="row">
              <span>{t.singleLimit}</span>
              <span className="value">{formatUsdc(guardrails.singleLimitUsdcMinor)} USDC</span>
            </div>
            <div className="row">
              <span>{t.dailySpent}</span>
              <span className="value">{formatUsdc(guardrails.dailyLimitUsdcMinor)} USDC</span>
            </div>
            <div className="row">
              <span>{t.chains}</span>
              <span className="value">{guardrails.allowedChains.join(", ")}</span>
            </div>
          </div>
          <div className="actions">
            <button
              className="secondary"
              onClick={() =>
                callAction("guardrails", "/api/guardrails/recommend", {
                  agentCount: 2,
                  dailySpendUsdc: 10,
                  riskProfile: "balanced"
                })
              }
              disabled={busyAction === "guardrails"}
            >
              {t.aiRecommend}
            </button>
          </div>
        </div>

        <div className="panel span-4">
          <div className="panel-title">
            <h2>{t.stats}</h2>
          </div>
          <div className="stack">
            <div className="row">
              <span>{t.spent24h}</span>
              <span className="value">{formatUsdc(stats.spent24hUsdcMinor)} USDC</span>
            </div>
            <div className="row">
              <span>{t.spent30d}</span>
              <span className="value">{formatUsdc(stats.spent30dUsdcMinor)} USDC</span>
            </div>
            <div className="row">
              <span>{t.tx24h30d}</span>
              <span className="value">
                {stats.txCount24h} / {stats.txCount30d}
              </span>
            </div>
            <div className="row">
              <span>{t.autoManual}</span>
              <span className="value">
                {stats.automaticPayments} / {stats.manualApprovalPayments}
              </span>
            </div>
          </div>
        </div>

        {(message || error) && (
          <div className={`notice span-12 ${error ? "error" : ""}`}>{error ?? message}</div>
        )}

        <div className="panel span-12">
          <div className="panel-title">
            <h2>{t.x402Panel}</h2>
            <span className="status active">HTTP 402 · CAW mock</span>
          </div>
          <p className="metric-label">{t.x402Hint}</p>
          <div className="actions">
            <button
              onClick={() => callAction("x402", "/api/x402/resource")}
              disabled={busyAction === "x402"}
            >
              {t.x402Demo}
            </button>
          </div>
          {x402Result && (
            <div className="x402-grid">
              <div className="event">
                <strong>{t.x402Credential}</strong>
                <span>
                  {x402Result.paymentCredential?.credentialId ?? "-"} ·{" "}
                  {x402Result.paymentCredential?.orderId ?? "-"}
                </span>
              </div>
              <div className="event">
                <strong>{t.x402Resource}</strong>
                <span>
                  {x402Result.resource?.title ?? "-"} · {x402Result.resource?.content ?? "-"}
                </span>
              </div>
              <div className="event x402-trace">
                <strong>{t.x402Trace}</strong>
                <span>
                  {x402Result.trace
                    ?.map((step) => `${step.step}(${step.status})${step.recordId ? `:${step.recordId}` : ""}`)
                    .join(" -> ") ?? "-"}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="panel span-6">
          <div className="panel-title">
            <h2>{t.pactManagement}</h2>
            <span className={`status ${authorization?.status ?? "blocked"}`}>
              {authorization?.status ?? t.inactive}
            </span>
          </div>
          {snapshot.pactDetails ? (
            <div className="stack">
              <div className="row">
                <span>{t.reviewAbove}</span>
                <span className="value">
                  {formatUsdc(snapshot.pactDetails.reviewIfAmountUsdcMinor)} USDC
                </span>
              </div>
              <div className="row">
                <span>{t.denyAbove}</span>
                <span className="value">
                  {formatUsdc(snapshot.pactDetails.denyIfAmountUsdcMinor)} USDC
                </span>
              </div>
              <div className="row">
                <span>{t.remainingSpend}</span>
                <span className="value">
                  {formatUsdc(snapshot.pactDetails.remainingUsdcMinor)} USDC
                </span>
              </div>
              <div className="row">
                <span>{t.daysLeft}</span>
                <span className="value">{snapshot.pactDetails.completionTimeElapsedDays}</span>
              </div>
            </div>
          ) : (
            <p className="metric-label">{t.enablePactHint}</p>
          )}
        </div>

        <div className="panel span-6">
          <div className="panel-title">
            <h2>{t.pendingApprovals}</h2>
            <span className={`status ${snapshot.pendingApprovals.length ? "blocked" : "active"}`}>
              {snapshot.pendingApprovals.length}
            </span>
          </div>
          <ul className="event-list">
            {snapshot.pendingApprovals.length === 0 ? (
              <li className="event">
                <strong>{t.noPending}</strong>
                <span>{t.pendingHint}</span>
              </li>
            ) : (
              snapshot.pendingApprovals.map((order) => (
                <li className="event" key={order.id}>
                  <strong>{formatUsdc(order.amountUsdcMinor)} USDC · {t.waitingApproval}</strong>
                  <span>{order.walletAddress} · {new Date(order.createdAt).toLocaleString()}</span>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="panel span-6">
          <div className="panel-title">
            <h2>{t.orders}</h2>
          </div>
          <ul className="event-list">
            {snapshot.topupOrders.length === 0 ? (
              <li className="event">
                <strong>{t.noTopups}</strong>
                <span>{t.noTopupsHint}</span>
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
            <h2>{t.ledger}</h2>
          </div>
          <ul className="event-list">
            {snapshot.ledgerEntries.map((entry) => (
              <li className="event" key={entry.id}>
                <strong>
                  {entry.type} · {entry.creditsDelta > 0 ? "+" : ""}
                  {entry.creditsDelta.toLocaleString()} credits
                </strong>
                <span>
                  {t.balanceAfter}: {entry.balanceAfterCredits.toLocaleString()} ·{" "}
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

function StatusItem({
  label,
  value,
  active
}: {
  label: string;
  value: string;
  active?: boolean;
}) {
  return (
    <div className="status-card">
      <span>{label}</span>
      <strong className={active === undefined ? undefined : active ? "ok" : "bad"}>{value}</strong>
    </div>
  );
}

function statusMessage(action: string, result: ApiResult, lang: Lang) {
  const t = copy[lang];
  if (action === "run") {
    return t.runOk;
  }

  if (action === "topup") {
    return result.reason
      ? `${t.topupOk} ${result.status}: ${result.reason}`
      : `${t.topupOk} ${result.status}.`;
  }

  if (action === "connect") {
    return t.connectOk;
  }

  if (action === "authorize") {
    return t.authorizeOk;
  }

  if (action === "refresh-pact") {
    return t.refreshPactOk;
  }

  if (action === "faucet") {
    return t.faucetOk;
  }

  if (action === "pair") {
    return t.pairOk;
  }

  if (action === "guardrails") {
    return result.note ?? t.guardrailsOk;
  }

  if (action === "x402") {
    return result.resource ? t.x402Ok : result.trace?.at(-1)?.note ?? t.done;
  }

  return t.done;
}
