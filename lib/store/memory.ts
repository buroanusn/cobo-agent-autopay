import {
  BASE_CHAIN,
  CREDITS_PER_USDC,
  DEFAULT_CREDIT_ACCOUNT,
  DEMO_USER_EMAIL,
  DEMO_USER_ID
} from "@/lib/domain/constants";
import type {
  AgentUsageEvent,
  CawAuthorization,
  CreditAccount,
  DashboardSnapshot,
  LedgerEntry,
  TopupOrder,
  User
} from "@/lib/domain/types";

type AgentDb = {
  users: Map<string, User>;
  creditAccounts: Map<string, CreditAccount>;
  cawAuthorizations: Map<string, CawAuthorization>;
  ledgerEntries: LedgerEntry[];
  topupOrders: Map<string, TopupOrder>;
  usageEvents: AgentUsageEvent[];
  chainEventsSeen: Set<string>;
};

const globalStore = globalThis as typeof globalThis & {
  __agentToTokenDb?: AgentDb;
};

export function nowIso() {
  return new Date().toISOString();
}

export function createId(prefix: string) {
  const uuid = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `${prefix}_${uuid.replaceAll("-", "").slice(0, 16)}`;
}

function createInitialDb(): AgentDb {
  const createdAt = nowIso();
  const user: User = {
    id: DEMO_USER_ID,
    email: DEMO_USER_EMAIL,
    createdAt
  };
  const account: CreditAccount = {
    userId: DEMO_USER_ID,
    balanceCredits: DEFAULT_CREDIT_ACCOUNT.openingBalanceCredits,
    lowBalanceThresholdCredits: DEFAULT_CREDIT_ACCOUNT.lowBalanceThresholdCredits,
    autoTopupCredits: DEFAULT_CREDIT_ACCOUNT.autoTopupCredits,
    updatedAt: createdAt
  };

  return {
    users: new Map([[DEMO_USER_ID, user]]),
    creditAccounts: new Map([[DEMO_USER_ID, account]]),
    cawAuthorizations: new Map(),
    ledgerEntries: [
      {
        id: createId("led"),
        userId: DEMO_USER_ID,
        type: "opening_grant",
        creditsDelta: DEFAULT_CREDIT_ACCOUNT.openingBalanceCredits,
        balanceAfterCredits: DEFAULT_CREDIT_ACCOUNT.openingBalanceCredits,
        createdAt
      }
    ],
    topupOrders: new Map(),
    usageEvents: [],
    chainEventsSeen: new Set()
  };
}

export const db = globalStore.__agentToTokenDb ?? createInitialDb();
globalStore.__agentToTokenDb = db;

export function requireUser(userId: string) {
  const user = db.users.get(userId);
  if (!user) {
    throw new Error(`Unknown user: ${userId}`);
  }
  return user;
}

export function requireCreditAccount(userId: string) {
  const account = db.creditAccounts.get(userId);
  if (!account) {
    throw new Error(`Missing credit account for user: ${userId}`);
  }
  return account;
}

export function getActiveAuthorization(userId: string) {
  const auths = [...db.cawAuthorizations.values()].filter(
    (authorization) => authorization.userId === userId
  );
  return auths.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

export function snapshotForUser(userId: string): DashboardSnapshot {
  const user = requireUser(userId);
  const account = requireCreditAccount(userId);
  const authorization = getActiveAuthorization(userId);

  return {
    user,
    account,
    authorization,
    topupOrders: [...db.topupOrders.values()]
      .filter((order) => order.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 12),
    ledgerEntries: db.ledgerEntries
      .filter((entry) => entry.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 12),
    usageEvents: db.usageEvents
      .filter((event) => event.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 12),
    network: {
      chainId: BASE_CHAIN.id,
      name: BASE_CHAIN.name,
      usdcAddress: BASE_CHAIN.usdcAddress
    },
    pricing: {
      creditsPerUsdc: CREDITS_PER_USDC
    }
  };
}
