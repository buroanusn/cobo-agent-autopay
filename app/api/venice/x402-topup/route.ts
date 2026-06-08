import { requireCurrentUser } from "@/lib/auth/session";
import { errorJson, okJson, readJson } from "@/lib/http";
import {
  discoverVeniceX402Requirements,
  pickVeniceBaseUsdcAccept,
  runVeniceX402Topup
} from "@/lib/venice/topup";

export const dynamic = "force-dynamic";

type TopupBody = {
  amountUsdc?: number;
  amountUsdcMinor?: number;
};

export async function GET() {
  try {
    await requireCurrentUser();
    const requirements = await discoverVeniceX402Requirements();
    return okJson({
      ok: true,
      requirements,
      selected: pickVeniceBaseUsdcAccept(requirements)
    });
  } catch (error) {
    return errorJson(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireCurrentUser();
    const body = await readJson<TopupBody>(request);
    const amountUsdcMinor = parseAmountUsdcMinor(body);
    return okJson(await runVeniceX402Topup({ userId: user.id, amountUsdcMinor }));
  } catch (error) {
    return errorJson(error);
  }
}

function parseAmountUsdcMinor(body: Partial<TopupBody>) {
  if (Number.isFinite(body.amountUsdcMinor) && Number(body.amountUsdcMinor) > 0) {
    return Math.floor(Number(body.amountUsdcMinor));
  }
  if (Number.isFinite(body.amountUsdc) && Number(body.amountUsdc) > 0) {
    return Math.floor(Number(body.amountUsdc) * 1_000_000);
  }
  const configured = Number(process.env.VENICE_X402_DEFAULT_USDC_MINOR || 1_000_000);
  return Number.isFinite(configured) && configured > 0 ? Math.floor(configured) : 1_000_000;
}
