import { createCawGateway } from "@/lib/caw/gateway";
import {
  CREDITS_PER_USDC,
  DEFAULT_SPEND_POLICY,
  DEMO_CAW_WALLET,
  DEMO_USER_ID,
  getConfiguredCawChainId,
  getConfiguredChain
} from "@/lib/domain/constants";
import { creditsToUsdcMinor } from "@/lib/domain/money";
import type { CawAuthorization } from "@/lib/domain/types";
import { getCreditRepository } from "@/lib/store";

type AutoTopupReason = "low_balance" | "insufficient_balance" | "manual";

export async function getDashboardSnapshot(userId = DEMO_USER_ID) {
  return getCreditRepository().snapshotForUser(userId);
}

export async function createPairingCode(input: { userId?: string }) {
  const repository = getCreditRepository();
  const userId = input.userId ?? DEMO_USER_ID;
  await repository.requireUser(userId);
  const gateway = createCawGateway();
  const pairing = await gateway.createPairingCode({ userId });
  const session = await repository.createPairingSession(userId, {
    code: pairing.code,
    status: pairing.status,
    expiresAt: pairing.expiresAt,
    createdAt: repository.nowIso()
  });

  return {
    pairingSession: session,
    snapshot: await repository.snapshotForUser(userId)
  };
}

export async function recommendGuardrails(input: {
  userId?: string;
  agentCount?: number;
  dailySpendUsdc?: number;
  riskProfile?: "conservative" | "balanced" | "growth";
}) {
  const repository = getCreditRepository();
  const userId = input.userId ?? DEMO_USER_ID;
  const snapshot = await repository.snapshotForUser(userId);
  const riskMultiplier =
    input.riskProfile === "growth" ? 1.5 : input.riskProfile === "conservative" ? 0.7 : 1;
  const agentCount = Math.max(1, input.agentCount ?? 2);
  const dailySpendUsdc = Math.max(1, input.dailySpendUsdc ?? 10);
  const reviewThresholdUsdcMinor = Math.round(
    Math.min(10, Math.max(1, dailySpendUsdc / agentCount / 2) * riskMultiplier) * 1_000_000
  );

  return {
    recommendation: {
      ...snapshot.guardrails,
      reviewThresholdUsdcMinor,
      singleLimitUsdcMinor: Math.max(
        reviewThresholdUsdcMinor,
        Math.round(dailySpendUsdc * 0.5 * riskMultiplier * 1_000_000)
      ),
      dailyLimitUsdcMinor: Math.round(dailySpendUsdc * riskMultiplier * 1_000_000),
      allowedChains: [getConfiguredCawChainId()],
      generatedBy: "ai_direct" as const,
      updatedAt: repository.nowIso()
    },
    note:
      "Demo recommendation only. Final Guardrails must be confirmed in Cobo Agentic Wallet App.",
    snapshot
  };
}

export async function connectCawWallet(input: {
  userId?: string;
  walletAddress?: string;
}) {
  const repository = getCreditRepository();
  const userId = input.userId ?? DEMO_USER_ID;
  const walletAddress = input.walletAddress ?? DEMO_CAW_WALLET;
  const user = await repository.requireUser(userId);
  const gateway = createCawGateway();
  const connection = await gateway.connectWallet({ userId, walletAddress });

  await repository.updateUser({
    ...user,
    cawWalletAddress: connection.walletAddress
  });

  return {
    connection,
    snapshot: await repository.snapshotForUser(userId)
  };
}

export async function createCawAuthorization(input: {
  userId?: string;
  singleLimitUsdcMinor?: number;
  dailyLimitUsdcMinor?: number;
  monthlyLimitUsdcMinor?: number;
  validDays?: number;
}) {
  const repository = getCreditRepository();
  const userId = input.userId ?? DEMO_USER_ID;
  const user = await repository.requireUser(userId);
  const walletAddress = user.cawWalletAddress ?? DEMO_CAW_WALLET;
  const createdAt = repository.nowIso();
  const chain = getConfiguredChain();
  const expiresAt = new Date(
    Date.now() + (input.validDays ?? DEFAULT_SPEND_POLICY.validDays) * 24 * 60 * 60 * 1000
  ).toISOString();
  const gateway = createCawGateway();
  const pact = await gateway.createPact({
    userId,
    walletAddress,
    contractAddress: process.env.PAYMENT_CONTRACT_ADDRESS,
    usdcAddress: chain.usdcAddress,
    singleLimitUsdcMinor: input.singleLimitUsdcMinor ?? DEFAULT_SPEND_POLICY.singleLimitUsdcMinor,
    dailyLimitUsdcMinor: input.dailyLimitUsdcMinor ?? DEFAULT_SPEND_POLICY.dailyLimitUsdcMinor,
    monthlyLimitUsdcMinor:
      input.monthlyLimitUsdcMinor ?? DEFAULT_SPEND_POLICY.monthlyLimitUsdcMinor,
    expiresAt
  });

  const authorization: CawAuthorization = {
    id: repository.createId("auth"),
    userId,
    walletAddress,
    pactId: pact.pactId,
    pactApiKey: pact.pactApiKey,
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

  await repository.createAuthorization(authorization);
  await repository.updateUser({ ...user, cawWalletAddress: walletAddress });

  return {
    authorization,
    approvalUrl: pact.approvalUrl,
    snapshot: await repository.snapshotForUser(userId)
  };
}

export async function refreshCawAuthorization(input: { userId?: string }) {
  const repository = getCreditRepository();
  const userId = input.userId ?? DEMO_USER_ID;
  const authorization = await repository.getActiveAuthorization(userId);
  if (!authorization) {
    throw new Error("No CAW authorization to refresh.");
  }

  const gateway = createCawGateway();
  const pact = await gateway.getPact({ pactId: authorization.pactId });
  const updated = await repository.updateAuthorization({
    ...authorization,
    status: pact.status,
    pactApiKey: pact.pactApiKey ?? authorization.pactApiKey
  });

  return {
    authorization: updated,
    snapshot: await repository.snapshotForUser(userId)
  };
}

export async function requestTestTokens(input: { userId?: string; tokenId?: string }) {
  const repository = getCreditRepository();
  const userId = input.userId ?? DEMO_USER_ID;
  const user = await repository.requireUser(userId);
  const walletAddress = user.cawWalletAddress ?? DEMO_CAW_WALLET;
  const gateway = createCawGateway();
  const faucet = await gateway.requestFaucet({
    walletAddress,
    tokenId: input.tokenId
  });

  return {
    faucet,
    snapshot: await repository.snapshotForUser(userId)
  };
}

export async function runAgentTask(input: {
  userId?: string;
  taskName?: string;
  prompt?: string;
}) {
  const repository = getCreditRepository();
  const userId = input.userId ?? DEMO_USER_ID;
  const taskName = input.taskName?.trim() || "research-agent";
  const prompt = input.prompt?.trim() || "Summarize wallet funding state and continue.";
  let account = await repository.requireCreditAccount(userId);
  const estimatedCredits = estimateAgentCredits(prompt);
  let topup: Awaited<ReturnType<typeof executeAutoTopup>> | undefined;

  if (account.balanceCredits < estimatedCredits) {
    topup = await executeAutoTopup({ userId, reason: "insufficient_balance" });
    account = await repository.requireCreditAccount(userId);
  }

  if (account.balanceCredits < estimatedCredits) {
    const usageEvent = await repository.createUsageEvent({
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
      snapshot: await repository.snapshotForUser(userId)
    };
  }

  account.balanceCredits -= estimatedCredits;
  account.updatedAt = repository.nowIso();
  await repository.updateCreditAccount(account);
  const usageEvent = await repository.createUsageEvent({
    userId,
    taskName,
    prompt,
    estimatedCredits,
    creditsCharged: estimatedCredits,
    status: "completed"
  });

  await repository.appendLedgerEntry({
    userId,
    type: "agent_usage",
    creditsDelta: -estimatedCredits,
    balanceAfterCredits: account.balanceCredits,
    usageEventId: usageEvent.id
  });

  if (account.balanceCredits < account.lowBalanceThresholdCredits) {
    topup = await executeAutoTopup({ userId, reason: "low_balance" });
  }

  return {
    ok: true,
    usageEvent,
    topup,
    snapshot: await repository.snapshotForUser(userId)
  };
}

export async function executeAutoTopup(input: {
  userId?: string;
  reason?: AutoTopupReason;
}) {
  const repository = getCreditRepository();
  const userId = input.userId ?? DEMO_USER_ID;
  const reason = input.reason ?? "low_balance";
  const user = await repository.requireUser(userId);
  const account = await repository.requireCreditAccount(userId);

  if (reason === "low_balance" && account.balanceCredits >= account.lowBalanceThresholdCredits) {
    return {
      status: "skipped" as const,
      reason: "balance_above_threshold",
      snapshot: await repository.snapshotForUser(userId)
    };
  }

  const existingPending = await repository.findPendingTopupOrder(userId);

  if (existingPending) {
    return {
      status: "pending" as const,
      order: existingPending,
      snapshot: await repository.snapshotForUser(userId)
    };
  }

  const amountUsdcMinor = creditsToUsdcMinor(account.autoTopupCredits);
  const policy = await checkAuthorizationPolicy(userId, amountUsdcMinor);

  if (!policy.ok) {
    const failedOrder = await repository.createTopupOrder({
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
      snapshot: await repository.snapshotForUser(userId)
    };
  }

  const order = await repository.createTopupOrder({
    userId,
    walletAddress: policy.authorization.walletAddress,
    amountUsdcMinor,
    credits: account.autoTopupCredits,
    reason,
    status: "pending_policy"
  });

  const gateway = createCawGateway();
  const chain = getConfiguredChain();
  const cawResult = await gateway.executeCreditsPurchase({
    userId,
    walletAddress: policy.authorization.walletAddress,
    pactId: policy.authorization.pactId,
    pactApiKey: policy.authorization.pactApiKey,
    paymentContractAddress: process.env.PAYMENT_CONTRACT_ADDRESS,
    usdcAddress: chain.usdcAddress,
    orderId: order.orderId,
    onchainOrderId: order.onchainOrderId,
    amountUsdcMinor,
    credits: account.autoTopupCredits
  });

  await recordAuthorizationSpend(policy.authorization, amountUsdcMinor);
  order.status = cawResult.status === "confirmed" ? "chain_pending" : "caw_submitted";
  order.txHash = cawResult.txHash;
  order.updatedAt = repository.nowIso();
  await repository.updateTopupOrder(order);
  let returnedOrder = order;

  if (cawResult.mockConfirmed) {
    const settlement = await settleCreditsPurchase({
      orderId: order.orderId,
      onchainOrderId: order.onchainOrderId,
      amountUsdcMinor: order.amountUsdcMinor,
      txHash: order.txHash,
      eventId: `mock_evt_${order.orderId}`
    });
    if ("order" in settlement && settlement.order) {
      returnedOrder = settlement.order;
    }
  }

  return {
    status: "submitted" as const,
    order: returnedOrder,
    snapshot: await repository.snapshotForUser(userId)
  };
}

export async function settleCreditsPurchase(input: {
  orderId?: string;
  onchainOrderId?: string;
  amountUsdcMinor: number;
  txHash?: string;
  eventId?: string;
}) {
  const repository = getCreditRepository();
  const eventId =
    input.eventId ??
    `${input.txHash ?? "no_tx"}:${input.orderId ?? input.onchainOrderId ?? "no_order"}`;

  if (await repository.hasChainEvent(eventId)) {
    return {
      status: "duplicate" as const,
      snapshot: await repository.snapshotForUser(DEMO_USER_ID)
    };
  }

  const marked = await repository.markChainEventSeen({
    eventId,
    txHash: input.txHash,
    orderId: input.orderId ?? input.onchainOrderId
  });
  if (!marked) {
    return {
      status: "duplicate" as const,
      snapshot: await repository.snapshotForUser(DEMO_USER_ID)
    };
  }
  const order = await repository.findTopupOrderByOrderId({
    orderId: input.orderId,
    onchainOrderId: input.onchainOrderId
  });

  if (!order) {
    throw new Error("No matching top-up order for chain event.");
  }

  if (order.status === "credited") {
    return {
      status: "already_credited" as const,
      order,
      snapshot: await repository.snapshotForUser(order.userId)
    };
  }

  if (order.amountUsdcMinor !== input.amountUsdcMinor) {
    order.status = "failed";
    order.failureReason = "chain_amount_mismatch";
    order.updatedAt = repository.nowIso();
    await repository.updateTopupOrder(order);
    return {
      status: "failed" as const,
      order,
      snapshot: await repository.snapshotForUser(order.userId)
    };
  }

  const account = await repository.requireCreditAccount(order.userId);
  account.balanceCredits += order.credits;
  account.updatedAt = repository.nowIso();
  await repository.updateCreditAccount(account);
  order.status = "credited";
  order.txHash = input.txHash ?? order.txHash;
  order.creditedAt = repository.nowIso();
  order.updatedAt = order.creditedAt;
  await repository.updateTopupOrder(order);

  await repository.appendLedgerEntry({
    userId: order.userId,
    type: "auto_topup",
    creditsDelta: order.credits,
    balanceAfterCredits: account.balanceCredits,
    orderId: order.orderId,
    usdcMinor: order.amountUsdcMinor,
    txHash: order.txHash
  });

  return {
    status: "credited" as const,
    order,
    snapshot: await repository.snapshotForUser(order.userId)
  };
}

async function checkAuthorizationPolicy(userId: string, amountUsdcMinor: number) {
  const repository = getCreditRepository();
  const authorization = await repository.getActiveAuthorization(userId);

  if (!authorization) {
    return { ok: false as const, reason: "missing_caw_authorization" };
  }

  refreshAuthorizationWindows(authorization);

  if (authorization.status !== "active") {
    return { ok: false as const, reason: `authorization_${authorization.status}` };
  }

  if (Date.parse(authorization.expiresAt) <= Date.now()) {
    authorization.status = "expired";
    await repository.updateAuthorization(authorization);
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

async function recordAuthorizationSpend(authorization: CawAuthorization, amountUsdcMinor: number) {
  const repository = getCreditRepository();
  refreshAuthorizationWindows(authorization);
  authorization.spentTodayUsdcMinor += amountUsdcMinor;
  authorization.spentMonthUsdcMinor += amountUsdcMinor;
  await repository.updateAuthorization(authorization);
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

export const pricing = {
  creditsPerUsdc: CREDITS_PER_USDC
};
