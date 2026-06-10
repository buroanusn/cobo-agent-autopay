// GET /api/wallet/caw/pacts?status=active
//
// Runs `caw pact list` and returns a sanitized summary list of pacts so
// the dashboard can show whether the user has any active pacts covering
// the chains / tokens that Venice x402 needs (Base USDC on eip155:8453).
//
// Currently the user's 3 active pacts are Sepolia-only (single tx up to
// 0.05 USDC), so the dashboard should surface a "no Base mainnet pact"
// warning when a Venice top-up is attempted.

import { NextResponse } from "next/server";
import { spawnSync } from "child_process";
import type { CawPactSummary } from "@/lib/venice/types";
import { resolveCawRuntimeConfig } from "@/lib/caw/runtime-config-store";
import { requireCurrentUser } from "@/lib/auth/session";

function inferStatus(value: unknown): CawPactSummary["status"] {
  if (typeof value !== "string") return "unknown";
  const normalized = value.toLowerCase();
  if (
    normalized === "active" ||
    normalized === "pending_approval" ||
    normalized === "completed" ||
    normalized === "expired" ||
    normalized === "revoked" ||
    normalized === "rejected"
  ) {
    return normalized;
  }
  return "unknown";
}

export async function GET(request: Request) {
  await requireCurrentUser();
  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? "active";
  if (!["active", "pending_approval", "completed", "expired", "revoked", "rejected"].includes(status)) {
    return NextResponse.json({ ok: false, error: "invalid status" }, { status: 400 });
  }
  const resolved = resolveCawRuntimeConfig();

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const CAW_HOME = process.env.HOME || require("os").homedir();

  // We do NOT pass --wallet-id because caw pact list operates on the
  // active profile. The active profile is determined by HOME + the
  // caw wallet current selection, not by the runtime config UUID.
  // The runtime config UUID is used downstream (e.g. pair, fetch) but
  // the CLI's `pact list` always reads the active profile.
  try {
    const proc = spawnSync("caw", ["pact", "list", "--status", status, "--limit", "50"], {
      timeout: 15000,
      encoding: "utf-8",
      env: {
        ...process.env,
        HOME: CAW_HOME
      }
    });
    if (proc.error) {
      throw proc.error;
    }
    if (proc.status !== 0) {
      throw new Error(proc.stderr || `caw pact list failed with status ${proc.status}`);
    }
    const raw = proc.stdout ?? "";
    const data = JSON.parse(raw) as {
      result?: { pacts?: Array<Record<string, unknown>> };
    };
    const pactsRaw = Array.isArray(data?.result?.pacts)
      ? data.result.pacts
      : [];

    const pacts: CawPactSummary[] = pactsRaw.map((p) => {
      const remaining = (p.remaining ?? {}) as Record<string, unknown>;
      const operator = (p.operator ?? {}) as Record<string, unknown>;
      return {
        id: String(p.id ?? ""),
        name: String(p.name ?? ""),
        intent: String(p.intent ?? ""),
        status: inferStatus(p.status),
        isDefault: Boolean(p.is_default),
        expiresAt: String(p.expires_at ?? ""),
        remaining: {
          timeRemainingSeconds:
            typeof remaining.time_remaining_seconds === "number"
              ? remaining.time_remaining_seconds
              : undefined,
          txCountRemaining:
            typeof remaining.tx_count_remaining === "number"
              ? remaining.tx_count_remaining
              : undefined
        },
        operatorName: String(operator.name ?? ""),
        raw: p
      };
    });

    // Detect whether any pact covers Base mainnet (chain id eip155:8453)
    // and USDC contract 0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.
    // Venice sends those in its 402 challenge; without a matching pact
    // the caw fetch will be denied by policy.
    const hasBaseUsdcPact = pacts.some((p) => {
      const raw = p.raw as Record<string, unknown>;
      const intent = String(raw.intent ?? "").toLowerCase();
      const name = String(raw.name ?? "").toLowerCase();
      return (
        intent.includes("eip155:8453") ||
        intent.includes("0x833589fcd6edb6e08f4c7c32d4f71b54bda02913") ||
        name.includes("eip155:8453") ||
        name.includes("base")
      );
    });

    return NextResponse.json({
      ok: true,
      status,
      pacts,
      hasBaseUsdcPact,
      boundWallet: {
        walletUuid: resolved.walletUuid,
        walletName: resolved.walletName,
        source: resolved.source
      }
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      {
        ok: false,
        error: msg,
        boundWallet: {
          walletUuid: resolved.walletUuid,
          walletName: resolved.walletName,
          source: resolved.source
        }
      },
      { status: 500 }
    );
  }
}
