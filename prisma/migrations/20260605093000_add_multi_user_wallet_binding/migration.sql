ALTER TABLE "users" ADD COLUMN "cawWalletId" TEXT;

CREATE UNIQUE INDEX "users_cawWalletId_key" ON "users"("cawWalletId");
CREATE UNIQUE INDEX "users_cawWalletAddress_key" ON "users"("cawWalletAddress");
