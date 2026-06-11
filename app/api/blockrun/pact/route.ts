import { requireCurrentUser } from "@/lib/auth/session";
import { errorJson, okJson, readJson } from "@/lib/http";
import {
  createBlockRunX402Authorization,
  previewBlockRunX402Authorization,
} from "@/lib/blockrun/services";

export const dynamic = "force-dynamic";

type BlockRunPactBody = {
  amountUsdc?: number;
  amountUsdcMinor?: number;
  dailyLimitUsdc?: number;
  dailyLimitUsdcMinor?: number;
  monthlyLimitUsdc?: number;
  monthlyLimitUsdcMinor?: number;
  validDays?: number;
  previewOnly?: boolean;
};

export async function POST(request: Request) {
  try {
    const user = await requireCurrentUser();
    const body = await readJson<BlockRunPactBody>(request);
    const input = {
      userId: user.id,
      amountUsdcMinor: parseUsdcMinor(body.amountUsdcMinor, body.amountUsdc),
      dailyLimitUsdcMinor: parseUsdcMinor(body.dailyLimitUsdcMinor, body.dailyLimitUsdc),
      monthlyLimitUsdcMinor: parseUsdcMinor(body.monthlyLimitUsdcMinor, body.monthlyLimitUsdc),
      validDays: parsePositiveInteger(body.validDays),
    };

    if (body.previewOnly) {
      return okJson(await previewBlockRunX402Authorization(input));
    }

    return okJson(await createBlockRunX402Authorization(input));
  } catch (error) {
    return errorJson(error);
  }
}

function parseUsdcMinor(minor: unknown, major: unknown) {
  if (Number.isFinite(minor) && Number(minor) > 0) {
    return Math.floor(Number(minor));
  }
  if (Number.isFinite(major) && Number(major) > 0) {
    return Math.round(Number(major) * 1_000_000);
  }
  return undefined;
}

function parsePositiveInteger(value: unknown) {
  if (!Number.isFinite(value) || Number(value) <= 0) {
    return undefined;
  }
  return Math.floor(Number(value));
}
