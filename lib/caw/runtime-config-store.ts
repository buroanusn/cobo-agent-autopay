// In-memory CAW runtime config store. Follows the same globalThis-cache
// pattern as lib/store/venice.ts (STORAGE_DRIVER=memory). Data resets on
// dev server restart, which is fine for the dashboard demo where every
// session re-uses the same caw wallet.
//
// Keys stored:
//   caw_wallet_uuid  — wallet UUID bound to this dashboard user
//   caw_wallet_name  — display name (e.g. "EthanTestProd")
//   caw_api_url      — CAW API base URL (mainnet / testnet)
//   caw_agent_id     — CAW agent ID
//
// The store is read by lib/caw/gateway.ts:resolveCawRuntimeConfig() so
// that getCawRuntimeStatus() can use a runtime-bound wallet even when
// the .env AGENT_WALLET_* variables are empty.

import { nowIso } from "@/lib/store/memory";
import type { CawRuntimeConfigKey, CawWalletSummary } from "@/lib/venice/types";

export type CawRuntimeConfigEntry = {
  key: CawRuntimeConfigKey;
  value: string;
  updatedAt: string;
};

type CawRuntimeStore = {
  entries: Map<CawRuntimeConfigKey, CawRuntimeConfigEntry>;
};

const globalCaw = globalThis as typeof globalThis & {
  __agentToTokenCawRuntimeStore?: CawRuntimeStore;
};

function createInitialCawRuntimeStore(): CawRuntimeStore {
  return { entries: new Map() };
}

const cawStore: CawRuntimeStore =
  globalCaw.__agentToTokenCawRuntimeStore ?? createInitialCawRuntimeStore();
globalCaw.__agentToTokenCawRuntimeStore = cawStore;

export function getCawRuntimeConfig(
  key: CawRuntimeConfigKey
): CawRuntimeConfigEntry | undefined {
  return cawStore.entries.get(key);
}

export function getCawRuntimeConfigValue(
  key: CawRuntimeConfigKey
): string | undefined {
  return cawStore.entries.get(key)?.value;
}

export function setCawRuntimeConfig(
  key: CawRuntimeConfigKey,
  value: string
): CawRuntimeConfigEntry {
  const entry: CawRuntimeConfigEntry = {
    key,
    value,
    updatedAt: nowIso()
  };
  cawStore.entries.set(key, entry);
  return entry;
}

export function setCawRuntimeConfigAll(
  values: Partial<Record<CawRuntimeConfigKey, string>>
): CawRuntimeConfigEntry[] {
  const out: CawRuntimeConfigEntry[] = [];
  for (const [k, v] of Object.entries(values)) {
    if (typeof v === "string" && v.length > 0) {
      out.push(setCawRuntimeConfig(k as CawRuntimeConfigKey, v));
    }
  }
  return out;
}

export function listCawRuntimeConfig(): CawRuntimeConfigEntry[] {
  return [...cawStore.entries.values()];
}

export function clearCawRuntimeConfig(): void {
  cawStore.entries.clear();
}

export type ResolvedCawRuntimeConfig = {
  walletUuid: string;
  walletName: string;
  apiUrl: string;
  agentId: string;
  source: "runtime" | "env";
};

export function resolveCawRuntimeConfig(): ResolvedCawRuntimeConfig {
  const fromRuntime = {
    walletUuid: getCawRuntimeConfigValue("caw_wallet_uuid") ?? "",
    walletName: getCawRuntimeConfigValue("caw_wallet_name") ?? "",
    apiUrl: getCawRuntimeConfigValue("caw_api_url") ?? "",
    agentId: getCawRuntimeConfigValue("caw_agent_id") ?? ""
  };
  if (fromRuntime.walletUuid && fromRuntime.apiUrl) {
    return { ...fromRuntime, source: "runtime" };
  }
  return {
    walletUuid:
      process.env.AGENT_WALLET_WALLET_ID || process.env.CAW_WALLET_ID || "",
    walletName: process.env.CAW_WALLET_NAME || "",
    apiUrl:
      process.env.AGENT_WALLET_API_URL || process.env.CAW_API_BASE_URL || "",
    agentId: process.env.CAW_AGENT_ID || "",
    source: "env"
  };
}

export function summarizeBoundWallet(
  wallet: CawWalletSummary
): ResolvedCawRuntimeConfig {
  return {
    walletUuid: wallet.walletUuid,
    walletName: wallet.walletName,
    apiUrl: wallet.apiUrl,
    agentId: wallet.agentId,
    source: "runtime"
  };
}
