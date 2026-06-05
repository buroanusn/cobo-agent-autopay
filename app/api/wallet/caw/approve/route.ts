import { approveUsdcForCreditsPayment } from "@/lib/domain/services";
import { errorJson, okJson, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

type ApproveBody = {
  userId?: string;
  amountUsdcMinor?: number;
};

export async function POST(request: Request) {
  try {
    const body = await readJson<ApproveBody>(request);
    return okJson(await approveUsdcForCreditsPayment(body));
  } catch (error) {
    return errorJson(error);
  }
}
