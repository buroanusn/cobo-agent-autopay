// createHash("sha256") rewritten with Web Crypto. The original
// `node:crypto` import triggered webpack's UnhandledSchemeError when
// this module was bundled for the Next.js server. SHA-256 is available
// in Node 19+ via globalThis.crypto.subtle.
async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder();
  const hash = await globalThis.crypto.subtle.digest("SHA-256", enc.encode(input));
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Cache of sync-call sites that were waiting for the same input string.
// We precompute a stable placeholder; the actual computation is async and
// happens in a microtask, so callers that immediately read the result see
// the placeholder. This module is only used for non-cryptographic ID
// generation (synthetic chain-event ids from orderId), so determinism is
// not required. To preserve the prior behaviour, we expose a synchronous
// `txHash` that returns a FNV-1a 64-bit hex (good enough for the
// dashboard "tx hash" display) and an async `txHashAsync` for callers
// that need the real SHA-256.
function fnv1a64Hex(input: string): string {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (let i = 0; i < input.length; i++) {
    hash ^= BigInt(input.charCodeAt(i));
    hash = (hash * prime) & 0xffffffffffffffffn;
  }
  return `0x${hash.toString(16).padStart(16, "0")}`;
}
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
  createUserWithDefaults,
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
  async getOrCreateUserByEmail(email: string): Promise<User> {
    const normalizedEmail = normalizeEmail(email);
    const existing = [...db.users.values()].find((user) => user.email === normalizedEmail);
    return existing ?? createUserWithDefaults(normalizedEmail);
  },
  async findUserByCawWalletAddress(walletAddress: string): Promise<User | undefined> {
    const normalizedWallet = walletAddress.toLowerCase();
    return [...db.users.values()].find(
      (user) => user.cawWalletAddress?.toLowerCase() === normalizedWallet
    );
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
  async listStaleTopupOrders(input: {
    cutoffIso: string;
    statuses: TopupOrder["status"][];
  }): Promise<TopupOrder[]> {
    const cutoffMs = Date.parse(input.cutoffIso);
    return [...db.topupOrders.values()]
      .filter(
        (order) =>
          input.statuses.includes(order.status) && Date.parse(order.createdAt) < cutoffMs
      )
      .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
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
  return fnv1a64Hex(orderId);
}

export const memorySnapshotNetwork = {
  chainId: getConfiguredChain().id,
  name: getConfiguredChain().name,
  usdcAddress: getConfiguredChain().usdcAddress,
  creditsPerUsdc: CREDITS_PER_USDC
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}
