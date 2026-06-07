import { requireCurrentUser } from "@/lib/auth/session";
import { getCawIntegrationStatus } from "@/lib/domain/services";
import { errorJson, okJson } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireCurrentUser();
    return okJson(await getCawIntegrationStatus(user.id));
  } catch (error) {
    return errorJson(error);
  }
}
