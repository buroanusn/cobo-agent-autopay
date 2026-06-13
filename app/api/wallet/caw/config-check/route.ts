import { NextResponse } from "next/server";
import { resolveCawBinary } from "@/lib/caw/cli";
import { existsSync } from "node:fs";

export const dynamic = "force-dynamic";

export async function GET() {
  const issues: string[] = [];
  const suggestions: string[] = [];

  // Check CLI availability
  let cliAvailable = false;
  let cliPath = "";
  try {
    cliPath = resolveCawBinary();
    // Verify the binary actually exists on disk (resolveCawBinary may return "caw" as fallback PATH lookup)
    if (cliPath === "caw" || existsSync(cliPath)) {
      cliAvailable = true;
    } else {
      issues.push("caw CLI 二进制文件未找到");
      suggestions.push("安装 caw CLI: npm install -g @cobo/agentic-wallet");
    }
  } catch {
    issues.push("caw CLI 路径解析失败");
    suggestions.push("安装 caw CLI 或在 .env.local 中设置 CAW_CLI_PATH 指向 caw 二进制文件");
  }

  // Check env vars
  const apiUrl = Boolean(process.env.AGENT_WALLET_API_URL || process.env.CAW_API_BASE_URL);
  const apiKey = Boolean(process.env.AGENT_WALLET_API_KEY || process.env.CAW_API_KEY);
  const walletId = Boolean(process.env.AGENT_WALLET_WALLET_ID || process.env.CAW_WALLET_ID);

  if (!apiUrl) {
    issues.push("AGENT_WALLET_API_URL 未设置");
    suggestions.push("在 .env.local 中添加: AGENT_WALLET_API_URL=https://api.agenticwallet.cobo.com");
  }
  if (!apiKey) {
    issues.push("AGENT_WALLET_API_KEY 未设置");
    suggestions.push("在 .env.local 中添加: AGENT_WALLET_API_KEY=<你的 CAW API Key>");
  }

  return NextResponse.json({
    cliAvailable,
    cliPath: cliPath || null,
    envVars: { apiUrl, apiKey, walletId },
    issues,
    suggestions,
  });
}
