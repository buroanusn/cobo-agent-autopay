-- CreateEnum
CREATE TYPE "CawAuthorizationStatus" AS ENUM ('pending_user_approval', 'active', 'expired', 'revoked');

-- CreateEnum
CREATE TYPE "TopupOrderStatus" AS ENUM ('pending_policy', 'caw_submitted', 'chain_pending', 'pending_approval', 'approval_expired', 'credited', 'failed');

-- CreateEnum
CREATE TYPE "AgentUsageStatus" AS ENUM ('completed', 'failed_insufficient_balance');

-- CreateEnum
CREATE TYPE "LedgerEntryType" AS ENUM ('opening_grant', 'agent_usage', 'auto_topup');

-- CreateEnum
CREATE TYPE "CawPairingStatus" AS ENUM ('generated', 'paired', 'expired');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "cawWalletAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "caw_pairing_sessions" (
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "CawPairingStatus" NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "caw_pairing_sessions_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "credit_accounts" (
    "userId" TEXT NOT NULL,
    "balanceCredits" INTEGER NOT NULL,
    "lowBalanceThresholdCredits" INTEGER NOT NULL,
    "autoTopupCredits" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_accounts_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "caw_authorizations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "pactId" TEXT NOT NULL,
    "status" "CawAuthorizationStatus" NOT NULL,
    "singleLimitUsdcMinor" INTEGER NOT NULL,
    "dailyLimitUsdcMinor" INTEGER NOT NULL,
    "monthlyLimitUsdcMinor" INTEGER NOT NULL,
    "spentTodayUsdcMinor" INTEGER NOT NULL DEFAULT 0,
    "spentMonthUsdcMinor" INTEGER NOT NULL DEFAULT 0,
    "dailyWindowStart" TIMESTAMP(3) NOT NULL,
    "monthlyWindowStart" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "caw_authorizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_entries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "LedgerEntryType" NOT NULL,
    "creditsDelta" INTEGER NOT NULL,
    "balanceAfterCredits" INTEGER NOT NULL,
    "orderId" TEXT,
    "usageEventId" TEXT,
    "usdcMinor" INTEGER,
    "txHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topup_orders" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "status" "TopupOrderStatus" NOT NULL,
    "reason" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "onchainOrderId" TEXT NOT NULL,
    "amountUsdcMinor" INTEGER NOT NULL,
    "credits" INTEGER NOT NULL,
    "txHash" TEXT,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "creditedAt" TIMESTAMP(3),

    CONSTRAINT "topup_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_usage_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taskName" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "estimatedCredits" INTEGER NOT NULL,
    "creditsCharged" INTEGER NOT NULL,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "modelId" TEXT,
    "priceVersion" TEXT,
    "status" "AgentUsageStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_usage_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chain_events_seen" (
    "eventId" TEXT NOT NULL,
    "txHash" TEXT,
    "logIndex" INTEGER,
    "orderId" TEXT,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chain_events_seen_pkey" PRIMARY KEY ("eventId")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "caw_authorizations_userId_createdAt_idx" ON "caw_authorizations"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ledger_entries_userId_createdAt_idx" ON "ledger_entries"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ledger_entries_orderId_idx" ON "ledger_entries"("orderId");

-- CreateIndex
CREATE INDEX "ledger_entries_usageEventId_idx" ON "ledger_entries"("usageEventId");

-- CreateIndex
CREATE UNIQUE INDEX "topup_orders_orderId_key" ON "topup_orders"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "topup_orders_onchainOrderId_key" ON "topup_orders"("onchainOrderId");

-- CreateIndex
CREATE INDEX "topup_orders_userId_status_idx" ON "topup_orders"("userId", "status");

-- CreateIndex
CREATE INDEX "topup_orders_createdAt_idx" ON "topup_orders"("createdAt");

-- CreateIndex
CREATE INDEX "agent_usage_events_userId_createdAt_idx" ON "agent_usage_events"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "chain_events_seen_txHash_logIndex_idx" ON "chain_events_seen"("txHash", "logIndex");

-- CreateIndex
CREATE INDEX "chain_events_seen_orderId_idx" ON "chain_events_seen"("orderId");

-- AddForeignKey
ALTER TABLE "caw_pairing_sessions" ADD CONSTRAINT "caw_pairing_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_accounts" ADD CONSTRAINT "credit_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caw_authorizations" ADD CONSTRAINT "caw_authorizations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topup_orders" ADD CONSTRAINT "topup_orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_usage_events" ADD CONSTRAINT "agent_usage_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
