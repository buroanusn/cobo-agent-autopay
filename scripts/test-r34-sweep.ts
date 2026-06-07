// Direct test of expireStaleTopupOrders using in-memory repository
// Mirrors the canonical R3.4 transcript adapted for memory mode (no PostgreSQL/dev-server required).
//
// Run with: npx tsx scripts/test-r34-sweep.ts

import { expireStaleTopupOrders } from "../lib/domain/services";
import { db } from "../lib/store/memory";

async function main() {
  const stamp = Date.now();
  const testId = `top_r34_test_${stamp}`;
  const testOrderId = `ord_r34_test_${stamp}`;
  const testOnchainId = `0x${stamp.toString(16).padStart(64, "0")}`;
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

  const demoUser = [...db.users.values()][0];
  if (!demoUser) {
    console.error("No demo user in memory db");
    process.exit(1);
  }

  console.log(`[STEP 1] Insert synthetic 2h-old caw_submitted order`);
  console.log(`  testId=${testId}`);
  console.log(`  testOrderId=${testOrderId}`);
  console.log(`  userId=${demoUser.id}`);
  const order = {
    id: testId,
    userId: demoUser.id,
    walletAddress: "0xtest_wallet_r34",
    status: "caw_submitted" as const,
    reason: "r34_synth_test_utc",
    orderId: testOrderId,
    onchainOrderId: testOnchainId,
    amountUsdcMinor: 10000,
    credits: 1000,
    createdAt: twoHoursAgo,
    updatedAt: twoHoursAgo
  };
  db.topupOrders.set(testId, order);
  console.log(`  INSERTED. age_sec=${(Date.now() - new Date(twoHoursAgo).getTime()) / 1000}`);

  console.log(`\n[STEP 2] Run expireStaleTopupOrders()`);
  const result = await expireStaleTopupOrders({});
  console.log(`  cutoffIso=${result.cutoffIso}`);
  console.log(`  timeoutMs=${result.timeoutMs}`);
  console.log(`  expiredCount=${result.expiredCount}`);
  console.log(`  expiredOrders[0]?.status=${result.expiredOrders[0]?.status}`);
  console.log(`  expiredOrders[0]?.failureReason=${result.expiredOrders[0]?.failureReason}`);

  console.log(`\n[STEP 3] Verify in db`);
  const persisted = db.topupOrders.get(testId);
  if (!persisted) {
    console.error("  Test row vanished!");
    process.exit(1);
  }
  console.log(`  status=${persisted.status}`);
  console.log(`  failureReason=${persisted.failureReason}`);
  console.log(`  createdAt=${persisted.createdAt} (should still be 2h ago)`);
  console.log(`  updatedAt=${persisted.updatedAt} (should be ~now)`);

  const allOk =
    persisted.status === "approval_expired" &&
    persisted.failureReason === "approval_timeout_after_30m" &&
    persisted.createdAt === twoHoursAgo;

  console.log(`\n[STEP 4] Idempotency check (run sweep again on already-expired order)`);
  const result2 = await expireStaleTopupOrders({});
  console.log(`  expiredCount=${result2.expiredCount} (should be 0)`);

  console.log(`\n[STEP 5] DELETE test row`);
  db.topupOrders.delete(testId);
  const afterDelete = db.topupOrders.has(testId);
  console.log(`  exists after delete: ${afterDelete} (should be false)`);

  console.log(`\n[STEP 6] Final check`);
  console.log(`  topupOrders total: ${db.topupOrders.size}`);

  if (!allOk || result.expiredCount !== 1 || result2.expiredCount !== 0 || afterDelete) {
    console.error(`\n❌ FAILED`);
    process.exit(1);
  }
  console.log(`\n✅ ALL CHECKS PASSED`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

