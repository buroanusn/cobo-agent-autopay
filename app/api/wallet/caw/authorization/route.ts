import { createCawAuthorization, previewCawAuthorization } from "@/lib/domain/services";
import { errorJson, okJson, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

type AuthorizationBody = {
  userId: string;
  intent: string;
  singleLimitUsdcMinor: number;
  dailyLimitUsdcMinor: number;
  monthlyLimitUsdcMinor: number;
  validDays: number;
  previewOnly: boolean;
};

export async function POST(request: Request) {
  try {
    const body = await readJson<AuthorizationBody>(request);
    if (body.previewOnly) {
      return okJson(await previewCawAuthorization(body));
    }

    return okJson(await createCawAuthorization(body));
  } catch (error) {
    return errorJson(error);
  }
}
