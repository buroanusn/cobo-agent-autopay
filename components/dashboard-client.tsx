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
  txHash?: string;
  amountUsdcMinor?: number;
  allowanceUsdcMinor?: number;
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
  spendReadiness?: {
    requiredUsdcMinor: number;
    remainingUsdcMinor: number;
    pactExpiresAt?: string;
    allowanceUsdcMinor?: number;
    walletUsdcMinor?: number;
    gasEth?: string;
    error?: string;
  };
  cawConfigured?: boolean;
  readyForRealPayment: boolean;
  missing: string[];
  configurationMissing?: string[];
  paymentMissing?: string[];
};

type Lang = "zh" | "en";

type CawTxRecord = {
  id: string;
  time: string;
  amount: string;
  token: string;
  chain: string;
  to: string;
  from: string;
  status: string;
  subStatus: string;
  reason: string;
  txHash: string | null;
  description: string;
  requestId: string;
  fee: string | null;
  pactId: string;
};

const copy = {
  zh: {
    language: "English",
    logout: "退出",
    title: "Agent 自动小额支付演示",
    subtitle: "演示 AI Agent 如何在用户授权范围内，用真实 CAW 钱包完成小额支付。",
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
    approveUsdc: "授权 USDC",
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
    authorizeOk: "Pact 已提交。请在 Cobo Agentic Wallet App 内审批，审批后点击刷新 Pact。",
    pactPreviewOk: "Pact 计划已生成，请确认内容后提交到 Cobo App 审批。",
    refreshPactOk: "Pact 状态已刷新。如果用户已在 Cobo App 审批，系统会保存 pact-scoped API key。",
    approveOk: "USDC 授权已提交到真实 CAW。",
    faucetOk: "测试币请求已提交，会调用 CAW Faucet。",
    pairOk: "配对码已生成。请在 Cobo Agentic Wallet App 内完成绑定。",
    guardrailsOk: "Guardrails 推荐已生成。最终设置需在 Cobo App 内确认。",
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
    nextPayment: "下一笔需要",
    pactRemaining: "Pact 剩余额度",
    allowance: "USDC 授权",
    gasBalance: "Gas 余额",
    statusHint: "这里只展示脱敏状态，API key 和私钥不会返回到浏览器。",
    presentationHint: "真实支付就绪需要 CAW 配置、有效 Pact、剩余额度、USDC 授权、USDC 余额和 gas 都满足。",
    done: "完成。"
  },
  en: {
    language: "中文",
    logout: "Logout",
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
    approveUsdc: "Approve USDC",
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
    authorizeOk: "Pact submitted. Approve it in Cobo Agentic Wallet App, then refresh Pact.",
    pactPreviewOk: "Pact plan generated. Review it before submitting for Cobo App approval.",
    refreshPactOk: "Pact status refreshed. If approved in Cobo App, the pact-scoped API key is now stored.",
    approveOk: "USDC approval submitted to real CAW.",
    faucetOk: "Test token request submitted through CAW Faucet.",
    pairOk: "Pairing code generated. Complete pairing in Cobo Agentic Wallet App.",
    guardrailsOk: "Guardrails recommendation generated. Final settings must be confirmed in Cobo App.",
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
    nextPayment: "Next payment needs",
    pactRemaining: "Pact remaining",
    allowance: "USDC allowance",
    gasBalance: "Gas balance",
    statusHint: "Only redacted status is shown here. API keys and private keys never reach the browser.",
    presentationHint: "Real payment requires CAW config, active Pact, remaining spend, allowance, USDC balance, and gas.",
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
  const [cawStatus, setCawStatus] = useState<CawStatusResult>();
  const [pactPreview, setPactPreview] = useState<CawPactPreview>();
  const [lang, setLang] = useState<Lang>("zh");
  const [cawTxRecords, setCawTxRecords] = useState<CawTxRecord[]>([]);
  const [prompt, setPrompt] = useState(
    "Analyze the user's portfolio and continue the agent task."
  );
  const [pactIntent, setPactIntent] = useState(
    "允许这个 Agent 在我的站内 credits 余额不足时，使用 Base Sepolia USDC 自动充值；每次最多 1 USDC，每天最多 5 USDC，有效期 7 天。"
  );
  const [singleLimitUsdc, setSingleLimitUsdc] = useState("1");
  const [dailyLimitUsdc, setDailyLimitUsdc] = useState("5");
  const [monthlyLimitUsdc, setMonthlyLimitUsdc] = useState("20");
  const [validDays, setValidDays] = useState("7");

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    const [snapshotResponse, cawStatusResponse, cawTxResponse] = await Promise.all([
      fetch("/api/credits/balance", { cache: "no-store" }),
      fetch("/api/wallet/caw/status", { cache: "no-store" }),
      fetch("/api/wallet/caw/transactions", { cache: "no-store" })
    ]);
    if (snapshotResponse.status === 401 || cawStatusResponse.status === 401) {
      window.location.href = "/login";
      return;
    }
    if (!snapshotResponse.ok) {
      const result = (await snapshotResponse.json()) as { error?: string };
      setError(result.error ?? "Unable to refresh dashboard.");
      return;
    }
    const nextSnapshot = (await snapshotResponse.json()) as DashboardSnapshot;
    setSnapshot(nextSnapshot);

    if (cawStatusResponse.ok) {
      setCawStatus((await cawStatusResponse.json()) as CawStatusResult);
    }

    if (cawTxResponse.ok) {
      const cawData = (await cawTxResponse.json()) as { records?: CawTxRecord[] };
      setCawTxRecords(cawData.records ?? []);
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

      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (!response.ok || result.error) {
        throw new Error(result.error ?? "Request failed.");
      }

      if (result.snapshot) {
        setSnapshot(result.snapshot);
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

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const authorization = snapshot.authorization;
  const t = copy[lang];
  const account = snapshot.account;
  const guardrails = snapshot.guardrails;
  const stats = snapshot.paymentStats;
  const walletConnected = Boolean(snapshot.user.cawWalletAddress);
  const walletPaired = Boolean(cawStatus?.runtime.walletPaired);
  const missingItems = cawStatus?.missing.map(formatMissingItem) ?? [];
  const realPactReady = Boolean(cawStatus) && !missingItems.includes("真实 CAW Pact 授权") && !missingItems.includes("有效 Pact 授权");
  const canApproveUsdc = realPactReady && !missingItems.includes("Pact 剩余额度不足");
  const nextStep = getNextStep(missingItems);
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
          <span className="pill">{snapshot.user.email}</span>
          <button className="secondary compact demo-hidden" onClick={() => setLang(lang === "zh" ? "en" : "zh")}>
            {t.language}
          </button>
          <button className="secondary compact" onClick={logout}>
            {t.logout}
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
              status={missingItems.includes("有效 Pact 授权") || missingItems.includes("真实 CAW Pact 授权") ? "待完成" : "已完成"}
              active={!missingItems.includes("真实 CAW Pact 授权") && !missingItems.includes("有效 Pact 授权")}
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

        <div className="panel span-12">
          <div className="panel-title">
            <h2>{walletPaired ? "CAW 钱包已配对" : "CAW 手机配对码"}</h2>
            <span className={`status ${walletPaired || snapshot.pairingSession ? "active" : "blocked"}`}>
              {walletPaired ? "已完成" : snapshot.pairingSession ? snapshot.pairingSession.status : "未生成"}
            </span>
          </div>
          <div className="pairing-box">
            <div>
              <span className="metric-label">{walletPaired ? "当前 CAW 钱包" : "配对码"}</span>
              <div className={`pairing-code ${walletPaired ? "wallet-address-code" : ""}`}>
                {walletPaired
                  ? cawStatus?.runtime.walletAddress ?? "已配对"
                  : snapshot.pairingSession?.code ?? "点击生成配对码"}
              </div>
            </div>
            <div className="pairing-help">
              {walletPaired ? (
                <>
                  <p>1. 当前 Agent 钱包已经和手机 CAW App 配对。</p>
                  <p>2. 不需要再输入验证码，重复配对会提示验证失败。</p>
                  <p>3. 下一步点击“连接 CAW”，再创建或刷新 Pact 授权。</p>
                </>
              ) : (
                <>
                  <p>1. 点击“生成配对码”。</p>
                  <p>2. 打开手机 Cobo Agentic Wallet App。</p>
                  <p>3. 输入这里显示的 8 位配对码。</p>
                  <p>4. 配对后点击“连接 CAW”。</p>
                </>
              )}
            </div>
          </div>
          <div className="actions">
            <button
              onClick={() => callAction("pair", "/api/wallet/caw/pairing-code")}
              disabled={busyAction === "pair" || walletPaired}
            >
              {walletPaired ? "已配对，无需生成" : "生成配对码"}
            </button>
            <button
              className="secondary"
              onClick={() => callAction("connect", "/api/wallet/caw/connect")}
              disabled={busyAction === "connect" || walletConnected}
            >
              连接 CAW
            </button>
          </div>
          <p className="metric-label">
            {walletPaired
              ? "如果换了手机或重装 CAW App，才需要重新生成配对码。当前演示请直接连接 CAW。"
              : snapshot.pairingSession
              ? `过期时间：${formatTime(snapshot.pairingSession.expiresAt)}`
              : "如果新电脑/新钱包还没有配对，先从这里生成验证码。"}
          </p>
        </div>

        <div className="panel span-12">
          <div className="panel-title">
            <h2>新用户怎么接入 CAW</h2>
            <span className="status blocked">部署方操作</span>
          </div>
          <div className="pairing-help new-user-guide">
            <p>1. 当前版本是单钱包部署模式：一份部署只读取一个后端 CAW Agent Wallet。</p>
            <p>2. 给另一个人使用时，先在服务器或本机用 CAW CLI 创建新的 Agent Wallet。</p>
            <p>3. 把新钱包的 API URL、API Key、Wallet ID、钱包地址写入该部署的环境变量。</p>
            <p>4. 重启网站后，页面会变成“未配对”，再生成配对码给新用户手机 CAW App 输入。</p>
            <p>5. 配对成功后点击“连接 CAW”，再让用户在手机里批准 Pact 和 USDC 授权。</p>
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
            <button
              className="secondary"
              onClick={() => callAction("approve-usdc", "/api/wallet/caw/approve")}
              disabled={busyAction === "approve-usdc" || !canApproveUsdc}
            >
              {t.approveUsdc}
            </button>
          </div>
        </div>

        <div className="panel span-12">
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
              <span>{t.nextPayment}</span>
              <span className="value">
                {cawStatus?.spendReadiness
                  ? `${formatUsdc(cawStatus.spendReadiness.requiredUsdcMinor)} USDC`
                  : "-"}
              </span>
            </div>
            <div className="row">
              <span>{t.pactRemaining}</span>
              <span className="value">
                {cawStatus?.spendReadiness
                  ? `${formatUsdc(cawStatus.spendReadiness.remainingUsdcMinor)} USDC`
                  : "-"}
              </span>
            </div>
            <div className="row">
              <span>{t.allowance}</span>
              <span className="value">
                {cawStatus?.spendReadiness?.allowanceUsdcMinor !== undefined
                  ? `${formatUsdc(cawStatus.spendReadiness.allowanceUsdcMinor)} USDC`
                  : "-"}
              </span>
            </div>
            <div className="row">
              <span>{t.gasBalance}</span>
              <span className="value">
                {cawStatus?.spendReadiness?.gasEth
                  ? `${formatEth(cawStatus.spendReadiness.gasEth)} ETH`
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
            {cawTxRecords.length === 0 ? (
              <li className="event">
                <strong>{t.noTopups}</strong>
                <span>{t.noTopupsHint}</span>
              </li>
            ) : (
              cawTxRecords.slice(0, 8).map((tx) => (
                <li className="event compact-event" key={tx.id}>
                  <div className="event-line">
                    <strong>{cawTxTitle(tx, lang)}</strong>
                    <span className={`status ${cawTxStatusClass(tx.status)}`}>
                      {cawTxStatusLabel(tx.status, lang)}
                    </span>
                  </div>
                  <div className="event-meta">
                    <span>{tx.amount} {tx.token}</span>
                    <span title={tx.from}>付款: {shortAddr(tx.from)}</span>
                    <span title={tx.to}>收款: {shortAddr(tx.to)}</span>
                    <span>{formatTime(tx.time)}</span>
                  </div>
                  <span>
                    {tx.txHash
                      ? `${t.txHash}: ${shortHash(tx.txHash)}`
                      : tx.description || tx.requestId || "—"}
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

        <VenicePanel
          cawWalletAddress={cawStatus?.runtime.walletAddress ?? snapshot.user.cawWalletAddress}
          hasActivePact={realPactReady}
          cawMode={cawStatus?.runtime.mode ?? "mock"}
        />
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

function formatEth(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return value;
  }
  return parsed.toLocaleString("en-US", {
    maximumFractionDigits: 8
  });
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
    "real CAW Pact authorization": "真实 CAW Pact 授权",
    "Pact authorization expired": "Pact 已过期",
    "Pact remaining spend below next payment": "Pact 剩余额度不足",
    "USDC allowance below next payment": "USDC 授权不足",
    "USDC balance below next payment": "USDC 余额不足",
    "Base Sepolia ETH gas balance missing": "Base Sepolia ETH gas 不足",
    "on-chain readiness check unavailable": "链上就绪检查失败"
  };

  return translations[item] ?? item;
}

function getNextStep(missingItems: string[]) {
  if (missingItems.includes("手机 App 配对")) {
    return "先在手机 CAW App 完成钱包配对。";
  }
  if (missingItems.includes("真实 CAW Pact 授权") || missingItems.includes("有效 Pact 授权")) {
    return "先给 CAW 钱包领取 Base Sepolia ETH 和 USDC，然后创建真实 Pact 并在手机 App 里批准。";
  }
  if (missingItems.includes("Pact 剩余额度不足")) {
    return "当前 Pact 额度已不足，创建新的最小额度 Pact 后再继续真实支付测试。";
  }
  if (missingItems.includes("USDC 授权不足")) {
    return "先给支付合约执行最小 USDC approve，再继续真实支付。";
  }
  if (missingItems.includes("USDC 余额不足") || missingItems.includes("Base Sepolia ETH gas 不足")) {
    return "先补足 CAW 钱包的 Base Sepolia USDC 和 ETH gas。";
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

function shortAddr(addr: string) {
  if (!addr) return "—";
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

function cawTxTitle(tx: CawTxRecord, lang: Lang) {
  if (tx.reason === "x402_auto") return lang === "zh" ? "x402 自动支付" : "x402 auto-pay";
  if (tx.reason === "policy_denied") return lang === "zh" ? "策略拒绝" : "Policy denied";
  if (tx.description?.toLowerCase().includes("x402")) return lang === "zh" ? "x402 自动支付" : "x402 auto-pay";
  return lang === "zh" ? "手动转账" : "Manual transfer";
}

function cawTxStatusLabel(status: string, lang: Lang) {
  if (status === "Success") return lang === "zh" ? "成功" : "Success";
  if (status === "Rejected") return lang === "zh" ? "失败" : "Failed";
  if (status === "Pending") return lang === "zh" ? "处理中" : "Processing";
  return lang === "zh" ? "未知" : "Unknown";
}

function cawTxStatusClass(status: string) {
  if (status === "Success") return "active";
  if (status === "Rejected") return "failed";
  return "blocked";
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

  if (action === "approve-usdc") {
    if (result.status === "already_approved") {
      return `${t.approveOk} allowance: ${formatUsdc(result.allowanceUsdcMinor ?? 0)} USDC.`;
    }
    return result.txHash ? `${t.approveOk} ${shortHash(result.txHash)}.` : t.approveOk;
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

  return t.done;
}

// =============== Venice Panel ===============
// Venice integration: API key config, balance, x402 top-up, inference test.
// All state lives in /lib/store/venice.ts (memory; resets on dev server restart).

type VeniceConfig = {
  veniceApiKeyConfigured: boolean;
  veniceApiKeyMasked: string;
  veniceModel: string;
  lowBalanceThresholdUsd: number;
  defaultTopupUsd: number;
};

type VeniceBalanceSnapshot = {
  id: string;
  fetchedAt: string;
  source: "x402_wallet" | "billing_api";
  canConsume: boolean;
  consumptionCurrency: "USD" | "DIEM" | "VCU" | "BUNDLED_CREDITS" | null;
  diemBalance: number;
  usdBalance: number;
  diemEpochAllocation: number;
  walletAddress?: string;
  rawResponse?: unknown;
};

type VeniceInferenceLog = {
  id: string;
  prompt: string;
  model: string;
  response: string;
  inputTokens: number | null;
  outputTokens: number | null;
  status: "completed" | "failed";
  errorMessage?: string;
  durationMs: number;
  createdAt: string;
};

type VeniceX402Requirement = {
  protocol: "x402";
  version: 2;
  network: string;
  asset: string;
  amount: string;
  payTo: string;
  extra?: { name?: string; version?: string; feePayer?: string };
};

type VeniceSiweXResult = {
  walletAddress: string;
  chainId: string;
  uri: string;
  headerName: "X-Sign-In-With-X";
  headerValue: string;
  decoded: {
    message: { address: string; domain: string; uri: string; nonce: string; issuedAt: string; chainId: number };
    signature: string;
    txId: string;
  };
};

function VenicePanel({ cawWalletAddress, hasActivePact, cawMode }: { cawWalletAddress?: string; hasActivePact: boolean; cawMode: "mock" | "http" }) {
  const [config, setConfig] = useState<VeniceConfig | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [modelInput, setModelInput] = useState("");
  const [balance, setBalance] = useState<VeniceBalanceSnapshot | null>(null);
  const [balanceHistory, setBalanceHistory] = useState<VeniceBalanceSnapshot[]>([]);
  const [inferenceLogs, setInferenceLogs] = useState<VeniceInferenceLog[]>([]);
  const [x402Req, setX402Req] = useState<VeniceX402Requirement | null>(null);
  const [topupUsd, setTopupUsd] = useState(5);
  const [promptInput, setPromptInput] = useState("用一句话介绍 Venice AI 的 x402 协议。");
  const [siweXResult, setSiweXResult] = useState<VeniceSiweXResult | null>(null);
  const [authMode, setAuthMode] = useState<"api_key" | "siwe_x">("api_key");
  const [logs, setLogs] = useState<VeniceInferenceLog[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function loadConfig() {
    try {
      const res = await fetch("/api/config/venice");
      const data = await res.json();
      if (res.ok) {
        setConfig(data);
        setModelInput(data.veniceModel ?? "llama-3.3-70b");
        if (data.defaultTopupUsd) setTopupUsd(data.defaultTopupUsd);
      }
    } catch (e) {
      // ignore
    }
  }

  async function loadBalance() {
    try {
      const res = await fetch("/api/venice/balance");
      const data = await res.json();
      if (res.ok) {
        setBalance(data.snapshot ?? null);
        setBalanceHistory(data.history ?? []);
      }
    } catch (e) {
      // ignore
    }
  }

  async function loadLogs() {
    try {
      const res = await fetch("/api/venice/logs");
      const data = await res.json();
      if (res.ok) setLogs(data.logs ?? []);
    } catch (e) {
      // ignore
    }
  }

  async function loadX402Requirements() {
    try {
      const res = await fetch("/api/venice/x402-topup");
      const data = await res.json();
      if (res.ok) {
        setX402Req(data.selected);
      } else {
        setError(data.error ?? "Failed to fetch x402 requirements");
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function generateSiweXHeader() {
    if (!cawWalletAddress) {
      setError("Connect a CAW wallet first (above).");
      return;
    }
    if (!hasActivePact) {
      setError("Create and approve an active Pact first (CAW Pact card).");
      return;
    }
    setBusy("siwe");
    setError(null);
    try {
      const res = await fetch("/api/venice/sign-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uri: "https://api.venice.ai/api/v1/chat/completions" })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sign-message failed");
      setSiweXResult(data);
      setAuthMode("siwe_x");
      setInfo(`Signed SiweX header for ${data.walletAddress.slice(0, 6)}…${data.walletAddress.slice(-4)} (chain ${data.chainId})`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function saveConfig() {
    setBusy("save");
    setError(null);
    setInfo(null);
    try {
      const res = await fetch("/api/config/venice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ veniceApiKey: apiKeyInput, veniceModel: modelInput })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setInfo(`Saved: ${data.updated.join(", ")}`);
      setApiKeyInput("");
      await loadConfig();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function refreshBalance() {
    setBusy("refresh");
    setError(null);
    try {
      const res = await fetch("/api/venice/balance?refresh=1");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Refresh failed");
      setBalance(data.snapshot ?? null);
      setBalanceHistory(data.history ?? []);
      setInfo("Balance refreshed");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function runTopup() {
    if (!cawWalletAddress) {
      setError("Connect a CAW wallet first (above).");
      return;
    }
    if (!hasActivePact) {
      setError("Create and approve an active Pact first (CAW Pact card).");
      return;
    }
    setBusy("topup");
    setError(null);
    setInfo(null);
    try {
      const res = await fetch("/api/venice/x402-topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usdAmount: topupUsd })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Top-up failed");
      setInfo(
        data.ok
          ? `x402 top-up submitted (${data.responseStatus}). Credit balance should update shortly.`
          : `Top-up returned ${data.responseStatus}. ${data.responseBody?.slice(0, 200) ?? ""}`
      );
      // Re-check balance after a moment
      setTimeout(loadBalance, 1500);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function runInference() {
    setBusy("inference");
    setError(null);
    setInfo(null);
    try {
      const payload: { prompt: string; model: string; siweXHeader?: string } = {
        prompt: promptInput,
        model: modelInput
      };
      if (authMode === "siwe_x" && siweXResult) {
        payload.siweXHeader = siweXResult.headerValue;
      }
      const res = await fetch("/api/venice/inference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Inference failed");
      setInfo(
        `Inference ok via ${data.authMode ?? "?"} in ${data.log.durationMs}ms (${data.log.inputTokens ?? 0} in / ${data.log.outputTokens ?? 0} out tokens)`
      );
      setTimeout(loadLogs, 200);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    loadConfig();
    loadBalance();
    loadX402Requirements();
    loadLogs();
  }, []);

  const ready = config?.veniceApiKeyConfigured;
  const usdDisplay = balance?.usdBalance !== undefined ? `$${balance.usdBalance.toFixed(2)}` : "—";
  const diemDisplay = balance?.diemBalance !== undefined ? balance.diemBalance.toFixed(2) : "—";
  const epochDisplay = balance?.diemEpochAllocation ? `${balance.diemEpochAllocation} DIEM/epoch` : "—";

  return (
    <div className="panel span-12">
      <div className="panel-title">
        <h2>Venice AI · x402 集成</h2>
        <span className={`status ${ready ? "active" : "blocked"}`}>
          {ready ? "已配置" : "未配置 API Key"}
        </span>
      </div>
      <p className="pairing-help">
        Venice 通过 x402 标准（HTTP 402 + 链上 USDC）让钱包按调用付费。下方可设置 Venice
        API key、查账户余额、用 CAW 钱包做 x402 top-up、并跑一次 inference 测试。
      </p>

      {error && (
        <div className="error-banner" style={{ background: "#fde2e2", color: "#ad2f2f", padding: "10px 14px", borderRadius: 8, marginBottom: 12, fontSize: 13 }}>
          ⚠️ {error}
        </div>
      )}
      {info && (
        <div className="info-banner" style={{ background: "#d4f5e4", color: "#116a47", padding: "10px 14px", borderRadius: 8, marginBottom: 12, fontSize: 13 }}>
          ✅ {info}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Config card */}
        <div style={{ background: "var(--surface-soft)", padding: 14, borderRadius: 10 }}>
          <strong style={{ display: "block", marginBottom: 8 }}>1) Venice API Key</strong>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>
            当前: {config?.veniceApiKeyMasked || "(未设置)"} · 模型: {config?.veniceModel || "llama-3.3-70b"}
          </div>
          <input
            type="password"
            placeholder="粘贴 Venice API key (ven_xxx)"
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
            style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid var(--line)", fontSize: 13, marginBottom: 8, boxSizing: "border-box" }}
          />
          <input
            type="text"
            placeholder="模型 ID (默认 llama-3.3-70b)"
            value={modelInput}
            onChange={(e) => setModelInput(e.target.value)}
            style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid var(--line)", fontSize: 13, marginBottom: 8, boxSizing: "border-box" }}
          />
          <button
            className="primary"
            onClick={saveConfig}
            disabled={busy === "save"}
            style={{ padding: "8px 16px", borderRadius: 6, border: "none", background: "var(--primary)", color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 13 }}
          >
            {busy === "save" ? "保存中…" : "保存"}
          </button>
        </div>

        {/* Balance card */}
        <div style={{ background: "var(--surface-soft)", padding: 14, borderRadius: 10 }}>
          <strong style={{ display: "block", marginBottom: 8 }}>2) Venice 账户余额</strong>
          {balance ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>USD</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{usdDisplay}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>DIEM</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{diemDisplay}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>Epoch</div>
                <div style={{ fontSize: 12 }}>{epochDisplay}</div>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 8 }}>暂无余额快照</div>
          )}
          <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 8 }}>
            {balance
              ? `更新于 ${new Date(balance.fetchedAt).toLocaleString()} (${balance.source})`
              : "未设置 API key 时无法获取"}
          </div>
          <button
            onClick={refreshBalance}
            disabled={busy === "refresh" || !ready}
            style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid var(--line)", background: ready ? "#fff" : "#eee", fontWeight: 600, cursor: ready ? "pointer" : "not-allowed", fontSize: 13 }}
          >
            {busy === "refresh" ? "刷新中…" : "刷新余额"}
          </button>
        </div>

        {/* x402 top-up card */}
        <div style={{ background: "var(--surface-soft)", padding: 14, borderRadius: 10 }}>
          <strong style={{ display: "block", marginBottom: 8 }}>3) x402 Top-up (CAW 钱包 → Venice)</strong>
          {x402Req ? (
            <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 8, fontFamily: "monospace" }}>
              {x402Req.network} · {(Number(x402Req.amount) / 1_000_000).toFixed(2)} USDC → {x402Req.payTo.slice(0, 6)}…{x402Req.payTo.slice(-4)}
            </div>
          ) : (
            <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 8 }}>未获取 x402 challenge</div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 12 }}>$</span>
            <input
              type="number"
              min={1}
              max={1000}
              value={topupUsd}
              onChange={(e) => setTopupUsd(Number(e.target.value))}
              style={{ width: 80, padding: "6px 8px", borderRadius: 6, border: "1px solid var(--line)", fontSize: 13 }}
            />
            <span style={{ fontSize: 12, color: "var(--muted)" }}>USDC</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={loadX402Requirements}
              style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid var(--line)", background: "#fff", fontSize: 12, cursor: "pointer" }}
            >
              查看 x402 challenge
            </button>
            <button
              className="primary"
              onClick={runTopup}
              disabled={busy === "topup" || !cawWalletAddress || !hasActivePact}
              title={!cawWalletAddress ? "需要先连接 CAW 钱包" : !hasActivePact ? "需要先激活 Pact" : ""}
              style={{ padding: "8px 16px", borderRadius: 6, border: "none", background: "var(--primary)", color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 13, opacity: !cawWalletAddress || !hasActivePact ? 0.5 : 1 }}
            >
              {busy === "topup" ? "执行中…" : "用 CAW 钱包 x402 充值"}
            </button>
          </div>
        </div>

        {/* Inference test card */}
        <div style={{ background: "var(--surface-soft)", padding: 14, borderRadius: 10 }}>
          <strong style={{ display: "block", marginBottom: 8 }}>4) 跑一次 Venice Inference</strong>
          <div style={{ display: "flex", gap: 12, marginBottom: 8, fontSize: 12 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
              <input
                type="radio"
                name="veniceAuthMode"
                checked={authMode === "api_key"}
                onChange={() => setAuthMode("api_key")}
              />
              API Key (Bearer)
            </label>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                cursor: cawWalletAddress && hasActivePact ? "pointer" : "not-allowed",
                opacity: cawWalletAddress && hasActivePact ? 1 : 0.5
              }}
            >
              <input
                type="radio"
                name="veniceAuthMode"
                disabled={!cawWalletAddress || !hasActivePact}
                checked={authMode === "siwe_x"}
                onChange={() => setAuthMode("siwe_x")}
              />
              X-Sign-In-With-X (钱包签)
            </label>
            {authMode === "siwe_x" && !siweXResult && (
              <button
                onClick={generateSiweXHeader}
                disabled={busy === "siwe" || !cawWalletAddress || !hasActivePact}
                style={{ marginLeft: 4, padding: "2px 10px", borderRadius: 4, border: "1px solid var(--primary)", background: "#fff", color: "var(--primary)", fontSize: 11, cursor: "pointer" }}
              >
                {busy === "siwe" ? "签名中…" : "生成签名"}
              </button>
            )}
            {authMode === "siwe_x" && siweXResult && (
              <span style={{ marginLeft: 4, fontSize: 11, color: "#116a47" }}>
                ✓ 已签 ({siweXResult.decoded.signature.slice(0, 10)}…)
              </span>
            )}
          </div>
          <textarea
            value={promptInput}
            onChange={(e) => setPromptInput(e.target.value)}
            rows={3}
            style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid var(--line)", fontSize: 13, marginBottom: 8, boxSizing: "border-box", fontFamily: "inherit" }}
          />
          <button
            className="primary"
            onClick={runInference}
            disabled={
              busy === "inference" ||
              (authMode === "api_key" ? !ready : !siweXResult)
            }
            style={{ padding: "8px 16px", borderRadius: 6, border: "none", background: "var(--primary)", color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 13 }}
          >
            {busy === "inference" ? "运行中…" : "运行 inference"}
          </button>
          {authMode === "api_key" && !ready && (
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>需要先设置 API key</div>
          )}
          {authMode === "siwe_x" && !siweXResult && (
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>需要先生成钱包签名</div>
          )}
        </div>
      </div>

      {logs.length > 0 && (
        <details style={{ marginTop: 16 }} open>
          <summary style={{ cursor: "pointer", fontSize: 13, color: "var(--muted)", fontWeight: 600 }}>
            Inference 历史 ({logs.length} 条)
          </summary>
          <div style={{ marginTop: 8, maxHeight: 280, overflowY: "auto" }}>
            {logs.map((l) => (
              <div
                key={l.id}
                style={{
                  padding: "8px 10px",
                  borderBottom: "1px solid var(--line)",
                  fontSize: 12,
                  background: l.status === "completed" ? "#f4faf6" : "#fff5f5"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, color: l.status === "completed" ? "#116a47" : "#ad2f2f" }}>
                    {l.status === "completed" ? "✓" : "✗"} {l.model}
                  </span>
                  <span style={{ color: "var(--muted)", fontSize: 11 }}>
                    {new Date(l.createdAt).toLocaleString()} · {l.durationMs}ms
                  </span>
                </div>
                <div style={{ color: "var(--muted)", fontSize: 11, marginBottom: 2 }}>→ {l.prompt}</div>
                {l.status === "completed" ? (
                  <div style={{ color: "var(--text)" }}>{l.response}</div>
                ) : (
                  <div style={{ color: "#ad2f2f", fontSize: 11 }}>{l.errorMessage}</div>
                )}
              </div>
            ))}
          </div>
        </details>
      )}

      {balanceHistory.length > 1 && (
        <details style={{ marginTop: 12 }}>
          <summary style={{ cursor: "pointer", fontSize: 13, color: "var(--muted)" }}>
            余额历史 ({balanceHistory.length} 条)
          </summary>
          <div style={{ marginTop: 8, fontSize: 12, fontFamily: "monospace" }}>
            {balanceHistory.map((b) => (
              <div key={b.id} style={{ padding: "4px 0", borderBottom: "1px solid var(--line)" }}>
                {new Date(b.fetchedAt).toLocaleString()} — USD ${b.usdBalance.toFixed(2)} · DIEM {b.diemBalance.toFixed(2)} · {b.source}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
