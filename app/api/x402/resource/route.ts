import { errorJson, okJson, readJson } from "@/lib/http";
import { createMockPaymentRequirements, runX402CawMockResource } from "@/lib/x402/mock-flow";

export const dynamic = "force-dynamic";

type X402ResourceBody = {
  userId: string;
  requestId: string;
};

export async function GET() {
  return okJson(
    {
      error: "payment_required",
      paymentRequirements: createMockPaymentRequirements()
    },
    { status: 402 }
  );
}

export async function POST(request: Request) {
  try {
    const body = await readJson<X402ResourceBody>(request);
    return okJson(await runX402CawMockResource(body));
  } catch (error) {
    return errorJson(error);
  }
}
