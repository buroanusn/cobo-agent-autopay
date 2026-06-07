// Venice inference (Bearer key path). For x402 pay-per-call, see topup.ts.

import { veniceChatCompletion, VeniceApiError } from "@/lib/venice/client";
import { getVeniceModel } from "@/lib/config/store";
import { createInferenceLog } from "@/lib/store/venice";

export async function runVeniceInference(input: {
  userId: string;
  prompt: string;
  systemPrompt?: string;
  model?: string;
}) {
  const start = Date.now();
  const model = input.model ?? getVeniceModel();
  const messages = [];
  if (input.systemPrompt) {
    messages.push({ role: "system" as const, content: input.systemPrompt });
  }
  messages.push({ role: "user" as const, content: input.prompt });

  try {
    const result = await veniceChatCompletion({ model, messages });
    const durationMs = Date.now() - start;
    const text = result.choices?.[0]?.message?.content ?? "";
    const log = createInferenceLog({
      userId: input.userId,
      prompt: input.prompt,
      model,
      response: text,
      inputTokens: result.usage?.prompt_tokens ?? null,
      outputTokens: result.usage?.completion_tokens ?? null,
      status: "completed",
      durationMs
    });
    return { log, raw: result };
  } catch (error) {
    const durationMs = Date.now() - start;
    const message = error instanceof Error ? error.message : "Unknown error";
    const log = createInferenceLog({
      userId: input.userId,
      prompt: input.prompt,
      model,
      response: "",
      inputTokens: null,
      outputTokens: null,
      status: "failed",
      errorMessage: error instanceof VeniceApiError ? `${error.status}: ${message}` : message,
      durationMs
    });
    return { log, error: message };
  }
}
