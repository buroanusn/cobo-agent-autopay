import { createPairingCode } from "@/lib/domain/services";
import { errorJson, okJson, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

type PairingBody = {
  userId: string;
};

export async function POST(request: Request) {
  try {
    const body = await readJson<PairingBody>(request);
    return okJson(await createPairingCode(body));
  } catch (error) {
    return errorJson(error);
  }
}
