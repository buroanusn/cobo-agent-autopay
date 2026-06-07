import { requireCurrentUser } from "@/lib/auth/session";
import { getCreditRepository } from "@/lib/store";
import { refreshVeniceBalance } from "@/lib/venice/balance";
import { getLatestBalanceSnapshot, listBalanceSnapshots } from "@/lib/store/venice";
import { getVeniceApiKey } from "@/lib/config/store";
import { errorJson, okJson } from "@/lib/http";
import { getCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireCurrentUser();
    const url = new URL(request.url);
    const refresh = url.searchParams.get("refresh") === "1";

    if (refresh) {
      if (!getVeniceApiKey()) {
        return errorJson(new Error("Venice API key not configured. Set it from the dashboard."), 400);
      }
      const repo = getCreditRepository();
      // Use the session user (the route is already auth-gated, so requireCurrentUser
      // above guarantees getCurrentUser() returns a user). Fall back to demo user
      // if needed for safety.
      const sessionUser = await import("@/lib/auth/session").then((m) => m.getCurrentUser());
      const userId = sessionUser?.id ?? "demo_user_local";
      const snapshot = await repo.snapshotForUser(userId);
      const walletAddress = snapshot.user.cawWalletAddress;
      const fresh = await refreshVeniceBalance({ walletAddress });
      return okJson({ ok: true, snapshot: fresh, history: listBalanceSnapshots(5) });
    }

    const latest = getLatestBalanceSnapshot();
    return okJson({ ok: true, snapshot: latest ?? null, history: listBalanceSnapshots(5) });
  } catch (error) {
    return errorJson(error);
  }
}
