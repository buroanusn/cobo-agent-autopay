import { NextRequest, NextResponse } from "next/server";

const PAYMENT_ADDRESS = process.env.TREASURY_ADDRESS || "0xb511E49FDd677aEA606c12f809d742d433f4AFD5";
const PRICE_WEI = "1000000000000000"; // 0.001 ETH in wei

const RESOURCE_DATA = {
  insight: "CAW + x402 = agent-native payments on the open internet",
  model: "HTTP 402 → CAW wallet signs → resource unlocked",
  chain: "Sepolia testnet",
  timestamp: new Date().toISOString(),
};

const verifiedPayments = new Set<string>();

export async function GET(req: NextRequest) {
  return handleRequest(req);
}

export async function POST(req: NextRequest) {
  return handleRequest(req);
}

async function handleRequest(req: NextRequest) {
  const paymentProof = req.headers.get("x-payment-proof");

  if (paymentProof) {
    // Verify on-chain
    try {
      const sepoliaRpc = "https://ethereum-sepolia-rpc.publicnode.com";
      const res = await fetch(sepoliaRpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_getTransactionReceipt",
          params: [paymentProof],
          id: 1,
        }),
      });
      const data = await res.json();
      const receipt = data?.result;

      if (receipt && receipt.status === "0x1") {
        const to = receipt.to?.toLowerCase();
        if (to === PAYMENT_ADDRESS.toLowerCase()) {
          verifiedPayments.add(paymentProof);
          return NextResponse.json({
            success: true,
            resource: RESOURCE_DATA,
            paymentVerified: true,
            txHash: paymentProof,
            blockNumber: receipt.blockNumber,
          });
        }
      }
    } catch {
      // Fall through to 402
    }

    return NextResponse.json(
      { error: "Payment verification failed" },
      { status: 402 }
    );
  }

  // Return standard x402 Payment Required response
  const response = NextResponse.json(
    {
      x402Version: 1,
      error: "Payment required",
      accepts: [
        {
          scheme: "exact",
          network: "eip155:11155111", // Sepolia
          maxAmountRequired: PRICE_WEI,
          resource: req.nextUrl.pathname,
          description: "Premium data access via x402 + CAW",
          mimeType: "application/json",
          payTo: PAYMENT_ADDRESS,
          maxTimeoutSeconds: 300,
          asset: "0x0000000000000000000000000000000000000000", // native ETH
        },
      ],
    },
    { status: 402 }
  );

  // Standard x402 headers
  response.headers.set("X-Payment-Required", "true");
  response.headers.set("WWW-Authenticate", "Payment");
  response.headers.set("Accept-Payment", `scheme="exact", network="eip155:11155111", asset="native", amount="${PRICE_WEI}", payTo="${PAYMENT_ADDRESS}"`);

  return response;
}
