import { getCawRuntimeStatus } from "@/lib/caw/gateway";
import { draftCawPactFromIntent } from "@/lib/caw/pact-drafter";
import {
  CREDITS_PER_USDC,
  DEFAULT_SPEND_POLICY,
  DEMO_CAW_WALLET,
  DEMO_USER_ID,
  getConfiguredCawChainId,
  getConfiguredChain
} from "@/lib/domain/constants";
import { creditsToUsdcMinor } from "@/lib/domain/money";
import type { CawAuthorization, CawPairingSession, TopupOrder } from "@/lib/domain/types";
import { getCreditRepository } from "@/lib/store";
import { createPublicClient, encodeFunctionData, formatUnits, getAddress, http } from "viem";
import { base, baseSepolia } from "viem/chains";

type AutoTopupReason = "low_balance" | "insufficient_balance" | "manual";

export type CawPactPreview = {
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

export async function getDashboardSnapshot(userId = DEMO_USER_ID) {
  return getCreditRepository().snapshotForUser(userId);
}

export async function getCawIntegrationStatus(userId = DEMO_USER_ID) {
  const [runtime, snapshot] = await Promise.all([
    getCawRuntimeStatus(),
    getDashboardSnapshot(userId)
  ]);
  const activeAuthorization = snapshot.authorization?.status === "active";
  const missing = [...runtime.missing];
  const readinessMissing: string[] = [];
  const requiredUsdcMinor = creditsToUsdcMinor(snapshot.account.autoTopupCredits);
  const remainingUsdcMinor = snapshot.pactDetails?.remainingUsdcMinor ?? 0;
  const expiresAt = snapshot.authorization?.expiresAt;

  if (!snapshot.user.cawWalletAddress) {
    missing.push("connected CAW wallet address");
  }
  if (
    runtime.mode === "http" &&
    runtime.walletAddress &&
    snapshot.user.cawWalletAddress &&
    runtime.walletAddress.toLowerCase() !== snapshot.user.cawWalletAddress.toLowerCase()
  ) {
    missing.push("connected wallet does not match CAW runtime wallet");
  }
  if (!activeAuthorization) {
    missing.push("active Pact authorization");
  }
  if (runtime.mode === "http" && snapshot.authorization?.pactId.startsWith("mock_")) {
    missing.push("real CAW Pact authorization");
  }
  if (activeAuthorization && expiresAt && Date.parse(expiresAt) <= Date.now()) {
    readinessMissing.push("Pact authorization expired");
  }
  if (activeAuthorization && remainingUsdcMinor < requiredUsdcMinor) {
    readinessMissing.push("Pact remaining spend below next payment");
  }

  const onchainReadiness =
    runtime.mode === "http" &&
    runtime.walletAddress &&
    snapshot.user.cawWalletAddress &&
    process.env.PAYMENT_CONTRACT_ADDRESS
      ? await getOnchainSpendReadiness({
          walletAddress: snapshot.user.cawWalletAddress,
          paymentContractAddress: process.env.PAYMENT_CONTRACT_ADDRESS,
          requiredUsdcMinor
        })
      : undefined;

  if (onchainReadiness?.error) {
    readinessMissing.push("on-chain readiness check unavailable");
  }
  if (onchainReadiness && !onchainReadiness.error) {
    if ((onchainReadiness.allowanceUsdcMinor ?? 0) < requiredUsdcMinor) {
      readinessMissing.push("USDC allowance below next payment");
    }
    if ((onchainReadiness.walletUsdcMinor ?? 0) < requiredUsdcMinor) {
      readinessMissing.push("USDC balance below next payment");
    }
    if ((onchainReadiness.gasEthWei ?? 0n) <= 0n) {
      readinessMissing.push("Base Sepolia ETH gas balance missing");
    }
  }

  const cawConfigured = missing.length === 0;
  const paymentMissing = [...missing, ...readinessMissing];

  return {
    runtime,
    app: {
      connectedWalletAddress: snapshot.user.cawWalletAddress,
      authorizationStatus: snapshot.authorization?.status ?? "missing",
      pactId: snapshot.authorization?.pactId,
      activeAuthorization
    },
    spendReadiness: {
      requiredUsdcMinor,
      remainingUsdcMinor,
      pactExpiresAt: expiresAt,
      allowanceUsdcMinor: onchainReadiness?.allowanceUsdcMinor,
      walletUsdcMinor: onchainReadiness?.walletUsdcMinor,
      gasEth: onchainReadiness?.gasEth,
      error: onchainReadiness?.error
    },
    cawConfigured,
    readyForRealPayment: paymentMissing.length === 0,
    missing: paymentMissing,
    configurationMissing: missing,
    paymentMissing: readinessMissing
  };
}

async function getOnchainSpendReadiness(input: {
  walletAddress: string;
  paymentContractAddress: string;
  requiredUsdcMinor: number;
}) {
  try {
    const chainConfig = getConfiguredChain();
    const viemChain = process.env.CHAIN_ENV === "base-mainnet" ? base : baseSepolia;
    const rpcUrl =
      process.env.BASE_RPC_URL ||
      (process.env.CHAIN_ENV === "base-mainnet" ? "https://mainnet.base.org" : "https://sepolia.base.org");
    const client = createPublicClient({
      chain: viemChain,
      transport: http(rpcUrl)
    });
    const erc20Abi = [
      {
        type: "function",
        name: "balanceOf",
        stateMutability: "view",
        inputs: [{ name: "account", type: "address" }],
        outputs: [{ type: "uint256" }]
      },
      {
        type: "function",
        name: "allowance",
        stateMutability: "view",
        inputs: [
          { name: "owner", type: "address" },
          { name: "spender", type: "address" }
        ],
        outputs: [{ type: "uint256" }]
      }
    ] as const;
    const walletAddress = getAddress(input.walletAddress);
    const paymentContractAddress = getAddress(input.paymentContractAddress);
    const usdcAddress = getAddress(chainConfig.usdcAddress);
    const [gasEthWei, walletUsdc, allowanceUsdc] = await Promise.all([
      client.getBalance({ address: walletAddress }),
      client.readContract({
        address: usdcAddress,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [walletAddress]
      }),
      client.readContract({
        address: usdcAddress,
        abi: erc20Abi,
        functionName: "allowance",
        args: [walletAddress, paymentContractAddress]
      })
    ]);

    return {
      gasEthWei,
      gasEth: formatUnits(gasEthWei, 18),
      walletUsdcMinor: Number(walletUsdc),
      allowanceUsdcMinor: Number(allowanceUsdc)
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "unknown on-chain readiness error"
    };
  }
}

export async function createPairingCode(input: { userId?: string }) {
  const repository = getCreditRepository();
  const userId = input.userId ?? DEMO_USER_ID;
  await repository.requireUser(userId);
  // Use caw CLI instead of SDK (Node.js HTTPS → TLS failure with 198.18.x.x DNS)
  const HOME = process.env.HOME || "/root";
  const { execSync } = eval('require')('child_process') as typeof import("child_process");
  const rawJson = execSync(`HOME=${HOME} caw wallet pair`, {
    timeout: 15000,
    encoding: "utf-8"
  });
  const parsed = JSON.parse(rawJson) as {
    token?: string;
    expires_at?: string;
    status?: string;
  };
  const session = await repository.createPairingSession(userId, {
    code: parsed.token ?? "",
    status: "generated" as const,
    expiresAt: parsed.expires_at ?? repository.nowIso(),
    createdAt: repository.nowIso()
  });

  return {
    pairingSession: session,
    snapshot: await repository.snapshotForUser(userId)
  };
}

/**
 * R1.4 pair-complete: query the upstream CAW service for the latest
 * pair-claim status, then mirror it into the local CawPairingSession row.
 *
 * Mapping (SDK token_status → project CawPairingSession.status):
 *   valid       → generated  (user has not yet typed code in Cobo App)
 *   paired      → paired     (human confirmed; reshare may still be pending)
 *   completed   → paired     (final state — first pair flow finished)
 *   expired     → expired    (30-minute TTL elapsed)
 *   not_found   → no change  (no pending claim row exists upstream)
 *
 * Always returns the current local session. When the row is already in a
 * terminal state (paired/expired) we skip the upstream call to avoid
 * burning API quota on a known-finished flow.
 */
export async function refreshPairingStatus(input: { userId?: string }) {
  const repository = getCreditRepository();
  const userId = input.userId ?? DEMO_USER_ID;
  await repository.requireUser(userId);

  const existing = (await repository.snapshotForUser(userId)).pairingSession;
  if (!existing) {
    // No local row → nothing to refresh. The dashboard only shows the pair
    // card after the user clicks "Generate Pairing Code", which creates the
    // row. Polling this endpoint before that point is a no-op.
    return { pairingSession: null, snapshot: await repository.snapshotForUser(userId) };
  }
  if (existing.status === "paired" || existing.status === "expired") {
    return { pairingSession: existing, snapshot: await repository.snapshotForUser(userId) };
  }

  // Use caw CLI instead of SDK (Node.js HTTPS → TLS failure with 198.18.x.x DNS)
  let upstreamStatus: "generated" | "paired" | "expired" | "not_found" = "not_found";
  let token: string | undefined;
  try {
    const { execSync } = eval('require')('child_process') as typeof import("child_process");
    const HOME = process.env.HOME || "/root";
    const rawJson = execSync(`HOME=${HOME} caw wallet pair-status`, {
      timeout: 10000,
      encoding: "utf-8"
    });
    const parsed = JSON.parse(rawJson) as {
      token_status?: string;
      token?: string;
    };
    const rawStatus = (parsed.token_status ?? "").toLowerCase();
    upstreamStatus =
      rawStatus === "valid"
        ? "generated"
        : rawStatus === "paired" || rawStatus === "completed"
          ? "paired"
          : rawStatus === "expired"
            ? "expired"
            : "not_found";
    token = parsed.token;
  } catch {
    upstreamStatus = "not_found";
  }
  let nextSession = existing;
  if (upstreamStatus !== "not_found") {
    nextSession = await repository.createPairingSession(userId, {
      code: token ?? existing.code,
      status: upstreamStatus as CawPairingSession["status"],
      expiresAt: existing.expiresAt,
      createdAt: existing.createdAt
    });
  }

  return {
    pairingSession: nextSession,
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
  // Use caw CLI instead of SDK
  const { execSync } = eval('require')('child_process') as typeof import("child_process");
  const HOME = process.env.HOME || "/root";
  const currentJson = execSync(`HOME=${HOME} caw wallet current`, {
    timeout: 10000, encoding: "utf-8"
  });
  const current = JSON.parse(currentJson) as { wallet_uuid?: string; wallet_name?: string };
  const walletId = current.wallet_uuid ?? "";
  const balanceJson = execSync(`HOME=${HOME} caw wallet balance --limit 5`, {
    timeout: 10000, encoding: "utf-8"
  });
  const balanceData = JSON.parse(balanceJson) as {
    result?: Array<{ address?: string; chain_id?: string }>;
  };
  const addresses = balanceData?.result ?? [];
  const evmAddress = addresses.find((a) => (a.address ?? "").startsWith("0x"));
  const resolvedAddress = evmAddress?.address ?? walletAddress;
  const connection = {
    connectionId: walletId,
    walletId,
    walletAddress: resolvedAddress
  };
  const existing = await repository.findUserByCawWalletAddress(connection.walletAddress);
  if (existing && existing.id !== user.id) {
    throw new Error(`This CAW wallet is already bound to ${existing.email}.`);
  }

  await repository.updateUser({
    ...user,
    cawWalletId: connection.walletId,
    cawWalletAddress: connection.walletAddress
  });

  return {
    connection,
    snapshot: await repository.snapshotForUser(userId)
  };
}

export async function createCawAuthorization(input: {
  userId?: string;
  intent?: string;
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
  const { preview } = await previewCawAuthorization(input);
  const expiresAt = new Date(
    Date.now() + (input.validDays ?? DEFAULT_SPEND_POLICY.validDays) * 24 * 60 * 60 * 1000
  ).toISOString();
  // Use caw CLI instead of SDK
  const { execSync } = eval('require')('child_process') as typeof import("child_process");
  const HOME = process.env.HOME || "/root";
  const shj = (s: string) => s.replace(/[\\"$`]/g, "\\$&").replace(/\n/g, "\\n");
  const policiesJson = JSON.stringify(preview.policies);
  const conditionsJson = JSON.stringify(preview.completionConditions);
  const cmd = `HOME=${HOME} caw pact submit` +
    ` --intent "${shj(preview.intent)}"` +
    ` --original-intent "${shj(preview.originalIntent)}"` +
    ` --policies '${policiesJson.replace(/'/g, "'\\''")}'` +
    ` --completion-conditions '${conditionsJson.replace(/'/g, "'\\''")}'` +
    ` --execution-plan "${shj(preview.executionPlan)}"`;
  const rawJson = execSync(cmd, { timeout: 20000, encoding: "utf-8" });
  const pactData = JSON.parse(rawJson) as {
    result?: { pact_id?: string; status?: string };
  };
  const pactResult = pactData?.result ?? {};
  const pact = {
    pactId: pactResult.pact_id ?? "",
    status: pactResult.status === "active" ? ("active" as const) : ("pending_user_approval" as const),
    pactApiKey: undefined as string | undefined
  };

  const authorization: CawAuthorization = {
    id: repository.createId("auth"),
    userId,
    walletAddress,
    pactId: pact.pactId,
    pactApiKey: pact.pactApiKey,
    status: pact.status,
    singleLimitUsdcMinor: preview.limits.singleLimitUsdcMinor,
    dailyLimitUsdcMinor: preview.limits.dailyLimitUsdcMinor,
    monthlyLimitUsdcMinor: preview.limits.monthlyLimitUsdcMinor,
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
    preview,
    snapshot: await repository.snapshotForUser(userId)
  };
}

export async function previewCawAuthorization(input: {
  userId?: string;
  intent?: string;
  singleLimitUsdcMinor?: number;
  dailyLimitUsdcMinor?: number;
  monthlyLimitUsdcMinor?: number;
  validDays?: number;
}): Promise<{ preview: CawPactPreview }> {
  const repository = getCreditRepository();
  const userId = input.userId ?? DEMO_USER_ID;
  const user = await repository.requireUser(userId);
  const walletAddress = user.cawWalletAddress ?? DEMO_CAW_WALLET;
  const chain = getConfiguredChain();
  const coboChainId = getConfiguredCawChainId();
  const contractAddress = resolvePaymentContractAddress();

  if (!contractAddress) {
    throw new Error("PAYMENT_CONTRACT_ADDRESS is required to preview a real CAW Pact. Set it in .env or deploy the CreditsPayment contract via `npm run contract:deploy`.");
  }

  const limits = {
    singleLimitUsdcMinor: input.singleLimitUsdcMinor ?? DEFAULT_SPEND_POLICY.singleLimitUsdcMinor,
    dailyLimitUsdcMinor: input.dailyLimitUsdcMinor ?? DEFAULT_SPEND_POLICY.dailyLimitUsdcMinor,
    monthlyLimitUsdcMinor:
      input.monthlyLimitUsdcMinor ?? DEFAULT_SPEND_POLICY.monthlyLimitUsdcMinor,
    validDays: input.validDays ?? DEFAULT_SPEND_POLICY.validDays
  };
  const userIntent =
    input.intent?.trim() ||
    "Allow this agent to automatically top up my internal credits with Base Sepolia USDC when the balance is low.";
  const draft = await draftCawPactFromIntent({
    intent: userIntent,
    context: {
      walletAddress,
      chainName: chain.name,
      cawChainId: coboChainId,
      usdcAddress: chain.usdcAddress,
      paymentContractAddress: contractAddress,
      limits
    }
  });

  return {
    preview: {
      intent: draft.intent,
      originalIntent: draft.originalIntent,
      executionPlan: draft.executionPlan,
      policies: draft.policies,
      completionConditions: draft.completionConditions,
      draftedBy: draft.draftedBy,
      warnings: draft.warnings,
      limits: draft.limits
    }
  };
}

export async function refreshCawAuthorization(input: { userId?: string }) {
  const repository = getCreditRepository();
  const userId = input.userId ?? DEMO_USER_ID;
  const authorization = await repository.getActiveAuthorization(userId);
  if (!authorization) {
    throw new Error("No CAW authorization to refresh.");
  }

  // Use caw CLI instead of the Node.js SDK because Node.js HTTPS
  // cannot reach the CAW API (DNS resolves to a local proxy IP
  // 198.18.x.x that Node.js cannot connect to, while the Go-based
  // caw CLI works fine).
  const { execSync } = eval('require')('child_process') as typeof import("child_process");
  const CAW_HOME = process.env.HOME || "/root";
  const pactStatusJson = execSync(`HOME=${CAW_HOME} caw pact list --status active,completed,expired,rejected,revoked,withdrawn,pending_approval --limit 50`, {
    timeout: 15000,
    encoding: "utf-8",
    env: { ...process.env, HOME: CAW_HOME }
  });
  const pactData = JSON.parse(pactStatusJson) as {
    result?: { pacts?: Array<Record<string, unknown>> };
  };
  const pacts = pactData?.result?.pacts ?? [];
  const matched = pacts.find((p) => String(p.id ?? "") === authorization.pactId);

  if (!matched) {
    // Pact not found — maybe revoked/expired on the CAW side
    return {
      authorization: {
        ...authorization,
        status: "revoked" as const
      },
      snapshot: await repository.snapshotForUser(userId)
    };
  }

  const rawStatus = String(matched.status ?? "").toLowerCase();
  const newStatus: CawAuthorization["status"] =
    rawStatus === "active"
      ? "active"
      : rawStatus === "expired" || rawStatus === "completed"
        ? "expired"
        : rawStatus === "revoked" || rawStatus === "rejected"
          ? "revoked"
          : "pending_user_approval";

  const updated = await repository.updateAuthorization({
    ...authorization,
    status: newStatus,
    pactApiKey: authorization.pactApiKey
  });

  return {
    authorization: updated,
    snapshot: await repository.snapshotForUser(userId)
  };
}

export async function approveUsdcForCreditsPayment(input: {
  userId?: string;
  amountUsdcMinor?: number;
}) {
  const repository = getCreditRepository();
  const userId = input.userId ?? DEMO_USER_ID;
  const user = await repository.requireUser(userId);
  const account = await repository.requireCreditAccount(userId);
  const authorization = await repository.getActiveAuthorization(userId);
  const amountUsdcMinor = input.amountUsdcMinor ?? creditsToUsdcMinor(account.autoTopupCredits);

  if (!user.cawWalletAddress) {
    throw new Error("Connect the real CAW wallet before approving USDC.");
  }
  if (!authorization || authorization.status !== "active") {
    throw new Error("Approve an active CAW Pact in Cobo App before approving USDC.");
  }
  if (Date.parse(authorization.expiresAt) <= Date.now()) {
    authorization.status = "expired";
    await repository.updateAuthorization(authorization);
    throw new Error("The active CAW Pact is expired. Create and approve a new Pact first.");
  }
  if (authorization.monthlyLimitUsdcMinor - authorization.spentMonthUsdcMinor < amountUsdcMinor) {
    throw new Error("The active CAW Pact has no remaining spend for this approval. Create and approve a new Pact first.");
  }

  const runtime = await getCawRuntimeStatus();
  if (runtime.mode !== "http") {
    throw new Error("USDC approval requires real CAW mode.");
  }
  if (authorization.pactId.startsWith("mock_")) {
    throw new Error("Mock Pact cannot approve real USDC.");
  }

  const readiness = await getOnchainSpendReadiness({
    walletAddress: user.cawWalletAddress,
    paymentContractAddress: requiredPaymentContractAddress(),
    requiredUsdcMinor: amountUsdcMinor
  });
  if (readiness.error) {
    throw new Error(`Unable to check on-chain USDC allowance: ${readiness.error}`);
  }
  if ((readiness.walletUsdcMinor ?? 0) < amountUsdcMinor) {
    throw new Error("CAW wallet USDC balance is below the requested approval amount.");
  }
  if ((readiness.gasEthWei ?? 0n) <= 0n) {
    throw new Error("CAW wallet needs Base Sepolia ETH for gas before approving USDC.");
  }
  if ((readiness.allowanceUsdcMinor ?? 0) >= amountUsdcMinor) {
    return {
      status: "already_approved" as const,
      allowanceUsdcMinor: readiness.allowanceUsdcMinor,
      snapshot: await repository.snapshotForUser(userId)
    };
  }

  const { execSync } = eval('require')('child_process') as typeof import("child_process");
  const HOME = process.env.HOME || "/root";
  const calldata = encodeFunctionData({
    abi: [
      {
        type: "function",
        name: "approve",
        stateMutability: "nonpayable",
        inputs: [
          { name: "spender", type: "address" },
          { name: "amount", type: "uint256" }
        ],
        outputs: [{ type: "bool" }]
      }
    ],
    functionName: "approve",
    args: [
      getAddress(requiredPaymentContractAddress()) as `0x${string}`,
      BigInt(amountUsdcMinor)
    ]
  });
  const chainId = getConfiguredCawChainId();
  const txJson = execSync(
    `HOME=${HOME} caw tx call` +
    ` --pact-id "${authorization.pactId}"` +
    ` --contract "${getConfiguredChain().usdcAddress}"` +
    ` --calldata "${calldata}"` +
    ` --chain-id "${chainId}"` +
    ` --src-address "${user.cawWalletAddress}"` +
    ` --request-id "approve-usdc-${Date.now()}"` +
    ` --description "Approve USDC for CreditsPayment ${amountUsdcMinor}"`,
    { timeout: 30000, encoding: "utf-8" }
  );
  const txResult = JSON.parse(txJson) as { id?: string; status?: string };
  const result = {
    txHash: txResult.id ?? "",
    status: txResult.status === "Confirmed" ? ("confirmed" as const) : ("submitted" as const)
  };

  return {
    status: result.status,
    txHash: result.txHash,
    amountUsdcMinor,
    snapshot: await repository.snapshotForUser(userId)
  };
}

export async function requestTestTokens(input: { userId?: string; tokenId?: string }) {
  const repository = getCreditRepository();
  const userId = input.userId ?? DEMO_USER_ID;
  const user = await repository.requireUser(userId);
  const walletAddress = user.cawWalletAddress ?? DEMO_CAW_WALLET;
  const { execSync } = eval('require')('child_process') as typeof import("child_process");
  const HOME = process.env.HOME || "/root";
  const tokenId = input.tokenId ?? "SETH_USDC1";
  const rawJson = execSync(
    `HOME=${HOME} caw faucet deposit -a ${walletAddress} -t ${tokenId}`,
    { timeout: 20000, encoding: "utf-8" }
  );
  const parsed = JSON.parse(rawJson) as {
    address?: string;
    token_id?: string;
    amount?: string;
  };

  return {
    faucet: {
      address: parsed.address ?? walletAddress,
      tokenId: parsed.token_id ?? tokenId,
      amount: parsed.amount ?? "0"
    },
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
  return executeCreditsTopup({
    userId: input.userId,
    reason: input.reason,
    skipIfBalanceAboveThreshold: input.reason === undefined || input.reason === "low_balance"
  });
}

export async function executeCreditsTopup(input: {
  userId?: string;
  reason?: AutoTopupReason;
  amountUsdcMinor?: number;
  credits?: number;
  skipIfBalanceAboveThreshold?: boolean;
}) {
  const repository = getCreditRepository();
  const userId = input.userId ?? DEMO_USER_ID;
  const reason = input.reason ?? "low_balance";
  const user = await repository.requireUser(userId);
  const account = await repository.requireCreditAccount(userId);

  if (input.skipIfBalanceAboveThreshold && account.balanceCredits >= account.lowBalanceThresholdCredits) {
    return {
      status: "skipped" as const,
      reason: "balance_above_threshold",
      snapshot: await repository.snapshotForUser(userId)
    };
  }

  const existingPending = await repository.findPendingTopupOrder(userId);

  if (existingPending) {
    if (isStalePolicyPendingOrder(existingPending)) {
      existingPending.status = "failed";
      existingPending.failureReason = "stale_pending_policy_order";
      existingPending.updatedAt = repository.nowIso();
      await repository.updateTopupOrder(existingPending);
    } else {
      return {
        status: "pending" as const,
        order: existingPending,
        snapshot: await repository.snapshotForUser(userId)
      };
    }
  }

  const freshPending = await repository.findPendingTopupOrder(userId);

  if (freshPending) {
    return {
      status: "pending" as const,
      order: freshPending,
      snapshot: await repository.snapshotForUser(userId)
    };
  }

  const credits = input.credits ?? account.autoTopupCredits;
  const amountUsdcMinor = input.amountUsdcMinor ?? creditsToUsdcMinor(credits);
  const policy = await checkAuthorizationPolicy(userId, amountUsdcMinor);

  if (!policy.ok) {
    const failedOrder = await repository.createTopupOrder({
      userId,
      walletAddress: user.cawWalletAddress ?? DEMO_CAW_WALLET,
      amountUsdcMinor,
      credits,
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

  const preflight = await checkRealPaymentPreflight({
    userId,
    walletAddress: policy.authorization.walletAddress,
    pactId: policy.authorization.pactId,
    amountUsdcMinor
  });

  if (!preflight.ok) {
    return {
      status: "blocked" as const,
      reason: preflight.reason,
      snapshot: await repository.snapshotForUser(userId)
    };
  }

  const order = await repository.createTopupOrder({
    userId,
    walletAddress: policy.authorization.walletAddress,
    amountUsdcMinor,
    credits,
    reason,
    status: "pending_policy"
  });

  const chain = getConfiguredChain();
  const { execSync } = eval('require')('child_process') as typeof import("child_process");
  const HOME = process.env.HOME || "/root";
  const buyCalldata = encodeFunctionData({
    abi: [
      {
        type: "function",
        name: "buyCredits",
        stateMutability: "nonpayable",
        inputs: [
          { name: "orderId", type: "bytes32" },
          { name: "creditAccount", type: "address" },
          { name: "amountUsdc", type: "uint256" }
        ],
        outputs: []
      }
    ],
    functionName: "buyCredits",
    args: [
      order.onchainOrderId as `0x${string}`,
      policy.authorization.walletAddress as `0x${string}`,
      BigInt(amountUsdcMinor)
    ]
  });
  const cawChainId = getConfiguredCawChainId();
  const cawJson = execSync(
    `HOME=${HOME} caw tx call` +
    ` --pact-id "${policy.authorization.pactId}"` +
    ` --contract "${resolvePaymentContractAddress()}"` +
    ` --calldata "${buyCalldata}"` +
    ` --chain-id "${cawChainId}"` +
    ` --src-address "${policy.authorization.walletAddress}"` +
    ` --request-id "${order.orderId}"` +
    ` --description "Agent credits top-up ${order.orderId}"`,
    { timeout: 30000, encoding: "utf-8" }
  );
  const cawResultParsed = JSON.parse(cawJson) as { id?: string; status?: string };
  const cawResult = {
    txHash: cawResultParsed.id ?? "",
    status: cawResultParsed.status === "Confirmed" ? ("confirmed" as const) : ("submitted" as const),
    mockConfirmed: false
  };

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

const EXPIRABLE_TOPUP_STATUSES: TopupOrder["status"][] = [
  "pending_policy",
  "pending_approval",
  "caw_submitted",
  "chain_pending"
];

export const STALE_TOPUP_TIMEOUT_MS = 30 * 60 * 1000;

export async function expireStaleTopupOrders(input: {
  timeoutMs?: number;
  nowMs?: number;
} = {}) {
  const repository = getCreditRepository();
  const timeoutMs = input.timeoutMs ?? STALE_TOPUP_TIMEOUT_MS;
  const nowMs = input.nowMs ?? Date.now();
  const cutoffIso = new Date(nowMs - timeoutMs).toISOString();

  const stale = await repository.listStaleTopupOrders({
    cutoffIso,
    statuses: EXPIRABLE_TOPUP_STATUSES
  });

  const expiredMinutes = Math.max(1, Math.round(timeoutMs / 60000));
  const expiredOrders: TopupOrder[] = [];
  const failed: { orderId: string; error: string }[] = [];

  for (const order of stale) {
    try {
      const next: TopupOrder = {
        ...order,
        status: "approval_expired",
        failureReason: `approval_timeout_after_${expiredMinutes}m`,
        updatedAt: repository.nowIso()
      };
      const persisted = await repository.updateTopupOrder(next);
      expiredOrders.push(persisted);
    } catch (error) {
      failed.push({
        orderId: order.orderId,
        error: error instanceof Error ? error.message : "unknown"
      });
    }
  }

  return {
    cutoffIso,
    timeoutMs,
    expiredCount: expiredOrders.length,
    failedCount: failed.length,
    expiredOrders,
    failed
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

async function checkRealPaymentPreflight(input: {
  userId: string;
  walletAddress: string;
  pactId: string;
  amountUsdcMinor: number;
}) {
  const runtime = await getCawRuntimeStatus();
  if (runtime.mode !== "http") {
    return { ok: true as const };
  }
  if (input.pactId.startsWith("mock_")) {
    return { ok: false as const, reason: "mock_pact_not_allowed_for_real_payment" };
  }
  if (!input.walletAddress) {
    return { ok: false as const, reason: "missing_caw_wallet_address" };
  }

  const readiness = await getOnchainSpendReadiness({
    walletAddress: input.walletAddress,
    paymentContractAddress: requiredPaymentContractAddress(),
    requiredUsdcMinor: input.amountUsdcMinor
  });

  if (readiness.error) {
    return { ok: false as const, reason: "onchain_readiness_unavailable" };
  }
  if ((readiness.walletUsdcMinor ?? 0) < input.amountUsdcMinor) {
    return { ok: false as const, reason: "insufficient_usdc_balance" };
  }
  if ((readiness.allowanceUsdcMinor ?? 0) < input.amountUsdcMinor) {
    return { ok: false as const, reason: "insufficient_usdc_allowance" };
  }
  if ((readiness.gasEthWei ?? 0n) <= 0n) {
    return { ok: false as const, reason: "insufficient_base_sepolia_eth_gas" };
  }

  return { ok: true as const };
}

function resolvePaymentContractAddress(): string {
  // 1) Explicit .env setting wins.
  const fromEnv = process.env.PAYMENT_CONTRACT_ADDRESS;
  if (fromEnv) return fromEnv;

  // 2) Smart default for Base Sepolia — the contract that was deployed
  //    during the initial project setup and is used by x402-client.js
  //    and all existing caw tx records.
  const chainEnv = process.env.CHAIN_ENV || "base-sepolia";
  const defaults: Record<string, string> = {
    "base-sepolia": "0x916ea4051f2c1815d286bd5c499756d68affeea5",
    // Add mainnet default here when deployed.
  };
  return defaults[chainEnv] ?? "";
}

function requiredPaymentContractAddress() {
  const address = resolvePaymentContractAddress();
  if (!address) {
    throw new Error("PAYMENT_CONTRACT_ADDRESS is required for real payments. Set it in .env or deploy the CreditsPayment contract.");
  }
  return address;
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

function isStalePolicyPendingOrder(order: { status: string; createdAt: string }) {
  if (order.status !== "pending_policy") {
    return false;
  }

  const createdAt = Date.parse(order.createdAt);
  if (Number.isNaN(createdAt)) {
    return false;
  }

  return Date.now() - createdAt > 30 * 1000;
}

export const pricing = {
  creditsPerUsdc: CREDITS_PER_USDC
};
