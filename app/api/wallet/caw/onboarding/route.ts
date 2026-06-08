import { requireCurrentUser } from "@/lib/auth/session";
import {
  advanceCawWalletOnboarding,
  getCawWalletOnboarding
} from "@/lib/domain/services";
import { errorJson, okJson, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

type OnboardingBody = {
  agentName?: string;
  apiUrl?: string;
  answers?: Record<string, unknown>;
};

export async function GET() {
  try {
    const user = await requireCurrentUser();
    return okJson(await getCawWalletOnboarding({ userId: user.id }));
  } catch (error) {
    return errorJson(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireCurrentUser();
    const body = await readJson<OnboardingBody>(request);
    return okJson(
      await advanceCawWalletOnboarding({
        userId: user.id,
        agentName: body.agentName,
        apiUrl: body.apiUrl,
        answers: isRecord(body.answers) ? body.answers : undefined
      })
    );
  } catch (error) {
    return errorJson(error);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
