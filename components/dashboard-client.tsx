"use client";

import { useEffect, useState } from "react";
import type { DashboardSnapshot, LedgerEntry, TopupOrder, TopupOrderStatus } from "@/lib/domain/types";
import { formatUsdc } from "@/lib/domain/money";

type ApiResult = {
  ok?: boolean;
  snapshot?: DashboardSnapshot;
  error?: string;
  resource?: X402Resource;
  paymentVerified?: boolean;
  payment?: {
    orderId: string;
    txHash?: string;
    amountUsdcMinor: number;
    status: string;
  };
  preview?: CawPactPreview;
  authorization?: DashboardSnapshot["authorization"];
  requirements?: VeniceX402Requirements;
  selected?: VeniceX402Accept;
  balance?: unknown;
  result?: unknown;
  responseStatus?: number;
  responsePreview?: string;
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
  order?: {
    orderId: string;
    status: string;
    txHash?: string;
  };
  x402?: {
    paymentProof?: string;
    paymentHeader: string;
    resourcePath: string;
  };
  onboarding?: DashboardSnapshot["cawOnboardingSession"];
  connection?: {
    walletId?: string;
    walletAddress?: string;
    walletName?: string;
    agentId?: string;
  };
};

type X402Resource = {
  insight: string;
  account: string;
  chain: string;
  creditsPerUsdc: number;
  unlockedAt: string;
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

type VeniceX402Accept = {
  protocol?: string;
  scheme?: string;
  version?: number;
  network: string;
  asset: string;
  amount?: string;
  maxAmountRequired?: string;
  payTo: string;
  extra?: Record<string, unknown>;
};

type VeniceX402Requirements = {
  x402Version?: number;
  accepts: VeniceX402Accept[];
  error?: string;
  resource?: unknown;
  authOptions?: unknown;
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
    cawOnboardingStatus?: string;
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
    x402Pay: "x402 资源支付",
    x402Unlock: "解锁资源",
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
    x402PayOk: "x402 支付",
    x402UnlockOk: "x402 资源已解锁。",
    x402UnlockPending: "x402 支付还在确认中，请稍后重试解锁。",
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
    x402Pay: "Pay x402 Resource",
    x402Unlock: "Unlock Resource",
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
    x402PayOk: "x402 payment",
    x402UnlockOk: "x402 resource unlocked.",
    x402UnlockPending: "x402 payment is still confirming. Retry unlock shortly.",
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
  const [prompt, setPrompt] = useState(
    "Analyze the user's portfolio and continue the agent task."
  );
  const [pactIntent, setPactIntent] = useState(
    `允许这个 Agent 在我的站内 credits 余额不足时，使用 ${initialSnapshot.network.name} USDC 自动充值；每次最多 1 USDC，每天最多 5 USDC，有效期 7 天。`
  );
  const [singleLimitUsdc, setSingleLimitUsdc] = useState("1");
  const [dailyLimitUsdc, setDailyLimitUsdc] = useState("5");
  const [monthlyLimitUsdc, setMonthlyLimitUsdc] = useState("20");
  const [validDays, setValidDays] = useState("7");
  const [cawWalletId, setCawWalletId] = useState(initialSnapshot.user.cawWalletId ?? "");
  const [cawAgentName, setCawAgentName] = useState(
    `${initialSnapshot.user.email.split("@")[0]?.replace(/[^a-zA-Z0-9_-]/g, "-") || "user"}-agent`
  );
  const [cawOnboardingAnswers, setCawOnboardingAnswers] = useState<Record<string, string>>({});
  const [veniceBalance, setVeniceBalance] = useState<unknown>();
  const [veniceRequirements, setVeniceRequirements] = useState<VeniceX402Requirements>();
  const [veniceAccept, setVeniceAccept] = useState<VeniceX402Accept>();
  const [venicePactPreview, setVenicePactPreview] = useState<CawPactPreview>();
  const [veniceTopupAmount, setVeniceTopupAmount] = useState("1");
  const [veniceDailyLimitUsdc, setVeniceDailyLimitUsdc] = useState("5");
  const [veniceMonthlyLimitUsdc, setVeniceMonthlyLimitUsdc] = useState("20");
  const [veniceValidDays, setVeniceValidDays] = useState("7");
  const [venicePaymentConfirmed, setVenicePaymentConfirmed] = useState(false);
  const [venicePrompt, setVenicePrompt] = useState("Summarize the current Venice balance and billing status.");
  const [veniceInference, setVeniceInference] = useState<string>();

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    const [snapshotResponse, cawStatusResponse] = await Promise.all([
      fetch("/api/credits/balance", { cache: "no-store" }),
      fetch("/api/wallet/caw/status", { cache: "no-store" })
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
        if (result.snapshot.user.cawWalletId) {
          setCawWalletId(result.snapshot.user.cawWalletId);
        }
      }

      if (action === "pact-preview" && result.preview) {
        setPactPreview(result.preview);
      }

      if (action === "venice-pact-preview" && result.preview) {
        setVenicePactPreview(result.preview);
        if (result.requirements) {
          setVeniceRequirements(result.requirements);
        }
        if (result.selected) {
          setVeniceAccept(result.selected);
        }
      }

      if (action === "authorize") {
        setPactPreview(undefined);
      }

      if (action === "venice-authorize") {
        setVenicePactPreview(undefined);
      }

      if (action === "caw-onboard" && result.onboarding?.needsInput === false) {
        setCawOnboardingAnswers({});
      }

      if (action === "venice-topup") {
        setVenicePaymentConfirmed(false);
        if (result.requirements) {
          setVeniceRequirements(result.requirements);
        }
        if (result.selected) {
          setVeniceAccept(result.selected);
        }
      }

      if (action === "venice-inference") {
        setVeniceInference(extractVeniceText(result.result));
      }

      setMessage(statusMessage(action, result, lang));
      void refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Request failed.");
    } finally {
      setBusyAction(undefined);
    }
  }

  async function callGetAction(action: string, path: string) {
    setBusyAction(action);
    setMessage(undefined);
    setError(undefined);

    try {
      const response = await fetch(path, { cache: "no-store" });
      const result = (await response.json()) as ApiResult;

      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (!response.ok || result.error) {
        throw new Error(result.error ?? "Request failed.");
      }

      if (action === "venice-balance") {
        setVeniceBalance(result.balance);
      }
      if (action === "venice-discover") {
        if (result.requirements) {
          setVeniceRequirements(result.requirements);
        }
        if (result.selected) {
          setVeniceAccept(result.selected);
        }
      }

      setMessage(statusMessage(action, result, lang));
      void refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Request failed.");
    } finally {
      setBusyAction(undefined);
    }
  }

  async function submitVeniceTopup(body: Record<string, unknown>) {
    const amountMinor = Number(body.amountUsdcMinor);
    if (!Number.isFinite(amountMinor) || amountMinor <= 0) {
      setError("Venice top-up amount must be positive.");
      return;
    }
    const amountLabel = formatUsdc(amountMinor);
    const confirmed = window.confirm(
      `确认通过 CAW x402 在 Base mainnet 支付真实 ${amountLabel} USDC 给 Venice？`
    );
    if (!confirmed) {
      return;
    }
    await callAction("venice-topup", "/api/venice/x402-topup", {
      ...body,
      confirmed: true
    });
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const authorization = snapshot.authorization;
  const onboarding = snapshot.cawOnboardingSession;
  const t = copy[lang];
  const account = snapshot.account;
  const guardrails = snapshot.guardrails;
  const stats = snapshot.paymentStats;
  const walletProfileBound = Boolean(snapshot.user.cawWalletId && snapshot.user.cawWalletAddress);
  const onboardingActive = onboarding?.status === "wallet_active";
  const onboardingPrompts = onboarding?.prompts ?? [];
  const selectedCawWalletId = cawWalletId.trim() || cawStatus?.runtime.walletId || snapshot.user.cawWalletId || "";
  const walletPaired = Boolean(cawStatus?.runtime.walletPaired);
  const missingItems = cawStatus?.missing.map(formatMissingItem) ?? [];
  const realPactReady = Boolean(cawStatus) && !missingItems.includes("真实 CAW Pact 授权");
  const canApproveUsdc = realPactReady && !missingItems.includes("Pact 剩余额度不足");
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
  const veniceAuthorization = snapshot.veniceAuthorization;
  const venicePactActive = veniceAuthorization?.status === "active";
  const venicePactBody = buildVenicePactBody({
    amountUsdc: veniceTopupAmount,
    dailyLimitUsdc: veniceDailyLimitUsdc,
    monthlyLimitUsdc: veniceMonthlyLimitUsdc,
    validDays: veniceValidDays
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
          <a className="button-link secondary compact" href="/dashboard/payments">
            支付记录
          </a>
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

        <div className="panel span-12">
          <div className="panel-title">
            <h2>{walletPaired ? "CAW 钱包已配对" : "CAW Wallet 绑定与配对"}</h2>
            <span className={`status ${walletPaired || snapshot.pairingSession ? "active" : "blocked"}`}>
              {walletPaired ? "已完成" : snapshot.pairingSession ? snapshot.pairingSession.status : "未生成"}
            </span>
          </div>
          <div className="onboarding-card">
            <div className="event-line">
              <strong>创建用户 CAW 钱包</strong>
              <span className={`status ${onboardingActive ? "active" : onboarding ? "blocked" : ""}`}>
                {onboarding?.status ?? "未创建"}
              </span>
            </div>
            <div className="wallet-profile-form">
              <label>
                <span className="metric-label">Agent 名称</span>
                <input
                  value={cawAgentName}
                  onChange={(event) => setCawAgentName(event.target.value)}
                  disabled={walletProfileBound || busyAction === "caw-onboard"}
                />
              </label>
              <div className="pairing-help">
                <p>我们会为当前登录用户创建独立 CAW CLI profile，并保存创建状态。</p>
                <p>创建完成后自动绑定 Wallet UUID；之后再生成配对码让用户在 CAW App 接管。</p>
              </div>
            </div>
            {onboardingPrompts.length > 0 ? (
              <div className="onboarding-prompts">
                {onboardingPrompts.map((promptItem) => (
                  <label key={promptItem.id}>
                    <span className="metric-label">
                      {promptItem.label || promptItem.message || promptItem.id}
                    </span>
                    <input
                      type={promptItem.secret ? "password" : "text"}
                      value={cawOnboardingAnswers[promptItem.id] ?? ""}
                      onChange={(event) =>
                        setCawOnboardingAnswers((current) => ({
                          ...current,
                          [promptItem.id]: event.target.value
                        }))
                      }
                    />
                  </label>
                ))}
              </div>
            ) : null}
            {onboarding?.lastError ? (
              <p className="metric-label error-text">创建提示：{onboarding.lastError}</p>
            ) : null}
            {onboarding?.nextAction ? (
              <p className="metric-label">下一步：{onboarding.nextAction}</p>
            ) : null}
            <div className="actions">
              <button
                onClick={() =>
                  callAction("caw-onboard", "/api/wallet/caw/onboarding", {
                    agentName: cawAgentName,
                    answers: onboardingPrompts.length > 0 ? cawOnboardingAnswers : undefined
                  })
                }
                disabled={busyAction === "caw-onboard" || walletProfileBound}
              >
                {onboardingPrompts.length > 0 ? "提交创建信息" : onboarding ? "继续创建钱包" : "创建 CAW 钱包"}
              </button>
            </div>
          </div>
          <div className="wallet-profile-form">
            <label>
              <span className="metric-label">CAW Wallet UUID</span>
              <input
                value={cawWalletId}
                placeholder={snapshot.user.cawWalletId ?? cawStatus?.runtime.walletId ?? "输入该用户的 CAW Wallet UUID"}
                onChange={(event) => setCawWalletId(event.target.value)}
                disabled={walletProfileBound}
              />
            </label>
            <div className="pairing-help">
              <p>1. 每个登录用户绑定自己的 CAW Wallet UUID，绑定后写入数据库。</p>
              <p>2. 后续 Pact、approve、支付和状态查询都会使用这个用户自己的 CAW wallet。</p>
              <p>3. 同一个 CAW wallet 不能绑定到多个应用用户。</p>
            </div>
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
              disabled={busyAction === "pair" || walletPaired || !walletProfileBound}
            >
              {walletPaired ? "已配对，无需生成" : "生成配对码"}
            </button>
            <button
              className="secondary"
              onClick={() => callAction("refresh-pair", "/api/wallet/caw/pairing-code/refresh")}
              disabled={busyAction === "refresh-pair" || walletPaired || !snapshot.pairingSession}
            >
              刷新配对状态
            </button>
            <button
              className="secondary"
              onClick={() =>
                callAction("connect", "/api/wallet/caw/connect", {
                  cawWalletId: selectedCawWalletId
                })
              }
              disabled={busyAction === "connect" || walletProfileBound || !selectedCawWalletId}
            >
              {walletProfileBound ? "已绑定 CAW" : "绑定 CAW Wallet"}
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
              className="secondary demo-hidden"
              onClick={() => callAction("pair", "/api/wallet/caw/pairing-code")}
              disabled={busyAction === "pair"}
            >
              {t.pair}
            </button>
            <button
              className="secondary demo-hidden"
              onClick={() =>
                callAction("connect", "/api/wallet/caw/connect", {
                  cawWalletId: selectedCawWalletId
                })
              }
              disabled={busyAction === "connect" || walletProfileBound || !selectedCawWalletId}
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
            <button
              className="secondary"
              onClick={() => callAction("approve-usdc", "/api/wallet/caw/approve")}
              disabled={busyAction === "approve-usdc" || !canApproveUsdc}
            >
              {t.approveUsdc}
            </button>
          </div>
        </div>

        <div className="panel span-12 venice-panel">
          <div className="panel-title">
            <h2>Venice AI</h2>
            <span className={`status ${venicePactActive ? "active" : "blocked"}`}>
              {venicePactActive ? "Venice Pact active" : "等待 Venice Pact"}
            </span>
          </div>
          <div className="venice-grid">
            <div className="venice-section">
              <div className="event-line">
                <strong>Balance</strong>
                <button
                  className="secondary compact"
                  onClick={() => callGetAction("venice-balance", "/api/venice/balance")}
                  disabled={busyAction === "venice-balance"}
                >
                  刷新
                </button>
              </div>
              <pre className="json-preview">{formatJsonPreview(veniceBalance ?? "未读取")}</pre>
              <div className="event-line">
                <strong>x402 requirement</strong>
                <button
                  className="secondary compact"
                  onClick={() => callGetAction("venice-discover", "/api/venice/x402-topup")}
                  disabled={busyAction === "venice-discover"}
                >
                  发现
                </button>
              </div>
              <div className="stack compact-stack">
                <div className="row">
                  <span>Network</span>
                  <span className="value">{veniceAccept?.network ?? "-"}</span>
                </div>
                <div className="row">
                  <span>Accepts</span>
                  <span className="value">{veniceRequirements?.accepts.length ?? "-"}</span>
                </div>
                <div className="row">
                  <span>USDC</span>
                  <span className="value">{veniceAccept?.asset ?? "-"}</span>
                </div>
                <div className="row">
                  <span>PayTo</span>
                  <span className="value">{veniceAccept?.payTo ?? "-"}</span>
                </div>
              </div>
            </div>

            <div className="venice-section">
              <div className="event-line">
                <strong>Venice Pact</strong>
                <span className={`status ${venicePactActive ? "active" : "blocked"}`}>
                  {veniceAuthorization?.status ?? "missing"}
                </span>
              </div>
              <div className="limits-grid">
                <label>
                  <span>Top-up USDC</span>
                  <input
                    inputMode="decimal"
                    value={veniceTopupAmount}
                    onChange={(event) => {
                      setVeniceTopupAmount(event.target.value);
                      setVenicePactPreview(undefined);
                    }}
                  />
                </label>
                <label>
                  <span>Daily USDC</span>
                  <input
                    inputMode="decimal"
                    value={veniceDailyLimitUsdc}
                    onChange={(event) => {
                      setVeniceDailyLimitUsdc(event.target.value);
                      setVenicePactPreview(undefined);
                    }}
                  />
                </label>
                <label>
                  <span>Monthly USDC</span>
                  <input
                    inputMode="decimal"
                    value={veniceMonthlyLimitUsdc}
                    onChange={(event) => {
                      setVeniceMonthlyLimitUsdc(event.target.value);
                      setVenicePactPreview(undefined);
                    }}
                  />
                </label>
                <label>
                  <span>Valid days</span>
                  <input
                    inputMode="numeric"
                    value={veniceValidDays}
                    onChange={(event) => {
                      setVeniceValidDays(event.target.value);
                      setVenicePactPreview(undefined);
                    }}
                  />
                </label>
              </div>
              <div className="actions compact-actions">
                <button
                  className="secondary"
                  onClick={() =>
                    callAction("venice-pact-preview", "/api/venice/pact", {
                      ...venicePactBody,
                      previewOnly: true
                    })
                  }
                  disabled={busyAction === "venice-pact-preview"}
                >
                  生成 Venice Pact
                </button>
                <button
                  onClick={() => callAction("venice-authorize", "/api/venice/pact", venicePactBody)}
                  disabled={busyAction === "venice-authorize" || !venicePactPreview}
                >
                  提交 Venice Pact
                </button>
                <button
                  className="secondary"
                  onClick={() => callAction("venice-refresh-pact", "/api/venice/pact/refresh")}
                  disabled={busyAction === "venice-refresh-pact" || !veniceAuthorization}
                >
                  刷新 Venice Pact
                </button>
              </div>
              {venicePactPreview ? (
                <div className="preview-compact">
                  <strong>{venicePactPreview.intent}</strong>
                  <pre>{venicePactPreview.executionPlan}</pre>
                  <pre>{JSON.stringify(venicePactPreview.policies, null, 2)}</pre>
                </div>
              ) : null}
            </div>

            <div className="venice-section">
              <div className="event-line">
                <strong>Inference</strong>
                <button
                  className="secondary compact"
                  onClick={() =>
                    callAction("venice-inference", "/api/venice/inference", {
                      prompt: venicePrompt
                    })
                  }
                  disabled={busyAction === "venice-inference" || !venicePrompt.trim()}
                >
                  运行
                </button>
              </div>
              <textarea
                className="venice-textarea"
                value={venicePrompt}
                onChange={(event) => setVenicePrompt(event.target.value)}
              />
              {veniceInference ? <pre className="json-preview">{veniceInference}</pre> : null}
              <label className="confirm-row">
                <input
                  type="checkbox"
                  checked={venicePaymentConfirmed}
                  onChange={(event) => setVenicePaymentConfirmed(event.target.checked)}
                />
                <span>确认通过 Base mainnet USDC 执行真实 Venice x402 top-up</span>
              </label>
              <button
                onClick={() => submitVeniceTopup(venicePactBody)}
                disabled={
                  busyAction === "venice-topup" ||
                  !venicePactActive ||
                  !venicePaymentConfirmed ||
                  Number(venicePactBody.amountUsdcMinor) <= 0
                }
              >
                真实 top-up
              </button>
            </div>
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

function buildVenicePactBody(input: {
  amountUsdc: string;
  dailyLimitUsdc: string;
  monthlyLimitUsdc: string;
  validDays: string;
}) {
  return {
    amountUsdcMinor: parseUsdcInput(input.amountUsdc),
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

function formatJsonPreview(value: unknown) {
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function extractVeniceText(value: unknown) {
  if (typeof value === "string") {
    return value;
  }
  if (isRecord(value)) {
    const choices = value.choices;
    if (Array.isArray(choices)) {
      const first = choices[0];
      if (isRecord(first) && isRecord(first.message) && typeof first.message.content === "string") {
        return first.message.content;
      }
    }
  }
  return formatJsonPreview(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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
    "CAW CLI profile": "CAW CLI 用户钱包",
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
    "Base ETH gas balance missing": "Base ETH gas 不足",
    "on-chain readiness check unavailable": "链上就绪检查失败"
  };

  return translations[item] ?? item;
}

function getNextStep(missingItems: string[]) {
  if (missingItems.includes("手机 App 配对")) {
    return "先在手机 CAW App 完成钱包配对。";
  }
  if (missingItems.includes("真实 CAW Pact 授权")) {
    return "先给 CAW 钱包准备当前网络的 ETH gas 和 USDC，然后创建真实 Pact 并在手机 App 里批准。";
  }
  if (missingItems.includes("Pact 剩余额度不足")) {
    return "当前 Pact 额度已不足，创建新的最小额度 Pact 后再继续真实支付测试。";
  }
  if (missingItems.includes("USDC 授权不足")) {
    return "先给支付合约执行最小 USDC approve，再继续真实支付。";
  }
  if (
    missingItems.includes("USDC 余额不足") ||
    missingItems.includes("Base Sepolia ETH gas 不足") ||
    missingItems.includes("Base ETH gas 不足")
  ) {
    return "先补足 CAW 钱包在当前网络上的 USDC 和 ETH gas。";
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
    return lang === "zh" ? "x402 资源支付" : "x402 resource payment";
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

  if (action === "x402-pay") {
    const proof = result.x402?.paymentProof ?? result.order?.orderId;
    return proof
      ? `${t.x402PayOk} ${result.status}. proof: ${proof}`
      : `${t.x402PayOk} ${result.status}.`;
  }

  if (action === "venice-balance") {
    return "Venice balance 已刷新。";
  }

  if (action === "venice-discover") {
    return result.selected
      ? `Venice x402 requirement 已发现：${result.selected.network} / ${shortHash(result.selected.asset)}。`
      : "Venice x402 requirement 已发现。";
  }

  if (action === "venice-pact-preview") {
    return "Venice Pact 计划已生成。";
  }

  if (action === "venice-authorize") {
    return "Venice Pact 已提交，请在 Cobo Agentic Wallet App 内审批。";
  }

  if (action === "venice-refresh-pact") {
    return "Venice Pact 状态已刷新。";
  }

  if (action === "venice-topup") {
    return result.responseStatus
      ? `Venice x402 top-up 已提交，HTTP ${result.responseStatus}。`
      : "Venice x402 top-up 已提交。";
  }

  if (action === "venice-inference") {
    return "Venice inference 已完成。";
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

  if (action === "refresh-pair") {
    return result.snapshot?.pairingSession?.status === "paired"
      ? "配对已完成。"
      : "配对状态已刷新。";
  }

  if (action === "caw-onboard") {
    const status = result.onboarding?.status ?? result.snapshot?.cawOnboardingSession?.status;
    if (status === "wallet_active") {
      return "CAW 钱包已创建并绑定到当前账号。";
    }
    if (status === "waiting_input") {
      return "请填写创建钱包所需信息后继续。";
    }
    if (status === "failed") {
      return "CAW 钱包创建失败，请查看提示并重试。";
    }
    return "CAW 钱包创建流程已继续。";
  }

  if (action === "guardrails") {
    return result.note ?? t.guardrailsOk;
  }

  return t.done;
}
