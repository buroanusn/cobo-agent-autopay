// BlockRun Pact services
// Reference implementation from lib/domain/services.ts createVeniceX402Authorization
// using the same Pact creation pattern but with blockrun_x402 scope and testnet/mainnet awareness

import { getCreditRepository } from "@/lib/store";
import { getBlockRunConfigInfo } from "@/lib/blockrun/topup";
import { submitCawCliPact, showCawCliPact } from "@/lib/caw/cli";
import type { CawAuthorization } from "@/lib/domain/types";
import type { DashboardSnapshot } from "@/lib/domain/types";

const DEMO_USER_ID = process.env.DEMO_USER_ID || "api";

type PactLimits = {
  singleLimitUsdcMinor: number;
  dailyLimitUsdcMinor: number;
  monthlyLimitUsdcMinor: number;
  validDays: number;
};

async function getCawWallet(userId: string) {
  const repo = getCreditRepository();
  const user = await repo.requireUser(userId);
  if (!user.cawWalletId || !user.cawWalletAddress) {
    throw new Error("Bind a CAW Wallet UUID to this user before running CAW operations.");
  }
  return { walletId: user.cawWalletId, walletAddress: user.cawWalletAddress };
}

function getNetworkLabel(network: string): string {
  if (network === "eip155:84532" || network === "TBASE_SETH") return "Base Sepolia (testnet)";
  if (network === "eip155:8453" || network === "BASE_ETH") return "Base Mainnet";
  return network;
}

async function snapshotForUser(userId: string): Promise<DashboardSnapshot> {
  const repo = getCreditRepository();
  return repo.snapshotForUser(userId);
}

export async function previewBlockRunX402Authorization(input: {
  userId?: string;
  amountUsdcMinor?: number;
  dailyLimitUsdcMinor?: number;
  monthlyLimitUsdcMinor?: number;
  validDays?: number;
}) {
  const userId = input.userId ?? DEMO_USER_ID;
  const repo = getCreditRepository();
  const user = await repo.requireUser(userId);
  const wallet = await getCawWallet(userId);

  const config = getBlockRunConfigInfo();
  const network = config.network;
  const cawChainId = config.cawChainId;
  const networkLabel = getNetworkLabel(network);
  const isTestnet = network === "eip155:84532" || network === "TBASE_SETH";

  const limits: PactLimits = {
    singleLimitUsdcMinor: input.amountUsdcMinor ?? 1_000_000, // 1 USDC
    dailyLimitUsdcMinor: input.dailyLimitUsdcMinor ?? 5_000_000, // 5 USDC
    monthlyLimitUsdcMinor: input.monthlyLimitUsdcMinor ?? 20_000_000, // 20 USDC
    validDays: input.validDays ?? 7,
  };

  const preview = {
    intent:
      `Authorize BlockRun x402 inferences on ${networkLabel} using USDC. ` +
      `Each inference is capped at $${(limits.singleLimitUsdcMinor / 1_000_000).toFixed(2)} USDC; ` +
      `total spend is capped at $${(limits.monthlyLimitUsdcMinor / 1_000_000).toFixed(2)} USDC while this Pact is valid.`,
    originalIntent:
      `Create a BlockRun x402 Pact for ${networkLabel} USDC. ` +
      `Network: ${network}. Scope: blockrun_x402.`,
    executionPlan: [
      `- Execute BlockRun x402 inference through CAW CLI with max amount ${limits.singleLimitUsdcMinor} minor USDC units.`,
      `- Selected network: ${network} (${networkLabel}).`,
      `- Refuse the payment if BlockRun requests a different chain or an amount above the configured cap.`,
    ].join("\n"),
    policies: [
      {
        name: "blockrun-x402-usdc",
        type: "contract_call",
        rules: {
          effect: "allow",
          when: {
            chain_in: [cawChainId],  // CAW Pact 用内部链名
          },
        },
        priority: 100,
        is_active: true,
      },
    ],
    completionConditions: [
      {
        type: "time_elapsed",
        threshold: String(limits.validDays * 24 * 60 * 60),
      },
      {
        type: "amount_spent_usd",
        threshold: (limits.monthlyLimitUsdcMinor / 1_000_000).toFixed(2),
      },
    ],
    draftedBy: "agent_deterministic",
    warnings: [
      `This Pact is for BlockRun x402 on ${networkLabel} only.`,
      isTestnet
        ? "Testnet USDC has no real value — safe for development."
        : "Mainnet USDC is real money. Double-check the limits before approving.",
    ],
    limits,
  };

  return {
    preview,
    authorization: await repo.getActiveAuthorization(userId, "blockrun_x402"),
    snapshot: await snapshotForUser(userId),
  };
}

export async function createBlockRunX402Authorization(input: {
  userId?: string;
  amountUsdcMinor?: number;
  dailyLimitUsdcMinor?: number;
  monthlyLimitUsdcMinor?: number;
  validDays?: number;
}) {
  const userId = input.userId ?? DEMO_USER_ID;
  const repo = getCreditRepository();
  const user = await repo.requireUser(userId);
  const wallet = await getCawWallet(userId);

  const config = getBlockRunConfigInfo();
  const network = config.network;
  const networkLabel = getNetworkLabel(network);

  const limits: PactLimits = {
    singleLimitUsdcMinor: input.amountUsdcMinor ?? 1_000_000,
    dailyLimitUsdcMinor: input.dailyLimitUsdcMinor ?? 5_000_000,
    monthlyLimitUsdcMinor: input.monthlyLimitUsdcMinor ?? 20_000_000,
    validDays: input.validDays ?? 7,
  };

  const { preview } = await previewBlockRunX402Authorization({ ...input, userId });

  const createdAt = repo.nowIso();
  const expiresAt = new Date(
    Date.now() + limits.validDays * 24 * 60 * 60 * 1000
  ).toISOString();

  const pactResult = await submitCawCliPact({
    userId,
    name: `BlockRun x402 ${networkLabel}`,
    intent: preview.intent,
    originalIntent: preview.originalIntent,
    executionPlan: preview.executionPlan,
    policies: preview.policies,
    completionConditions: preview.completionConditions,
  });

  const authorization: CawAuthorization = {
    id: repo.createId("auth"),
    userId,
    purpose: "blockrun_x402",
    walletAddress: wallet.walletAddress,
    pactId: pactResult.pactId,
    status: pactResult.status,
    singleLimitUsdcMinor: limits.singleLimitUsdcMinor,
    dailyLimitUsdcMinor: limits.dailyLimitUsdcMinor,
    monthlyLimitUsdcMinor: limits.monthlyLimitUsdcMinor,
    spentTodayUsdcMinor: 0,
    spentMonthUsdcMinor: 0,
    dailyWindowStart: createdAt,
    monthlyWindowStart: createdAt,
    expiresAt,
    createdAt,
  };

  await repo.createAuthorization(authorization);

  return {
    authorization,
    preview,
    snapshot: await snapshotForUser(userId),
  };
}

export async function refreshBlockRunX402Authorization(input: { userId?: string }) {
  const userId = input.userId ?? DEMO_USER_ID;
  const repo = getCreditRepository();
  const authorization = await repo.getActiveAuthorization(userId, "blockrun_x402");
  if (!authorization) {
    throw new Error("No BlockRun x402 CAW authorization to refresh.");
  }

  const pact = await showCawCliPact({ userId, pactId: authorization.pactId });
  const updated = await repo.updateAuthorization({
    ...authorization,
    status: pact.status,
  });

  return {
    authorization: updated,
    snapshot: await snapshotForUser(userId),
  };
}
