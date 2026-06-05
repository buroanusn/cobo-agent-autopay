import { requireCurrentUser } from "@/lib/auth/session";
import { connectCawWallet } from "@/lib/domain/services";
import { errorJson, okJson, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

type ConnectBody = {
  walletAddress?: string;
};

export async function POST(request: Request) {
  try {
    const user = await requireCurrentUser();
    const body = await readJson<ConnectBody>(request);
    return okJson(await connectCawWallet({ ...body, userId: user.id }));
  } catch (error) {
    return errorJson(error);
  }
}
