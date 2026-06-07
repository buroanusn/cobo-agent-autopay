// Venice integration types
// Schema derived from https://docs.venice.ai/api-reference/endpoint/x402/*
// and https://docs.venice.ai/api-reference/endpoint/billing/*

export type RuntimeConfigKey =
  | "venice_api_key"
  | "venice_inference_model"
  | "venice_low_balance_threshold_usd"
  | "x402_topup_default_usd";

export type RuntimeConfigEntry = {
  key: RuntimeConfigKey;
  value: string;
  updatedAt: string;
};

export type VeniceBalanceSnapshot = {
  id: string;
  fetchedAt: string;
  source: "x402_wallet" | "billing_api";
  // x402 wallet-based balance (path: GET /x402/balance/{walletAddress})
  // or billing API (path: GET /api/v1/billing/balance)
  canConsume: boolean;
  consumptionCurrency: "USD" | "DIEM" | "VCU" | "BUNDLED_CREDITS" | null;
  diemBalance: number;
  usdBalance: number;
  diemEpochAllocation: number;
  walletAddress?: string;
  rawResponse: unknown;
};

export type VeniceInferenceLog = {
  id: string;
  userId: string;
  prompt: string;
  model: string;
  response: string;
  inputTokens: number | null;
  outputTokens: number | null;
  status: "completed" | "failed";
  errorMessage?: string;
  durationMs: number;
  createdAt: string;
};

export type VeniceX402TopupRequest = {
  walletAddress: string;
  pactId: string;
  // Amount in USD (will be converted to USDC minor units for the x402 payment)
  usdAmount: number;
};

export type VeniceX402TopupResult = {
  status: "submitted" | "failed";
  paymentPayload: string; // base64-encoded X-402-Payment header
  txHash?: string;
  responseStatus: number;
  responseBody: string;
  durationMs: number;
};
