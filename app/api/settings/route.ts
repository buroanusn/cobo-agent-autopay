// app/api/settings/route.ts
// Read/write runtime config settings — in-memory for now, DB schema in later iteration.
import { okJson, errorJson, readJson } from "@/lib/http";
import { getR34SweepHeartbeatStatus } from "@/lib/r34-sweep-heartbeat";
import { requireCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

// In-memory settings store (global, survives HMR via globalThis)
declare global {
  // eslint-disable-next-line no-var
  var __AUTOPAY_SETTINGS__: Record<string, unknown> | undefined;
}

function getSettings(): Record<string, unknown> {
  if (!globalThis.__AUTOPAY_SETTINGS__) {
    globalThis.__AUTOPAY_SETTINGS__ = {};
  }
  return globalThis.__AUTOPAY_SETTINGS__;
}

export async function GET() {
  await requireCurrentUser();
  const store = getSettings();
  const hb = getR34SweepHeartbeatStatus();
  return okJson({
    veniceBalanceThreshold: store.veniceBalanceThreshold ?? hb.veniceBalanceThreshold ?? 5,
    ...store
  });
}

export async function POST(request: Request) {
  await requireCurrentUser();
  const body = await readJson<{ veniceBalanceThreshold?: number }>(request);
  if (body.veniceBalanceThreshold !== undefined) {
    const raw = body.veniceBalanceThreshold;
    const num = typeof raw === "number" && Number.isFinite(raw) ? raw : Number(raw);
    if (!Number.isFinite(num) || num < 0 || num > 1000) {
      return errorJson("veniceBalanceThreshold must be a number between 0 and 1000");
    }
    getSettings().veniceBalanceThreshold = num;
    process.env.VENICE_BALANCE_THRESHOLD = String(num);
  }
  return okJson({ ok: true, settings: { ...getSettings() } });
}
