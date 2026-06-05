import { requireCurrentUser } from "@/lib/auth/session";
import { requestTestTokens } from "@/lib/domain/services";
import { errorJson, okJson, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

type FaucetBody = {
  tokenId?: string;
};

export async function POST(request: Request) {
  try {
    const user = await requireCurrentUser();
    const body = await readJson<FaucetBody>(request);
    return okJson(await requestTestTokens({ ...body, userId: user.id }));
  } catch (error) {
    return errorJson(error);
  }
}
