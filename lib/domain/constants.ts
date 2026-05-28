export const DEMO_USER_ID = "user_demo";
export const DEMO_USER_EMAIL = "demo@agent.local";
export const DEMO_CAW_WALLET = "0x7a58f9D84bBf0C4A7fC41bE32189E3aA7c1E5d0A";

export const BASE_CHAIN = {
  id: 8453,
  name: "Base",
  usdcAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  explorerBaseUrl: "https://basescan.org"
} as const;

export const USDC_DECIMALS = 6;
export const USDC_MINOR_UNITS = 10 ** USDC_DECIMALS;
export const CREDITS_PER_USDC = 1000;

export const DEFAULT_CREDIT_ACCOUNT = {
  openingBalanceCredits: 1800,
  lowBalanceThresholdCredits: 1000,
  autoTopupCredits: 5000
} as const;

export const DEFAULT_SPEND_POLICY = {
  singleLimitUsdcMinor: 5 * USDC_MINOR_UNITS,
  dailyLimitUsdcMinor: 20 * USDC_MINOR_UNITS,
  monthlyLimitUsdcMinor: 100 * USDC_MINOR_UNITS,
  validDays: 7
} as const;
