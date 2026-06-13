import { requireCurrentUser } from "@/lib/auth/session";
import { errorJson, okJson } from "@/lib/http";
import { runCawCli } from "@/lib/caw/cli";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireCurrentUser();

    // 使用 runCawCli 走 per-user HOME，列出所有 pacts
    const result = await runCawCli(user.id, ["pact", "list"]);
    if (result.exitCode !== 0) {
      return okJson({ hasPact: false, pactId: null, status: "no_pact", message: "caw pact list failed" });
    }

    let data: { result?: { pacts?: Array<Record<string, unknown>> } };
    try {
      data = JSON.parse(result.stdout);
    } catch {
      return okJson({ hasPact: false, pactId: null, status: "no_pact", message: "non-JSON response" });
    }

    const pacts = data.result?.pacts ?? [];

    // 找 active 的 Venice SIWE pact（intent 含 personal_sign 或 SIWE）
    for (const pact of pacts) {
      if (String(pact.status) !== "active") continue;
      const intent = String(pact.intent ?? "");
      const name = String(pact.name ?? "");
      if (intent.includes("SIWE") || intent.includes("personal_sign") || name.includes("SIWE")) {
        return okJson({
          hasPact: true,
          pactId: String(pact.id),
          status: "active",
          expiresAt: String(pact.expires_at ?? ""),
          walletAddress: user.cawWalletAddress,
        });
      }
    }

    // 没找到 Venice pact，返回任意 active pact（用于其他用途）
    for (const pact of pacts) {
      if (String(pact.status) === "active") {
        return okJson({
          hasPact: true,
          pactId: String(pact.id),
          status: "active",
          expiresAt: String(pact.expires_at ?? ""),
          walletAddress: user.cawWalletAddress,
        });
      }
    }

    return okJson({
      hasPact: false,
      pactId: null,
      status: "no_pact",
      message: "未找到 active Pact",
    });
  } catch (error) {
    return errorJson(error);
  }
}
