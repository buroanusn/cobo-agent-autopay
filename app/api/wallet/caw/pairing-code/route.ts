import { requireCurrentUser } from "@/lib/auth/session";
import { createPairingCode } from "@/lib/domain/services";
import { errorJson, okJson } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const user = await requireCurrentUser();
    return okJson(await createPairingCode({ userId: user.id }));
  } catch (error) {
    return errorJson(error);
  }
}
