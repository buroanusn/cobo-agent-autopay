import { requireCurrentUser } from "@/lib/auth/session";
import { listInferenceLogs } from "@/lib/store/venice-file-logs";
import { errorJson, okJson } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireCurrentUser();
    return okJson({ ok: true, logs: listInferenceLogs(20) });
  } catch (error) {
    return errorJson(error);
  }
}
