# Agent To Token

MVP implementation for an agent that consumes internal credits and automatically buys more credits with a CAW-controlled wallet when the balance is low.

Original GitHub repository README is preserved at `docs/github-readme.md`.

## What This Implements

- Next.js dashboard and API routes.
- Chain-off credits ledger with idempotent top-up orders.
- CAW gateway boundary with a mock mode for local development and a real Cobo Agentic Wallet SDK adapter.
- Base USDC configuration and a Solidity `CreditsPayment` contract that emits order-linked purchase events.
- Default policy: 5 USDC per transaction, 20 USDC per day, 100 USDC per month, 7-day validity.
- Agent-drafted CAW Pact previews: natural-language intent becomes a PactSpec
  draft, then backend validation constrains it to the configured chain, USDC
  token, payment contract, and spend limits before CAW submission.

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

## Pact Drafter

The dashboard's "Generate Pact Plan" button runs a local agent drafter before
submitting anything to CAW. With no LLM key configured, the app uses a
deterministic drafter so demos keep working offline. To use an LLM-backed
drafter, set:

```bash
OPENAI_API_KEY=...
PACT_DRAFTER_MODE=llm
PACT_DRAFTER_MODEL=gpt-4.1-mini
```

CAW still receives a structured PactSpec through the SDK. The app does not let
the model directly expand permissions: backend validation rebuilds the final
policy allowlist from `CHAIN_ENV`, `CAW_CHAIN_ID`, `PAYMENT_CONTRACT_ADDRESS`,
and the configured USDC address.

## Database Setup

The local setup uses Postgres through Prisma by default. The durable schema is
defined in `prisma/schema.prisma`; use `STORAGE_DRIVER=prisma` after migrations
are applied.

```bash
cp .env.example .env
npm run db:generate
npm run db:migrate
```

Set `DATABASE_URL` to a Postgres database before running migrations.

Use `STORAGE_DRIVER=memory` only for a throwaway local mock demo.

## Testnet Mode

The project defaults to `CHAIN_ENV=base-sepolia` so demos can use Base Sepolia
ETH and test USDC instead of real funds. Switch to `CHAIN_ENV=base-mainnet`
only after CAW credentials, contract deployment, treasury setup, and production
spend controls are confirmed.

## Deploy CreditsPayment

Configure deployment variables in `.env`:

```bash
BASE_RPC_URL=https://...
DEPLOYER_PRIVATE_KEY=0x...
TREASURY_ADDRESS=0x...
CHAIN_ENV=base-sepolia
```

Deploy the contract:

```bash
npm run contract:compile
npm run contract:deploy
```

The script prints `PAYMENT_CONTRACT_ADDRESS=...`; copy that value into `.env`
before switching `CAW_MODE=http`.

Important: `CreditsPayment.buyCredits` pulls USDC with `transferFrom`, so the
CAW wallet must grant USDC allowance to the deployed contract before real
`buyCredits` calls can succeed.

## Production Wiring

Keep business code behind `lib/caw/gateway.ts`. The app expects CAW to enforce the wallet-side spending policy and the backend to enforce product-side limits before every payment.

See [Next Implementation Questions](docs/next-implementation-questions.md) for the remaining production work and the information needed before wiring real funds.

For a real deployment:

- Replace `CAW_MODE=mock` with `CAW_MODE=http`.
- Set Cobo Agentic Wallet SDK credentials: `AGENT_WALLET_API_URL`,
  `AGENT_WALLET_API_KEY`, and `AGENT_WALLET_WALLET_ID`.
- Keep `CHAIN_ENV=base-sepolia` and `CAW_CHAIN_ID=BASE_SEPOLIA` for testnet demos.
- Use `CAW_FAUCET_TOKEN_ID` for CAW Faucet requests. Confirm the exact token id from
  CAW metadata if your test environment uses a different name.
- Deploy `contracts/CreditsPayment.sol` on Base Sepolia for testnet demos.
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
