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
import { readFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";
import {
  getCawRuntimeConfig,
  listCawRuntimeConfig,
  setCawRuntimeConfigAll,
  clearCawRuntimeConfig
} from "@/lib/caw/runtime-config-store";
import type { CawRuntimeConfigKey } from "@/lib/venice/types";

type CawProfileCredentials = {
  apiKey: string;
  apiUrl: string;
  agentId: string;
  walletName: string;
  walletUuid: string;
};

// Read the active caw CLI profile from disk. caw stores credentials in
// ~/.cobo-agentic-wallet/profiles/<agent_id>/credentials (file perms
// 600, owner-only). This route is a leaf node.js route (no client
// instrumentation chain) so it's safe to import `fs` and `path` here.
function readCawProfileCredentials(): CawProfileCredentials | null {
  const home = process.env.HOME || require("os").homedir();
  const profilesDir = join(home, ".cobo-agentic-wallet", "profiles");
  if (!existsSync(profilesDir)) return null;

  // Prefer the wallet the user marked as default in their caw config
  // (~/.cobo-agentic-wallet/config). caw uses "default_profile" not
  // "active_agent_id" — match the actual on-disk schema.
  let defaultAgentId: string | null = null;
  const configPath = join(home, ".cobo-agentic-wallet", "config");
  if (existsSync(configPath)) {
    try {
      const cfg = JSON.parse(readFileSync(configPath, "utf-8"));
      if (typeof cfg?.default_profile === "string") {
        defaultAgentId = cfg.default_profile;
      } else if (typeof cfg?.active_agent_id === "string") {
        defaultAgentId = cfg.active_agent_id;
      }
    } catch {
      // ignore parse error
    }
  }

  const dirs = readdirSync(profilesDir)
    .filter((d) => d.startsWith("profile_caw_agent_"))
    .sort((a, b) => {
      const aMatch = a === `profile_${defaultAgentId}`;
      const bMatch = b === `profile_${defaultAgentId}`;
      if (aMatch && !bMatch) return -1;
      if (!aMatch && bMatch) return 1;
      return 0;
    });

  for (const dir of dirs) {
    const credPath = join(profilesDir, dir, "credentials");
    if (!existsSync(credPath)) continue;
    try {
      const raw = readFileSync(credPath, "utf-8");
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const apiKey = String(parsed.api_key ?? "");
      const apiUrl = String(parsed.api_url ?? "");
      const agentId = String(parsed.agent_id ?? "");
      if (!apiKey || !apiUrl) continue;
      return {
        apiKey,
        apiUrl,
        agentId,
        walletName: String(parsed.wallet_name ?? "default"),
        walletUuid: String(parsed.wallet_uuid ?? "")
      };
    } catch {
      // Skip unparseable profile; keep scanning.
    }
  }
  return null;
}

export async function GET(request: Request) {
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
  const profile = readCawProfileCredentials();
  if (!profile) {
    return NextResponse.json(
      {
        ok: false,
        error: "no caw profile found in ~/.cobo-agentic-wallet/profiles",
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
  const matchedProfile = readCawProfileCredentials();
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
  clearCawRuntimeConfig();
  return NextResponse.json({ ok: true, cleared: true });
}
