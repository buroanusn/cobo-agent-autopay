// POST /api/wallet/caw/pairing-code/refresh — R1.4 pair-complete.
//
// Mirrors the upstream CAW service's pair-claim state into the local
// CawPairingSession row. The dashboard calls this after the user has
// entered the pairing code in the Cobo Agentic Wallet App, so the UI
// flips from "Generated" to "Paired" within one click.
//
// Mapping (SDK token_status → project CawPairingSession.status):
//   valid       → generated
//   paired      → paired
//   completed   → paired
//   expired     → expired
//   not_found   → no change (no pending claim row upstream)
//
// Terminal-state short-circuit: if the local row is already "paired" or
// "expired", the service returns the existing session without calling
// upstream. The route just echoes the service result.

import { requireCurrentUser } from "@/lib/auth/session";
import { refreshPairingStatus } from "@/lib/domain/services";
import { errorJson, okJson } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const user = await requireCurrentUser();
    return okJson(await refreshPairingStatus({ userId: user.id }));
  } catch (error) {
    return errorJson(error);
  }
}
