import { requireCurrentUser } from "@/lib/auth/session";
import { createPairingCode } from "@/lib/domain/services";
import { errorJson, okJson } from "@/lib/http";
import { getCreditRepository } from "@/lib/store";

export const dynamic = "force-dynamic";

// POST /api/wallet/caw/pairing-code — generate a new pairing code via
// the upstream CAW wallet, write a CawPairingSession row, and return
// the code + the user dashboard snapshot. The user types this code
// into the Cobo Agentic Wallet App on their phone to complete
// wallet ownership pairing.
export async function POST() {
  try {
    const user = await requireCurrentUser();
    return okJson(await createPairingCode({ userId: user.id }));
  } catch (error) {
    return errorJson(error);
  }
}

// GET /api/wallet/caw/pairing-code — return the current local
// CawPairingSession row from the user snapshot. Read-only; no upstream
// call. The dashboard polls this for cheap (no upstream), and only calls
// POST /api/wallet/caw/pairing-code/refresh after user actions (clicking
// the "Refresh" button, or generating a new code) to push a fresh
// upstream token_status check.
export async function GET() {
  try {
    const user = await requireCurrentUser();
    const repository = getCreditRepository();
    const snapshot = await repository.snapshotForUser(user.id);
    return okJson({ pairingSession: snapshot.pairingSession ?? null, snapshot });
  } catch (error) {
    return errorJson(error);
  }
}
