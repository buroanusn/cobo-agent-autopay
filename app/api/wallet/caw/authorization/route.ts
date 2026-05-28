import { createCawAuthorization } from "@/lib/domain/services";
import { errorJson, okJson, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

type AuthorizationBody = {
  userId: string;
  singleLimitUsdcMinor: number;
  dailyLimitUsdcMinor: number;
  monthlyLimitUsdcMinor: number;
  validDays: number;
};

export async function POST(request: Request) {
  try {
    const body = await readJson<AuthorizationBody>(request);
    return okJson(await createCawAuthorization(body));
  } catch (error) {
    return errorJson(error);
  }
}
