// Venice x402 top-up via caw fetch.
// 1. Discover payment requirements: POST /x402/top-up without X-402-Payment header
//    -> returns 402 with accepts[] (Base/Solana USDC options)
// 2. Pay via caw fetch (which handles the x402 challenge automatically using the
//    wallet bound to the active pact).
//
// This is the x402 native path: agent pays USDC from the CAW wallet, Venice
// credits the corresponding balance. No Venice API key required for the credit
// balance side; SIWE auth is bypassed because payment itself proves identity.

import { spawn } from "node:child_process";
import { getCawRuntimeStatus } from "@/lib/caw/gateway";
import { getCreditRepository } from "@/lib/store";
import { createInferenceLog } from "@/lib/store/venice";
import { nowIso } from "@/lib/store/memory";
import type { VeniceX402TopupRequest, VeniceX402TopupResult } from "@/lib/venice/types";
import { getVeniceBaseUrl } from "@/lib/config/store";

const VENICE_X402_TOPUP_PATH = "/api/v1/x402/top-up";

type X402PaymentRequirementV2 = {
  x402Version: 2;
  accepts: Array<{
    protocol: "x402";
    version: 2;
    network: "eip155:8453" | "solana" | string;
    asset: string;
    amount: string;
    payTo: string;
    extra?: {
      name?: string;
      version?: string;
      feePayer?: string;
    };
  }>;
  error?: string;
  resource?: { url?: string; description?: string; mimeType?: string };
  authOptions?: { apiKey?: { header?: string; docs?: string } };
};

export async function discoverVeniceX402Requirements(): Promise<X402PaymentRequirementV2> {
  const url = `${getVeniceBaseUrl()}${VENICE_X402_TOPUP_PATH}`;
  const res = await fetch(url, { method: "POST", cache: "no-store" });
  if (res.status !== 402) {
    throw new Error(`Expected 402 from Venice ${VENICE_X402_TOPUP_PATH}, got ${res.status}`);
  }
  const body = (await res.json()) as X402PaymentRequirementV2;
  if (!body.accepts || body.accepts.length === 0) {
    throw new Error("Venice /api/v1/x402/top-up returned 402 with no accepts[] options");
  }
  return body;
}

export function pickBaseUsdcAccept(reqs: X402PaymentRequirementV2) {
  const base = reqs.accepts.find((a) => a.network === "eip155:8453" || a.network === "base");
  if (base) return base;
  // Fallback: any USDC option
  const usdc = reqs.accepts.find((a) => a.asset?.toUpperCase().includes("USDC"));
  return usdc ?? reqs.accepts[0];
}

function runCawFetch(pactId: string, url: string, body: object): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const args = [
      "fetch",
      pactId,
      url,
      "--method", "POST",
      "--json", JSON.stringify(body),
      "--protocol", "x402",
      "--max-amount", "1000000000", // 1000 USDC cap; dashboard enforces real cap
      "--network", "eip155:8453", // base mainnet by default
      "--output", "full",
      "--timeout", "60"
    ];
    const child = spawn("caw", args, {
      env: { ...process.env, NODE_TLS_REJECT_UNAUTHORIZED: "0" },
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (b) => (stdout += b.toString()));
    child.stderr.on("data", (b) => (stderr += b.toString()));
    child.on("error", reject);
    child.on("close", (code) => resolve({ stdout, stderr, exitCode: code ?? 1 }));
  });
}

export async function runVeniceX402Topup(input: {
  userId: string;
  walletAddress: string;
  pactId: string;
  usdAmount: number;
}): Promise<VeniceX402TopupResult> {
  const start = Date.now();
  // Sanity checks
  const runtime = await getCawRuntimeStatus();
  if (runtime.mode !== "http") {
    throw new Error("Venice x402 top-up requires real CAW mode (CAW_MODE=http).");
  }
  if (!input.pactId) {
    throw new Error("An active Pact is required. Create one from the dashboard first.");
  }

  // Convert USD to USDC minor units (USDC has 6 decimals)
  const usdcMinor = Math.max(1000, Math.round(input.usdAmount * 1_000_000));

  // We need to send a body for the POST. The X-402-Payment header carries the
  // payment payload; caw fetch handles this automatically when --protocol=x402.
  // The body is just an empty/minimal JSON to satisfy the POST.
  const url = `${getVeniceBaseUrl()}${VENICE_X402_TOPUP_PATH}`;
  const body = { usdAmount: input.usdAmount, minorUnits: usdcMinor };

  const result = await runCawFetch(input.pactId, url, body);
  const durationMs = Date.now() - start;

  // caw fetch --output=full prints HTTP status line + headers + body
  // Try to parse out the status code from the first line
  const statusLine = result.stdout.split("\n")[0]?.trim() ?? "";
  const statusMatch = statusLine.match(/^(\d{3})/);
  const responseStatus = statusMatch ? Number(statusMatch[1]) : 0;

  // Log a ledger-style entry (we use inference log table for top-ups too, prefix model)
  createInferenceLog({
    userId: input.userId,
    prompt: `x402 top-up: $${input.usdAmount} USDC → Venice credit balance`,
    model: "venice-x402-topup",
    response: result.stdout.slice(0, 2000),
    inputTokens: null,
    outputTokens: null,
    status: responseStatus >= 200 && responseStatus < 300 ? "completed" : "failed",
    errorMessage: responseStatus >= 400 ? (result.stderr || result.stdout).slice(0, 1000) : undefined,
    durationMs
  });

  // Also update authorization spent count (best-effort, doesn't break on miss)
  try {
    const repo = getCreditRepository();
    const auth = await repo.getActiveAuthorization(input.userId);
    if (auth) {
      await repo.updateAuthorization({
        ...auth,
        spentTodayUsdcMinor: auth.spentTodayUsdcMinor + usdcMinor,
        spentMonthUsdcMinor: auth.spentMonthUsdcMinor + usdcMinor
      });
    }
  } catch {
    // Non-fatal: best-effort budget tracking
  }

  return {
    status: responseStatus >= 200 && responseStatus < 300 ? "submitted" : "failed",
    paymentPayload: "", // caw fetch handles the header internally; we don't expose it
    responseStatus,
    responseBody: result.stdout,
    durationMs
  };
}

export async function getOrCreateVeniceX402TopupRequest(args: {
  userId: string;
  usdAmount: number;
}): Promise<VeniceX402TopupRequest> {
  const repo = getCreditRepository();
  const user = await repo.requireUser(args.userId);
  if (!user.cawWalletAddress) {
    throw new Error("Connect a CAW wallet first.");
  }
  const auth = await repo.getActiveAuthorization(args.userId);
  if (!auth || auth.status !== "active") {
    throw new Error("An active Pact is required. Create one from the dashboard first.");
  }
  return {
    walletAddress: user.cawWalletAddress,
    pactId: auth.pactId,
    usdAmount: args.usdAmount
  };
}
