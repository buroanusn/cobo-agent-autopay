import { requireCurrentUser } from "@/lib/auth/session";
import { approveUsdcForCreditsPayment } from "@/lib/domain/services";
import { errorJson, okJson, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

type ApproveBody = {
  amountUsdcMinor?: number;
};

export async function POST(request: Request) {
  try {
    const user = await requireCurrentUser();
    const body = await readJson<ApproveBody>(request);
    return okJson(await approveUsdcForCreditsPayment({ ...body, userId: user.id }));
  } catch (error) {
    return errorJson(error);
  }
}
