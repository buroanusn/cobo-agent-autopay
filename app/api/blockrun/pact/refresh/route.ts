import { requireCurrentUser } from "@/lib/auth/session";
import { refreshBlockRunX402Authorization } from "@/lib/blockrun/services";
import { errorJson, okJson } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const user = await requireCurrentUser();
    return okJson(await refreshBlockRunX402Authorization({ userId: user.id }));
  } catch (error) {
    return errorJson(error);
  }
}
