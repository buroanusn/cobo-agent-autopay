// GET /api/wallet/caw/discover
//
// Runs `caw wallet list` against the user's actual CAW profile directory
// (under their real HOME) and returns a sanitized list of wallets they
// can bind to this dashboard. The browser uses this to show "Available
// Wallets" in the CAW integration panel and lets the user pick one
// without editing .env or remembering UUIDs.
//
// Response: { ok: true, wallets: CawWalletSummary[] } on success,
// { ok: false, error: string } on failure.

import { NextResponse } from "next/server";
import { execSync } from "child_process";
import type { CawWalletSummary } from "@/lib/venice/types";

// Same HOME correction as the transactions route — point at the user's
// real ~/.cobo-agentic-wallet directory.
const CAW_HOME = "/Users/jichenyang";

function runCaw(args: string): { stdout: string; stderr: string; status: number | null } {
  const result = require("child_process").spawnSync(
    "caw",
    args.split(/\s+/).filter(Boolean),
    {
      timeout: 15000,
      encoding: "utf-8",
      env: { ...process.env, HOME: CAW_HOME },
      shell: false
    }
  );
  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    status: result.status
  };
}

function inferEnv(apiUrl: string): "prod" | "dev" | "unknown" {
  if (apiUrl.includes("dev.cobo.com") || apiUrl.includes("sandbox")) {
    return "dev";
  }
  if (apiUrl.includes("api.agenticwallet.cobo.com")) {
    return "prod";
  }
  return "unknown";
}

export async function GET() {
  // Surface diagnostics so we can tell why `caw wallet list` returns 0
  // wallets from inside the Next.js runtime even though the same shell
  // command returns 2. We log HOME, cwd, PATH and PATH-tail so the dev
  // can see which caw binary is being picked up.
  const debug = {
    home: process.env.HOME,
    cwd: process.cwd(),
    cawOnPath: (() => {
      try {
        return require("child_process")
          .execSync("which caw", { encoding: "utf-8" })
          .trim();
      } catch {
        return null;
      }
    })()
  };

  try {
    // caw wallet list returns a top-level JSON array; caw pact list returns
    // an object with a `result` envelope. We try array first, then object.
    const proc = runCaw("wallet list");
    let rawArray: Array<Record<string, unknown>> = [];
    let rawObject: { result?: Array<Record<string, unknown>> } | null = null;
    let parseError: string | null = null;
    try {
      const parsed = JSON.parse(proc.stdout);
      if (Array.isArray(parsed)) {
        rawArray = parsed;
      } else if (parsed && typeof parsed === "object") {
        rawObject = parsed as { result?: Array<Record<string, unknown>> };
        if (Array.isArray(rawObject.result)) {
          rawArray = rawObject.result;
        }
      }
    } catch (e) {
      parseError = e instanceof Error ? e.message : String(e);
    }
    if (parseError) {
      return NextResponse.json(
        {
          ok: false,
          error: "caw wallet list returned non-JSON",
          parseError,
          rawStdout: proc.stdout.slice(0, 1000),
          rawStderr: proc.stderr.slice(0, 500),
          status: proc.status,
          debug
        },
        { status: 500 }
      );
    }

    const rawWallets = rawArray;
    const wallets: CawWalletSummary[] = rawWallets.map((w) => {
      const apiUrl = String(w.api_url ?? "");
      const env = inferEnv(apiUrl);
      return {
        walletUuid: String(w.wallet_uuid ?? ""),
        walletName: String(w.wallet_name ?? w.wallet_name ?? "unknown"),
        agentId: String(w.agent_id ?? ""),
        agentName: String(w.agent_name ?? "unknown"),
        apiUrl,
        env,
        isActive: Boolean(w.active),
        status: String(w.status ?? "unknown"),
        onboardedAt: String(w.onboarded_at ?? "")
      };
    });

    return NextResponse.json({ ok: true, wallets, debug, rawStdout: proc.stdout.slice(0, 500), rawStderr: proc.stderr.slice(0, 1000) });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg, debug }, { status: 500 });
  }
}
