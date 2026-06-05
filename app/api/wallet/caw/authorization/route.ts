import { requireCurrentUser } from "@/lib/auth/session";
import { createCawAuthorization, previewCawAuthorization } from "@/lib/domain/services";
import { errorJson, okJson, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

type AuthorizationBody = {
  intent: string;
  singleLimitUsdcMinor: number;
  dailyLimitUsdcMinor: number;
  monthlyLimitUsdcMinor: number;
  validDays: number;
  previewOnly: boolean;
};

export async function POST(request: Request) {
  try {
    const user = await requireCurrentUser();
    const body = await readJson<AuthorizationBody>(request);
    if (body.previewOnly) {
      return okJson(await previewCawAuthorization({ ...body, userId: user.id }));
    }

    return okJson(await createCawAuthorization({ ...body, userId: user.id }));
  } catch (error) {
    return errorJson(error);
  }
}
