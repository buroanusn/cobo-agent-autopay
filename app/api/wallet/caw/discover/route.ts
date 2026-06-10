// GET /api/wallet/caw/discover
//
// Runs `caw wallet list` against the current app user's isolated CAW_HOME
// and returns a sanitized list of wallets they
// can bind to this dashboard. The browser uses this to show "Available
// Wallets" in the CAW integration panel and lets the user pick one
// without editing .env or remembering UUIDs.
//
// Response: { ok: true, wallets: CawWalletSummary[] } on success,
// { ok: false, error: string } on failure.

import { NextResponse } from "next/server";
import type { CawWalletSummary } from "@/lib/venice/types";
import { requireCurrentUser } from "@/lib/auth/session";
import { ensureCawHome, listCawCliWallets } from "@/lib/caw/cli";

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
  const user = await requireCurrentUser();
  const cawHome = await ensureCawHome(user.id);
  const debug = {
    userId: user.id,
    cawHome,
    cwd: process.cwd()
  };

  try {
    const rawWallets = await listCawCliWallets(user.id);
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

    return NextResponse.json({ ok: true, wallets, debug });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg, debug }, { status: 500 });
  }
}
