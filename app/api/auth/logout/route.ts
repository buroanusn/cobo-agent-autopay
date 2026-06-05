import { logout } from "@/lib/auth/session";
import { errorJson, okJson } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await logout();
    return okJson({ ok: true });
  } catch (error) {
    return errorJson(error);
  }
}
