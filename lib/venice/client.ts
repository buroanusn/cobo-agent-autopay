// Low-level HTTP client for Venice APIs.
// x402 inference flow uses caw fetch (see lib/venice/topup.ts),
// this client handles the Bearer-key paths:
//   - GET  /api/v1/billing/balance  (account balance, dual-currency DIEM+USD)
//   - GET  /x402/balance/{walletAddress}  (x402 credit balance for a wallet)
//   - POST /api/v1/chat/completions  (inference, bearer-authenticated)
//   - GET  /api/v1/models  (list available models)

import { getVeniceApiKey, getVeniceBaseUrl } from "@/lib/config/store";

export type VeniceBearerRequest = {
  method?: "GET" | "POST";
  path: string;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  // If true, do not throw on 4xx/5xx; return full response
  passthrough?: boolean;
};

export type VeniceBearerResponse = {
  status: number;
  headers: Headers;
  body: unknown;
};

export class VeniceApiError extends Error {
  readonly status: number;
  readonly body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

function buildUrl(path: string, query?: VeniceBearerRequest["query"]) {
  const base = getVeniceBaseUrl().replace(/\/+$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${base}${cleanPath}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null) {
        url.searchParams.set(k, String(v));
      }
    }
  }
  return url.toString();
}

export async function veniceRequest(req: VeniceBearerRequest): Promise<VeniceBearerResponse> {
  const apiKey = getVeniceApiKey();
  if (!apiKey) {
    throw new Error("Venice API key is not configured. Set it from the dashboard.");
  }

  const url = buildUrl(req.path, req.query);
  const init: RequestInit = {
    method: req.method ?? "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    cache: "no-store"
  };
  if (req.body !== undefined) {
    init.body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
  }

  const res = await fetch(url, init);
  const text = await res.text();
  let body: unknown = text;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      // Keep as text if not JSON
    }
  }

  if (!res.ok && !req.passthrough) {
    const message =
      (body && typeof body === "object" && "error" in body && (body as { error?: string }).error) ||
      `Venice API ${res.status} ${res.statusText}`;
    throw new VeniceApiError(typeof message === "string" ? message : String(message), res.status, body);
  }

  return { status: res.status, headers: res.headers, body };
}

export type VeniceBillingBalance = {
  canConsume: boolean;
  consumptionCurrency: "USD" | "DIEM" | "VCU" | "BUNDLED_CREDITS" | null;
  balances: {
    diem: number;
    usd: number;
  };
  diemEpochAllocation: number;
};

export type VeniceX402Balance = {
  // Schema inferred from docs (we will normalize on read; server may return slightly different shape)
  balance?: number;
  amount?: number;
  canConsume?: boolean;
  currency?: string;
  raw: unknown;
};

export async function fetchVeniceBillingBalance(): Promise<VeniceBillingBalance> {
  const res = await veniceRequest({ path: "/api/v1/billing/balance" });
  const body = res.body as {
    canConsume?: boolean;
    consumptionCurrency?: VeniceBillingBalance["consumptionCurrency"];
    balances?: { diem?: number; usd?: number };
    diemEpochAllocation?: number;
  };
  return {
    canConsume: Boolean(body?.canConsume),
    consumptionCurrency: body?.consumptionCurrency ?? null,
    balances: {
      diem: Number(body?.balances?.diem ?? 0),
      usd: Number(body?.balances?.usd ?? 0)
    },
    diemEpochAllocation: Number(body?.diemEpochAllocation ?? 0)
  };
}

export async function fetchVeniceX402Balance(walletAddress: string): Promise<VeniceX402Balance> {
  // x402 balance requires Sign-in-with-x (SIWE) auth, but we'll attempt the GET
  // and surface the 401/402 response so the dashboard can prompt the user to use
  // the x402 top-up flow (caw fetch) instead.
  try {
    const res = await veniceRequest({
      path: `/x402/balance/${walletAddress}`,
      passthrough: true
    });
    return { ...((res.body as object) ?? {}), raw: res.body };
  } catch (error) {
    if (error instanceof VeniceApiError) {
      return { raw: error.body };
    }
    throw error;
  }
}

export type VeniceChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type VeniceChatRequest = {
  model?: string;
  messages: VeniceChatMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: false;
};

export type VeniceChatResponse = {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: { role: "assistant"; content: string };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

export async function veniceChatCompletion(
  input: VeniceChatRequest
): Promise<VeniceChatResponse> {
  const res = await veniceRequest({
    method: "POST",
    path: "/api/v1/chat/completions",
    body: {
      model: input.model,
      messages: input.messages,
      temperature: input.temperature ?? 0.7,
      max_tokens: input.max_tokens ?? 512,
      stream: false
    }
  });
  return res.body as VeniceChatResponse;
}
