import { requestTestTokens } from "@/lib/domain/services";
import { errorJson, okJson, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

type FaucetBody = {
  userId: string;
  tokenId: string;
};

export async function POST(request: Request) {
  try {
    const body = await readJson<FaucetBody>(request);
    return okJson(await requestTestTokens(body));
  } catch (error) {
    return errorJson(error);
  }
}
