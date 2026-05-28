import { executeAutoTopup } from "@/lib/domain/services";
import { errorJson, okJson, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

type TopupBody = {
  userId: string;
};

export async function POST(request: Request) {
  try {
    const body = await readJson<TopupBody>(request);
    return okJson(await executeAutoTopup({ userId: body.userId, reason: "manual" }));
  } catch (error) {
    return errorJson(error);
  }
}
