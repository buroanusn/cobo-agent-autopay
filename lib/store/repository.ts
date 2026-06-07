import type {
  AgentUsageEvent,
  CawAuthorization,
  CreditAccount,
  DashboardSnapshot,
  LedgerEntry,
  TopupOrder,
  User,
  CawPairingSession
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
  findUserByCawWalletAddress(walletAddress: string): Promise<User | undefined>;
  requireUser(userId: string): Promise<User>;
  requireCreditAccount(userId: string): Promise<CreditAccount>;
  updateCreditAccount(account: CreditAccount): Promise<CreditAccount>;
  updateUser(user: User): Promise<User>;
  getActiveAuthorization(userId: string): Promise<CawAuthorization | undefined>;
  createAuthorization(authorization: CawAuthorization): Promise<CawAuthorization>;
  updateAuthorization(authorization: CawAuthorization): Promise<CawAuthorization>;
  createPairingSession(userId: string, session: CawPairingSession): Promise<CawPairingSession>;
  createUsageEvent(input: Omit<AgentUsageEvent, "id" | "createdAt">): Promise<AgentUsageEvent>;
  appendLedgerEntry(input: Omit<LedgerEntry, "id" | "createdAt">): Promise<LedgerEntry>;
  findPendingTopupOrder(userId: string): Promise<TopupOrder | undefined>;
  createTopupOrder(
    input: Omit<TopupOrder, "id" | "orderId" | "onchainOrderId" | "createdAt" | "updatedAt">
  ): Promise<TopupOrder>;
  updateTopupOrder(order: TopupOrder): Promise<TopupOrder>;
  findTopupOrderByOrderId(input: {
    orderId?: string;
    onchainOrderId?: string;
  }): Promise<TopupOrder | undefined>;
  listStaleTopupOrders(input: {
    cutoffIso: string;
    statuses: TopupOrder["status"][];
  }): Promise<TopupOrder[]>;
  hasChainEvent(eventId: string): Promise<boolean>;
  markChainEventSeen(event: ChainEventRecord): Promise<boolean>;
};
