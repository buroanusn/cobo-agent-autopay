import { requireCurrentUser } from "@/lib/auth/session";
import { getCreditRepository } from "@/lib/store";
import { errorJson, okJson } from "@/lib/http";
import { getBlockRunConfigInfo } from "@/lib/blockrun/topup";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireCurrentUser();
    const repo = getCreditRepository();
    const config = getBlockRunConfigInfo();

    const auth = await repo.getActiveAuthorization(user.id, "blockrun_x402");

    if (!auth) {
      return okJson({
        hasPact: false,
        network: config.network,
        error: "未找到 BlockRun 的 Pact 授权",
      });
    }

    return okJson({
      hasPact: true,
      pactId: auth.pactId ? `${auth.pactId.slice(0, 8)}...` : null,
      pactIdFull: auth.pactId,
      network: config.network,
      status: auth.status,
      singleLimitUsd: auth.singleLimitUsdcMinor / 1_000_000,
      dailyLimitUsd: auth.dailyLimitUsdcMinor / 1_000_000,
      monthlyLimitUsd: auth.monthlyLimitUsdcMinor / 1_000_000,
      expiresAt: auth.expiresAt,
    });
  } catch (error) {
    return errorJson(error);
  }
}
