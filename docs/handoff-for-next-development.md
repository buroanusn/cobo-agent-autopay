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

Real CAW integration is not complete yet. It needs:

```env
AGENT_WALLET_API_URL=
AGENT_WALLET_API_KEY=
AGENT_WALLET_WALLET_ID=
```

After those are available, set:

```env
CAW_MODE=http
```

The CAW wallet must also have:

- Base Sepolia ETH for gas.
- Base Sepolia USDC for payment.
- USDC allowance granted to `PAYMENT_CONTRACT_ADDRESS`.

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
caw onboard
```

After onboarding:

```bash
caw wallet current --show-api-key
```

Map output into project `.env`:

```env
AGENT_WALLET_API_URL=<api_url>
AGENT_WALLET_API_KEY=<api_key>
AGENT_WALLET_WALLET_ID=<wallet_uuid>
```

## Recommended Next Tasks

1. Build a readiness panel/API.
   - Show whether `CAW_MODE`, CAW credentials, contract address, treasury address, RPC, and chain settings are ready.
   - Do not expose secret values.

2. Run CAW onboarding.
   - Execute `caw onboard`.
   - Pair wallet in Cobo Agentic Wallet app.
   - Save API URL, API key, and wallet UUID into `.env`.

3. Switch from mock to real CAW.
   - Set `CAW_MODE=http`.
   - Test pairing code.
   - Test Pact submit.
   - Approve Pact in app.
   - Refresh Pact.

4. Fund CAW wallet.
   - Add Base Sepolia ETH.
   - Add Base Sepolia USDC.
   - Grant USDC allowance to the deployed `CreditsPayment` contract.

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
