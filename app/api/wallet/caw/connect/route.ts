import { connectCawWallet } from "@/lib/domain/services";
import { errorJson, okJson, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

type ConnectBody = {
  userId: string;
  walletAddress: string;
};

export async function POST(request: Request) {
  try {
    const body = await readJson<ConnectBody>(request);
    return okJson(await connectCawWallet(body));
  } catch (error) {
    return errorJson(error);
  }
}
