// Venice x402 余额查询端点
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { requireCurrentUser } from "@/lib/auth/session";
import { errorJson, okJson, readJson } from "@/lib/http";
import { runCawCli } from "@/lib/caw/cli";

export const dynamic = "force-dynamic";

// 从 pact list 中找 active 的 Venice SIWE pact
async function findVeniceSiwePact(userId: string): Promise<{ id: string; apiKey: string } | null> {
  const result = await runCawCli(userId, ["pact", "list"]);
  if (result.exitCode !== 0) return null;

  let data: { result?: { pacts?: Array<Record<string, unknown>> } };
  try {
    data = JSON.parse(result.stdout);
  } catch {
    return null;
  }

  const pacts = data.result?.pacts ?? [];
  for (const pact of pacts) {
    if (String(pact.status) !== "active") continue;
    const intent = String(pact.intent ?? "");
    const name = String(pact.name ?? "");
    if (intent.includes("SIWE") || intent.includes("personal_sign") || name.includes("SIWE")) {
      // 获取 pact 的 api_key
      const statusResult = await runCawCli(userId, ["pact", "status", "--pact-id", String(pact.id)]);
      if (statusResult.exitCode === 0) {
        try {
          const statusData = JSON.parse(statusResult.stdout);
          if (statusData.api_key) {
            return { id: String(pact.id), apiKey: statusData.api_key };
          }
        } catch {}
      }
      // fallback: pact 没有 api_key，返回 id only
      return { id: String(pact.id), apiKey: "" };
    }
  }
  return null;
}

function runCaw(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("caw", args, {
      env: { ...process.env, NODE_TLS_REJECT_UNAUTHORIZED: "0" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    child.stdout.on("data", (b) => (stdout += b.toString()));
    child.on("close", () => resolve(stdout));
    child.on("error", reject);
  });
}

// SIWE 消息构造
function buildSiweMessage(walletAddress: string) {
  const nonce = randomBytes(8).toString("hex");
  const now = new Date();
  const exp = new Date(now.getTime() + 10 * 60 * 1000);

  const message = `api.venice.ai wants you to sign in with your Ethereum account:
${walletAddress}

Sign in to Venice AI

URI: https://api.venice.ai/api/v1/x402/balance/${walletAddress.toLowerCase()}
Version: 1
Chain ID: 8453
Nonce: ${nonce}
Issued At: ${now.toISOString()}
Expiration Time: ${exp.toISOString()}`;

  return { message, nonce };
}

// CAW 签名
async function signWithCaw(
  walletUuid: string,
  pactApiKey: string,
  walletAddress: string,
  siweMessage: string,
  requestId: string
): Promise<{ requestId: string; status: string }> {
  const siweHex = "0x" + Buffer.from(siweMessage, "utf-8").toString("hex");

  const payload = JSON.stringify({
    source_address: walletAddress,
    destination_type: "evm_personal_sign",
    personal_sign_message: siweHex,
    chain_id: "BASE_ETH",
    sync: false,
    request_id: requestId,
    description: "SIWE for Venice x402 balance",
  });

  return new Promise((resolve, reject) => {
    const child = spawn(
      "curl",
      ["-s", "--http2-prior-knowledge", "-X", "POST",
       `https://api.agenticwallet.cobo.com/api/v1/wallets/${walletUuid}/message-sign`,
       "-H", "Content-Type: application/json",
       "-H", `x-api-key: ${pactApiKey}`,
       "-d", payload],
      { env: { ...process.env, NODE_TLS_REJECT_UNAUTHORIZED: "0" }, stdio: ["ignore", "pipe", "pipe"] }
    );

    let stdout = "";
    child.stdout.on("data", (b) => (stdout += b.toString()));
    child.on("error", reject);
    child.on("close", () => {
      try {
        const result = JSON.parse(stdout);
        if (!result.success) {
          reject(new Error(result.error?.message || "CAW signing failed"));
          return;
        }
        resolve({
          requestId: result.result?.request_id || requestId,
          status: result.result?.status_display || "unknown",
        });
      } catch {
        reject(new Error(`Failed to parse CAW response: ${stdout.slice(0, 200)}`));
      }
    });
  });
}

// 从 caw tx list 获取签名
async function getSignatureFromCaw(requestId: string): Promise<string | null> {
  return new Promise((resolve) => {
    const child = spawn("caw", ["tx", "list", "--limit", "5"], {
      env: { ...process.env, NODE_TLS_REJECT_UNAUTHORIZED: "0" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    child.stdout.on("data", (b) => (stdout += b.toString()));
    child.on("close", () => {
      try {
        const result = JSON.parse(stdout);
        const items = result.result?.items || result.result || [];
        for (const tx of items) {
          if (tx.request_id?.includes(requestId)) {
            resolve(tx.data?.signature || null);
            return;
          }
        }
        resolve(null);
      } catch {
        resolve(null);
      }
    });
    child.on("error", () => resolve(null));
  });
}

// 查询 Venice x402 余额
async function queryVeniceBalance(
  walletAddress: string,
  signature: string,
  siweMessage: string,
  timestampMs: number
) {
  const headerObj = {
    address: walletAddress,
    message: siweMessage,
    signature,
    timestamp: timestampMs,
    chainId: 8453,
  };
  const headerValue = Buffer.from(JSON.stringify(headerObj)).toString("base64");

  const response = await fetch(
    `https://api.venice.ai/api/v1/x402/balance/${walletAddress.toLowerCase()}`,
    { headers: { "X-Sign-In-With-X": headerValue }, cache: "no-store" }
  );

  return response.json();
}

// POST /api/venice/x402-balance
export async function POST(request: Request) {
  try {
    const user = await requireCurrentUser();
    const body = await readJson<{
      action: string;
      requestId?: string;
      siweMessage?: string;
      timestampMs?: number;
    }>(request);

    if (!user.cawWalletAddress || !user.cawWalletId) {
      return errorJson(new Error("请先绑定 CAW 钱包"), 400);
    }

    // 动态查找 active Venice SIWE pact
    const venicePact = await findVeniceSiwePact(user.id);
    if (!venicePact) {
      return errorJson(new Error("Venice SIWE Pact 不可用，请先创建或审批"), 400);
    }

    if (body.action === "sign") {
      const siwe = buildSiweMessage(user.cawWalletAddress);
      const requestId = `siwe-venice-${Date.now()}-${siwe.nonce.slice(0, 8)}`;

      const signResult = await signWithCaw(
        user.cawWalletId,
        venicePact.apiKey,
        user.cawWalletAddress,
        siwe.message,
        requestId
      );

      return okJson({
        requestId: signResult.requestId,
        siweMessage: siwe.message,
        timestampMs: Date.now(),
        pactId: venicePact.id,
        status: "signing",
      });
    }

    if (body.action === "query") {
      if (!body.requestId || !body.siweMessage || !body.timestampMs) {
        return errorJson(new Error("Missing requestId, siweMessage, or timestampMs"), 400);
      }

      // 尝试获取签名
      const signature = await getSignatureFromCaw(body.requestId);
      if (!signature) {
        return okJson({ status: "pending", message: "签名尚未完成，请稍后重试" });
      }

      // 查询 Venice 余额
      const balance = await queryVeniceBalance(
        user.cawWalletAddress,
        signature,
        body.siweMessage,
        body.timestampMs
      );

      return okJson({
        status: "completed",
        balance: balance,
        pactId: venicePact.id,
      });
    }

    return errorJson(new Error("Unknown action"), 400);
  } catch (error) {
    return errorJson(error);
  }
}
