import { NextRequest } from "next/server";
import { requireCurrentUser } from "@/lib/auth/session";
import { runVeniceInference } from "@/lib/venice/inference";
import { getVeniceApiKey } from "@/lib/config/store";
import { veniceChatCompletion, VeniceApiError } from "@/lib/venice/client";
import { getVeniceModel } from "@/lib/config/store";
import { decodeSiweXHeader } from "@/lib/venice/siwe";
import { createInferenceLog } from "@/lib/store/venice";
import { errorJson, okJson, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

/**
 * Inference endpoint supports two auth modes:
 *   A. Venice API key (Bearer) — credit balance deducted from the Venice
 *      account that owns the key. Simple, requires the user to set up a
 *      Venice account and add credits.
 *   B. X-Sign-In-With-X header (wallet-bound EIP-712 typed data signed by
 *      the CAW wallet). Credit balance deducted from the wallet-bound Venice
 *      account. Use /api/venice/sign-message to generate the header value.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireCurrentUser();
    const body = await readJson<{
      prompt?: string;
      systemPrompt?: string;
      model?: string;
      // Pre-generated SiweX header. If present, takes precedence over the
      // API-key path; if absent, we try the API key.
      siweXHeader?: string;
    }>(request);
    if (!body.prompt || !body.prompt.trim()) {
      return errorJson(new Error("prompt is required"), 400);
    }
    const model = body.model?.trim() || getVeniceModel();

    // Pre-generated SiweX header takes precedence
    if (body.siweXHeader) {
      // Verify it's a valid header we generated
      try {
        decodeSiweXHeader(body.siweXHeader);
      } catch (e) {
        return errorJson(new Error(`Invalid X-Sign-In-With-X header: ${(e as Error).message}`), 400);
      }
      return await runWithSiweX(user.id, body, body.siweXHeader, model);
    }

    // Fall back to API-key path
    if (!getVeniceApiKey()) {
      return errorJson(
        new Error(
          "Venice API key not configured. Either set it from the dashboard, or generate a wallet-signed X-Sign-In-With-X header (requires real CAW mode + active Pact)."
        ),
        400
      );
    }
    const result = await runVeniceInference({
      userId: user.id,
      prompt: body.prompt.trim(),
      systemPrompt: body.systemPrompt?.trim(),
      model
    });
    if (result.error) {
      return errorJson({ error: result.error, log: result.log }, 502);
    }
    return okJson({ ok: true, log: result.log, raw: result.raw, authMode: "api_key" });
  } catch (error) {
    return errorJson(error);
  }
}

async function runWithSiweX(
  userId: string,
  body: { prompt: string; systemPrompt?: string },
  siweXHeader: string,
  model: string
) {
  const start = Date.now();
  const messages = [];
  if (body.systemPrompt) {
    messages.push({ role: "system" as const, content: body.systemPrompt });
  }
  messages.push({ role: "user" as const, content: body.prompt });

  try {
    const res = await fetch("https://api.venice.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Sign-In-With-X": siweXHeader
      },
      body: JSON.stringify({ model, messages, stream: false })
    });
    const text = await res.text();
    let parsed: unknown = text;
    try {
      parsed = JSON.parse(text);
    } catch {
      // keep as text
    }
    if (!res.ok) {
      const durationMs = Date.now() - start;
      const errorMessage = `Venice ${res.status}: ${text.slice(0, 300)}`;
      const log = createInferenceLog({
        userId,
        prompt: body.prompt,
        model,
        response: "",
        inputTokens: null,
        outputTokens: null,
        status: "failed",
        errorMessage,
        durationMs
      });
      return errorJson({ error: errorMessage, log }, res.status);
    }
    const result = parsed as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const output = result.choices?.[0]?.message?.content ?? "";
    const durationMs = Date.now() - start;
    const log = createInferenceLog({
      userId,
      prompt: body.prompt,
      model,
      response: output,
      inputTokens: result.usage?.prompt_tokens ?? null,
      outputTokens: result.usage?.completion_tokens ?? null,
      status: "completed",
      durationMs
    });
    return okJson({ ok: true, log, raw: result, authMode: "siwe_x" });
  } catch (error) {
    const durationMs = Date.now() - start;
    const message = error instanceof Error ? error.message : "unknown error";
    const log = createInferenceLog({
      userId,
      prompt: body.prompt,
      model,
      response: "",
      inputTokens: null,
      outputTokens: null,
      status: "failed",
      errorMessage: message,
      durationMs
    });
    return errorJson({ error: message, log }, 502);
  }
}
