# Handoff For Next Development

## Current Status

The project is currently in a working mock-demo state with the first real testnet prerequisite completed.

Completed:

- CAW small auto-payment dashboard.
- Bilingual UI.
- Local Prisma/Postgres persistence.
- Mock CAW pairing, wallet connection, Pact creation, Pact refresh, faucet, and top-up flow.
- x402 + CAW mock proof of concept.
- Base Sepolia `CreditsPayment` contract deployment.
- GitHub and Gitee synchronization.
- `caw` CLI installation for future real CAW onboarding.

Latest relevant commits:

```text
825286b Document CAW testnet integration progress
0ad6dab Add x402 CAW mock flow
c09f420 Add CreditsPayment deployment script
8b7c9c5 Implement CAW testnet payment demo
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

Current recommended local mode:

```env
STORAGE_DRIVER=prisma
CAW_MODE=mock
CHAIN_ENV=base-sepolia
```

## What Works In Mock Mode

Dashboard actions:

- Generate pairing code.
- Connect CAW wallet.
- Enable mock Pact.
- Refresh Pact.
- Request mock test tokens.
- Run Agent task.
- Trigger manual top-up.
- Run x402 paid resource.

Mock x402 flow:

```text
GET /api/x402/resource
  -> returns HTTP 402 payment requirements

POST /api/x402/resource
  -> request paid resource
  -> receive 402 requirements
  -> execute CAW mock payment
  -> write topup order and ledger entry
  -> create mock payment credential
  -> return paid resource
```

## Important API Routes

```text
GET  /api/credits/balance
POST /api/agent/run
POST /api/credits/topup/auto
POST /api/wallet/caw/pairing-code
POST /api/wallet/caw/connect
POST /api/wallet/caw/authorization
POST /api/wallet/caw/authorization/refresh
POST /api/wallet/caw/faucet
POST /api/guardrails/recommend
GET  /api/x402/resource
POST /api/x402/resource
POST /api/webhooks/chain/credits-payment
```

## Testnet Contract Deployment

Network:

```text
Base Sepolia
Chain ID: 84532
```

CreditsPayment contract:

```text
0x1047e3c9476b57ecb4c794737ead8f5c8b8c6b05
```

Deployment transaction:

```text
0x3e19f578a56e22ac5946ce8f9bb625e88391aa1e869f525dd8fd740d46301682
```

Explorer:

```text
https://sepolia.basescan.org/address/0x1047e3c9476b57ecb4c794737ead8f5c8b8c6b05
```

Treasury address:

```text
0xb511E49FDd677aEA606c12f809d742d433f4AFD5
```

Base Sepolia USDC:

```text
0x036CbD53842c5426634e7929541eC2318f3dCF7e
```

## What Is Still Missing

Real CAW production wallet setup is now partially complete:

```text
Environment: prod
Agent name: cobo-agent-autopay
Agent ID: caw_agent_093bca402f6e43db
Wallet UUID: 351b97b6-4ae5-4d74-8656-b869bb0f6103
EVM address: 0x6346470a02ab22d8ecc967c980ed747689fa4304
Wallet status: active
Wallet paired: true
```

Local `.env` contains the production CAW API URL, API key, and wallet UUID. It is ignored by git and must not be committed.

The CAW integration status API and Dashboard panel are implemented:

- `GET /api/wallet/caw/status`
- Dashboard section: "Real CAW Integration Status" / "真实 CAW 接入状态"
- It returns only redacted status and never returns CAW API keys or private keys.

The CAW wallet must also have:

- Base Sepolia ETH for gas.
- Base Sepolia USDC for payment.
- USDC allowance granted to `PAYMENT_CONTRACT_ADDRESS`.

Known funding state:

```text
SETH: 0.01 received from CAW faucet
Base Sepolia ETH: missing
Base Sepolia USDC: missing
```

Important chain id note:

```text
Project chain: Base Sepolia
CAW chain id: TBASE_SETH
Old incorrect value: BASE_SEPOLIA
```

Allowance spender:

```text
0x1047e3c9476b57ecb4c794737ead8f5c8b8c6b05
```

## CAW CLI Status

Installed:

```text
caw version -> v0.2.84
```

CLI path:

```text
/Users/tnt/.local/bin/caw
```

Next CAW command to run:

```bash
caw wallet balance --chain-id TBASE_SETH
```

Useful production CAW checks:

```bash
caw status
caw wallet pair-status
caw wallet balance --token-id SETH
curl -s http://127.0.0.1:3000/api/wallet/caw/status
```

Do not run a new `caw onboard` unless intentionally creating a new wallet/profile.

## Recommended Next Tasks

1. Fund the production CAW wallet on Base Sepolia.
   - Address: `0x6346470a02ab22d8ecc967c980ed747689fa4304`.
   - Needs Base Sepolia ETH for gas.
   - Needs Base Sepolia USDC for the `CreditsPayment` contract.

2. Create a real CAW Pact.
   - Use `CAW_MODE=http`.
   - Chain must be `TBASE_SETH`.
   - Target contract must be `0x1047e3c9476b57ecb4c794737ead8f5c8b8c6b05`.
   - Owner approves in the production Cobo Agentic Wallet App.

3. Refresh Pact and verify readiness.
   - `POST /api/wallet/caw/authorization/refresh`
   - `GET /api/wallet/caw/status`
   - The status panel should no longer show `real CAW Pact authorization` as missing.

4. Grant USDC allowance if required.
   - The current `CreditsPayment` contract uses `USDC.transferFrom`.
   - The CAW wallet may need an ERC-20 approval transaction for the payment contract.

5. Run real payment test.
   - Trigger manual top-up.
   - Verify CAW contract call.
   - Verify chain event and ledger settlement.

6. Replace mock x402 credential.
   - Determine whether Bank of AI x402 accepts external signer/payment adapter.
   - If yes, map CAW payment results into real x402 credential.
   - If no, implement a CAW-backed x402 adapter.

## Development Rules

- One completed feature should become one git commit.
- Commit only after validation.
- Push completed commits to GitHub.
- Do not commit `.env`, private keys, CAW API keys, or local credentials.
- Keep mock mode available even after real CAW integration.

## Useful Validation Commands

```bash
npm run typecheck
npm run lint
npm run contract:compile
curl -i http://127.0.0.1:3000/api/x402/resource
curl -s -X POST http://127.0.0.1:3000/api/x402/resource -H 'content-type: application/json' -d '{}'
```
