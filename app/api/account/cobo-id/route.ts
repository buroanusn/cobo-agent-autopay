import { requireCurrentUser } from "@/lib/auth/session";
import { bindCoboAccount } from "@/lib/domain/services";
import { errorJson, okJson, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

type BindCoboIdBody = {
  coboId?: string;
};

export async function POST(request: Request) {
  try {
    const user = await requireCurrentUser();
    const body = await readJson<BindCoboIdBody>(request);
    return okJson(await bindCoboAccount({ userId: user.id, coboId: body.coboId }));
  } catch (error) {
    return errorJson(error);
  }
}
