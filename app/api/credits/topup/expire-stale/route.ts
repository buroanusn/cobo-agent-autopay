import { requireCurrentUser } from "@/lib/auth/session";
import { expireStaleTopupOrders, STALE_TOPUP_TIMEOUT_MS } from "@/lib/domain/services";
import { errorJson, okJson, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

type SweepBody = {
  timeoutMs?: number;
};

export async function POST(request: Request) {
  try {
    await requireCurrentUser();
    const body = await readJson<SweepBody>(request).catch(() => ({} as SweepBody));
    const timeoutMs =
      typeof body.timeoutMs === "number" && body.timeoutMs > 0
        ? body.timeoutMs
        : STALE_TOPUP_TIMEOUT_MS;
    return okJson(await expireStaleTopupOrders({ timeoutMs }));
  } catch (error) {
    return errorJson(error);
  }
}

export async function GET() {
  return okJson({
    defaultTimeoutMs: STALE_TOPUP_TIMEOUT_MS,
    description:
      "POST to sweep topup orders stuck in pending_policy / pending_approval / caw_submitted / chain_pending past the timeout. Returns {cutoffIso, timeoutMs, expiredCount, expiredOrders}."
  });
}
