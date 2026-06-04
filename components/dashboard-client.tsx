"use client";

import { useEffect, useState } from "react";
import type { DashboardSnapshot, LedgerEntry, TopupOrder, TopupOrderStatus } from "@/lib/domain/types";
import { formatUsdc } from "@/lib/domain/money";

type ApiResult = {
  ok?: boolean;
  snapshot?: DashboardSnapshot;
  error?: string;
  preview?: CawPactPreview;
  status?: string;
  reason?: string;
  note?: string;
  usageEvent?: {
    estimatedCredits: number;
    creditsCharged: number;
    status: string;
  };
  topup?: {
    status: string;
    reason?: string;
    order?: {
      orderId: string;
      status: string;
      reason: string;
    };
  };
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

type CawPactPreview = {
  intent: string;
  originalIntent: string;
  executionPlan: string;
  policies: unknown[];
  completionConditions: unknown[];
  draftedBy: "agent_llm" | "agent_deterministic";
  warnings: string[];
  limits: {
    singleLimitUsdcMinor: number;
    dailyLimitUsdcMinor: number;
    monthlyLimitUsdcMinor: number;
    validDays: number;
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
    title: "Agent 自动小额支付演示",
    subtitle:
      "演示 AI Agent 如何在用户授权范围内，用 CAW 钱包完成小额支付和 x402 付费资源访问。",
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
    generatePactPlan: "生成 Pact 计划",
    submitPact: "提交 Pact",
    refreshPact: "刷新 Pact",
    pactIntent: "授权意图",
    pactSingleLimit: "单笔 USDC",
    pactDailyLimit: "每日 USDC",
    pactMonthlyLimit: "每月 USDC",
    pactValidDays: "有效天数",
    pactPreview: "Pact 预览",
    pactPreviewHint: "先根据用户意图生成 CAW 计划，确认后再提交到 Cobo App 审批。",
    draftedBy: "起草来源",
    warnings: "校验提示",
    originalIntent: "用户原始意图",
    executionPlan: "执行计划",
    policies: "权限策略",
    completionConditions: "结束条件",
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
    orders: "支付记录",
    noTopups: "暂无支付",
    noTopupsHint: "真实支付成功后，会在这里显示金额、状态和链上交易。",
    ledger: "Credits 账本",
    balanceAfter: "余额",
    recentOnly: "仅显示最近 6 条",
    txHash: "交易",
    runOk: "Agent 已运行；如果余额低于阈值，系统会尝试自动充值。",
    runFailed: "Agent 未运行：积分不足。",
    runPending: "已有充值订单待处理，请先确认订单状态。",
    running: "运行中...",
    topupOk: "充值",
    connectOk: "CAW 钱包已连接。",
    authorizeOk: "Pact 已启用。mock 模式会立即激活；真实模式需用户在 App 内审批。",
    pactPreviewOk: "Pact 计划已生成，请确认内容后提交到 Cobo App 审批。",
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
    presentationHint: "演示重点：钱包已配对；还缺真实 Pact 和 Base Sepolia 测试币。",
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
    generatePactPlan: "Generate Pact Plan",
    submitPact: "Submit Pact",
    refreshPact: "Refresh Pact",
    pactIntent: "Authorization intent",
    pactSingleLimit: "Single USDC",
    pactDailyLimit: "Daily USDC",
    pactMonthlyLimit: "Monthly USDC",
    pactValidDays: "Valid days",
    pactPreview: "Pact Preview",
    pactPreviewHint: "Generate a CAW plan from the user's intent first, then submit it for Cobo App approval.",
    draftedBy: "Drafted by",
    warnings: "Validation notes",
    originalIntent: "Original intent",
    executionPlan: "Execution plan",
    policies: "Policies",
    completionConditions: "Completion conditions",
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
    orders: "Payment Records",
    noTopups: "No payments yet",
    noTopupsHint: "Real payments appear here with amount, status, and on-chain tx.",
    ledger: "Credits Ledger",
    balanceAfter: "Balance after",
    recentOnly: "Latest 6 only",
    txHash: "Tx",
    runOk: "Agent run finished. If credits crossed the threshold, auto top-up was attempted.",
    runFailed: "Agent did not run: insufficient credits.",
    runPending: "A top-up order is already pending. Check the order status first.",
    running: "Running...",
    topupOk: "Top-up",
    connectOk: "CAW wallet connected.",
    authorizeOk: "Pact is enabled. Mock mode activates immediately; real mode requires app approval.",
    pactPreviewOk: "Pact plan generated. Review it before submitting for Cobo App approval.",
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
    presentationHint: "Demo focus: wallet is paired; real Pact and Base Sepolia test funds are still missing.",
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
  const [pactPreview, setPactPreview] = useState<CawPactPreview>();
  const [lang, setLang] = useState<Lang>("zh");
  const [prompt, setPrompt] = useState(
    "Analyze the user's portfolio and continue the agent task."
  );
  const [pactIntent, setPactIntent] = useState(
    "允许这个 Agent 在我的站内 credits 余额不足时，使用 Base Sepolia USDC 自动充值；每次最多 5 USDC，每天最多 20 USDC，有效期 7 天。"
  );
  const [singleLimitUsdc, setSingleLimitUsdc] = useState("5");
  const [dailyLimitUsdc, setDailyLimitUsdc] = useState("20");
  const [monthlyLimitUsdc, setMonthlyLimitUsdc] = useState("100");
  const [validDays, setValidDays] = useState("7");

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

      if (action === "pact-preview" && result.preview) {
        setPactPreview(result.preview);
      }

      if (action === "authorize") {
        setPactPreview(undefined);
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
  const missingItems = cawStatus?.missing.map(formatMissingItem) ?? [];
  const realPactReady = Boolean(cawStatus) && !missingItems.includes("真实 CAW Pact 授权");
  const nextStep = getNextStep(missingItems);
  const recentOrders = snapshot.topupOrders.slice(0, 6);
  const recentLedgerEntries = snapshot.ledgerEntries.slice(0, 6);
  const pactBody = buildPactBody({
    intent: pactIntent,
    singleLimitUsdc,
    dailyLimitUsdc,
    monthlyLimitUsdc,
    validDays
  });

  return (
    <main className="page">
      <header className="topbar">
        <div>
          <h1 className="title">{t.title}</h1>
          <p className="subtitle">{t.subtitle}</p>
        </div>
        <div className="top-actions">
          <button className="secondary compact demo-hidden" onClick={() => setLang(lang === "zh" ? "en" : "zh")}>
            {t.language}
          </button>
          <span className="pill">
            {snapshot.network.name} · {snapshot.pricing.creditsPerUsdc} 积分 / USDC
          </span>
        </div>
      </header>

      <section className="grid">
        <div className="panel span-12 guide-panel">
          <div className="panel-title">
            <h2>演示流程总览</h2>
            <span className={`status ${cawStatus?.readyForRealPayment ? "active" : "blocked"}`}>
              {cawStatus?.readyForRealPayment ? "真实支付已就绪" : "真实支付未就绪"}
            </span>
          </div>
          <div className="guide-steps">
            <GuideStep
              index="1"
              title="CAW 钱包配对"
              status={cawStatus?.runtime.walletPaired ? "已完成" : "待完成"}
              active={Boolean(cawStatus?.runtime.walletPaired)}
              description="手机 CAW App 已绑定 Agent 钱包后，后续 Pact 在手机里审批。"
            />
            <GuideStep
              index="2"
              title="测试币准备"
              status="待完成"
              active={false}
              description="还需要 Base Sepolia ETH 付 gas，Base Sepolia USDC 用于支付。"
            />
            <GuideStep
              index="3"
              title="Pact 授权"
              status={missingItems.includes("真实 CAW Pact 授权") ? "待完成" : "已完成"}
              active={!missingItems.includes("真实 CAW Pact 授权")}
              description="Pact 限制 Agent 能调用哪个合约、最多花多少钱、有效多久。"
            />
            <GuideStep
              index="4"
              title="真实链上支付"
              status={cawStatus?.readyForRealPayment ? "可执行" : "等待前置条件"}
              active={Boolean(cawStatus?.readyForRealPayment)}
              description="余额不足时，Agent 通过 CAW 调用合约完成 USDC 充值。"
            />
          </div>
          <div className="next-step">
            <strong>下一步：</strong>
            <span>{nextStep}</span>
          </div>
        </div>

        <div className="panel span-8">
          <div className="panel-title">
            <h2>{t.credits}</h2>
            <span className={`status ${account.balanceCredits < account.lowBalanceThresholdCredits ? "blocked" : "active"}`}>
              {account.balanceCredits < account.lowBalanceThresholdCredits
                ? t.belowThreshold
                : t.ready}
            </span>
          </div>
          <div className="metric">{formatInteger(account.balanceCredits)}</div>
          <div className="metric-label">
            {t.threshold}: {formatInteger(account.lowBalanceThresholdCredits)} 积分 ·
            {t.autoTopup}: {formatInteger(account.autoTopupCredits)} 积分
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
              {busyAction === "run" ? t.running : t.runAgent}
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
          <div className="pact-form demo-hidden">
            <label>
              <span>{t.pactIntent}</span>
              <textarea
                value={pactIntent}
                onChange={(event) => {
                  setPactIntent(event.target.value);
                  setPactPreview(undefined);
                }}
              />
            </label>
            <div className="limits-grid">
              <label>
                <span>{t.pactSingleLimit}</span>
                <input
                  inputMode="decimal"
                  value={singleLimitUsdc}
                  onChange={(event) => {
                    setSingleLimitUsdc(event.target.value);
                    setPactPreview(undefined);
                  }}
                />
              </label>
              <label>
                <span>{t.pactDailyLimit}</span>
                <input
                  inputMode="decimal"
                  value={dailyLimitUsdc}
                  onChange={(event) => {
                    setDailyLimitUsdc(event.target.value);
                    setPactPreview(undefined);
                  }}
                />
              </label>
              <label>
                <span>{t.pactMonthlyLimit}</span>
                <input
                  inputMode="decimal"
                  value={monthlyLimitUsdc}
                  onChange={(event) => {
                    setMonthlyLimitUsdc(event.target.value);
                    setPactPreview(undefined);
                  }}
                />
              </label>
              <label>
                <span>{t.pactValidDays}</span>
                <input
                  inputMode="numeric"
                  value={validDays}
                  onChange={(event) => {
                    setValidDays(event.target.value);
                    setPactPreview(undefined);
                  }}
                />
              </label>
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
              className="demo-hidden"
              onClick={() =>
                callAction("pact-preview", "/api/wallet/caw/authorization", {
                  ...pactBody,
                  previewOnly: true
                })
              }
              disabled={busyAction === "pact-preview"}
            >
              {t.generatePactPlan}
            </button>
            <button
              className="demo-hidden"
              onClick={() => callAction("authorize", "/api/wallet/caw/authorization", pactBody)}
              disabled={busyAction === "authorize" || !pactPreview}
            >
              {t.submitPact}
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

        <div className="panel span-12 demo-hidden">
          <div className="panel-title">
            <h2>{t.pactPreview}</h2>
            <span className={`status ${pactPreview ? "active" : "blocked"}`}>
              {pactPreview ? t.ready : t.notCreated}
            </span>
          </div>
          <p className="metric-label">{t.pactPreviewHint}</p>
          {pactPreview ? (
            <div className="preview-grid">
              <div className="event">
                <strong>Intent</strong>
                <span>{pactPreview.intent}</span>
              </div>
              <div className="event">
                <strong>{t.draftedBy}</strong>
                <span>{pactPreview.draftedBy}</span>
              </div>
              <div className="event">
                <strong>{t.originalIntent}</strong>
                <span>{pactPreview.originalIntent}</span>
              </div>
              <div className="event preview-wide">
                <strong>{t.executionPlan}</strong>
                <pre>{pactPreview.executionPlan}</pre>
              </div>
              <div className="event">
                <strong>{t.policies}</strong>
                <pre>{JSON.stringify(pactPreview.policies, null, 2)}</pre>
              </div>
              <div className="event">
                <strong>{t.completionConditions}</strong>
                <pre>{JSON.stringify(pactPreview.completionConditions, null, 2)}</pre>
              </div>
              {pactPreview.warnings.length > 0 ? (
                <div className="event preview-wide">
                  <strong>{t.warnings}</strong>
                  <pre>{pactPreview.warnings.join("\n")}</pre>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="event">
              <strong>{t.notCreated}</strong>
              <span>{t.pactPreviewHint}</span>
            </div>
          )}
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
            <StatusItem label={t.mode} value={formatMode(cawStatus?.runtime.mode)} />
            <StatusItem
              label="接口配置"
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
              label="Pact 授权"
              value={realPactReady ? "真实 Pact 已就绪" : "缺真实 Pact"}
              active={realPactReady}
            />
          </div>
          <div className="stack" style={{ marginTop: 14 }}>
            <div className="row">
              <span>钱包 ID</span>
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
                {missingItems.length
                  ? missingItems.join("，")
                  : t.noMissing}
              </span>
            </div>
          </div>
          <p className="metric-label">{cawStatus?.runtime.error ?? t.statusHint}</p>
          <p className="metric-label">{t.presentationHint}</p>
        </div>

        <div className="panel span-4 demo-hidden">
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
                  ? formatTime(snapshot.pairingSession.expiresAt)
                  : "-"}
              </span>
            </div>
            <p className="metric-label">
              {t.onboardingHint}
            </p>
          </div>
        </div>

        <div className="panel span-4 demo-hidden">
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

        <div className="panel span-4 demo-hidden">
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
            <span className="status active">HTTP 402 · CAW 模拟</span>
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

        <div className="panel span-6 demo-hidden">
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

        <div className="panel span-6 demo-hidden">
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
                  <span>{order.walletAddress} · {formatDateTime(order.createdAt)}</span>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="panel span-6">
          <div className="panel-title">
            <h2>{t.orders}</h2>
            <span className="status active">{t.recentOnly}</span>
          </div>
          <ul className="event-list">
            {recentOrders.length === 0 ? (
              <li className="event">
                <strong>{t.noTopups}</strong>
                <span>{t.noTopupsHint}</span>
              </li>
            ) : (
              recentOrders.map((order) => (
                <li className="event compact-event" key={order.id}>
                  <div className="event-line">
                    <strong>{paymentRecordTitle(order, lang)}</strong>
                    <span className={`status ${paymentStatusClass(order.status)}`}>
                      {paymentStatusLabel(order.status, lang)}
                    </span>
                  </div>
                  <div className="event-meta">
                    <span>{formatUsdc(order.amountUsdcMinor)} USDC</span>
                    <span>{formatInteger(order.credits)} credits</span>
                    <span>{formatTime(order.creditedAt ?? order.updatedAt)}</span>
                  </div>
                  <span>
                    {order.txHash ? `${t.txHash}: ${shortHash(order.txHash)}` : order.failureReason ?? order.orderId}
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="panel span-6">
          <div className="panel-title">
            <h2>{t.ledger}</h2>
            <span className="status active">{t.recentOnly}</span>
          </div>
          <ul className="event-list">
            {recentLedgerEntries.map((entry) => (
              <li className="event compact-event" key={entry.id}>
                <div className="event-line">
                  <strong>{ledgerEntryTitle(entry.type, lang)}</strong>
                  <span className={entry.creditsDelta >= 0 ? "amount-positive" : "amount-negative"}>
                    {entry.creditsDelta > 0 ? "+" : ""}
                    {formatInteger(entry.creditsDelta)}
                  </span>
                </div>
                <div className="event-meta">
                  <span>{t.balanceAfter}: {formatInteger(entry.balanceAfterCredits)}</span>
                  <span>{formatTime(entry.createdAt)}</span>
                </div>
                {entry.txHash ? <span>{t.txHash}: {shortHash(entry.txHash)}</span> : null}
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

function GuideStep({
  index,
  title,
  status,
  description,
  active
}: {
  index: string;
  title: string;
  status: string;
  description: string;
  active: boolean;
}) {
  return (
    <div className={`guide-step ${active ? "done" : ""}`}>
      <div className="guide-index">{index}</div>
      <div>
        <div className="guide-heading">
          <strong>{title}</strong>
          <span>{status}</span>
        </div>
        <p>{description}</p>
      </div>
    </div>
  );
}

function buildPactBody(input: {
  intent: string;
  singleLimitUsdc: string;
  dailyLimitUsdc: string;
  monthlyLimitUsdc: string;
  validDays: string;
}) {
  return {
    intent: input.intent,
    singleLimitUsdcMinor: parseUsdcInput(input.singleLimitUsdc),
    dailyLimitUsdcMinor: parseUsdcInput(input.dailyLimitUsdc),
    monthlyLimitUsdcMinor: parseUsdcInput(input.monthlyLimitUsdc),
    validDays: parsePositiveInteger(input.validDays)
  };
}

function parseUsdcInput(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }
  return Math.round(parsed * 1_000_000);
}

function parsePositiveInteger(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 1;
  }
  return Math.floor(parsed);
}

function formatMode(mode: CawStatusResult["runtime"]["mode"] | undefined) {
  if (mode === "http") {
    return "真实 CAW";
  }
  if (mode === "mock") {
    return "模拟模式";
  }
  return "-";
}

function formatMissingItem(item: string) {
  const translations: Record<string, string> = {
    "CAW API URL/API key": "CAW 接口配置",
    "CAW wallet id": "CAW 钱包 ID",
    "CAW App pairing": "手机 App 配对",
    "payment contract address": "支付合约地址",
    "treasury address": "收款地址",
    "connected CAW wallet address": "连接 CAW 钱包地址",
    "active Pact authorization": "有效 Pact 授权",
    "connected wallet does not match CAW runtime wallet": "页面连接的钱包和 CAW 钱包不一致",
    "real CAW Pact authorization": "真实 CAW Pact 授权"
  };

  return translations[item] ?? item;
}

function getNextStep(missingItems: string[]) {
  if (missingItems.includes("手机 App 配对")) {
    return "先在手机 CAW App 完成钱包配对。";
  }
  if (missingItems.includes("真实 CAW Pact 授权")) {
    return "先给 CAW 钱包领取 Base Sepolia ETH 和 USDC，然后创建真实 Pact 并在手机 App 里批准。";
  }
  if (missingItems.length > 0) {
    return `还缺：${missingItems.join("，")}。`;
  }
  return "可以开始真实链上支付测试。";
}

function formatInteger(value: number) {
  return new Intl.NumberFormat("zh-CN").format(value);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(new Date(value));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(new Date(value));
}

function paymentRecordTitle(order: TopupOrder, lang: Lang) {
  if (order.reason === "x402_resource") {
    return lang === "zh" ? "x402 付费资源" : "x402 paid resource";
  }
  if (order.reason === "low_balance") {
    return lang === "zh" ? "低余额自动充值" : "Low-balance top-up";
  }
  if (order.reason === "insufficient_balance") {
    return lang === "zh" ? "余额不足补足" : "Insufficient-balance top-up";
  }
  if (order.reason === "manual") {
    return lang === "zh" ? "手动充值" : "Manual top-up";
  }
  return lang === "zh" ? "CAW 支付" : "CAW payment";
}

function paymentStatusLabel(status: TopupOrderStatus, lang: Lang) {
  if (status === "credited") {
    return lang === "zh" ? "成功" : "Succeeded";
  }
  if (status === "failed" || status === "approval_expired") {
    return lang === "zh" ? "失败" : "Failed";
  }
  return lang === "zh" ? "处理中" : "Processing";
}

function paymentStatusClass(status: TopupOrderStatus) {
  if (status === "credited") {
    return "active";
  }
  if (status === "failed" || status === "approval_expired") {
    return "failed";
  }
  return "blocked";
}

function ledgerEntryTitle(type: LedgerEntry["type"], lang: Lang) {
  if (type === "auto_topup") {
    return lang === "zh" ? "充值到账" : "Credits topped up";
  }
  if (type === "agent_usage") {
    return lang === "zh" ? "Agent 消耗" : "Agent usage";
  }
  return lang === "zh" ? "初始赠送" : "Opening grant";
}

function shortHash(value: string) {
  if (value.length <= 18) {
    return value;
  }
  return `${value.slice(0, 10)}...${value.slice(-6)}`;
}

function statusMessage(action: string, result: ApiResult, lang: Lang) {
  const t = copy[lang];
  if (action === "run") {
    if (result.ok === false) {
      if (result.topup?.status === "pending") {
        return `${t.runFailed} ${t.runPending} ${result.topup.order?.orderId ?? ""}`.trim();
      }
      if (result.topup?.status === "blocked") {
        return `${t.runFailed} ${result.topup.reason ?? result.topup.order?.status ?? ""}`.trim();
      }
      return `${t.runFailed} 需要 ${result.usageEvent?.estimatedCredits ?? "-"} credits，实际扣费 ${
        result.usageEvent?.creditsCharged ?? 0
      }。`;
    }
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

  if (action === "pact-preview") {
    return t.pactPreviewOk;
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
