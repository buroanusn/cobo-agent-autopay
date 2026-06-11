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
import type { BlockRunX402Request, BlockRunX402Result, BlockRunX402Step } from "@/lib/blockrun/types";

// ── 常量 ──────────────────────────────────────────────────────────────────
const PRODUCTION_URL = "https://blockrun.ai/api/v1/chat/completions";
const TESTNET_URL = "https://testnet.blockrun.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-oss-20b";

// ── 解析运行模式 ──────────────────────────────────────────────────────────
function getBlockRunConfig() {
  return {
    // 默认走测试网，仅当显式设为 false 时走主网
    baseUrl: process.env.BLOCKRUN_USE_TESTNET === "false" ? PRODUCTION_URL : TESTNET_URL,
    model: process.env.BLOCKRUN_MODEL || DEFAULT_MODEL,
    minBalance: Number(process.env.BLOCKRUN_MIN_BALANCE ?? 5),
    network: process.env.BLOCKRUN_USE_TESTNET === "false" ? "eip155:8453" : "eip155:84532",
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
      "--network", network ?? "eip155:84532",
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

export async function runBlockRunX402Inference(input: {
  userId: string;
  walletAddress: string;
  pactId: string;
  model?: string;
  messages: BlockRunMessage[];
  usdAmount?: number; // 愿意支付的最高金额，默认 0.01
}): Promise<BlockRunX402Result> {
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
      durationMs: Date.now() - start,
      error: error instanceof Error ? error.message : "caw fetch failed",
      steps: {
        received402: false,
        signed: null,
        txHash: null,
        gotResult: false,
      },
    };
  }
  const durationMs = Date.now() - start;

  // 3. 解析 caw fetch stdout 提取状态
  // caw fetch --output full 的输出格式大致为：
  // 第1行: HTTP/2 402 或 HTTP/2 200
  // 中间包含 x402 challenge、签名、交易hash等信息
  const stdout = result.stdout;
  const stderr = result.stderr;

  // 状态码
  const statusLine = stdout.split("\n")[0]?.trim() ?? "";
  const statusMatch = statusLine.match(/\b(\d{3})\b/);
  const responseStatus = statusMatch ? Number(statusMatch[1]) : 0;
  const success = responseStatus >= 200 && responseStatus < 300;

  // 解析 steps
  const steps: BlockRunX402Step = {
    received402: responseStatus === 402 || stderr.includes("402") || stdout.includes("402"),
    signed: null,
    txHash: null,
    gotResult: success,
  };

  // 尝试从 stdout/stderr 中提取价格
  const priceMatch = stdout.match(/"amount"\s*:\s*"([^"]+)"/);
  if (priceMatch) {
    steps.price = `${priceMatch[1]} USD`;
  }

  // 尝试提取 tx hash (caw fetch 一般输出 tx hash 在日志中)
  const txHashMatch = stdout.match(/0x[a-fA-F0-9]{64}/);
  if (txHashMatch) {
    steps.txHash = txHashMatch[0];
    steps.signed = true;
  }

  // 如果返回了推理结果，说明签名必然成功了
  if (success) {
    steps.signed = true;
  }

  return {
    status: success ? "completed" : "failed",
    responseStatus,
    responseBody: stdout,
    durationMs,
    error: success ? undefined : (stderr || stdout).slice(0, 500),
    steps,
  };
}

// ── 获取 BlockRun Pact 及配置 ─────────────────────────────────────────────
// 从数据库读取用户的 BlockRun x402 授权信息

export async function getBlockRunX402Request(userId: string): Promise<BlockRunX402Request> {
  const repo = getCreditRepository();
  const user = await repo.requireUser(userId);
  if (!user.cawWalletAddress) {
    throw new Error("Connect a CAW wallet first.");
  }
  const auth = await repo.getActiveAuthorization(userId, "blockrun_x402");
  if (!auth || auth.status !== "active") {
    throw new Error("未找到 BlockRun 的 Pact 授权，请先在 BlockRun 页面创建测试网 Pact");
  }
  return {
    walletAddress: user.cawWalletAddress,
    pactId: auth.pactId,
    usdAmount: 0.01,
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
