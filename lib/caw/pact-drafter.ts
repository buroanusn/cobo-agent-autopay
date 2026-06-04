type PactLimitInput = {
  singleLimitUsdcMinor: number;
  dailyLimitUsdcMinor: number;
  monthlyLimitUsdcMinor: number;
  validDays: number;
};

export type PactDraftContext = {
  walletAddress: string;
  chainName: string;
  cawChainId: string;
  usdcAddress: string;
  paymentContractAddress: string;
  limits: PactLimitInput;
};

export type PactDraftResult = {
  intent: string;
  originalIntent: string;
  executionPlan: string;
  policies: unknown[];
  completionConditions: unknown[];
  limits: PactLimitInput;
  draftedBy: "agent_llm" | "agent_deterministic";
  warnings: string[];
};

type RawAgentDraft = {
  intent?: unknown;
  executionPlan?: unknown;
  singleLimitUsdc?: unknown;
  dailyLimitUsdc?: unknown;
  monthlyLimitUsdc?: unknown;
  validDays?: unknown;
  warnings?: unknown;
};

const DEFAULT_INTENT =
  "Allow this agent to automatically top up my internal credits with Base Sepolia USDC when the balance is low.";

export async function draftCawPactFromIntent(input: {
  intent?: string;
  context: PactDraftContext;
}): Promise<PactDraftResult> {
  const originalIntent = input.intent?.trim() || DEFAULT_INTENT;
  const warnings: string[] = [];
  let rawDraft: RawAgentDraft | undefined;
  let draftedBy: PactDraftResult["draftedBy"] = "agent_deterministic";

  if (process.env.PACT_DRAFTER_MODE === "llm") {
    if (!process.env.OPENAI_API_KEY) {
      warnings.push("PACT_DRAFTER_MODE=llm but OPENAI_API_KEY is not configured; used deterministic CAW drafter.");
    } else {
      rawDraft = await draftWithOpenAi(originalIntent, input.context).catch((error: unknown) => {
        warnings.push(`LLM drafter unavailable; used deterministic CAW drafter. ${errorMessage(error)}`);
        return undefined;
      });
    }
    if (rawDraft) {
      draftedBy = "agent_llm";
    }
  }

  rawDraft ??= draftDeterministically(originalIntent, input.context);
  const rawWarnings = Array.isArray(rawDraft.warnings)
    ? rawDraft.warnings.filter((item): item is string => typeof item === "string")
    : [];
  warnings.push(...rawWarnings);

  return assembleValidatedPactDraft({
    originalIntent,
    rawDraft,
    context: input.context,
    draftedBy,
    warnings
  });
}

function assembleValidatedPactDraft(input: {
  originalIntent: string;
  rawDraft: RawAgentDraft;
  context: PactDraftContext;
  draftedBy: PactDraftResult["draftedBy"];
  warnings: string[];
}): PactDraftResult {
  const limits = clampLimits(
    {
      singleLimitUsdcMinor:
        usdcToMinor(input.rawDraft.singleLimitUsdc) ??
        parseRequestedUsdc(input.originalIntent, "single") ??
        input.context.limits.singleLimitUsdcMinor,
      dailyLimitUsdcMinor:
        usdcToMinor(input.rawDraft.dailyLimitUsdc) ??
        parseRequestedUsdc(input.originalIntent, "daily") ??
        input.context.limits.dailyLimitUsdcMinor,
      monthlyLimitUsdcMinor:
        usdcToMinor(input.rawDraft.monthlyLimitUsdc) ??
        parseRequestedUsdc(input.originalIntent, "monthly") ??
        input.context.limits.monthlyLimitUsdcMinor,
      validDays:
        positiveInteger(input.rawDraft.validDays) ??
        parseRequestedDays(input.originalIntent) ??
        input.context.limits.validDays
    },
    input.context.limits
  );
  const timeElapsedSeconds = Math.max(1, limits.validDays * 24 * 60 * 60);
  const policies = buildCreditsPaymentPolicies(input.context);
  const completionConditions = [
    {
      type: "time_elapsed",
      threshold: timeElapsedSeconds.toString()
    },
    {
      type: "amount_spent_usd",
      threshold: usdcMinorToUsdString(limits.monthlyLimitUsdcMinor)
    }
  ];

  return {
    intent: safeString(input.rawDraft.intent) || `Agent credits auto top-up on ${input.context.chainName}`,
    originalIntent: input.originalIntent,
    executionPlan:
      safeString(input.rawDraft.executionPlan) ||
      buildDeterministicExecutionPlan(input.originalIntent, input.context, limits),
    policies,
    completionConditions,
    limits,
    draftedBy: input.draftedBy,
    warnings: input.warnings
  };
}

function buildCreditsPaymentPolicies(context: PactDraftContext) {
  return [
    {
      name: "credits-payment-contract-call",
      type: "contract_call",
      rules: {
        effect: "allow",
        when: {
          chain_in: [context.cawChainId],
          target_in: [
            { chain_id: context.cawChainId, contract_addr: context.paymentContractAddress },
            { chain_id: context.cawChainId, contract_addr: context.usdcAddress }
          ]
        },
        deny_if: {
          usage_limits: {
            rolling_24h: {
              tx_count_gt: 10
            }
          }
        }
      },
      priority: 100,
      is_active: true
    }
  ];
}

function draftDeterministically(intent: string, context: PactDraftContext): RawAgentDraft {
  const limits = {
    singleLimitUsdcMinor: parseRequestedUsdc(intent, "single") ?? context.limits.singleLimitUsdcMinor,
    dailyLimitUsdcMinor: parseRequestedUsdc(intent, "daily") ?? context.limits.dailyLimitUsdcMinor,
    monthlyLimitUsdcMinor: parseRequestedUsdc(intent, "monthly") ?? context.limits.monthlyLimitUsdcMinor,
    validDays: parseRequestedDays(intent) ?? context.limits.validDays
  };

  return {
    intent: `Agent credits auto top-up on ${context.chainName}`,
    executionPlan: buildDeterministicExecutionPlan(intent, context, limits),
    singleLimitUsdc: limits.singleLimitUsdcMinor / 1_000_000,
    dailyLimitUsdc: limits.dailyLimitUsdcMinor / 1_000_000,
    monthlyLimitUsdc: limits.monthlyLimitUsdcMinor / 1_000_000,
    validDays: limits.validDays
  };
}

async function draftWithOpenAi(intent: string, context: PactDraftContext): Promise<RawAgentDraft> {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.PACT_DRAFTER_MODEL || "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content: [
            "You are the CAW Pact drafter for a credits auto top-up agent.",
            "Draft only within the provided context. Do not invent chains, tokens, contracts, recipients, or extra operations.",
            "The owner intent must become a PactSpec preview with intent, execution plan, suggested limits, and warnings.",
            "The backend will enforce least-privilege policy separately."
          ].join("\n")
        },
        {
          role: "user",
          content: JSON.stringify({
            owner_intent: intent,
            allowed_context: {
              task: "Automatically buy internal agent credits with USDC when the credit balance is low.",
              chain_name: context.chainName,
              caw_chain_id: context.cawChainId,
              wallet_address: context.walletAddress,
              usdc_address: context.usdcAddress,
              payment_contract_address: context.paymentContractAddress,
              maximum_limits: {
                single_usdc: context.limits.singleLimitUsdcMinor / 1_000_000,
                daily_usdc: context.limits.dailyLimitUsdcMinor / 1_000_000,
                monthly_usdc: context.limits.monthlyLimitUsdcMinor / 1_000_000,
                valid_days: context.limits.validDays
              }
            }
          })
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "caw_pact_draft",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: [
              "intent",
              "executionPlan",
              "singleLimitUsdc",
              "dailyLimitUsdc",
              "monthlyLimitUsdc",
              "validDays",
              "warnings"
            ],
            properties: {
              intent: { type: "string" },
              executionPlan: { type: "string" },
              singleLimitUsdc: { type: "number" },
              dailyLimitUsdc: { type: "number" },
              monthlyLimitUsdc: { type: "number" },
              validDays: { type: "integer" },
              warnings: {
                type: "array",
                items: { type: "string" }
              }
            }
          }
        }
      }
    })
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`OpenAI returned ${response.status}${body ? `: ${body.slice(0, 240)}` : ""}`);
  }

  const payload = (await response.json()) as unknown;
  const outputText = extractResponseText(payload);
  if (!outputText) {
    throw new Error("OpenAI response did not include structured text.");
  }
  return JSON.parse(outputText) as RawAgentDraft;
}

function extractResponseText(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }
  const record = payload as Record<string, unknown>;
  if (typeof record.output_text === "string") {
    return record.output_text;
  }
  const output = record.output;
  if (!Array.isArray(output)) {
    return undefined;
  }
  for (const item of output) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const content = (item as Record<string, unknown>).content;
    if (!Array.isArray(content)) {
      continue;
    }
    for (const part of content) {
      if (!part || typeof part !== "object") {
        continue;
      }
      const text = (part as Record<string, unknown>).text;
      if (typeof text === "string") {
        return text;
      }
    }
  }
  return undefined;
}

function buildDeterministicExecutionPlan(
  intent: string,
  context: PactDraftContext,
  limits: PactLimitInput
) {
  return [
    "# Intent",
    intent,
    "# Execution Plan",
    `- Monitor the internal credit balance associated with ${context.walletAddress}.`,
    `- When the balance is low, call the CreditsPayment contract ${context.paymentContractAddress} on ${context.chainName}.`,
    "- Pay with USDC and wait for CAW transaction submission plus chain settlement before crediting the account.",
    "- If CAW rejects the transaction or the chain call fails, mark the top-up order failed and do not retry with broader permissions.",
    "# Policies",
    `- Allowed chain: ${context.chainName} (${context.cawChainId}).`,
    `- Allowed targets: CreditsPayment ${context.paymentContractAddress} and USDC ${context.usdcAddress}.`,
    `- Single top-up cap: ${usdcMinorToUsdString(limits.singleLimitUsdcMinor)} USDC.`,
    `- Daily cap: ${usdcMinorToUsdString(limits.dailyLimitUsdcMinor)} USDC.`,
    `- Pact ends after ${limits.validDays} days or ${usdcMinorToUsdString(
      limits.monthlyLimitUsdcMinor
    )} USD of spend.`
  ].join("\n\n");
}

function clampLimits(requested: PactLimitInput, maximum: PactLimitInput): PactLimitInput {
  return {
    singleLimitUsdcMinor: clampPositive(requested.singleLimitUsdcMinor, maximum.singleLimitUsdcMinor),
    dailyLimitUsdcMinor: clampPositive(requested.dailyLimitUsdcMinor, maximum.dailyLimitUsdcMinor),
    monthlyLimitUsdcMinor: clampPositive(
      requested.monthlyLimitUsdcMinor,
      maximum.monthlyLimitUsdcMinor
    ),
    validDays: clampPositive(requested.validDays, maximum.validDays)
  };
}

function clampPositive(value: number, max: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return max;
  }
  return Math.min(Math.floor(value), max);
}

function parseRequestedUsdc(intent: string, type: "single" | "daily" | "monthly") {
  const keywords = {
    single: ["single", "each", "per tx", "per transaction", "单笔", "每次"],
    daily: ["daily", "per day", "每天", "每日"],
    monthly: ["monthly", "per month", "每月", "每个月"]
  }[type];
  for (const keyword of keywords) {
    const escaped = escapeRegExp(keyword);
    const after = new RegExp(`${escaped}[^0-9]{0,24}([0-9]+(?:\\.[0-9]+)?)\\s*(?:USDC|usd)?`, "i");
    const before = new RegExp(`([0-9]+(?:\\.[0-9]+)?)\\s*(?:USDC|usd)?[^.。\\n]{0,24}${escaped}`, "i");
    const match = intent.match(after) ?? intent.match(before);
    if (match?.[1]) {
      return Math.round(Number(match[1]) * 1_000_000);
    }
  }
  return undefined;
}

function parseRequestedDays(intent: string) {
  const match =
    intent.match(/(?:valid|expires?|有效)[^0-9]{0,20}([0-9]+)\s*(?:days?|天)/i) ??
    intent.match(/([0-9]+)\s*(?:days?|天)[^.。\n]{0,24}(?:valid|expires?|有效)/i);
  return match?.[1] ? positiveInteger(Number(match[1])) : undefined;
}

function usdcToMinor(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }
  return Math.round(value * 1_000_000);
}

function positiveInteger(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }
  return Math.floor(value);
}

function safeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function usdcMinorToUsdString(amountUsdcMinor: number) {
  return (amountUsdcMinor / 1_000_000).toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
