// 创建 Venice SIWE message_sign Pact
import { spawn } from "node:child_process";
import { requireCurrentUser } from "@/lib/auth/session";
import { errorJson, okJson } from "@/lib/http";

export const dynamic = "force-dynamic";

// 调用 caw pact submit 创建 message_sign pact
async function createSiwePact(): Promise<{ pactId: string; status: string }> {
  const policies = JSON.stringify([
    {
      name: "venice-siwe-sign",
      type: "message_sign",
      rules: { effect: "allow", when: {}, always_review: true },
    },
  ]);

  const completionConditions = JSON.stringify([{ type: "time_elapsed", threshold: "86400" }]);

  const executionPlan =
    "# Summary\npersonal_sign SIWE for Venice x402 balance query\n\n" +
    "# Operations\n- evm_personal_sign SIWE messages\n\n" +
    "# Risk Controls\n- Always requires owner review\n- 24h expiry";

  return new Promise((resolve, reject) => {
    const child = spawn(
      "caw",
      [
        "pact", "submit",
        "--name", "Venice SIWE personal_sign",
        "--intent", "personal_sign SIWE for Venice x402 balance query",
        "--policies", policies,
        "--completion-conditions", completionConditions,
        "--execution-plan", executionPlan,
      ],
      {
        env: { ...process.env, NODE_TLS_REJECT_UNAUTHORIZED: "0" },
        stdio: ["ignore", "pipe", "pipe"],
      }
    );

    let stdout = "";
    child.stdout.on("data", (b) => (stdout += b.toString()));
    child.on("error", reject);
    child.on("close", () => {
      try {
        const result = JSON.parse(stdout);
        if (!result.success) {
          reject(new Error(result.message || result.error?.message || "Pact creation failed"));
          return;
        }
        resolve({
          pactId: result.result?.pact_id || "",
          status: result.result?.status || "pending_approval",
        });
      } catch {
        reject(new Error(`Failed to parse caw output: ${stdout.slice(0, 300)}`));
      }
    });
  });
}

// POST /api/venice/siwe-pact
export async function POST() {
  try {
    await requireCurrentUser();
    const result = await createSiwePact();
    return okJson({
      pactId: result.pactId,
      status: result.status,
      message: "Pact 已提交，请在手机上审批",
    });
  } catch (error) {
    return errorJson(error);
  }
}
