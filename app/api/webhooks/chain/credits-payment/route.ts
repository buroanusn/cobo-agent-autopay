import { settleCreditsPurchase } from "@/lib/domain/services";
import { errorJson, okJson, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

type CreditsPaymentEvent = {
  orderId: string;
  onchainOrderId: string;
  amountUsdcMinor: number;
  txHash: string;
  eventId: string;
};

export async function POST(request: Request) {
  try {
    const body = await readJson<CreditsPaymentEvent>(request);
    if (!body.amountUsdcMinor) {
      throw new Error("amountUsdcMinor is required.");
    }
    return okJson(
      await settleCreditsPurchase({
        orderId: body.orderId,
        onchainOrderId: body.onchainOrderId,
        amountUsdcMinor: body.amountUsdcMinor,
        txHash: body.txHash,
        eventId: body.eventId
      })
    );
  } catch (error) {
    return errorJson(error);
  }
}
