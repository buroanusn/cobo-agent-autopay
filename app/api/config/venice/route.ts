import { NextRequest } from "next/server";
import { requireCurrentUser } from "@/lib/auth/session";
import {
  getVeniceApiKey,
  getVeniceModel,
  getLowBalanceThresholdUsd,
  getDefaultTopupUsd,
  maskApiKey,
  setVeniceApiKey,
  setVeniceModel
} from "@/lib/config/store";
import { errorJson, okJson, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireCurrentUser();
    return okJson({
      veniceApiKeyConfigured: Boolean(getVeniceApiKey()),
      veniceApiKeyMasked: maskApiKey(getVeniceApiKey()),
      veniceModel: getVeniceModel(),
      lowBalanceThresholdUsd: getLowBalanceThresholdUsd(),
      defaultTopupUsd: getDefaultTopupUsd()
    });
  } catch (error) {
    return errorJson(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireCurrentUser();
    const body = await readJson<{ veniceApiKey?: string; veniceModel?: string }>(request);
    const updated: string[] = [];
    if (typeof body.veniceApiKey === "string" && body.veniceApiKey.trim()) {
      setVeniceApiKey(body.veniceApiKey.trim());
      updated.push("venice_api_key");
    }
    if (typeof body.veniceModel === "string" && body.veniceModel.trim()) {
      setVeniceModel(body.veniceModel.trim());
      updated.push("venice_inference_model");
    }
    return okJson({
      ok: true,
      updated,
      veniceApiKeyConfigured: Boolean(getVeniceApiKey()),
      veniceApiKeyMasked: maskApiKey(getVeniceApiKey()),
      veniceModel: getVeniceModel()
    });
  } catch (error) {
    return errorJson(error);
  }
}
