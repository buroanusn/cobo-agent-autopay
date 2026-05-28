# Agent To Token

MVP implementation for an agent that consumes internal credits and automatically buys more credits with a CAW-controlled wallet when the balance is low.

## What This Implements

- Next.js dashboard and API routes.
- Chain-off credits ledger with idempotent top-up orders.
- CAW gateway boundary with a mock mode for local development and an HTTP adapter for production wiring.
- Base USDC configuration and a Solidity `CreditsPayment` contract that emits order-linked purchase events.
- Default policy: 5 USDC per transaction, 20 USDC per day, 100 USDC per month, 7-day validity.

## Project Skills

Project-local Codex skills live in `skills/`:

- `skills/agent-credits-ledger`: credits ledger, usage charging, and auto top-up rules.
- `skills/caw-wallet-integration`: CAW Pact and wallet execution integration rules.
- `skills/base-usdc-settlement`: Base USDC contract, listener, and settlement rules.

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000/dashboard`.

The default `CAW_MODE=mock` flow lets you:

1. Connect a demo CAW wallet.
2. Create an active Pact-style authorization.
3. Run an agent task that consumes credits.
4. Auto top up with mock Base USDC when the balance drops under the threshold.

## Production Wiring

Keep business code behind `lib/caw/gateway.ts`. The app expects CAW to enforce the wallet-side spending policy and the backend to enforce product-side limits before every payment.

See [Next Implementation Questions](docs/next-implementation-questions.md) for the remaining production work and the information needed before wiring real funds.

For a real deployment:

- Replace `CAW_MODE=mock` with `CAW_MODE=http`.
- Set `CAW_API_BASE_URL`, `CAW_API_KEY`, and CAW route paths to the approved CAW environment.
- Deploy `contracts/CreditsPayment.sol` on Base.
- Configure `PAYMENT_CONTRACT_ADDRESS` and `TREASURY_ADDRESS`.
- Replace the in-memory store with a durable database.
- Subscribe to `CreditsPurchased` events and call `POST /api/webhooks/chain/credits-payment`.

## Core Flow

```text
agent task -> estimate/consume credits
          -> balance below threshold
          -> backend policy check
          -> CAW executes purchase under Pact
          -> CreditsPayment emits CreditsPurchased
          -> webhook settles order once
          -> credits ledger increments
```
