import { requireCurrentUser } from "@/lib/auth/session";
import { createCawGateway } from "@/lib/caw/gateway";
import { errorJson, okJson } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireCurrentUser();
    const walletId = user.cawWalletId || process.env.AGENT_WALLET_WALLET_ID || process.env.CAW_WALLET_ID;
    if (!walletId) {
      throw new Error("Bind a CAW Wallet UUID before reading CAW transactions.");
    }

    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") ?? 50);
    const records = await createCawGateway().listTransactions({ walletId, limit });

    return okJson({ records });
  } catch (error) {
    return errorJson(error);
  }
}
