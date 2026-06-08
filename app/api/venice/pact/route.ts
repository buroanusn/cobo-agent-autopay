import { requireCurrentUser } from "@/lib/auth/session";
import { createVeniceX402Authorization, previewVeniceX402Authorization } from "@/lib/domain/services";
import { errorJson, okJson, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

type VenicePactBody = {
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
    const body = await readJson<VenicePactBody>(request);
    const input = {
      userId: user.id,
      amountUsdcMinor: parseUsdcMinor(body.amountUsdcMinor, body.amountUsdc),
      dailyLimitUsdcMinor: parseUsdcMinor(body.dailyLimitUsdcMinor, body.dailyLimitUsdc),
      monthlyLimitUsdcMinor: parseUsdcMinor(body.monthlyLimitUsdcMinor, body.monthlyLimitUsdc),
      validDays: parsePositiveInteger(body.validDays)
    };

    if (body.previewOnly) {
      return okJson(await previewVeniceX402Authorization(input));
    }

    return okJson(await createVeniceX402Authorization(input));
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
