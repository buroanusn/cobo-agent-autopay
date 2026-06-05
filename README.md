# Agent To Token

MVP implementation for an agent that consumes internal credits and automatically buys more credits with a CAW-controlled wallet when the balance is low.

Original GitHub repository README is preserved at `docs/github-readme.md`.

## What This Implements

- Next.js dashboard and API routes.
- Chain-off credits ledger with idempotent top-up orders.
- CAW gateway boundary with a real Cobo Agentic Wallet SDK adapter. Mock mode is disabled by default and only available when explicitly enabled for offline local development.
- Base USDC configuration and a Solidity `CreditsPayment` contract that emits order-linked purchase events.
- Default policy: 1 USDC per transaction, 5 USDC per day, 20 USDC per month, 7-day validity.
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

The default runtime expects real CAW credentials and real Base Sepolia calls:

1. Pair/connect the configured CAW wallet.
2. Generate and submit a CAW Pact from user intent.
3. Approve the Pact in the Cobo Agentic Wallet App.
4. Approve USDC allowance for the deployed `CreditsPayment` contract.
5. Run the agent task or manual top-up; the backend submits a real CAW contract call.

Offline mock mode requires both `CAW_MODE=mock` and `CAW_ALLOW_MOCK=true`.

For a new user or a separate deployment, create a separate CAW Agent Wallet and
switch the deployment environment variables before generating the pairing code.
See `docs/new-user-caw-pairing.md`.

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

Use `STORAGE_DRIVER=memory` only for throwaway local development. Real runs should use `STORAGE_DRIVER=prisma`.

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

- Use `CAW_MODE=http`. This is also the default unless mock is explicitly enabled with `CAW_ALLOW_MOCK=true`.
- Set Cobo Agentic Wallet SDK credentials: `AGENT_WALLET_API_URL`,
  `AGENT_WALLET_API_KEY`, and `AGENT_WALLET_WALLET_ID`.
- Keep `CHAIN_ENV=base-sepolia` and `CAW_CHAIN_ID=TBASE_SETH` for Base Sepolia runs.
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
