CREATE TYPE "CawAuthorizationPurpose" AS ENUM ('credits_payment', 'venice_x402');

ALTER TABLE "caw_authorizations"
ADD COLUMN "purpose" "CawAuthorizationPurpose" NOT NULL DEFAULT 'credits_payment';

CREATE INDEX "caw_authorizations_userId_purpose_createdAt_idx"
ON "caw_authorizations"("userId", "purpose", "createdAt");
