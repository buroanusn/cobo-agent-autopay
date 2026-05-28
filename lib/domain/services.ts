import { createHash } from "node:crypto";
import { createCawGateway } from "@/lib/caw/gateway";
import {
  BASE_CHAIN,
  CREDITS_PER_USDC,
  DEFAULT_SPEND_POLICY,
  DEMO_CAW_WALLET,
  DEMO_USER_ID
} from "@/lib/domain/constants";
import { creditsToUsdcMinor } from "@/lib/domain/money";
import type {
  AgentUsageEvent,
  CawAuthorization,
  DashboardSnapshot,
  TopupOrder
} from "@/lib/domain/types";
import {
  createId,
  db,
  getActiveAuthorization,
  nowIso,
  requireCreditAccount,
  requireUser,
  snapshotForUser
} from "@/lib/store/memory";

type AutoTopupReason = "low_balance" | "insufficient_balance" | "manual";

export function getDashboardSnapshot(userId = DEMO_USER_ID): DashboardSnapshot {
  return snapshotForUser(userId);
}

export async function connectCawWallet(input: {
  userId?: string;
  walletAddress?: string;
}) {
  const userId = input.userId ?? DEMO_USER_ID;
  const walletAddress = input.walletAddress ?? DEMO_CAW_WALLET;
  const user = requireUser(userId);
  const gateway = createCawGateway();
  const connection = await gateway.connectWallet({ userId, walletAddress });

  db.users.set(userId, {
    ...user,
    cawWalletAddress: connection.walletAddress
  });

  return {
    connection,
    snapshot: snapshotForUser(userId)
  };
}

export async function createCawAuthorization(input: {
  userId?: string;
  singleLimitUsdcMinor?: number;
  dailyLimitUsdcMinor?: number;
  monthlyLimitUsdcMinor?: number;
  validDays?: number;
}) {
  const userId = input.userId ?? DEMO_USER_ID;
  const user = requireUser(userId);
  const walletAddress = user.cawWalletAddress ?? DEMO_CAW_WALLET;
  const createdAt = nowIso();
  const expiresAt = new Date(
    Date.now() + (input.validDays ?? DEFAULT_SPEND_POLICY.validDays) * 24 * 60 * 60 * 1000
  ).toISOString();
  const gateway = createCawGateway();
  const pact = await gateway.createPact({
    userId,
    walletAddress,
    contractAddress: process.env.PAYMENT_CONTRACT_ADDRESS,
    usdcAddress: BASE_CHAIN.usdcAddress,
    singleLimitUsdcMinor: input.singleLimitUsdcMinor ?? DEFAULT_SPEND_POLICY.singleLimitUsdcMinor,
    dailyLimitUsdcMinor: input.dailyLimitUsdcMinor ?? DEFAULT_SPEND_POLICY.dailyLimitUsdcMinor,
    monthlyLimitUsdcMinor:
      input.monthlyLimitUsdcMinor ?? DEFAULT_SPEND_POLICY.monthlyLimitUsdcMinor,
    expiresAt
  });

  const authorization: CawAuthorization = {
    id: createId("auth"),
    userId,
    walletAddress,
    pactId: pact.pactId,
    status: pact.status,
    singleLimitUsdcMinor: input.singleLimitUsdcMinor ?? DEFAULT_SPEND_POLICY.singleLimitUsdcMinor,
    dailyLimitUsdcMinor: input.dailyLimitUsdcMinor ?? DEFAULT_SPEND_POLICY.dailyLimitUsdcMinor,
    monthlyLimitUsdcMinor:
      input.monthlyLimitUsdcMinor ?? DEFAULT_SPEND_POLICY.monthlyLimitUsdcMinor,
    spentTodayUsdcMinor: 0,
    spentMonthUsdcMinor: 0,
    dailyWindowStart: createdAt,
    monthlyWindowStart: createdAt,
    expiresAt,
    createdAt
  };

  db.cawAuthorizations.set(authorization.id, authorization);
  db.users.set(userId, { ...user, cawWalletAddress: walletAddress });

  return {
    authorization,
    approvalUrl: pact.approvalUrl,
    snapshot: snapshotForUser(userId)
  };
}

export async function runAgentTask(input: {
  userId?: string;
  taskName?: string;
  prompt?: string;
}) {
  const userId = input.userId ?? DEMO_USER_ID;
  const taskName = input.taskName?.trim() || "research-agent";
  const prompt = input.prompt?.trim() || "Summarize wallet funding state and continue.";
  const account = requireCreditAccount(userId);
  const estimatedCredits = estimateAgentCredits(prompt);
  let topup: Awaited<ReturnType<typeof executeAutoTopup>> | undefined;

  if (account.balanceCredits < estimatedCredits) {
    topup = await executeAutoTopup({ userId, reason: "insufficient_balance" });
  }

  if (account.balanceCredits < estimatedCredits) {
    const usageEvent = createUsageEvent({
      userId,
      taskName,
      prompt,
      estimatedCredits,
      creditsCharged: 0,
      status: "failed_insufficient_balance"
    });

    return {
      ok: false,
      usageEvent,
      topup,
      snapshot: snapshotForUser(userId)
    };
  }

  account.balanceCredits -= estimatedCredits;
  account.updatedAt = nowIso();
  const usageEvent = createUsageEvent({
    userId,
    taskName,
    prompt,
    estimatedCredits,
    creditsCharged: estimatedCredits,
    status: "completed"
  });

  db.ledgerEntries.push({
    id: createId("led"),
    userId,
    type: "agent_usage",
    creditsDelta: -estimatedCredits,
    balanceAfterCredits: account.balanceCredits,
    usageEventId: usageEvent.id,
    createdAt: nowIso()
  });

  if (account.balanceCredits < account.lowBalanceThresholdCredits) {
    topup = await executeAutoTopup({ userId, reason: "low_balance" });
  }

  return {
    ok: true,
    usageEvent,
    topup,
    snapshot: snapshotForUser(userId)
  };
}

export async function executeAutoTopup(input: {
  userId?: string;
  reason?: AutoTopupReason;
}) {
  const userId = input.userId ?? DEMO_USER_ID;
  const reason = input.reason ?? "low_balance";
  const user = requireUser(userId);
  const account = requireCreditAccount(userId);

  if (reason === "low_balance" && account.balanceCredits >= account.lowBalanceThresholdCredits) {
    return {
      status: "skipped" as const,
      reason: "balance_above_threshold",
      snapshot: snapshotForUser(userId)
    };
  }

  const existingPending = [...db.topupOrders.values()].find(
    (order) =>
      order.userId === userId &&
      ["pending_policy", "caw_submitted", "chain_pending"].includes(order.status)
  );

  if (existingPending) {
    return {
      status: "pending" as const,
      order: existingPending,
      snapshot: snapshotForUser(userId)
    };
  }

  const amountUsdcMinor = creditsToUsdcMinor(account.autoTopupCredits);
  const policy = checkAuthorizationPolicy(userId, amountUsdcMinor);

  if (!policy.ok) {
    const failedOrder = createTopupOrder({
      userId,
      walletAddress: user.cawWalletAddress ?? DEMO_CAW_WALLET,
      amountUsdcMinor,
      credits: account.autoTopupCredits,
      reason,
      status: "failed",
      failureReason: policy.reason
    });

    return {
      status: "blocked" as const,
      reason: policy.reason,
      order: failedOrder,
      snapshot: snapshotForUser(userId)
    };
  }

  const order = createTopupOrder({
    userId,
    walletAddress: policy.authorization.walletAddress,
    amountUsdcMinor,
    credits: account.autoTopupCredits,
    reason,
    status: "pending_policy"
  });

  const gateway = createCawGateway();
  const cawResult = await gateway.executeCreditsPurchase({
    userId,
    walletAddress: policy.authorization.walletAddress,
    pactId: policy.authorization.pactId,
    paymentContractAddress: process.env.PAYMENT_CONTRACT_ADDRESS,
    usdcAddress: BASE_CHAIN.usdcAddress,
    orderId: order.orderId,
    onchainOrderId: order.onchainOrderId,
    amountUsdcMinor,
    credits: account.autoTopupCredits
  });

  recordAuthorizationSpend(policy.authorization, amountUsdcMinor);
  order.status = cawResult.status === "confirmed" ? "chain_pending" : "caw_submitted";
  order.txHash = cawResult.txHash;
  order.updatedAt = nowIso();

  if (cawResult.mockConfirmed) {
    settleCreditsPurchase({
      orderId: order.orderId,
      onchainOrderId: order.onchainOrderId,
      amountUsdcMinor: order.amountUsdcMinor,
      txHash: order.txHash,
      eventId: `mock_evt_${order.orderId}`
    });
  }

  return {
    status: "submitted" as const,
    order,
    snapshot: snapshotForUser(userId)
  };
}

export function settleCreditsPurchase(input: {
  orderId?: string;
  onchainOrderId?: string;
  amountUsdcMinor: number;
  txHash?: string;
  eventId?: string;
}) {
  const eventId =
    input.eventId ??
    `${input.txHash ?? "no_tx"}:${input.orderId ?? input.onchainOrderId ?? "no_order"}`;

  if (db.chainEventsSeen.has(eventId)) {
    return {
      status: "duplicate" as const,
      snapshot: snapshotForUser(DEMO_USER_ID)
    };
  }

  db.chainEventsSeen.add(eventId);
  const order = [...db.topupOrders.values()].find(
    (candidate) =>
      candidate.orderId === input.orderId || candidate.onchainOrderId === input.onchainOrderId
  );

  if (!order) {
    throw new Error("No matching top-up order for chain event.");
  }

  if (order.status === "credited") {
    return {
      status: "already_credited" as const,
      order,
      snapshot: snapshotForUser(order.userId)
    };
  }

  if (order.amountUsdcMinor !== input.amountUsdcMinor) {
    order.status = "failed";
    order.failureReason = "chain_amount_mismatch";
    order.updatedAt = nowIso();
    return {
      status: "failed" as const,
      order,
      snapshot: snapshotForUser(order.userId)
    };
  }

  const account = requireCreditAccount(order.userId);
  account.balanceCredits += order.credits;
  account.updatedAt = nowIso();
  order.status = "credited";
  order.txHash = input.txHash ?? order.txHash;
  order.creditedAt = nowIso();
  order.updatedAt = order.creditedAt;

  db.ledgerEntries.push({
    id: createId("led"),
    userId: order.userId,
    type: "auto_topup",
    creditsDelta: order.credits,
    balanceAfterCredits: account.balanceCredits,
    orderId: order.orderId,
    usdcMinor: order.amountUsdcMinor,
    txHash: order.txHash,
    createdAt: nowIso()
  });

  return {
    status: "credited" as const,
    order,
    snapshot: snapshotForUser(order.userId)
  };
}

function createUsageEvent(input: Omit<AgentUsageEvent, "id" | "createdAt">) {
  const usageEvent: AgentUsageEvent = {
    ...input,
    id: createId("use"),
    createdAt: nowIso()
  };
  db.usageEvents.push(usageEvent);
  return usageEvent;
}

function createTopupOrder(input: {
  userId: string;
  walletAddress: string;
  amountUsdcMinor: number;
  credits: number;
  reason: string;
  status: TopupOrder["status"];
  failureReason?: string;
}) {
  const createdAt = nowIso();
  const orderId = createId("ord");
  const order: TopupOrder = {
    id: createId("top"),
    userId: input.userId,
    walletAddress: input.walletAddress,
    status: input.status,
    reason: input.reason,
    orderId,
    onchainOrderId: orderIdToBytes32(orderId),
    amountUsdcMinor: input.amountUsdcMinor,
    credits: input.credits,
    failureReason: input.failureReason,
    createdAt,
    updatedAt: createdAt
  };
  db.topupOrders.set(order.id, order);
  return order;
}

function checkAuthorizationPolicy(userId: string, amountUsdcMinor: number) {
  const authorization = getActiveAuthorization(userId);

  if (!authorization) {
    return { ok: false as const, reason: "missing_caw_authorization" };
  }

  refreshAuthorizationWindows(authorization);

  if (authorization.status !== "active") {
    return { ok: false as const, reason: `authorization_${authorization.status}` };
  }

  if (Date.parse(authorization.expiresAt) <= Date.now()) {
    authorization.status = "expired";
    return { ok: false as const, reason: "authorization_expired" };
  }

  if (amountUsdcMinor > authorization.singleLimitUsdcMinor) {
    return { ok: false as const, reason: "single_limit_exceeded" };
  }

  if (authorization.spentTodayUsdcMinor + amountUsdcMinor > authorization.dailyLimitUsdcMinor) {
    return { ok: false as const, reason: "daily_limit_exceeded" };
  }

  if (authorization.spentMonthUsdcMinor + amountUsdcMinor > authorization.monthlyLimitUsdcMinor) {
    return { ok: false as const, reason: "monthly_limit_exceeded" };
  }

  return { ok: true as const, authorization };
}

function recordAuthorizationSpend(authorization: CawAuthorization, amountUsdcMinor: number) {
  refreshAuthorizationWindows(authorization);
  authorization.spentTodayUsdcMinor += amountUsdcMinor;
  authorization.spentMonthUsdcMinor += amountUsdcMinor;
}

function refreshAuthorizationWindows(authorization: CawAuthorization) {
  const now = new Date();
  const dailyStart = new Date(authorization.dailyWindowStart);
  if (dailyStart.toISOString().slice(0, 10) !== now.toISOString().slice(0, 10)) {
    authorization.spentTodayUsdcMinor = 0;
    authorization.dailyWindowStart = now.toISOString();
  }

  const monthKey = now.toISOString().slice(0, 7);
  if (authorization.monthlyWindowStart.slice(0, 7) !== monthKey) {
    authorization.spentMonthUsdcMinor = 0;
    authorization.monthlyWindowStart = now.toISOString();
  }
}

function estimateAgentCredits(prompt: string) {
  return Math.min(5000, Math.max(750, Math.ceil(prompt.length * 10) + 650));
}

function orderIdToBytes32(orderId: string) {
  return `0x${createHash("sha256").update(orderId).digest("hex")}`;
}

export const pricing = {
  creditsPerUsdc: CREDITS_PER_USDC
};
