import { requireCurrentUser } from "@/lib/auth/session";
import { recommendGuardrails } from "@/lib/domain/services";
import { errorJson, okJson, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

type RecommendBody = {
  agentCount: number;
  dailySpendUsdc: number;
  riskProfile: "conservative" | "balanced" | "growth";
};

export async function POST(request: Request) {
  try {
    const user = await requireCurrentUser();
    const body = await readJson<RecommendBody>(request);
    return okJson(await recommendGuardrails({ ...body, userId: user.id }));
  } catch (error) {
    return errorJson(error);
  }
}
