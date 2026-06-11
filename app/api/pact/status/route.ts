import { requireCurrentUser } from "@/lib/auth/session";
import { getCreditRepository } from "@/lib/store";
import { errorJson, okJson } from "@/lib/http";

export const dynamic = "force-dynamic";

/**
 * GET /api/pact/status
 * Returns all pact authorizations from DB for the current user:
 * - credits_payment (old system)
 * - venice_x402
 * - blockrun_x402
 */
export async function GET() {
  try {
    const user = await requireCurrentUser();
    const repo = getCreditRepository();

    const [creditsAuth, veniceAuth, blockrunAuth] = await Promise.all([
      repo.getActiveAuthorization(user.id, "credits_payment"),
      repo.getActiveAuthorization(user.id, "venice_x402"),
      repo.getActiveAuthorization(user.id, "blockrun_x402"),
    ]);

    return okJson({
      credits: creditsAuth ? formatAuth(creditsAuth) : null,
      venice: veniceAuth ? formatAuth(veniceAuth) : null,
      blockrun: blockrunAuth ? formatAuth(blockrunAuth) : null,
    });
  } catch (error) {
    return errorJson(error);
  }
}

function formatAuth(auth: { pactId: string; status: string; expiresAt: string; singleLimitUsdcMinor: number; dailyLimitUsdcMinor: number; monthlyLimitUsdcMinor: number; createdAt: string }) {
  return {
    pactId: auth.pactId,
    pactIdShort: auth.pactId ? `${auth.pactId.slice(0, 8)}...` : null,
    status: auth.status,
    expiresAt: auth.expiresAt,
    singleLimitUsd: auth.singleLimitUsdcMinor / 1_000_000,
    dailyLimitUsd: auth.dailyLimitUsdcMinor / 1_000_000,
    monthlyLimitUsd: auth.monthlyLimitUsdcMinor / 1_000_000,
    createdAt: auth.createdAt,
  };
}
