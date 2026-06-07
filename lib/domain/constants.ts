export const DEMO_USER_ID = "user_demo";
export const DEMO_USER_EMAIL = "demo@agent.local";
export const DEMO_CAW_WALLET = "0x7a58f9D84bBf0C4A7fC41bE32189E3aA7c1E5d0A";

export const BASE_CHAIN = {
  id: 8453,
  name: "Base",
  usdcAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  explorerBaseUrl: "https://basescan.org"
} as const;

export const BASE_SEPOLIA_CHAIN = {
  id: 84532,
  name: "Base Sepolia",
  usdcAddress: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  explorerBaseUrl: "https://sepolia.basescan.org"
} as const;

export function getConfiguredChain() {
  return process.env.CHAIN_ENV === "base-mainnet" ? BASE_CHAIN : BASE_SEPOLIA_CHAIN;
}

export function getConfiguredCawChainId() {
  return process.env.CAW_CHAIN_ID || (process.env.CHAIN_ENV === "base-mainnet" ? "BASE_ETH" : "TBASE_SETH");
}

export const USDC_DECIMALS = 6;
export const USDC_MINOR_UNITS = 10 ** USDC_DECIMALS;
export const CREDITS_PER_USDC = 1000;

export const DEFAULT_CREDIT_ACCOUNT = {
  openingBalanceCredits: 1800,
  lowBalanceThresholdCredits: 1000,
  autoTopupCredits: 1000
} as const;

export const DEFAULT_SPEND_POLICY = {
  singleLimitUsdcMinor: 1 * USDC_MINOR_UNITS,
  dailyLimitUsdcMinor: 5 * USDC_MINOR_UNITS,
  monthlyLimitUsdcMinor: 20 * USDC_MINOR_UNITS,
  validDays: 7
} as const;

export const DEFAULT_GUARDRAILS = {
  reviewThresholdUsdcMinor: 2 * USDC_MINOR_UNITS,
  rolling24hTxCountLimit: 10,
  rolling24hAmountUsdcMinor: 20 * USDC_MINOR_UNITS
} as const;
