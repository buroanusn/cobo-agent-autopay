import { requireCurrentUser } from "@/lib/auth/session";
import { executeAutoTopup } from "@/lib/domain/services";
import { errorJson, okJson } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const user = await requireCurrentUser();
    return okJson(await executeAutoTopup({ userId: user.id, reason: "manual" }));
  } catch (error) {
    return errorJson(error);
  }
}
