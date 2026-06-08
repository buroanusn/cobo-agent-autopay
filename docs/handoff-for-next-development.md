# Handoff For Next Development

Last updated: 2026-06-09, Asia/Shanghai.

## 2026-06-09 Update: New User CAW First-Use Flow

Adjusted the first-use flow so a new user no longer needs to know a Cobo ID
before creating and pairing a CAW wallet:

- The Web account email is now the default product identity for onboarding.
- `users.coboId` remains in the database as an optional unique external account
  note, not a required gate for CAW wallet creation or pairing.
- Dashboard progress now starts with the logged-in email account, then CAW
  wallet creation, CAW App pairing, and Pact authorization.
- The Cobo ID form moved into an optional disclosure.
- Backend CAW onboarding, manual wallet binding, pairing code generation,
  Pact preview/submission, USDC approval, Credits top-up, and Venice x402
  readiness no longer require `user.coboId`.
- Wallet and payment safety gates remain:
  - wallet IDs and wallet addresses are still unique per Web user
  - Pact and payment endpoints still require bound CAW wallet state
  - Venice x402 top-up still requires Base mainnet, CLI wallet profile, active
    non-mock Venice Pact, and sufficient Pact limits

Safety note:

- This update does not execute real Pact submission, CAW transactions, x402
  top-up, or on-chain payment by itself.

## 2026-06-09 Update: Ordered Feature Development Plan

Added a dedicated sequencing document:

- `docs/ordered-feature-development.md`

Purpose:

- Keep the next phase strictly one feature at a time.
- Put new-user onboarding before Venice automation because current testing is
  blocked by user confusion around Cobo ID / CAW wallet creation.
- Make every feature independently testable, validated, committed, and pushed
  before starting the next one.
- Preserve the real-money boundary: no real Pact submission, CAW transaction,
  x402 top-up, or on-chain operation during development/testing without
  explicit user confirmation.

Recommended next feature:

```text
1. 新用户首次使用流程校准
```

## 2026-06-09 Update: Simplified Dashboard First Screen

Simplified the dashboard for first-time users:

- The default dashboard now focuses on:
  - current setup progress
  - Cobo ID binding
  - CAW wallet creation
  - CAW App pairing code
  - visible status/activity log
- Existing advanced controls are retained but moved behind an "高级功能"
  disclosure:
  - Credits run/top-up
  - Credits Pact controls
  - Venice balance/x402/Pact/inference controls
  - CAW integration diagnostics
  - payment records and ledger
- Added browser-side activity logging for major dashboard actions so test users
  can see when requests start, succeed, fail, and where the setup is blocked.
- Moved manual CAW Wallet UUID binding into a small disclosure so new users see
  the intended path first: bind Cobo ID -> create CAW wallet -> generate pairing
  code -> pair in the Cobo Agentic Wallet app.

Safety note:

- This update is presentation-only. It does not execute CAW, Pact, x402, or
  on-chain operations by itself.

## 2026-06-09 Update: Cobo ID Account Binding

Started the first missing registration/binding gap from the target product flow:

- Added a first-class Cobo ID binding step after email login.
- Added Prisma fields on `User`:
  - `coboId`
  - `coboIdBoundAt`
- Added migration:
  - `prisma/migrations/20260609093000_add_user_cobo_id/`
- Added `POST /api/account/cobo-id` for logged-in users to bind a Cobo ID.
- Added duplicate Cobo ID checks across users.
- Cobo ID is normalized to lowercase and constrained to a short visible ID format.
- Dashboard now shows Cobo ID as the first step before CAW wallet creation,
  manual CAW Wallet UUID binding, and pairing code generation.
- Backend now blocks CAW wallet creation/binding, pairing code generation,
  Pact creation, USDC approval, credits top-up, and Venice x402 top-up until
  the logged-in account has a Cobo ID.

Important limitation:

- This does not claim external Cobo account ownership is verified by a Cobo API.
  It records the user's Cobo ID as the Web account binding identifier. Wallet
  ownership is still verified by CAW wallet/App pairing.

## 2026-06-09 Update: Pairing Status Auto Polling

Improved the registration/binding stage after Cobo ID binding:

- Dashboard now automatically refreshes CAW pairing status while a pairing code
  is in `generated` state and the wallet is not paired.
- Polling runs from the browser every 8 seconds and stops when pairing is
  completed, expired, or the page is left.
- The manual refresh button remains available as a fallback and is disabled
  after terminal states.
- Server-side pairing refresh now marks a locally expired pairing code as
  `expired` before attempting upstream CLI status checks.
- The UI clearly tells the user when automatic checking is active or when the
  pairing code has expired.

Important limitation:

- This is not yet a production background worker. It covers the MVP dashboard
  experience; a server-side job/queue should still be added for production
  pairing status tracking when users leave the page.

## 2026-06-08 Update: Venice Pact Template And Dashboard Panel

Added the first real Venice x402 UI path:

- Added a dedicated CAW authorization purpose field so Pact records are scoped:
  - `credits_payment` remains the existing CreditsPayment authorization path.
  - `venice_x402` is used only for Venice x402 top-up.
- Added Prisma migration:
  - `prisma/migrations/20260608103000_add_caw_authorization_purpose/`
- Added Venice Pact APIs:
  - `POST /api/venice/pact` with `previewOnly: true` generates a Venice
    Pact preview/template.
  - `POST /api/venice/pact` submits the Venice Pact through the user's CAW CLI
    profile.
  - `POST /api/venice/pact/refresh` refreshes the Venice Pact status through
    CAW CLI.
- Venice Pact template is deterministic and explicitly scoped to:
  - Base mainnet CAW chain ID `BASE_ETH`
  - Base mainnet native USDC token ID `BASE_USDC`
  - Base USDC contract `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
  - Venice x402 payTo discovered from the real 402 requirement
  - user-visible single/daily/monthly limits and validity
- `GET /api/venice/x402-topup` now discovers Base mainnet USDC requirements
  independent of the current testnet app config. `POST /api/venice/x402-topup`
  still requires `CHAIN_ENV=base-mainnet`.
- `POST /api/venice/x402-topup` now reads only the active `venice_x402` Pact
  and records product-side daily/monthly Pact spend after successful CAW x402
  execution.
- Dashboard now has a Venice AI panel for:
  - billing balance
  - x402 payment requirement discovery
  - Venice Pact preview / submit / refresh
  - explicit real-payment checkbox plus browser confirmation before top-up
  - standalone Venice inference
- `POST /api/venice/x402-topup` also requires `confirmed: true` in the
  request body; the dashboard only sends it after the explicit UI confirmation.
- The old mock x402 resource button is no longer exposed in the main dashboard
  flow.

Current validation for this update:

```text
npm run db:generate
npm run typecheck
npm run lint
npm run contract:compile
npm run build
git diff --check
```

## 2026-06-08 Update: Real Mainnet Direction

Product direction changed from Base Sepolia-first verification to real
environment execution first:

- Keep the existing CAW SDK + CreditsPayment flow for the current product path.
- Add CAW CLI support instead of replacing the SDK wholesale.
- The app now has a CAW CLI onboarding foundation so the site can create and
bind a CAW wallet for each logged-in user.
- Each app user gets an isolated CAW CLI `HOME` under `CAW_CLI_HOME_ROOT`
  instead of sharing the server user's active CAW profile.
- `.caw-cli-homes/` is ignored by git because it may contain local CAW
  profile credentials.
- Venice AI integration is started as backend APIs:
  - `GET /api/venice/balance` reads Venice billing balance with
    `VENICE_API_KEY`.
  - `POST /api/venice/inference` calls Venice chat completions with
    `VENICE_API_KEY`.
  - `GET /api/venice/x402-topup` discovers Venice x402 payment requirements
    without spending.
  - `POST /api/venice/x402-topup` executes a real CAW CLI
    `caw fetch --protocol x402` top-up. It is gated to Base mainnet USDC.

New CAW wallet creation flow:

1. Logged-in user clicks "创建 CAW 钱包" in the dashboard.
2. Backend calls `caw onboard` inside that user's isolated CAW CLI HOME.
3. The app stores `session_id`, `phase`, `prompts`, `needs_input`,
   `wallet_status`, and error/next-action metadata in
   `caw_wallet_onboarding_sessions`.
4. Follow-up calls always reuse the stored `session_id`.
5. When the CLI reports the wallet is active, the app reads the user's CAW CLI
   profile and binds `wallet_uuid` + EVM address to the app user.
6. Pairing code generation uses the user's isolated CLI profile when the wallet
   was created through CLI onboarding.

Important real-money guardrails:

- `POST /api/venice/x402-topup` is the first Venice endpoint that can spend
  real USDC. Do not call it during smoke tests.
- The endpoint requires:
  - `CHAIN_ENV=base-mainnet`
  - bound user CAW wallet
  - active non-mock Pact
  - unexpired Pact with enough single/monthly spend
  - Venice offering Base mainnet USDC in its 402 `accepts`
- The `--max-amount` passed to `caw fetch` is exactly the requested amount in
  USDC minor units; if Venice asks for more, CAW CLI should refuse the payment.

Validation completed for this update:

```text
npm run db:generate
npm run typecheck
npm run lint
npm run contract:compile
npm run build
git diff --check
```

Local HTTP smoke completed:

```text
GET /dashboard unauthenticated -> 307 /login
GET /api/wallet/caw/onboarding unauthenticated -> 401
POST /api/auth/login -> 200
GET /dashboard authenticated -> 200
GET /api/wallet/caw/onboarding authenticated -> 200
GET /api/wallet/caw/status authenticated -> 200
```

Local Prisma migration applied:

```text
20260608093000_add_caw_cli_onboarding
```

Remaining implementation work:

- Add a dedicated Venice Pact template/preview so the CAW App approval clearly
  authorizes Venice x402 top-ups on Base mainnet USDC.
- Add frontend controls for Venice balance, top-up amount, and inference once
  the real Pact wording is finalized.
- Decide whether internal CreditsPayment approvals/execution should also move
  to CAW CLI for CLI-created wallets, or remain SDK-only.
- Add production-grade background jobs for payment/order polling instead of
  relying only on manual refresh.
- Add encrypted storage or managed secret handling before deploying isolated
  CAW CLI homes to a shared production server.

## Current Status

The project has moved past mock-only demo mode. A real Cobo Agentic Wallet
testnet flow has been verified on Base Sepolia with the minimum spend path.

Completed:

- Next.js dashboard and API routes for agent credits, CAW authorization, real payment, and settlement.
- Database-backed email login is implemented. Each logged-in app user has
  isolated credits, orders, ledger entries, Pact records, and CAW wallet binding.
- CAW wallet addresses are unique per app user; duplicate binding is rejected.
- Real CAW HTTP mode is the default runtime.
- Mock CAW mode is disabled by default and only available when both
  `CAW_MODE=mock` and `CAW_ALLOW_MOCK=true` are set for offline local
  development.
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
- Dashboard now has a real CAW USDC approval action for `approve(paymentContract, amount)`.
- Default top-up and Pact form values now target the minimum 1 USDC path.
- Dashboard snapshots are public-safe: pact-scoped API keys are no longer sent
  to the browser.

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
npx prisma migrate deploy
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
Set `AUTH_SESSION_SECRET` before production deployment. Local development falls
back to a non-production session secret.

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

- `GET /api/wallet/caw/status` now separates "CAW configured" from "ready to
  spend now".
- The active 1 USDC Pact is exhausted:

```text
singleLimitUsdcMinor: 1000000
dailyLimitUsdcMinor: 1000000
monthlyLimitUsdcMinor: 1000000
spentTodayUsdcMinor: 1000000
spentMonthUsdcMinor: 1000000
remainingUsdcMinor: 0
```

Current status response correctly reports:

```text
cawConfigured: true
readyForRealPayment: false
missing:
  - Pact remaining spend below next payment
  - USDC allowance below next payment
spendReadiness.requiredUsdcMinor: 1000000
spendReadiness.remainingUsdcMinor: 0
spendReadiness.allowanceUsdcMinor: 0
```

This is correct: the next real operation still needs a new active Pact with
remaining spend and a fresh USDC allowance.

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

Real payment readiness now checks:

- CAW runtime configuration.
- Wallet pairing and wallet address match.
- Active real Pact.
- Pact expiry.
- Product-side remaining spend for the next default payment.
- USDC allowance for the payment contract.
- CAW wallet USDC balance.
- CAW wallet Base Sepolia ETH gas balance.

Real payment submission now runs this preflight before creating a top-up order.
If Pact, allowance, USDC, or gas is insufficient, the API returns `blocked`
instead of creating a fake or doomed payment order.

## What Works Now

Dashboard:

- Login by email at `/login`.
- Keep all dashboard/API actions scoped to the logged-in database user.
- Connect configured CAW wallet.
- Generate Pact preview from natural-language intent.
- Submit Pact to CAW.
- Refresh Pact after Cobo App approval.
- Show redacted CAW integration status and spend-readiness details.
- Submit a real CAW USDC `approve` call for the payment contract.
- Run real CAW payment through the credits payment flow.
- Show simplified payment records and credits ledger.

Backend:

- Database-backed user creation from email login.
- Signed httpOnly app session cookie.
- Per-user repository isolation for accounts, Pact records, top-up orders,
  usage events, and ledger entries.
- Unique CAW wallet address binding across users.
- Real CAW `submitPact`.
- Real CAW `contractCall` for `CreditsPayment.buyCredits`.
- Real CAW `contractCall` for ERC-20 `approve` through the dashboard/API.
- Product-side spend limits before payment.
- Real on-chain preflight before payment order creation.
- Chain webhook settlement with idempotent event IDs.

## Known Gaps

1. **CAW wallet provisioning is still single-runtime**
   - App users are now separate database users.
   - The current CAW SDK adapter still uses the one wallet configured in `.env`.
   - To let every real user bring a distinct CAW wallet, add per-user CAW wallet
     provisioning/profile storage or a supported CAW multi-wallet selector.
   - Until then, duplicate wallet binding is blocked.

2. **Automatic chain listener is missing**
   - Current settlement route works, but local verification required manually posting the event.
   - Add a listener for `CreditsPurchased` on `CreditsPayment`.
   - Listener should call `POST /api/webhooks/chain/credits-payment` with tx hash, order id, amount, and deterministic event id.

3. **Payment status polling is incomplete**
   - `executeCreditsPurchase` records CAW submission, but does not poll CAW until final `Success` / `Failed`.
   - Add a payment-status refresh job or endpoint to update `caw_submitted` orders.

4. **Pact generation is still deterministic by default**
   - The drafter supports optional OpenAI Responses API usage when `PACT_DRAFTER_MODE=llm`.
   - Need production-grade LLM prompt evaluation and stricter ambiguity handling before relying on arbitrary user text.

5. **x402 mock demo has been removed**
   - Do not use the old x402 route for current testing.
   - If x402 becomes a product requirement again, add it as a real provider integration instead of a mock panel.

6. **The 1 USDC test Pact is exhausted**
   - Do not rerun real payments under the same Pact.
   - For the next real operation, create and approve a new minimal Pact.

7. **Base Sepolia ETH is low**
   - Current wallet had `0.00015 ETH` before verification.
   - Top up Base Sepolia ETH before repeated real tests.

## Recommended Next Features

1. Add per-user CAW wallet provisioning or profile selection.
   - Store wallet UUID/address per app user.
   - Ensure CAW transactions use the logged-in user's configured wallet, not a
     single env wallet.

2. Add automatic on-chain event listener.
   - Target: `CreditsPurchased(bytes32,address,uint256,uint256)`.
   - Store last processed block or use deterministic event ids.
   - Keep webhook idempotency.

3. Add CAW tx status refresh endpoint.
   - Input: order id or request id.
   - Reads CAW tx status.
   - Updates order status and tx hash.
   - If success and listener has not settled yet, surface a clear "waiting for chain event" state.

4. Improve Pact drafter ambiguity handling.
   - If user intent lacks amount, chain, token, or duration, ask before submission.
   - Do not silently default ambiguous real CAW authorization requests.

5. Add clearer audit/export view.
   - Compact dashboard remains simple.
   - Add a separate detail drawer for order id, CAW tx id, chain tx hash, Pact id, and webhook event id.

6. Clean old mock data.
   - Current database contains previous mock orders with `0xmock...` tx hashes.
   - Add a reset/demo-seed script or a filtered "real only" view.

## Validation Commands

```bash
npm run typecheck
npm run lint
curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/dashboard
curl -s http://localhost:3000/api/wallet/caw/status
```

Login smoke test:

```bash
curl -s -c /private/tmp/agent_to_token_cookie.txt \
  -H 'content-type: application/json' \
  -d '{"email":"demo@agent.local"}' \
  http://localhost:3000/api/auth/login
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
- Mock mode must stay opt-in and visibly offline-only.
- Prefer minimal Base Sepolia spend; use 1 USDC or less for real verification.
