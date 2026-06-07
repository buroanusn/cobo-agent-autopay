import { NextResponse } from "next/server";
import { execSync } from "child_process";

// Use the user's actual HOME so caw CLI reads the real profile directory
// (~/.cobo-agentic-wallet/profiles/...) where their CAW wallets live.
// Previous value pointed at the "think" Hermes profile home which has a
// different (empty) caw profile.
const CAW_HOME = "/Users/jichenyang";

export async function GET() {
  try {
    const raw = execSync("caw tx list --limit 10", {
      timeout: 15000,
      encoding: "utf-8",
      env: { ...process.env, HOME: CAW_HOME },
    });
    const data = JSON.parse(raw);
    if (!data.success) {
      return NextResponse.json({ error: "caw tx list failed" }, { status: 500 });
    }

    const records = (data.result || []).map((tx: Record<string, unknown>) => {
      const description = (tx.description as string) || "";
      const requestId = (tx.request_id as string) || "";
      const status = tx.status as string;
      const subStatus = tx.sub_status as string;

      let reason = "manual";
      if (requestId.startsWith("x402-")) reason = "x402_auto";
      else if (description.toLowerCase().includes("x402")) reason = "x402_auto";

      if (status === "Rejected" && subStatus === "policy_denied") reason = "policy_denied";
      else if (status === "Pending") reason = "pending";
      else if (status === "Expired") reason = "expired";

      return {
        id: tx.id,
        time: tx.created_at,
        amount: tx.amount,
        token: tx.token_id,
        chain: tx.chain_id,
        to: tx.dst_address,
        from: tx.src_address,
        status,
        subStatus,
        reason,
        txHash: tx.transaction_hash || null,
        description,
        requestId,
        fee: tx.fee?.estimated_fee_used || null,
        pactId: tx.pact_id,
      };
    });

    return NextResponse.json({ records });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
