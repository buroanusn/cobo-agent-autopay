import { getDashboardSnapshot } from "@/lib/domain/services";
import { errorJson, okJson } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return okJson(getDashboardSnapshot());
  } catch (error) {
    return errorJson(error, 500);
  }
}
