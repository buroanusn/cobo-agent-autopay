import { createHash } from "node:crypto";
import {
  CREDITS_PER_USDC,
  DEFAULT_CREDIT_ACCOUNT,
  DEFAULT_GUARDRAILS,
  DEFAULT_SPEND_POLICY,
  DEMO_USER_EMAIL,
  DEMO_USER_ID,
  getConfiguredCawChainId,
  getConfiguredChain
} from "@/lib/domain/constants";
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
import { prisma } from "@/lib/store/prisma-client";
import type { ChainEventRecord, CreditRepository } from "@/lib/store/repository";

const pendingTopupStatuses: TopupOrder["status"][] = [
  "pending_policy",
  "caw_submitted",
  "chain_pending"
];

export const prismaRepository: CreditRepository = {
  createId,
  nowIso,
  async snapshotForUser(userId: string): Promise<DashboardSnapshot> {
    await ensureDemoData(userId);
    const user = await requirePrismaUser(userId);
    const account = await requirePrismaCreditAccount(userId);
    const authorization = await prisma.cawAuthorization.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" }
    });
    const [pairingSession, topupOrders, ledgerEntries, usageEvents] = await Promise.all([
      prisma.cawPairingSession.findUnique({ where: { userId } }),
      prisma.topupOrder.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 12
      }),
      prisma.ledgerEntry.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 12
      }),
      prisma.agentUsageEvent.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 12
      })
    ]);
    const mappedTopupOrders = topupOrders.map(mapTopupOrder);
    const chain = getConfiguredChain();
    const creditedOrders = mappedTopupOrders.filter((order) => order.status === "credited");
    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;
    const monthAgo = now - 30 * 24 * 60 * 60 * 1000;
    const credited24h = creditedOrders.filter((order) => Date.parse(order.updatedAt) >= dayAgo);
    const credited30d = creditedOrders.filter((order) => Date.parse(order.updatedAt) >= monthAgo);
    const mappedAuthorization = authorization
      ? mapAuthorization(authorization, { includePactApiKey: false })
      : undefined;

    return {
      user: mapUser(user),
      account: mapCreditAccount(account),
      authorization: mappedAuthorization,
      pairingSession: pairingSession ? mapPairingSession(pairingSession) : undefined,
      guardrails: {
        singleLimitUsdcMinor:
          mappedAuthorization?.singleLimitUsdcMinor ?? DEFAULT_SPEND_POLICY.singleLimitUsdcMinor,
        dailyLimitUsdcMinor:
          mappedAuthorization?.dailyLimitUsdcMinor ?? DEFAULT_SPEND_POLICY.dailyLimitUsdcMinor,
        reviewThresholdUsdcMinor: DEFAULT_GUARDRAILS.reviewThresholdUsdcMinor,
        allowedAddresses: user.cawWalletAddress ? [user.cawWalletAddress] : [],
        allowedChains: [getConfiguredCawChainId()],
        generatedBy: "system_default",
        updatedAt: mappedAuthorization?.createdAt ?? user.createdAt.toISOString()
      },
      paymentStats: {
        spent24hUsdcMinor: credited24h.reduce((total, order) => total + order.amountUsdcMinor, 0),
        spent30dUsdcMinor: credited30d.reduce((total, order) => total + order.amountUsdcMinor, 0),
        txCount24h: credited24h.length,
        txCount30d: credited30d.length,
        automaticPayments: creditedOrders.filter((order) => order.reason !== "manual").length,
        manualApprovalPayments: mappedTopupOrders.filter(
          (order) => order.status === "pending_approval"
        ).length
      },
      pendingApprovals: mappedTopupOrders.filter((order) => order.status === "pending_approval"),
      pactDetails: mappedAuthorization
        ? {
            reviewIfAmountUsdcMinor: DEFAULT_GUARDRAILS.reviewThresholdUsdcMinor,
            denyIfAmountUsdcMinor: mappedAuthorization.singleLimitUsdcMinor,
            completionTimeElapsedDays: Math.max(
              0,
              Math.ceil(
                (Date.parse(mappedAuthorization.expiresAt) - Date.now()) / (24 * 60 * 60 * 1000)
              )
            ),
            completionAmountSpentUsdcMinor: mappedAuthorization.monthlyLimitUsdcMinor,
            remainingUsdcMinor: Math.max(
              0,
              mappedAuthorization.monthlyLimitUsdcMinor - mappedAuthorization.spentMonthUsdcMinor
            ),
            txCount24hLimit: DEFAULT_GUARDRAILS.rolling24hTxCountLimit,
            amount24hLimitUsdcMinor: DEFAULT_GUARDRAILS.rolling24hAmountUsdcMinor
          }
        : undefined,
      topupOrders: mappedTopupOrders,
      ledgerEntries: ledgerEntries.map(mapLedgerEntry),
      usageEvents: usageEvents.map(mapUsageEvent),
      network: {
        chainId: chain.id,
        name: chain.name,
        usdcAddress: chain.usdcAddress
      },
      pricing: {
        creditsPerUsdc: CREDITS_PER_USDC
      }
    };
  },
  async getOrCreateUserByEmail(email: string): Promise<User> {
    const normalizedEmail = normalizeEmail(email);
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      await ensureCreditAccount(existing.id);
      return mapUser(existing);
    }

    const userId = createId("usr");
    const created = await prisma.user.create({
      data: {
        id: userId,
        email: normalizedEmail,
        creditAccount: {
          create: {
            balanceCredits: DEFAULT_CREDIT_ACCOUNT.openingBalanceCredits,
            lowBalanceThresholdCredits: DEFAULT_CREDIT_ACCOUNT.lowBalanceThresholdCredits,
            autoTopupCredits: DEFAULT_CREDIT_ACCOUNT.autoTopupCredits
          }
        },
        ledgerEntries: {
          create: {
            id: createId("led"),
            type: "opening_grant",
            creditsDelta: DEFAULT_CREDIT_ACCOUNT.openingBalanceCredits,
            balanceAfterCredits: DEFAULT_CREDIT_ACCOUNT.openingBalanceCredits
          }
        }
      }
    });
    return mapUser(created);
  },
  async findUserByCawWalletAddress(walletAddress: string): Promise<User | undefined> {
    const user = await prisma.user.findFirst({
      where: { cawWalletAddress: { equals: walletAddress, mode: "insensitive" } }
    });
    return user ? mapUser(user) : undefined;
  },
  async requireUser(userId: string): Promise<User> {
    await ensureDemoData(userId);
    return mapUser(await requirePrismaUser(userId));
  },
  async requireCreditAccount(userId: string): Promise<CreditAccount> {
    await ensureDemoData(userId);
    return mapCreditAccount(await requirePrismaCreditAccount(userId));
  },
  async updateCreditAccount(account: CreditAccount): Promise<CreditAccount> {
    const updated = await prisma.creditAccount.update({
      where: { userId: account.userId },
      data: {
        balanceCredits: account.balanceCredits,
        lowBalanceThresholdCredits: account.lowBalanceThresholdCredits,
        autoTopupCredits: account.autoTopupCredits
      }
    });
    return mapCreditAccount(updated);
  },
  async updateUser(user: User): Promise<User> {
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        email: user.email,
        cawWalletId: user.cawWalletId,
        cawWalletAddress: user.cawWalletAddress
      }
    });
    return mapUser(updated);
  },
  async getActiveAuthorization(userId: string): Promise<CawAuthorization | undefined> {
    await ensureDemoData(userId);
    const authorization = await prisma.cawAuthorization.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" }
    });
    return authorization ? mapAuthorization(authorization) : undefined;
  },
  async createAuthorization(authorization: CawAuthorization): Promise<CawAuthorization> {
    const created = await prisma.cawAuthorization.create({
      data: {
        id: authorization.id,
        userId: authorization.userId,
        walletAddress: authorization.walletAddress,
        pactId: authorization.pactId,
        pactApiKey: authorization.pactApiKey,
        status: authorization.status,
        singleLimitUsdcMinor: authorization.singleLimitUsdcMinor,
        dailyLimitUsdcMinor: authorization.dailyLimitUsdcMinor,
        monthlyLimitUsdcMinor: authorization.monthlyLimitUsdcMinor,
        spentTodayUsdcMinor: authorization.spentTodayUsdcMinor,
        spentMonthUsdcMinor: authorization.spentMonthUsdcMinor,
        dailyWindowStart: new Date(authorization.dailyWindowStart),
        monthlyWindowStart: new Date(authorization.monthlyWindowStart),
        expiresAt: new Date(authorization.expiresAt),
        createdAt: new Date(authorization.createdAt)
      }
    });
    return mapAuthorization(created);
  },
  async updateAuthorization(authorization: CawAuthorization): Promise<CawAuthorization> {
    const updated = await prisma.cawAuthorization.update({
      where: { id: authorization.id },
      data: {
        walletAddress: authorization.walletAddress,
        pactId: authorization.pactId,
        pactApiKey: authorization.pactApiKey,
        status: authorization.status,
        singleLimitUsdcMinor: authorization.singleLimitUsdcMinor,
        dailyLimitUsdcMinor: authorization.dailyLimitUsdcMinor,
        monthlyLimitUsdcMinor: authorization.monthlyLimitUsdcMinor,
        spentTodayUsdcMinor: authorization.spentTodayUsdcMinor,
        spentMonthUsdcMinor: authorization.spentMonthUsdcMinor,
        dailyWindowStart: new Date(authorization.dailyWindowStart),
        monthlyWindowStart: new Date(authorization.monthlyWindowStart),
        expiresAt: new Date(authorization.expiresAt)
      }
    });
    return mapAuthorization(updated);
  },
  async createPairingSession(
    userId: string,
    session: CawPairingSession
  ): Promise<CawPairingSession> {
    const created = await prisma.cawPairingSession.upsert({
      where: { userId },
      create: {
        userId,
        code: session.code,
        status: session.status,
        expiresAt: new Date(session.expiresAt),
        createdAt: new Date(session.createdAt)
      },
      update: {
        code: session.code,
        status: session.status,
        expiresAt: new Date(session.expiresAt),
        createdAt: new Date(session.createdAt)
      }
    });
    return mapPairingSession(created);
  },
  async createUsageEvent(
    input: Omit<AgentUsageEvent, "id" | "createdAt">
  ): Promise<AgentUsageEvent> {
    const created = await prisma.agentUsageEvent.create({
      data: {
        ...input,
        id: createId("use")
      }
    });
    return mapUsageEvent(created);
  },
  async appendLedgerEntry(input: Omit<LedgerEntry, "id" | "createdAt">): Promise<LedgerEntry> {
    const created = await prisma.ledgerEntry.create({
      data: {
        id: createId("led"),
        userId: input.userId,
        type: input.type,
        creditsDelta: input.creditsDelta,
        balanceAfterCredits: input.balanceAfterCredits,
        orderId: input.orderId,
        usageEventId: input.usageEventId,
        usdcMinor: input.usdcMinor,
        txHash: input.txHash
      }
    });
    return mapLedgerEntry(created);
  },
  async findPendingTopupOrder(userId: string): Promise<TopupOrder | undefined> {
    const order = await prisma.topupOrder.findFirst({
      where: {
        userId,
        status: { in: pendingTopupStatuses }
      },
      orderBy: { createdAt: "asc" }
    });
    return order ? mapTopupOrder(order) : undefined;
  },
  async createTopupOrder(
    input: Omit<TopupOrder, "id" | "orderId" | "onchainOrderId" | "createdAt" | "updatedAt">
  ): Promise<TopupOrder> {
    const orderId = createId("ord");
    const created = await prisma.topupOrder.create({
      data: {
        id: createId("top"),
        userId: input.userId,
        walletAddress: input.walletAddress,
        status: input.status,
        reason: input.reason,
        orderId,
        onchainOrderId: orderIdToBytes32(orderId),
        amountUsdcMinor: input.amountUsdcMinor,
        credits: input.credits,
        txHash: input.txHash,
        failureReason: input.failureReason,
        creditedAt: input.creditedAt ? new Date(input.creditedAt) : undefined
      }
    });
    return mapTopupOrder(created);
  },
  async updateTopupOrder(order: TopupOrder): Promise<TopupOrder> {
    const updated = await prisma.topupOrder.update({
      where: { id: order.id },
      data: {
        walletAddress: order.walletAddress,
        status: order.status,
        reason: order.reason,
        amountUsdcMinor: order.amountUsdcMinor,
        credits: order.credits,
        txHash: order.txHash,
        failureReason: order.failureReason,
        creditedAt: order.creditedAt ? new Date(order.creditedAt) : null
      }
    });
    return mapTopupOrder(updated);
  },
  async findTopupOrderByOrderId(input: {
    orderId?: string;
    onchainOrderId?: string;
  }): Promise<TopupOrder | undefined> {
    const order = await prisma.topupOrder.findFirst({
      where: {
        OR: [
          ...(input.orderId ? [{ orderId: input.orderId }] : []),
          ...(input.onchainOrderId ? [{ onchainOrderId: input.onchainOrderId }] : [])
        ]
      }
    });
    return order ? mapTopupOrder(order) : undefined;
  },
  async listStaleTopupOrders(input: {
    cutoffIso: string;
    statuses: TopupOrder["status"][];
  }): Promise<TopupOrder[]> {
    const orders = await prisma.topupOrder.findMany({
      where: {
        status: { in: input.statuses },
        createdAt: { lt: new Date(input.cutoffIso) }
      },
      orderBy: { createdAt: "asc" }
    });
    return orders.map(mapTopupOrder);
  },
  async hasChainEvent(eventId: string): Promise<boolean> {
    const count = await prisma.chainEventSeen.count({ where: { eventId } });
    return count > 0;
  },
  async markChainEventSeen(event: ChainEventRecord): Promise<boolean> {
    try {
      await prisma.chainEventSeen.create({
        data: {
          eventId: event.eventId,
          txHash: event.txHash,
          logIndex: event.logIndex,
          orderId: event.orderId
        }
      });
      return true;
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return false;
      }
      throw error;
    }
  }
};

async function ensureDemoData(userId: string) {
  if (userId !== DEMO_USER_ID) {
    return;
  }

  await prisma.user.upsert({
    where: { id: DEMO_USER_ID },
    create: {
      id: DEMO_USER_ID,
      email: DEMO_USER_EMAIL,
      creditAccount: {
        create: {
          balanceCredits: DEFAULT_CREDIT_ACCOUNT.openingBalanceCredits,
          lowBalanceThresholdCredits: DEFAULT_CREDIT_ACCOUNT.lowBalanceThresholdCredits,
          autoTopupCredits: DEFAULT_CREDIT_ACCOUNT.autoTopupCredits
        }
      },
      ledgerEntries: {
        create: {
          id: createId("led"),
          type: "opening_grant",
          creditsDelta: DEFAULT_CREDIT_ACCOUNT.openingBalanceCredits,
          balanceAfterCredits: DEFAULT_CREDIT_ACCOUNT.openingBalanceCredits
        }
      }
    },
    update: {}
  });

  await prisma.creditAccount.upsert({
    where: { userId: DEMO_USER_ID },
    create: {
      userId: DEMO_USER_ID,
      balanceCredits: DEFAULT_CREDIT_ACCOUNT.openingBalanceCredits,
      lowBalanceThresholdCredits: DEFAULT_CREDIT_ACCOUNT.lowBalanceThresholdCredits,
      autoTopupCredits: DEFAULT_CREDIT_ACCOUNT.autoTopupCredits
    },
    update: {}
  });
}

async function ensureCreditAccount(userId: string) {
  await prisma.creditAccount.upsert({
    where: { userId },
    create: {
      userId,
      balanceCredits: DEFAULT_CREDIT_ACCOUNT.openingBalanceCredits,
      lowBalanceThresholdCredits: DEFAULT_CREDIT_ACCOUNT.lowBalanceThresholdCredits,
      autoTopupCredits: DEFAULT_CREDIT_ACCOUNT.autoTopupCredits
    },
    update: {}
  });
}

async function requirePrismaUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error(`Unknown user: ${userId}`);
  }
  return user;
}

async function requirePrismaCreditAccount(userId: string) {
  const account = await prisma.creditAccount.findUnique({ where: { userId } });
  if (!account) {
    throw new Error(`Missing credit account for user: ${userId}`);
  }
  return account;
}

function createId(prefix: string) {
  const uuid = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `${prefix}_${uuid.replaceAll("-", "").slice(0, 16)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function orderIdToBytes32(orderId: string) {
  return `0x${createHash("sha256").update(orderId).digest("hex")}`;
}

function mapUser(user: {
  id: string;
  email: string;
  cawWalletId: string | null;
  cawWalletAddress: string | null;
  createdAt: Date;
}): User {
  return {
    id: user.id,
    email: user.email,
    cawWalletId: user.cawWalletId ?? undefined,
    cawWalletAddress: user.cawWalletAddress ?? undefined,
    createdAt: user.createdAt.toISOString()
  };
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function mapPairingSession(session: {
  code: string;
  status: CawPairingSession["status"];
  expiresAt: Date;
  createdAt: Date;
}): CawPairingSession {
  return {
    code: session.code,
    status: session.status,
    expiresAt: session.expiresAt.toISOString(),
    createdAt: session.createdAt.toISOString()
  };
}

function mapCreditAccount(account: {
  userId: string;
  balanceCredits: number;
  lowBalanceThresholdCredits: number;
  autoTopupCredits: number;
  updatedAt: Date;
}): CreditAccount {
  return {
    userId: account.userId,
    balanceCredits: account.balanceCredits,
    lowBalanceThresholdCredits: account.lowBalanceThresholdCredits,
    autoTopupCredits: account.autoTopupCredits,
    updatedAt: account.updatedAt.toISOString()
  };
}

function mapAuthorization(
  authorization: {
    id: string;
    userId: string;
    walletAddress: string;
    pactId: string;
    pactApiKey: string | null;
    status: CawAuthorization["status"];
    singleLimitUsdcMinor: number;
    dailyLimitUsdcMinor: number;
    monthlyLimitUsdcMinor: number;
    spentTodayUsdcMinor: number;
    spentMonthUsdcMinor: number;
    dailyWindowStart: Date;
    monthlyWindowStart: Date;
    expiresAt: Date;
    createdAt: Date;
  },
  options: { includePactApiKey?: boolean } = { includePactApiKey: true }
): CawAuthorization {
  return {
    id: authorization.id,
    userId: authorization.userId,
    walletAddress: authorization.walletAddress,
    pactId: authorization.pactId,
    pactApiKey: options.includePactApiKey ? authorization.pactApiKey ?? undefined : undefined,
    status: authorization.status,
    singleLimitUsdcMinor: authorization.singleLimitUsdcMinor,
    dailyLimitUsdcMinor: authorization.dailyLimitUsdcMinor,
    monthlyLimitUsdcMinor: authorization.monthlyLimitUsdcMinor,
    spentTodayUsdcMinor: authorization.spentTodayUsdcMinor,
    spentMonthUsdcMinor: authorization.spentMonthUsdcMinor,
    dailyWindowStart: authorization.dailyWindowStart.toISOString(),
    monthlyWindowStart: authorization.monthlyWindowStart.toISOString(),
    expiresAt: authorization.expiresAt.toISOString(),
    createdAt: authorization.createdAt.toISOString()
  };
}

function mapTopupOrder(order: {
  id: string;
  userId: string;
  walletAddress: string;
  status: TopupOrder["status"];
  reason: string;
  orderId: string;
  onchainOrderId: string;
  amountUsdcMinor: number;
  credits: number;
  txHash: string | null;
  failureReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  creditedAt: Date | null;
}): TopupOrder {
  return {
    id: order.id,
    userId: order.userId,
    walletAddress: order.walletAddress,
    status: order.status,
    reason: order.reason,
    orderId: order.orderId,
    onchainOrderId: order.onchainOrderId,
    amountUsdcMinor: order.amountUsdcMinor,
    credits: order.credits,
    txHash: order.txHash ?? undefined,
    failureReason: order.failureReason ?? undefined,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    creditedAt: order.creditedAt?.toISOString()
  };
}

function mapLedgerEntry(entry: {
  id: string;
  userId: string;
  type: LedgerEntry["type"];
  creditsDelta: number;
  balanceAfterCredits: number;
  orderId: string | null;
  usageEventId: string | null;
  usdcMinor: number | null;
  txHash: string | null;
  createdAt: Date;
}): LedgerEntry {
  return {
    id: entry.id,
    userId: entry.userId,
    type: entry.type,
    creditsDelta: entry.creditsDelta,
    balanceAfterCredits: entry.balanceAfterCredits,
    orderId: entry.orderId ?? undefined,
    usageEventId: entry.usageEventId ?? undefined,
    usdcMinor: entry.usdcMinor ?? undefined,
    txHash: entry.txHash ?? undefined,
    createdAt: entry.createdAt.toISOString()
  };
}

function mapUsageEvent(event: {
  id: string;
  userId: string;
  taskName: string;
  prompt: string;
  estimatedCredits: number;
  creditsCharged: number;
  status: AgentUsageEvent["status"];
  createdAt: Date;
}): AgentUsageEvent {
  return {
    id: event.id,
    userId: event.userId,
    taskName: event.taskName,
    prompt: event.prompt,
    estimatedCredits: event.estimatedCredits,
    creditsCharged: event.creditsCharged,
    status: event.status,
    createdAt: event.createdAt.toISOString()
  };
}

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}
