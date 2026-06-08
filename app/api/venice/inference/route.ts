import { requireCurrentUser } from "@/lib/auth/session";
import { errorJson, okJson, readJson } from "@/lib/http";
import { getVeniceApiKey, runVeniceChatCompletion } from "@/lib/venice/client";

export const dynamic = "force-dynamic";

type InferenceBody = {
  prompt?: string;
  systemPrompt?: string;
  model?: string;
};

export async function POST(request: Request) {
  try {
    await requireCurrentUser();
    if (!getVeniceApiKey()) {
      throw new Error("VENICE_API_KEY is required for Venice inference.");
    }
    const body = await readJson<InferenceBody>(request);
    const prompt = body.prompt?.trim();
    if (!prompt) {
      return errorJson(new Error("prompt is required"), 400);
    }
    return okJson({
      ok: true,
      result: await runVeniceChatCompletion({
        prompt,
        systemPrompt: body.systemPrompt,
        model: body.model
      })
    });
  } catch (error) {
    return errorJson(error);
  }
}
