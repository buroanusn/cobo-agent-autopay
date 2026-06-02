import { DEMO_USER_ID, getConfiguredChain } from "@/lib/domain/constants";
import { executeCreditsTopup } from "@/lib/domain/services";
import type { DashboardSnapshot, TopupOrder } from "@/lib/domain/types";

const X402_RESOURCE_PRICE_USDC_MINOR = 1_000_000;
const X402_RESOURCE_CREDITS = 1_000;

export type X402PaymentRequirements = {
  x402Version: "mock-v1";
  accepts: Array<{
    scheme: "exact";
    network: string;
    asset: string;
    amountUsdcMinor: number;
    payTo: string;
  }>;
  resource: string;
  requestId: string;
  expiresAt: string;
  memo: string;
};

export type X402PaymentCredential = {
  credentialId: string;
  scheme: "mock-caw";
  orderId: string;
  txHash?: string;
  amountUsdcMinor: number;
  paidAt: string;
};

export type X402DemoResult = {
  trace: Array<{
    step: "request_resource" | "receive_402" | "caw_payment" | "retry_with_credential" | "resource_granted";
    status: number;
    recordId?: string;
    note: string;
  }>;
  paymentRequirements: X402PaymentRequirements;
  paymentCredential?: X402PaymentCredential;
  resource?: {
    id: string;
    title: string;
    content: string;
    deliveredAt: string;
  };
  topup?: Awaited<ReturnType<typeof executeCreditsTopup>>;
  snapshot: DashboardSnapshot;
};

export function createMockPaymentRequirements(requestId = createRequestId()): X402PaymentRequirements {
  const chain = getConfiguredChain();
  return {
    x402Version: "mock-v1",
    accepts: [
      {
        scheme: "exact",
        network: chain.name,
        asset: chain.usdcAddress,
        amountUsdcMinor: X402_RESOURCE_PRICE_USDC_MINOR,
        payTo: process.env.TREASURY_ADDRESS || "0xb511E49FDd677aEA606c12f809d742d433f4AFD5"
      }
    ],
    resource: "/api/x402/resource",
    requestId,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    memo: "Mock x402 paid resource for CAW auto-payment demo."
  };
}

export async function runX402CawMockResource(input: {
  userId?: string;
  requestId?: string;
}): Promise<X402DemoResult> {
  const userId = input.userId ?? DEMO_USER_ID;
  const paymentRequirements = createMockPaymentRequirements(input.requestId);
  const trace: X402DemoResult["trace"] = [
    {
      step: "request_resource",
      status: 200,
      note: "Agent requested a paid resource without a payment credential."
    },
    {
      step: "receive_402",
      status: 402,
      note: "Seller returned x402 payment requirements."
    }
  ];

  const topup = await executeCreditsTopup({
    userId,
    reason: "x402_resource",
    amountUsdcMinor: X402_RESOURCE_PRICE_USDC_MINOR,
    credits: X402_RESOURCE_CREDITS
  });
  const order = "order" in topup ? topup.order : undefined;

  trace.push({
    step: "caw_payment",
    status: topup.status === "submitted" ? 200 : 402,
    recordId: order?.orderId,
    note:
      topup.status === "submitted"
        ? "CAW gateway executed the scoped payment and recorded a top-up order."
        : `CAW payment did not complete: ${"reason" in topup ? topup.reason : topup.status}.`
  });

  if (topup.status !== "submitted" || !order || order.status !== "credited") {
    return {
      trace,
      paymentRequirements,
      topup,
      snapshot: topup.snapshot
    };
  }

  const credential = createPaymentCredential(order);
  trace.push(
    {
      step: "retry_with_credential",
      status: 200,
      recordId: credential.credentialId,
      note: "Agent retried the resource request with the mock x402 payment credential."
    },
    {
      step: "resource_granted",
      status: 200,
      note: "Seller accepted the payment credential and returned the paid resource."
    }
  );

  return {
    trace,
    paymentRequirements,
    paymentCredential: credential,
    resource: {
      id: `res_${paymentRequirements.requestId}`,
      title: "Paid Agent Research Packet",
      content:
        "This resource was released after the x402 mock flow recorded a CAW-backed payment order.",
      deliveredAt: new Date().toISOString()
    },
    topup,
    snapshot: topup.snapshot
  };
}

function createPaymentCredential(order: TopupOrder): X402PaymentCredential {
  return {
    credentialId: `x402_cred_${order.orderId.slice(-12)}`,
    scheme: "mock-caw",
    orderId: order.orderId,
    txHash: order.txHash,
    amountUsdcMinor: order.amountUsdcMinor,
    paidAt: order.creditedAt ?? order.updatedAt
  };
}

function createRequestId() {
  const id = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return id.replaceAll("-", "").slice(0, 16);
}
