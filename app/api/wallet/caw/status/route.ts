import { getCawIntegrationStatus } from "@/lib/domain/services";
import { errorJson, okJson } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return okJson(await getCawIntegrationStatus());
  } catch (error) {
    return errorJson(error, 500);
  }
}
