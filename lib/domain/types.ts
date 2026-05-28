export type CawAuthorizationStatus =
  | "pending_user_approval"
  | "active"
  | "expired"
  | "revoked";

export type TopupOrderStatus =
  | "pending_policy"
  | "caw_submitted"
  | "chain_pending"
  | "credited"
  | "failed";

export type AgentUsageStatus = "completed" | "failed_insufficient_balance";

export type User = {
  id: string;
  email: string;
  cawWalletAddress?: string;
  createdAt: string;
};

export type CreditAccount = {
  userId: string;
  balanceCredits: number;
  lowBalanceThresholdCredits: number;
  autoTopupCredits: number;
  updatedAt: string;
};

export type CawAuthorization = {
  id: string;
  userId: string;
  walletAddress: string;
  pactId: string;
  status: CawAuthorizationStatus;
  singleLimitUsdcMinor: number;
  dailyLimitUsdcMinor: number;
  monthlyLimitUsdcMinor: number;
  spentTodayUsdcMinor: number;
  spentMonthUsdcMinor: number;
  dailyWindowStart: string;
  monthlyWindowStart: string;
  expiresAt: string;
  createdAt: string;
};

export type LedgerEntry = {
  id: string;
  userId: string;
  type: "opening_grant" | "agent_usage" | "auto_topup";
  creditsDelta: number;
  balanceAfterCredits: number;
  orderId?: string;
  usageEventId?: string;
  usdcMinor?: number;
  txHash?: string;
  createdAt: string;
};

export type TopupOrder = {
  id: string;
  userId: string;
  walletAddress: string;
  status: TopupOrderStatus;
  reason: string;
  orderId: string;
  onchainOrderId: string;
  amountUsdcMinor: number;
  credits: number;
  txHash?: string;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
  creditedAt?: string;
};

export type AgentUsageEvent = {
  id: string;
  userId: string;
  taskName: string;
  prompt: string;
  estimatedCredits: number;
  creditsCharged: number;
  status: AgentUsageStatus;
  createdAt: string;
};

export type DashboardSnapshot = {
  user: User;
  account: CreditAccount;
  authorization?: CawAuthorization;
  topupOrders: TopupOrder[];
  ledgerEntries: LedgerEntry[];
  usageEvents: AgentUsageEvent[];
  network: {
    chainId: number;
    name: string;
    usdcAddress: string;
  };
  pricing: {
    creditsPerUsdc: number;
  };
};
