import { createHash } from "node:crypto";
import { CREDITS_PER_USDC, getConfiguredChain } from "@/lib/domain/constants";
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
import {
  createId,
  db,
  getActiveAuthorization,
  nowIso,
  requireCreditAccount,
  requireUser,
  snapshotForUser
} from "@/lib/store/memory";
import type { ChainEventRecord, CreditRepository } from "@/lib/store/repository";

const pendingTopupStatuses: TopupOrder["status"][] = [
  "pending_policy",
  "caw_submitted",
  "chain_pending"
];

export const memoryRepository: CreditRepository = {
  createId,
  nowIso,
  async snapshotForUser(userId: string): Promise<DashboardSnapshot> {
    return snapshotForUser(userId);
  },
  async requireUser(userId: string): Promise<User> {
    return requireUser(userId);
  },
  async requireCreditAccount(userId: string): Promise<CreditAccount> {
    return requireCreditAccount(userId);
  },
  async updateCreditAccount(account: CreditAccount): Promise<CreditAccount> {
    db.creditAccounts.set(account.userId, account);
    return account;
  },
  async updateUser(user: User): Promise<User> {
    db.users.set(user.id, user);
    return user;
  },
  async getActiveAuthorization(userId: string): Promise<CawAuthorization | undefined> {
    return getActiveAuthorization(userId);
  },
  async createAuthorization(authorization: CawAuthorization): Promise<CawAuthorization> {
    db.cawAuthorizations.set(authorization.id, authorization);
    return authorization;
  },
  async updateAuthorization(authorization: CawAuthorization): Promise<CawAuthorization> {
    db.cawAuthorizations.set(authorization.id, authorization);
    return authorization;
  },
  async createPairingSession(
    userId: string,
    session: CawPairingSession
  ): Promise<CawPairingSession> {
    db.pairingSessions.set(userId, session);
    return session;
  },
  async createUsageEvent(
    input: Omit<AgentUsageEvent, "id" | "createdAt">
  ): Promise<AgentUsageEvent> {
    const usageEvent: AgentUsageEvent = {
      ...input,
      id: createId("use"),
      createdAt: nowIso()
    };
    db.usageEvents.push(usageEvent);
    return usageEvent;
  },
  async appendLedgerEntry(input: Omit<LedgerEntry, "id" | "createdAt">): Promise<LedgerEntry> {
    const entry: LedgerEntry = {
      ...input,
      id: createId("led"),
      createdAt: nowIso()
    };
    db.ledgerEntries.push(entry);
    return entry;
  },
  async findPendingTopupOrder(userId: string): Promise<TopupOrder | undefined> {
    return [...db.topupOrders.values()].find(
      (order) => order.userId === userId && pendingTopupStatuses.includes(order.status)
    );
  },
  async createTopupOrder(
    input: Omit<TopupOrder, "id" | "orderId" | "onchainOrderId" | "createdAt" | "updatedAt">
  ): Promise<TopupOrder> {
    const createdAt = nowIso();
    const orderId = createId("ord");
    const order: TopupOrder = {
      ...input,
      id: createId("top"),
      orderId,
      onchainOrderId: orderIdToBytes32(orderId),
      createdAt,
      updatedAt: createdAt
    };
    db.topupOrders.set(order.id, order);
    return order;
  },
  async updateTopupOrder(order: TopupOrder): Promise<TopupOrder> {
    db.topupOrders.set(order.id, order);
    return order;
  },
  async findTopupOrderByOrderId(input: {
    orderId?: string;
    onchainOrderId?: string;
  }): Promise<TopupOrder | undefined> {
    return [...db.topupOrders.values()].find(
      (candidate) =>
        candidate.orderId === input.orderId || candidate.onchainOrderId === input.onchainOrderId
    );
  },
  async hasChainEvent(eventId: string): Promise<boolean> {
    return db.chainEventsSeen.has(eventId);
  },
  async markChainEventSeen(event: ChainEventRecord): Promise<boolean> {
    if (db.chainEventsSeen.has(event.eventId)) {
      return false;
    }
    db.chainEventsSeen.add(event.eventId);
    return true;
  }
};

function orderIdToBytes32(orderId: string) {
  return `0x${createHash("sha256").update(orderId).digest("hex")}`;
}

export const memorySnapshotNetwork = {
  chainId: getConfiguredChain().id,
  name: getConfiguredChain().name,
  usdcAddress: getConfiguredChain().usdcAddress,
  creditsPerUsdc: CREDITS_PER_USDC
};
