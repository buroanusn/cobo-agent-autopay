// app/api/settings/treasury/route.ts
// Treasury 配置 GET/POST API
// GET: 从 user_secrets 读取，API Key 脱敏返回
// POST: 加密写入 user_secrets

import { okJson, errorJson, readJson } from "@/lib/http";
import { requireCurrentUser } from "@/lib/auth/session";
import { getUserSecrets, setUserSecret } from "@/lib/secrets/store";
import { getTreasuryStatus } from "@/lib/caw/transfer";

export const dynamic = "force-dynamic";

const TREASURY_KEYS = [
  "TREASURY_API_KEY",
  "TREASURY_API_URL",
  "TREASURY_PACT_ID",
  "TREASURY_TOPUP_AMOUNT",
];

function maskApiKey(key: string | null): string {
  if (!key) return "";
  if (key.length <= 8) return "****";
  return `${key.slice(0, 3)}${"*".repeat(key.length - 7)}${key.slice(-4)}`;
}

export async function GET() {
  const user = await requireCurrentUser();
  const secrets = await getUserSecrets(user.id, TREASURY_KEYS);
  const treasury = getTreasuryStatus();

  return okJson({
    apiKey: maskApiKey(secrets.TREASURY_API_KEY),
    apiKeySet: Boolean(secrets.TREASURY_API_KEY),
    apiUrl: secrets.TREASURY_API_URL || "",
    pactId: secrets.TREASURY_PACT_ID || "",
    topupAmount: secrets.TREASURY_TOPUP_AMOUNT
      ? Number(secrets.TREASURY_TOPUP_AMOUNT)
      : 20,
    // 运行时状态
    treasuryStatus: treasury.treasuryStatus,
    treasuryLastAmount: treasury.treasuryLastAmount,
    treasuryLastTransferAt: treasury.treasuryLastTransferAt,
  });
}

export async function POST(request: Request) {
  const user = await requireCurrentUser();
  const body = await readJson<{
    apiKey?: string;
    apiUrl?: string;
    pactId?: string;
    topupAmount?: number;
  }>(request);

  // 只更新非空字段
  if (body.apiKey && body.apiKey !== "" && !body.apiKey.includes("*")) {
    await setUserSecret(user.id, "TREASURY_API_KEY", body.apiKey);
  }
  if (body.apiUrl !== undefined) {
    await setUserSecret(user.id, "TREASURY_API_URL", body.apiUrl);
  }
  if (body.pactId !== undefined) {
    await setUserSecret(user.id, "TREASURY_PACT_ID", body.pactId);
  }
  if (body.topupAmount !== undefined) {
    const num = Number(body.topupAmount);
    if (!Number.isFinite(num) || num < 1 || num > 1000) {
      return errorJson("topupAmount must be between 1 and 1000");
    }
    await setUserSecret(user.id, "TREASURY_TOPUP_AMOUNT", String(num));
  }

  return okJson({ ok: true });
}
