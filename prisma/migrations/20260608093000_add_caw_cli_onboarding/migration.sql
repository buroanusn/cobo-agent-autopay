-- CreateEnum
CREATE TYPE "CawOnboardingStatus" AS ENUM ('not_started', 'waiting_input', 'running', 'wallet_active', 'failed');

-- CreateTable
CREATE TABLE "caw_wallet_onboarding_sessions" (
    "userId" TEXT NOT NULL,
    "sessionId" TEXT,
    "status" "CawOnboardingStatus" NOT NULL,
    "phase" TEXT,
    "walletStatus" TEXT,
    "needsInput" BOOLEAN NOT NULL DEFAULT false,
    "prompts" JSONB,
    "nextAction" TEXT,
    "lastError" TEXT,
    "agentName" TEXT,
    "apiUrl" TEXT,
    "walletId" TEXT,
    "walletName" TEXT,
    "agentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "caw_wallet_onboarding_sessions_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "caw_wallet_onboarding_sessions" ADD CONSTRAINT "caw_wallet_onboarding_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
