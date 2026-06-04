# Handoff For Next Development

Last updated: 2026-06-05, Asia/Shanghai.

## Current Status

The project has moved past mock-only demo mode. A real Cobo Agentic Wallet
testnet flow has been verified on Base Sepolia with the minimum spend path.

Completed:

- Next.js dashboard and API routes for agent credits, CAW authorization, real payment, and settlement.
- Mock CAW mode remains available for offline demos.
- Real CAW HTTP mode is configured locally.
- CAW wallet is active and paired in the Cobo Agentic Wallet App.
- Base Sepolia `CreditsPayment` contract is deployed.
- CAW Pact preview flow now uses an agent drafter:
  - User natural-language intent becomes a PactSpec draft.
  - Backend validation constrains final policy to the configured chain, USDC token, payment contract, and spend limits.
  - CAW still receives structured PactSpec through the SDK.
- Dashboard payment history and credits ledger were simplified for demos.
- Real 1 USDC CAW payment verification succeeded.
- The x402 mock demo panel and `/api/x402/resource` route were removed for the real-environment testing stage.

Latest relevant commits:

```text
2dd295b Simplify payment history display
ec5a456 Add agent-drafted CAW pact previews
a775634 Add CAW pact preview flow
```

## How To Run Locally

```bash
npm install
npm run db:generate
npm run dev
```

Open:

```text
http://localhost:3000/dashboard
```

Current real-demo mode:

```env
STORAGE_DRIVER=prisma
CAW_MODE=http
CHAIN_ENV=base-sepolia
CAW_CHAIN_ID=TBASE_SETH
```

Local `.env` contains CAW credentials and must not be committed.

## Real CAW Wallet State

CAW wallet:

```text
Wallet UUID: 351b97b6-4ae5-4d74-8656-b869bb0f6103
Wallet status: active
Wallet paired: true
EVM address: 0x6346470a02ab22d8ecc967c980ed747689fa4304
CAW chain id: TBASE_SETH
```

Known Base Sepolia balances before the 1 USDC verification:

```text
Base Sepolia ETH: 0.00015
Base Sepolia USDC: 40
```

Important addresses:

```text
CreditsPayment: 0x1047e3c9476b57ecb4c794737ead8f5c8b8c6b05
Base Sepolia USDC: 0x036CbD53842c5426634e7929541eC2318f3dCF7e
Treasury: 0xb511E49FDd677aEA606c12f809d742d433f4AFD5
```

## Real Verification Completed

Minimal Pact:

```text
Pact ID: ab0a60b5-77f7-466a-b184-051a96d9a49f
Status: active
Scope: Base Sepolia, USDC, CreditsPayment only
Single limit: 1 USDC
Daily limit: 1 USDC
Monthly/test limit: 1 USDC
Validity: 1 day
```

USDC approval:

```text
Spender: 0x1047e3c9476b57ecb4c794737ead8f5c8b8c6b05
Amount: 1 USDC
Tx: 0x6e9e17b60fbe18ac0deb3e886b6af52803eacd89758ddb2b941a72a214136655
```

1 USDC payment verification:

```text
Order ID: ord_789738713c3844b8
On-chain order ID: 0xf0c1d708cc42c2b358932dbb20dd0c9b13cb83822d217f1dfbfee8a1b6fb9052
Amount: 1 USDC
CAW tx record: 885302e7-bf80-49fc-90d0-a5e05a9b7d0d
Tx: 0xea60e4fe6d139db67b4c79ee538e68a3e33e5daae3605ba3413d3e89786e8b01
Settlement: credited
Credits balance: 4770 -> 5770
```

The 1 USDC Pact now has `remainingUsdcMinor = 0`, which is expected and prevents
accidental additional test spending under this Pact.

## Real Environment Readiness Assessment

Current conclusion:

```text
Real minimum end-to-end flow: verified
Safe to continue real-environment development testing: yes
Feature-complete / production-ready: no
```

Important nuance:

- `GET /api/wallet/caw/status` currently reports `readyForRealPayment=true`
  because CAW is configured, the wallet is paired, and the Pact status is
  `active`.
- That is not sufficient for real payment readiness. The active 1 USDC Pact is
  already exhausted:

```text
singleLimitUsdcMinor: 1000000
dailyLimitUsdcMinor: 1000000
monthlyLimitUsdcMinor: 1000000
spentTodayUsdcMinor: 1000000
spentMonthUsdcMinor: 1000000
remainingUsdcMinor: 0
```

Until this is fixed, the status panel can say "ready" while a new payment would
be blocked by product-side policy. Treat the current readiness indicator as
"CAW integration configured", not "can spend now".

## Important Fixes From Verification

Real CAW contract calls require explicit `src_addr` even though the CLI/SDK
documentation says it can be omitted. The app now sends:

```ts
src_addr: input.walletAddress
```

in `lib/caw/gateway.ts` for real `contractCall` execution.

The app currently relies on the chain webhook route to finalize a successful
payment:

```text
POST /api/webhooks/chain/credits-payment
```

For the verified test, settlement was manually replayed after confirming CAW tx
success because no automatic chain-event listener is running locally.

## What Works Now

Dashboard:

- Connect configured CAW wallet.
- Generate Pact preview from natural-language intent.
- Submit Pact to CAW.
- Refresh Pact after Cobo App approval.
- Show redacted CAW integration status.
- Run real CAW payment through the credits payment flow.
- Show simplified payment records and credits ledger.

Backend:

- Real CAW `submitPact`.
- Real CAW `contractCall` for `CreditsPayment.buyCredits`.
- Real CAW `contractCall` for ERC-20 `approve` through CLI/manual flow.
- Product-side spend limits before payment.
- Chain webhook settlement with idempotent event IDs.

## Known Gaps

1. **Readiness check is too optimistic**
   - `readyForRealPayment` must include:
     - Pact status is active.
     - Pact has not expired.
     - Product-side remaining spend is greater than the requested payment.
     - USDC allowance is enough for the requested payment.
     - CAW wallet still has enough USDC and Base Sepolia ETH.
   - Current UI can show ready even when `remainingUsdcMinor = 0`.

2. **Default top-up amount does not match the minimal Pact**
   - The default Agent auto top-up is still 5 USDC.
   - The verified Pact is only 1 USDC and is now exhausted.
   - A real test click can create failed orders instead of a clean demo.
   - Add a minimal verification mode or dynamically clamp top-up amount to the active Pact.

3. **Automatic chain listener is missing**
   - Current settlement route works, but local verification required manually posting the event.
   - Add a listener for `CreditsPurchased` on `CreditsPayment`.
   - Listener should call `POST /api/webhooks/chain/credits-payment` with tx hash, order id, amount, and deterministic event id.

4. **Payment status polling is incomplete**
   - `executeCreditsPurchase` records CAW submission, but does not poll CAW until final `Success` / `Failed`.
   - Add a payment-status refresh job or endpoint to update `caw_submitted` orders.

5. **USDC approval is still manual**
   - The app can execute the payment after allowance exists.
   - Add an explicit approval flow:
     - Check current allowance.
     - If below requested spend, propose/submit a Pact or use existing Pact scope for `approve`.
     - Execute `approve(spender, amount)` with minimal amount.
     - Display allowance status in the dashboard.

6. **Pact generation is still deterministic by default**
   - The drafter supports optional OpenAI Responses API usage when `PACT_DRAFTER_MODE=llm`.
   - Need production-grade LLM prompt evaluation and stricter ambiguity handling before relying on arbitrary user text.

7. **x402 mock demo has been removed**
   - Do not use the old x402 route for current testing.
   - If x402 becomes a product requirement again, add it as a real provider integration instead of a mock panel.

8. **The 1 USDC test Pact is exhausted**
   - Do not rerun real payments under the same Pact.
   - For more tests, create a new minimal Pact or use mock mode.

9. **Base Sepolia ETH is low**
   - Current wallet had `0.00015 ETH` before verification.
   - Top up Base Sepolia ETH before repeated real tests.

## Recommended Next Features

1. Fix real readiness semantics.
   - Rename or split current status into:
     - "CAW configured"
     - "Ready to spend now"
   - Include Pact remaining amount, expiry, allowance, USDC balance, and gas balance.
   - Show "Pact exhausted" when remaining amount is 0.

2. Add minimal real verification mode.
   - Use 1 USDC or less.
   - Disable the default 5 USDC top-up path during minimal tests.
   - Avoid creating failed orders when the active Pact cannot cover the amount.

3. Add allowance panel and approval action.
   - Show current allowance.
   - Show required allowance for next test.
   - Create minimal approve transaction.
   - Avoid infinite allowance for demos.

4. Add automatic on-chain event listener.
   - Target: `CreditsPurchased(bytes32,address,uint256,uint256)`.
   - Store last processed block or use deterministic event ids.
   - Keep webhook idempotency.

5. Add CAW tx status refresh endpoint.
   - Input: order id or request id.
   - Reads CAW tx status.
   - Updates order status and tx hash.
   - If success and listener has not settled yet, surface a clear "waiting for chain event" state.

6. Improve Pact drafter ambiguity handling.
   - If user intent lacks amount, chain, token, or duration, ask before submission.
   - Do not silently default for real CAW mode except in mock/demo mode.

7. Add clearer audit/export view.
   - Compact dashboard remains simple.
   - Add a separate detail drawer for order id, CAW tx id, chain tx hash, Pact id, and webhook event id.

8. Clean old mock data for demos.
   - Current database contains previous mock orders with `0xmock...` tx hashes.
   - Add a reset/demo-seed script or a filtered "real only" view.

## Validation Commands

```bash
npm run typecheck
npm run lint
curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/dashboard
curl -s http://localhost:3000/api/wallet/caw/status
```

Useful CAW commands:

```bash
caw wallet balance --chain-id TBASE_SETH
caw pact show --pact-id <pact-id>
caw tx get --request-id <request-id>
```

Useful chain checks:

```text
Check CAW wallet Base Sepolia ETH balance.
Check CAW wallet Base Sepolia USDC balance.
Check USDC allowance from CAW wallet to CreditsPayment.
Check CreditsPayment contract code exists.
```

## Development Rules

- One completed feature should become one git commit.
- Commit only after validation.
- Push completed commits to GitHub.
- Do not commit `.env`, private keys, CAW API keys, pact API keys, or local credentials.
- Keep mock mode available after real CAW integration.
- Prefer minimal testnet spend; use 1 USDC or less for real verification.
