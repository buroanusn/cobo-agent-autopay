// Venice balance: queries both billing API and x402 wallet API,
// records a snapshot in memory, and exposes a normalized shape for the dashboard.

import { recordBalanceSnapshot } from "@/lib/store/venice";
import { createId, nowIso } from "@/lib/store/memory";
import {
  fetchVeniceBillingBalance,
  fetchVeniceX402Balance,
  VeniceApiError
} from "@/lib/venice/client";
import type { VeniceBalanceSnapshot } from "@/lib/venice/types";

export async function refreshVeniceBalance(input: { walletAddress?: string } = {}): Promise<VeniceBalanceSnapshot> {
  const walletAddress = input.walletAddress;

  // Primary: billing API (Bearer key, no SIWE required)
  let canConsume = false;
  let consumptionCurrency: VeniceBalanceSnapshot["consumptionCurrency"] = null;
  let diemBalance = 0;
  let usdBalance = 0;
  let diemEpochAllocation = 0;
  let source: VeniceBalanceSnapshot["source"] = "billing_api";
  let raw: unknown;

  try {
    const billing = await fetchVeniceBillingBalance();
    canConsume = billing.canConsume;
    consumptionCurrency = billing.consumptionCurrency;
    diemBalance = billing.balances.diem;
    usdBalance = billing.balances.usd;
    diemEpochAllocation = billing.diemEpochAllocation;
    raw = billing;
  } catch (error) {
    if (error instanceof VeniceApiError && walletAddress) {
      // Fall back to x402 wallet path (still may 401 due to SIWE, but record attempt)
      source = "x402_wallet";
      const x402 = await fetchVeniceX402Balance(walletAddress);
      raw = x402.raw;
      // Best-effort extraction; not strict
      usdBalance = Number((x402 as { amount?: number }).amount ?? 0);
      canConsume = Boolean((x402 as { canConsume?: boolean }).canConsume);
    } else {
      throw error;
    }
  }

  const snapshot: VeniceBalanceSnapshot = {
    id: createId("vbs"),
    fetchedAt: nowIso(),
    source,
    canConsume,
    consumptionCurrency,
    diemBalance,
    usdBalance,
    diemEpochAllocation,
    walletAddress,
    rawResponse: raw
  };

  recordBalanceSnapshot(snapshot);
  return snapshot;
}
