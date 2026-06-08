import { requireCurrentUser } from "@/lib/auth/session";
import { errorJson, okJson } from "@/lib/http";
import { fetchVeniceBillingBalance } from "@/lib/venice/client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireCurrentUser();
    return okJson({
      ok: true,
      balance: await fetchVeniceBillingBalance()
    });
  } catch (error) {
    return errorJson(error);
  }
}
