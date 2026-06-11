import { requireCurrentUser } from "@/lib/auth/session";
import { errorJson, okJson } from "@/lib/http";
import { spawn } from "node:child_process";

export const dynamic = "force-dynamic";

// 已知可用的 Venice SIWE pact
const KNOWN_PACT_ID = "e6a9e389-d55d-42a3-995d-297b8d2d6690";

function runCaw(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("caw", args, {
      env: { ...process.env, NODE_TLS_REJECT_UNAUTHORIZED: "0" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (b) => (stdout += b.toString()));
    child.stderr.on("data", (b) => (stderr += b.toString()));
    child.on("close", () => resolve(stdout));
    child.on("error", (e) => reject(e));
  });
}

export async function GET() {
  try {
    const user = await requireCurrentUser();

    // 直接检查已知 pact
    try {
      const output = await runCaw(["pact", "status", "--pact-id", KNOWN_PACT_ID]);
      const pact = JSON.parse(output);
      
      if (pact.status === "active") {
        return okJson({
          hasPact: true,
          pactId: KNOWN_PACT_ID,
          status: "active",
          expiresAt: pact.expires_at,
          walletAddress: user.cawWalletAddress,
        });
      }
    } catch {}

    // 已知 pact 不可用，从列表找
    try {
      const output = await runCaw(["pact", "list"]);
      const data = JSON.parse(output);
      const pacts = data.result?.pacts || [];
      
      for (const pact of pacts) {
        if (pact.status !== "active") continue;
        const policies = pact.spec?.policies || [];
        const hasMessageSign = policies.some((p: { type?: string }) => p.type === "message_sign");
        if (hasMessageSign) {
          return okJson({
            hasPact: true,
            pactId: pact.id,
            status: pact.status,
            expiresAt: pact.expires_at,
            walletAddress: user.cawWalletAddress,
          });
        }
      }
    } catch {}

    return okJson({
      hasPact: false,
      pactId: null,
      status: "no_pact",
      message: "未找到 Venice SIWE 签名 Pact",
    });
  } catch (error) {
    return errorJson(error);
  }
}
