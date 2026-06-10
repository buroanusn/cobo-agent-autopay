// lib/blockrun/topup.ts
// BlockRun x402 支付支持
// BlockRun 是实时扣款模式，每次推理直接从 CAW 钱包扣款，没有预充值额度概念。
//
// 架构说明：
// - 复用 lib/venice/topup.ts 的 runCawFetch()（spawn caw fetch --protocol=x402）
// - 不从 venice/topup.ts import 任何东西，避免耦合
// - 自己实现 runCawFetch() 的等价调用（实际就是 spawn caw fetch）
// - 所有环境变量前缀 BLOCKRUN_

import { spawn } from "node:child_process";
import { getCreditRepository } from "@/lib/store";
import { createInferenceLog } from "@/lib/store/venice";

// ── 常量 ──────────────────────────────────────────────────────────────────
const PRODUCTION_URL = "https://blockrun.ai/api/v1/chat/completions";
const TESTNET_URL = "https://testnet.blockrun.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-oss-20b";

// ── 解析运行模式 ──────────────────────────────────────────────────────────
function getBlockRunConfig() {
  return {
    baseUrl: process.env.BLOCKRUN_USE_TESTNET === "true" ? TESTNET_URL : PRODUCTION_URL,
    model: process.env.BLOCKRUN_MODEL || DEFAULT_MODEL,
    minBalance: Number(process.env.BLOCKRUN_MIN_BALANCE ?? 5),
    network: process.env.BLOCKRUN_USE_TESTNET === "true" ? "eip155:84532" : "eip155:8453",
  };
}

// ── runCawFetch (本地副本，复用逻辑) ──────────────────────────────────────
function runCawFetch(
  pactId: string,
  url: string,
  body: object,
  network?: string
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const args = [
      "fetch",
      pactId,
      url,
      "--method", "POST",
      "--json", JSON.stringify(body),
      "--protocol", "x402",
      "--max-amount", "1000000000", // 1000 USDC cap
      "--network", network ?? "eip155:8453",
      "--output", "full",
      "--timeout", "60",
    ];
    const child = spawn("caw", args, {
      env: { ...process.env, NODE_TLS_REJECT_UNAUTHORIZED: "0" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (b) => (stdout += b.toString()));
    child.stderr.on("data", (b) => (stderr += b.toString()));
    child.on("error", reject);
    child.on("close", (code) => resolve({ stdout, stderr, exitCode: code ?? 1 }));
  });
}

// ── BlockRun x402 推理执行 ────────────────────────────────────────────────
//
// BlockRun 和 Venice 的核心区别：
// - Venice: 先充值到 Venice 平台 credits 余额，再从余额扣费
// - BlockRun: 实时扣款，每次推理直接从 CAW 钱包扣 USDC，没有预充值
//
// 但技术实现一致：都是 caw fetch --protocol=x402 → Venice/BlockRun 返回
// 402 challenge → CAW 自动签名并支付 → 返回推理结果
//
// 参数：
//   pactId     - CAW Pact ID（自动授权的范围）
//   model      - 模型名称（默认 openai/gpt-oss-20b）
//   messages   - Chat messages 数组
//   usdAmount  - 愿意支付的最高 USDC 金额（单位：USD，默认 0.01）
//
// 返回：
//   {
//     status: "completed" | "failed",
//     responseStatus: number,
//     responseBody: string,     // 推理响应 JSON
//     durationMs: number
//   }

export type BlockRunMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type BlockRunTopupResult = {
  status: "completed" | "failed";
  responseStatus: number;
  responseBody: string;
  durationMs: number;
  error?: string;
};

export async function runBlockRunX402Inference(input: {
  userId: string;
  walletAddress: string;
  pactId: string;
  model?: string;
  messages: BlockRunMessage[];
  usdAmount?: number; // 愿意支付的最高金额，默认 0.01
}): Promise<BlockRunTopupResult> {
  const config = getBlockRunConfig();
  const start = Date.now();
  const model = input.model ?? config.model;
  const usdAmount = input.usdAmount ?? 0.01;

  // 1. 生成请求 body
  const url = config.baseUrl;
  const body = {
    model,
    messages: input.messages,
    // 告诉 BlockRun 愿意支付的上限，以便其返回合理的 402 challenge
    maxX402Amount: usdAmount,
  };

  // 2. 通过 caw fetch 发起 x402 推理请求
  let result: Awaited<ReturnType<typeof runCawFetch>>;
  try {
    result = await runCawFetch(input.pactId, url, body, config.network);
  } catch (error) {
    return {
      status: "failed",
      responseStatus: 0,
      responseBody: "",
      durationMs: Date.now() - start,
      error: error instanceof Error ? error.message : "caw fetch failed",
    };
  }
  const durationMs = Date.now() - start;

  // 3. 解析响应状态码
  const statusLine = result.stdout.split("\n")[0]?.trim() ?? "";
  const statusMatch = statusLine.match(/\b(\d{3})\b/);
  const responseStatus = statusMatch ? Number(statusMatch[1]) : 0;
  const success = responseStatus >= 200 && responseStatus < 300;

  // 4. 记录日志（复用 Venice 的 inference log 表）
  createInferenceLog({
    userId: input.userId,
    prompt: `BlockRun x402 inference: ${model} / ${input.messages.length} messages`,
    model: `blockrun-${model}`,
    response: result.stdout.slice(0, 2000),
    inputTokens: null,
    outputTokens: null,
    status: success ? "completed" : "failed",
    errorMessage: success ? undefined : (result.stderr || result.stdout).slice(0, 1000),
    durationMs,
  });

  return {
    status: success ? "completed" : "failed",
    responseStatus,
    responseBody: result.stdout,
    durationMs,
    error: success ? undefined : result.stderr.slice(0, 500),
  };
}

// ── 获取 BlockRun 配置信息 ────────────────────────────────────────────────
export type BlockRunConfigInfo = {
  baseUrl: string;
  model: string;
  minBalance: number;
  network: string;
};

export function getBlockRunConfigInfo(): BlockRunConfigInfo {
  const config = getBlockRunConfig();
  return {
    baseUrl: config.baseUrl,
    model: config.model,
    minBalance: config.minBalance,
    network: config.network,
  };
}
