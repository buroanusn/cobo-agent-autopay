// Venice runtime storage (in-memory, follows STORAGE_DRIVER=memory pattern).
// Note: data resets on dev server restart. This matches the existing
// project convention (see lib/store/memory.ts for the same pattern).

import { createId, nowIso } from "@/lib/store/memory";
import type {
  RuntimeConfigEntry,
  RuntimeConfigKey,
  VeniceBalanceSnapshot,
  VeniceInferenceLog
} from "@/lib/venice/types";

type VeniceStore = {
  runtimeConfig: Map<RuntimeConfigKey, RuntimeConfigEntry>;
  balanceSnapshots: VeniceBalanceSnapshot[];
  inferenceLogs: VeniceInferenceLog[];
};

const globalVeniceStore = globalThis as typeof globalThis & {
  __agentToTokenVeniceStore?: VeniceStore;
};

function createInitialVeniceStore(): VeniceStore {
  const createdAt = nowIso();
  return {
    runtimeConfig: new Map<RuntimeConfigKey, RuntimeConfigEntry>([
      [
        "venice_inference_model",
        { key: "venice_inference_model", value: "llama-3.3-70b", updatedAt: createdAt }
      ],
      [
        "venice_low_balance_threshold_usd",
        { key: "venice_low_balance_threshold_usd", value: "5", updatedAt: createdAt }
      ],
      [
        "x402_topup_default_usd",
        { key: "x402_topup_default_usd", value: "5", updatedAt: createdAt }
      ]
    ]),
    balanceSnapshots: [],
    inferenceLogs: []
  };
}

const veniceStore: VeniceStore =
  globalVeniceStore.__agentToTokenVeniceStore ?? createInitialVeniceStore();
globalVeniceStore.__agentToTokenVeniceStore = veniceStore;

// ---- RuntimeConfig ----

export function getRuntimeConfig(key: RuntimeConfigKey): RuntimeConfigEntry | undefined {
  return veniceStore.runtimeConfig.get(key);
}

export function getRuntimeConfigValue(key: RuntimeConfigKey): string | undefined {
  return veniceStore.runtimeConfig.get(key)?.value;
}

export function setRuntimeConfig(key: RuntimeConfigKey, value: string): RuntimeConfigEntry {
  const entry: RuntimeConfigEntry = { key, value, updatedAt: nowIso() };
  veniceStore.runtimeConfig.set(key, entry);
  return entry;
}

export function listRuntimeConfig(): RuntimeConfigEntry[] {
  return [...veniceStore.runtimeConfig.values()];
}

// ---- VeniceBalanceSnapshot ----

export function recordBalanceSnapshot(snapshot: VeniceBalanceSnapshot) {
  veniceStore.balanceSnapshots.unshift(snapshot);
  // Keep last 50
  if (veniceStore.balanceSnapshots.length > 50) {
    veniceStore.balanceSnapshots.length = 50;
  }
  return snapshot;
}

export function getLatestBalanceSnapshot(): VeniceBalanceSnapshot | undefined {
  return veniceStore.balanceSnapshots[0];
}

export function listBalanceSnapshots(limit = 20): VeniceBalanceSnapshot[] {
  return veniceStore.balanceSnapshots.slice(0, limit);
}

// ---- VeniceInferenceLog ----

export function createInferenceLog(
  input: Omit<VeniceInferenceLog, "id" | "createdAt">
): VeniceInferenceLog {
  const log: VeniceInferenceLog = { ...input, id: createId("vin"), createdAt: nowIso() };
  veniceStore.inferenceLogs.unshift(log);
  if (veniceStore.inferenceLogs.length > 50) {
    veniceStore.inferenceLogs.length = 50;
  }
  return log;
}

export function listInferenceLogs(limit = 20): VeniceInferenceLog[] {
  return veniceStore.inferenceLogs.slice(0, limit);
}
