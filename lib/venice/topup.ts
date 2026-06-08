import { runCawFetchX402 } from "@/lib/caw/cli";
import { BASE_CHAIN, getConfiguredChain } from "@/lib/domain/constants";
import type { CawAuthorization, User } from "@/lib/domain/types";
import { getCreditRepository } from "@/lib/store";
import { getVeniceBaseUrl } from "@/lib/venice/client";

const VENICE_X402_TOPUP_PATH = "/api/v1/x402/top-up";
const BASE_MAINNET_NETWORK = "eip155:8453";

export type VeniceX402Accept = {
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

export type VeniceX402Requirements = {
  x402Version?: number;
  accepts: VeniceX402Accept[];
  error?: string;
  resource?: unknown;
  authOptions?: unknown;
};

export async function discoverVeniceX402Requirements() {
  const response = await fetch(`${getVeniceBaseUrl()}${VENICE_X402_TOPUP_PATH}`, {
    method: "POST",
    cache: "no-store"
  });
  if (response.status !== 402) {
    throw new Error(`Expected Venice x402 top-up to return 402, got ${response.status}.`);
  }
  const body = (await response.json()) as VeniceX402Requirements;
  if (!Array.isArray(body.accepts) || body.accepts.length === 0) {
    throw new Error("Venice x402 top-up returned no accepted payment methods.");
  }
  return body;
}

export function pickVeniceBaseUsdcAccept(requirements: VeniceX402Requirements) {
  const match = requirements.accepts.find(
    (accept) =>
      accept.network === BASE_MAINNET_NETWORK &&
      accept.asset.toLowerCase() === BASE_CHAIN.usdcAddress.toLowerCase()
  );
  if (!match) {
    throw new Error("Venice did not offer a Base mainnet USDC x402 payment option.");
  }
  return match;
}

export async function runVeniceX402Topup(input: {
  userId: string;
  amountUsdcMinor: number;
}) {
  assertBaseMainnet();
  const repository = getCreditRepository();
  const user = await repository.requireUser(input.userId);
  const onboarding = await repository.getCawOnboardingSession(input.userId);
  if (onboarding?.status !== "wallet_active") {
    throw new Error("Venice x402 top-up requires this user's CAW CLI wallet profile.");
  }
  const authorization = await repository.getActiveAuthorization(input.userId, "venice_x402");
  if (authorization) {
    refreshAuthorizationWindows(authorization);
  }
  validateTopupReadiness(user, authorization, input.amountUsdcMinor);
  const requirements = await discoverVeniceX402Requirements();
  const accept = pickVeniceBaseUsdcAccept(requirements);
  const result = await runCawFetchX402({
    userId: input.userId,
    pactId: authorization.pactId,
    url: `${getVeniceBaseUrl()}${VENICE_X402_TOPUP_PATH}`,
    network: accept.network,
    maxAmountMinor: input.amountUsdcMinor,
    body: {
      usdAmount: input.amountUsdcMinor / 1_000_000,
      minorUnits: input.amountUsdcMinor
    }
  });
  const responseStatus = parseHttpStatus(result.stdout);

  if (result.exitCode !== 0) {
    throw new Error(
      `Venice x402 top-up failed: ${redact(result.stderr || result.stdout).slice(0, 800)}`
    );
  }
  if (!responseStatus || responseStatus < 200 || responseStatus >= 300) {
    throw new Error(
      `Venice x402 top-up returned HTTP ${responseStatus || "unknown"}: ${redact(result.stdout).slice(0, 800)}`
    );
  }

  refreshAuthorizationWindows(authorization);
  authorization.spentTodayUsdcMinor += input.amountUsdcMinor;
  authorization.spentMonthUsdcMinor += input.amountUsdcMinor;
  await repository.updateAuthorization(authorization);

  return {
    ok: true,
    responseStatus,
    requirements,
    selected: accept,
    amountUsdcMinor: input.amountUsdcMinor,
    responsePreview: redact(result.stdout).slice(0, 1200),
    snapshot: await repository.snapshotForUser(input.userId)
  };
}

function assertBaseMainnet() {
  const chain = getConfiguredChain();
  if (chain.id !== 8453) {
    throw new Error("Venice x402 top-up uses real Base mainnet USDC. Set CHAIN_ENV=base-mainnet before executing.");
  }
}

function validateTopupReadiness(
  user: User,
  authorization: CawAuthorization | undefined,
  amountUsdcMinor: number
): asserts authorization is CawAuthorization {
  if (!user.cawWalletId || !user.cawWalletAddress) {
    throw new Error("Create and bind this user's CAW wallet before using Venice x402 top-up.");
  }
  if (!authorization || authorization.status !== "active") {
    throw new Error("Create and approve an active Venice x402 CAW Pact before using Venice x402 top-up.");
  }
  if (authorization.purpose !== "venice_x402") {
    throw new Error("The active Pact is not scoped for Venice x402 top-up.");
  }
  if (authorization.pactId.startsWith("mock_")) {
    throw new Error("Mock Pact cannot be used for a real Venice x402 top-up.");
  }
  if (Date.parse(authorization.expiresAt) <= Date.now()) {
    throw new Error("The active CAW Pact is expired. Create and approve a new Pact first.");
  }
  if (authorization.singleLimitUsdcMinor < amountUsdcMinor) {
    throw new Error("The requested Venice top-up exceeds the Pact single-payment limit.");
  }
  if (authorization.dailyLimitUsdcMinor - authorization.spentTodayUsdcMinor < amountUsdcMinor) {
    throw new Error("The active CAW Pact has no remaining daily spend for this Venice top-up.");
  }
  if (authorization.monthlyLimitUsdcMinor - authorization.spentMonthUsdcMinor < amountUsdcMinor) {
    throw new Error("The active CAW Pact has no remaining monthly spend for this Venice top-up.");
  }
}

function refreshAuthorizationWindows(authorization: CawAuthorization) {
  const now = new Date();
  const dailyStart = new Date(authorization.dailyWindowStart);
  if (Number.isNaN(dailyStart.getTime()) || now.getTime() - dailyStart.getTime() >= 24 * 60 * 60 * 1000) {
    authorization.spentTodayUsdcMinor = 0;
    authorization.dailyWindowStart = now.toISOString();
  }

  const monthKey = now.toISOString().slice(0, 7);
  if (authorization.monthlyWindowStart.slice(0, 7) !== monthKey) {
    authorization.spentMonthUsdcMinor = 0;
    authorization.monthlyWindowStart = now.toISOString();
  }
}

function parseHttpStatus(output: string) {
  const firstLine = output.split("\n")[0]?.trim() ?? "";
  const direct = firstLine.match(/^(\d{3})\b/);
  if (direct) {
    return Number(direct[1]);
  }
  const http = firstLine.match(/^HTTP\/\S+\s+(\d{3})\b/);
  return http ? Number(http[1]) : undefined;
}

function redact(value: string) {
  return value.replace(/(api[_-]?key|token|secret|password|authorization)["'=:\s]+[^"',\s}]+/gi, "$1=[redacted]");
}
