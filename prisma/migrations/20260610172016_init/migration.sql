-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "coboId" TEXT,
    "coboIdBoundAt" DATETIME,
    "cawWalletId" TEXT,
    "cawWalletAddress" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "caw_pairing_sessions" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "caw_pairing_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "caw_wallet_onboarding_sessions" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT,
    "status" TEXT NOT NULL,
    "phase" TEXT,
    "walletStatus" TEXT,
    "needsInput" BOOLEAN NOT NULL DEFAULT false,
    "prompts" TEXT,
    "nextAction" TEXT,
    "lastError" TEXT,
    "agentName" TEXT,
    "apiUrl" TEXT,
    "walletId" TEXT,
    "walletName" TEXT,
    "agentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "caw_wallet_onboarding_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "credit_accounts" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "balanceCredits" INTEGER NOT NULL,
    "lowBalanceThresholdCredits" INTEGER NOT NULL,
    "autoTopupCredits" INTEGER NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "credit_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "caw_authorizations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'credits_payment',
    "walletAddress" TEXT NOT NULL,
    "pactId" TEXT NOT NULL,
    "pactApiKey" TEXT,
    "status" TEXT NOT NULL,
    "singleLimitUsdcMinor" INTEGER NOT NULL,
    "dailyLimitUsdcMinor" INTEGER NOT NULL,
    "monthlyLimitUsdcMinor" INTEGER NOT NULL,
    "spentTodayUsdcMinor" INTEGER NOT NULL DEFAULT 0,
    "spentMonthUsdcMinor" INTEGER NOT NULL DEFAULT 0,
    "dailyWindowStart" DATETIME NOT NULL,
    "monthlyWindowStart" DATETIME NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "caw_authorizations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ledger_entries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "creditsDelta" INTEGER NOT NULL,
    "balanceAfterCredits" INTEGER NOT NULL,
    "orderId" TEXT,
    "usageEventId" TEXT,
    "usdcMinor" INTEGER,
    "txHash" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ledger_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "topup_orders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "onchainOrderId" TEXT NOT NULL,
    "amountUsdcMinor" INTEGER NOT NULL,
    "credits" INTEGER NOT NULL,
    "txHash" TEXT,
    "failureReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "creditedAt" DATETIME,
    CONSTRAINT "topup_orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "agent_usage_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "taskName" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "estimatedCredits" INTEGER NOT NULL,
    "creditsCharged" INTEGER NOT NULL,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "modelId" TEXT,
    "priceVersion" TEXT,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "agent_usage_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "chain_events_seen" (
    "eventId" TEXT NOT NULL PRIMARY KEY,
    "txHash" TEXT,
    "logIndex" INTEGER,
    "orderId" TEXT,
    "processedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_coboId_key" ON "users"("coboId");

-- CreateIndex
CREATE UNIQUE INDEX "users_cawWalletId_key" ON "users"("cawWalletId");

-- CreateIndex
CREATE UNIQUE INDEX "users_cawWalletAddress_key" ON "users"("cawWalletAddress");

-- CreateIndex
CREATE INDEX "caw_authorizations_userId_createdAt_idx" ON "caw_authorizations"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "caw_authorizations_userId_purpose_createdAt_idx" ON "caw_authorizations"("userId", "purpose", "createdAt");

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
