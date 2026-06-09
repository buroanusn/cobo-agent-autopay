ALTER TABLE "users"
ADD COLUMN "coboId" TEXT,
ADD COLUMN "coboIdBoundAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "users_coboId_key" ON "users"("coboId");
