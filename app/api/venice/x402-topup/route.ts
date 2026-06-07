import { NextRequest } from "next/server";
import { requireCurrentUser } from "@/lib/auth/session";
import {
  discoverVeniceX402Requirements,
  pickBaseUsdcAccept,
  runVeniceX402Topup
} from "@/lib/venice/topup";
import { errorJson, okJson, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireCurrentUser();
    const reqs = await discoverVeniceX402Requirements();
    const accept = pickBaseUsdcAccept(reqs);
    return okJson({
      ok: true,
      requirements: reqs,
      selected: accept
    });
  } catch (error) {
    return errorJson(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireCurrentUser();
    const body = await readJson<{ usdAmount?: number }>(request);
    const usdAmount = Number(body.usdAmount);
    if (!Number.isFinite(usdAmount) || usdAmount <= 0) {
      return errorJson(new Error("usdAmount must be a positive number"), 400);
    }

    const repo = await import("@/lib/store").then((m) => m.getCreditRepository());
    const snapshot = await repo.snapshotForUser(user.id);
    if (!snapshot.user.cawWalletAddress) {
      return errorJson(new Error("Connect a CAW wallet first (Connect Wallet card)."), 400);
    }
    if (!snapshot.authorization || snapshot.authorization.status !== "active") {
      return errorJson(new Error("Create and approve an active Pact first (CAW Pact card)."), 400);
    }

    const result = await runVeniceX402Topup({
      userId: user.id,
      walletAddress: snapshot.user.cawWalletAddress,
      pactId: snapshot.authorization.pactId,
      usdAmount
    });
    return okJson({ ok: result.status === "submitted", ...result });
  } catch (error) {
    return errorJson(error);
  }
}
