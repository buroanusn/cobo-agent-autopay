// POST /api/wallet/caw/runtime-config
//
// Body: { walletUuid, walletName?, apiUrl?, agentId? }
//
// Writes the bound CAW wallet into the in-memory CawRuntimeConfigStore
// so the next /api/wallet/caw/status call reads the same UUID/API URL
// without restarting the dev server. The dashboard CAW panel calls this
// after the user picks a wallet from /api/wallet/caw/discover.
//
// GET returns the current bound runtime config (debug + UI use).
//
// NOTE: data resets on dev server restart (STORAGE_DRIVER=memory).

import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth/session";
import {
  getCawRuntimeConfig,
  listCawRuntimeConfig,
  setCawRuntimeConfigAll,
  clearCawRuntimeConfig
} from "@/lib/caw/runtime-config-store";
import { readCawProfileCredentials } from "@/lib/caw/cli";
import type { CawRuntimeConfigKey } from "@/lib/venice/types";

export async function GET(request: Request) {
  const user = await requireCurrentUser();
  const url = new URL(request.url);
  const autobind = url.searchParams.get("autobind") === "1";

  if (!autobind) {
    return NextResponse.json({
      ok: true,
      entries: listCawRuntimeConfig()
    });
  }

  // autobind: pull active caw profile from disk and seed RuntimeConfig.
  // This is the "user installed caw skill → just bind it" path.
  const profile = await readCawProfileCredentials(user.id);
  if (!profile) {
    return NextResponse.json(
      {
        ok: false,
        error: "no caw profile found for current user",
        entries: listCawRuntimeConfig()
      },
      { status: 404 }
    );
  }

  setCawRuntimeConfigAll({
    caw_wallet_uuid: profile.walletUuid,
    caw_wallet_name: profile.walletName,
    caw_api_url: profile.apiUrl,
    caw_agent_id: profile.agentId
  });

  // Seed an in-process env var so getCawRuntimeStatus() in
  // lib/caw/gateway.ts can pick up the API key without gateway.ts
  // having to import `fs` (which would break webpack's client bundle
  // compilation through the instrumentation chain). This override
  // lives only for the lifetime of the dev server process.
  process.env.AGENT_WALLET_API_URL = profile.apiUrl;
  process.env.AGENT_WALLET_API_KEY = profile.apiKey;
  process.env.AGENT_WALLET_WALLET_ID = profile.walletUuid;

  return NextResponse.json({
    ok: true,
    autobound: true,
    source: "caw-cli-profile",
    profile: {
      walletUuid: profile.walletUuid,
      walletName: profile.walletName,
      apiUrl: profile.apiUrl,
      agentId: profile.agentId,
      apiKeyTail: profile.apiKey.slice(-6)
    },
    entries: listCawRuntimeConfig()
  });
}

export async function POST(request: Request) {
  const user = await requireCurrentUser();
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json body" }, { status: 400 });
  }

  const walletUuid = typeof body.walletUuid === "string" ? body.walletUuid.trim() : "";
  if (!walletUuid) {
    return NextResponse.json(
      { ok: false, error: "walletUuid is required" },
      { status: 400 }
    );
  }

  const updates: Partial<Record<CawRuntimeConfigKey, string>> = {
    caw_wallet_uuid: walletUuid
  };

  if (typeof body.walletName === "string" && body.walletName.trim()) {
    updates.caw_wallet_name = body.walletName.trim();
  }
  if (typeof body.apiUrl === "string" && body.apiUrl.trim()) {
    updates.caw_api_url = body.apiUrl.trim();
  }
  if (typeof body.agentId === "string" && body.agentId.trim()) {
    updates.caw_agent_id = body.agentId.trim();
  }

  const written = setCawRuntimeConfigAll(updates);

  // Also seed process.env so HttpCawGateway constructor can find the
  // credentials immediately (it reads AGENT_WALLET_* env vars only).
  // Look up the API key from the local caw CLI profile that matches
  // the bound wallet UUID.
  process.env.AGENT_WALLET_API_URL = updates.caw_api_url ?? "";
  process.env.AGENT_WALLET_WALLET_ID = walletUuid;
  const matchedProfile = await readCawProfileCredentials(user.id, walletUuid);
  if (matchedProfile) {
    process.env.AGENT_WALLET_API_KEY = matchedProfile.apiKey;
  }

  return NextResponse.json({
    ok: true,
    written: written.length,
    current: {
      walletUuid: getCawRuntimeConfig("caw_wallet_uuid")?.value,
      walletName: getCawRuntimeConfig("caw_wallet_name")?.value,
      apiUrl: getCawRuntimeConfig("caw_api_url")?.value,
      agentId: getCawRuntimeConfig("caw_agent_id")?.value
    }
  });
}

export async function DELETE() {
  await requireCurrentUser();
  clearCawRuntimeConfig();
  return NextResponse.json({ ok: true, cleared: true });
}
