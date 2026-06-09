import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth/session";
import {
  getX402ResourcePriceUsdcMinor,
  verifyX402ResourcePayment
} from "@/lib/domain/services";
import {
  CREDITS_PER_USDC,
  getConfiguredCawChainId,
  getConfiguredChain
} from "@/lib/domain/constants";
import { formatUsdc } from "@/lib/domain/money";
import { errorJson, okJson, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

type X402ProofBody = {
  paymentProof?: string;
};

export async function GET(request: NextRequest) {
  return handleResourceRequest(request);
}

export async function POST(request: NextRequest) {
  return handleResourceRequest(request);
}

async function handleResourceRequest(request: NextRequest) {
  try {
    const proof = await readPaymentProof(request);
    if (!proof) {
      return paymentRequired(request);
    }

    const user = await requireCurrentUser();
    const verification = await verifyX402ResourcePayment({
      userId: user.id,
      proof
    });

    if (!verification.ok) {
      return paymentRequired(request, verification.reason);
    }

    return okJson({
      ok: true,
      resource: {
        insight: "x402 request unlocked by a CAW-backed Base USDC payment.",
        account: user.email,
        chain: getConfiguredChain().name,
        creditsPerUsdc: CREDITS_PER_USDC,
        unlockedAt: new Date().toISOString()
      },
      paymentVerified: true,
      payment: {
        orderId: verification.order.orderId,
        txHash: verification.order.txHash,
        amountUsdcMinor: verification.order.amountUsdcMinor,
        status: verification.order.status
      }
    });
  } catch (error) {
    return errorJson(error);
  }
}

async function readPaymentProof(request: NextRequest) {
  const headerProof =
    request.headers.get("x-payment-proof") ||
    request.headers.get("x-payment") ||
    request.headers.get("payment");
  if (headerProof) {
    return headerProof;
  }

  if (request.method === "GET") {
    return request.nextUrl.searchParams.get("paymentProof") ?? undefined;
  }

  const body = await readJson<X402ProofBody>(request);
  return body.paymentProof;
}

function paymentRequired(request: NextRequest, reason?: string) {
  const payment = buildPaymentRequirement(request, reason);
  const response = NextResponse.json(payment, { status: 402 });
  response.headers.set("X-Payment-Required", "true");
  response.headers.set("WWW-Authenticate", 'Payment realm="x402"');
  response.headers.set(
    "Accept-Payment",
    `scheme="exact", network="${payment.accepts[0].network}", asset="${payment.accepts[0].asset}", amount="${payment.accepts[0].maxAmountRequired}", payTo="${payment.accepts[0].payTo}"`
  );
  return response;
}

function buildPaymentRequirement(request: NextRequest, reason?: string) {
  const chain = getConfiguredChain();
  const amountUsdcMinor = getX402ResourcePriceUsdcMinor();
  const paymentContractAddress = process.env.PAYMENT_CONTRACT_ADDRESS || "";

  return {
    x402Version: 1,
    error: reason ?? "payment_required",
    accepts: [
      {
        scheme: "exact",
        network: chain.id === 8453 ? "base" : "base-sepolia",
        chainId: `eip155:${chain.id}`,
        cawChainId: getConfiguredCawChainId(),
        maxAmountRequired: String(amountUsdcMinor),
        amount: formatUsdc(amountUsdcMinor),
        asset: chain.usdcAddress,
        payTo: paymentContractAddress,
        resource: request.nextUrl.pathname,
        description: "Unlock this resource with a CAW-authorized USDC payment.",
        mimeType: "application/json",
        maxTimeoutSeconds: 300,
        extra: {
          paymentContractAddress,
          token: "USDC",
          decimals: 6,
          creditsPerUsdc: CREDITS_PER_USDC,
          proofHeader: "x-payment-proof"
        }
      }
    ]
  };
}
