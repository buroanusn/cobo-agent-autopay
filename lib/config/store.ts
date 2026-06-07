// Runtime config: DB-backed (memory now) with env fallback.
// Lets dashboard front-end override env values without code/config changes.

import { getRuntimeConfigValue, setRuntimeConfig } from "@/lib/store/venice";
import type { RuntimeConfigKey } from "@/lib/venice/types";

/**
 * Resolve a config value with the following priority:
 *   1. RuntimeConfig (in-memory, set by dashboard)
 *   2. process.env[ENV_KEY] (e.g. VENICE_API_KEY)
 *   3. fallback arg
 */
export function resolveConfig(
  key: RuntimeConfigKey,
  envKey: string,
  fallback?: string
): string | undefined {
  return getRuntimeConfigValue(key) ?? process.env[envKey] ?? fallback;
}

export function writeConfig(key: RuntimeConfigKey, value: string) {
  return setRuntimeConfig(key, value);
}

// Venice-specific helpers

export function getVeniceApiKey(): string | undefined {
  return resolveConfig("venice_api_key", "VENICE_API_KEY");
}

export function setVeniceApiKey(value: string) {
  return writeConfig("venice_api_key", value);
}

export function getVeniceModel(): string {
  return resolveConfig("venice_inference_model", "VENICE_INFERENCE_MODEL", "llama-3.3-70b")!;
}

export function setVeniceModel(value: string) {
  return writeConfig("venice_inference_model", value);
}

export function getVeniceBaseUrl(): string {
  return process.env.VENICE_BASE_URL || "https://api.venice.ai";
}

export function getLowBalanceThresholdUsd(): number {
  const raw = resolveConfig("venice_low_balance_threshold_usd", "VENICE_LOW_BALANCE_THRESHOLD_USD", "5");
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 5;
}

export function getDefaultTopupUsd(): number {
  const raw = resolveConfig("x402_topup_default_usd", "X402_TOPUP_DEFAULT_USD", "5");
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 5;
}

/** Mask an API key for safe display: "ven_***last4" */
export function maskApiKey(key: string | undefined): string {
  if (!key) return "";
  if (key.length <= 8) return "***";
  return `${key.slice(0, 4)}***${key.slice(-4)}`;
}
