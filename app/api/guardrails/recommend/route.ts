import { recommendGuardrails } from "@/lib/domain/services";
import { errorJson, okJson, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

type RecommendBody = {
  userId: string;
  agentCount: number;
  dailySpendUsdc: number;
  riskProfile: "conservative" | "balanced" | "growth";
};

export async function POST(request: Request) {
  try {
    const body = await readJson<RecommendBody>(request);
    return okJson(await recommendGuardrails(body));
  } catch (error) {
    return errorJson(error);
  }
}
