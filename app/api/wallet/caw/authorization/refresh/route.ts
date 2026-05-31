import { refreshCawAuthorization } from "@/lib/domain/services";
import { errorJson, okJson, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

type RefreshBody = {
  userId: string;
};

export async function POST(request: Request) {
  try {
    const body = await readJson<RefreshBody>(request);
    return okJson(await refreshCawAuthorization(body));
  } catch (error) {
    return errorJson(error);
  }
}
