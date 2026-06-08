import type {
  AgentUsageEvent,
  CawAuthorization,
  CawAuthorizationPurpose,
  CreditAccount,
  DashboardSnapshot,
  LedgerEntry,
  TopupOrder,
  User,
  CawPairingSession,
  CawWalletOnboardingSession
} from "@/lib/domain/types";

export type ChainEventRecord = {
  eventId: string;
  txHash?: string;
  logIndex?: number;
  orderId?: string;
};

export type CreditRepository = {
  createId(prefix: string): string;
  nowIso(): string;
  snapshotForUser(userId: string): Promise<DashboardSnapshot>;
  getOrCreateUserByEmail(email: string): Promise<User>;
  findUserByCoboId(coboId: string): Promise<User | undefined>;
  findUserByCawWalletId(walletId: string): Promise<User | undefined>;
  findUserByCawWalletAddress(walletAddress: string): Promise<User | undefined>;
  requireUser(userId: string): Promise<User>;
  requireCreditAccount(userId: string): Promise<CreditAccount>;
  updateCreditAccount(account: CreditAccount): Promise<CreditAccount>;
  updateUser(user: User): Promise<User>;
  getActiveAuthorization(
    userId: string,
    purpose?: CawAuthorizationPurpose
  ): Promise<CawAuthorization | undefined>;
  createAuthorization(authorization: CawAuthorization): Promise<CawAuthorization>;
  updateAuthorization(authorization: CawAuthorization): Promise<CawAuthorization>;
  createPairingSession(userId: string, session: CawPairingSession): Promise<CawPairingSession>;
  getCawOnboardingSession(userId: string): Promise<CawWalletOnboardingSession | undefined>;
  upsertCawOnboardingSession(
    session: CawWalletOnboardingSession
  ): Promise<CawWalletOnboardingSession>;
  createUsageEvent(input: Omit<AgentUsageEvent, "id" | "createdAt">): Promise<AgentUsageEvent>;
  appendLedgerEntry(input: Omit<LedgerEntry, "id" | "createdAt">): Promise<LedgerEntry>;
  findPendingTopupOrder(userId: string): Promise<TopupOrder | undefined>;
  listPendingTopupOrders(userId: string): Promise<TopupOrder[]>;
  createTopupOrder(
    input: Omit<TopupOrder, "id" | "orderId" | "onchainOrderId" | "createdAt" | "updatedAt">
  ): Promise<TopupOrder>;
  updateTopupOrder(order: TopupOrder): Promise<TopupOrder>;
  findTopupOrderByOrderId(input: {
    orderId?: string;
    onchainOrderId?: string;
  }): Promise<TopupOrder | undefined>;
  findTopupOrderByTxHash(input: {
    userId: string;
    txHash: string;
  }): Promise<TopupOrder | undefined>;
  hasChainEvent(eventId: string): Promise<boolean>;
  markChainEventSeen(event: ChainEventRecord): Promise<boolean>;
};
