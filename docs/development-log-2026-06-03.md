# Development Log - 2026-06-03

## Summary

Today we moved the project from a local mock-only demo toward real CAW testnet integration.
The app already has a working CAW mock flow and an x402 + CAW mock proof of concept. The
Base Sepolia payment contract is now deployed, and the CAW CLI has been installed locally for
the next onboarding step.

## Current Project State

Completed:

- CAW small auto-payment dashboard.
- Bilingual UI.
- Prisma/Postgres local persistence.
- CAW mock flow for wallet pairing, Pact creation, top-up orders, ledger entries, and payment stats.
- x402 + CAW mock flow:
  - `GET /api/x402/resource` returns HTTP 402 payment requirements.
  - `POST /api/x402/resource` runs the mock flow: 402 -> CAW mock payment -> payment credential -> paid resource.
- Base Sepolia `CreditsPayment` deployment script.
- Base Sepolia `CreditsPayment` contract deployment.
- GitHub push flow is working.
- Global `feature-commit` skill exists for one-feature-one-commit workflow.

Latest functional commit:

```text
0ad6dab Add x402 CAW mock flow
```

## Contract Deployment

Network:

```text
Base Sepolia
Chain ID: 84532
```

Deployer wallet:

```text
0x83Be2C04485b0E2c1f94D712FE480f9C80584863
```

Treasury address:

```text
0xb511E49FDd677aEA606c12f809d742d433f4AFD5
```

USDC:

```text
0x036CbD53842c5426634e7929541eC2318f3dCF7e
```

Payment contract:

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

Local `.env` has been updated with:

```env
PAYMENT_CONTRACT_ADDRESS=0x1047e3c9476b57ecb4c794737ead8f5c8b8c6b05
TREASURY_ADDRESS=0xb511E49FDd677aEA606c12f809d742d433f4AFD5
CHAIN_ENV=base-sepolia
```

Do not commit `.env`.

## CAW CLI Installation

Installed the Cobo Agentic Wallet skill:

```bash
npx skills add CoboGlobal/cobo-agentic-wallet --skill cobo-agentic-wallet --yes --global
```

Installed the `caw` CLI:

```bash
bash ~/.agents/skills/cobo-agentic-wallet/scripts/bootstrap-env.sh --only caw
```

Installed binary:

```text
/Users/tnt/.local/bin/caw
```

Verified version:

```text
caw version -> v0.2.84
```

Verified schema command:

```bash
caw schema wallet current
```

## What Is Still Missing

Real CAW production App pairing is complete.

CAW production wallet status:

```text
Environment: prod
Agent name: cobo-agent-autopay
Agent ID: caw_agent_093bca402f6e43db
Wallet UUID: 351b97b6-4ae5-4d74-8656-b869bb0f6103
EVM address: 0x6346470a02ab22d8ecc967c980ed747689fa4304
Wallet status: active
Wallet paired: true
```

The Dashboard now includes a redacted CAW integration status panel and `/api/wallet/caw/status`. It shows CAW mode, environment, API configured status, wallet pairing, wallet address, app-connected wallet, Pact status, chain, and missing readiness items. It does not expose API keys or private keys.

CAW test funding status:

```text
SETH faucet amount: 0.01
SETH status: received
Base Sepolia ETH: missing
Base Sepolia USDC: missing
```

Important CAW chain ID correction:

```text
Project CHAIN_ENV: base-sepolia
CAW Base Sepolia chain id: TBASE_SETH
Old incorrect value: BASE_SEPOLIA
```

The code default and `.env.example` now use `TBASE_SETH`.

Because the production CAW App was unavailable in the user's App Store region, a separate CAW developer-environment wallet was created from the PDF developer tutorial path.

CAW dev wallet status:

```text
Environment: dev
Agent name: cobo-agent-autopay-dev
Agent ID: caw_agent_e4c0c73c1c506e81
Wallet UUID: d4d60341-82d5-4abc-91cf-a4956b414a26
EVM address: 0x4ecf1c3c2e612e61dd6ed9a42d57fb981fb00820
Wallet status: active
Wallet paired: false
```

Local `.env` was switched to the CAW dev API/profile for testing. The API key is local-only and must not be committed.

The dev pairing code was generated and shared in the chat session only. Do not commit active pairing codes. If the project switches back to dev, run `caw wallet current --wallet-uuid d4d60341-82d5-4abc-91cf-a4956b414a26`, then `caw wallet pair`.

Real CAW integration still needs:

```env
AGENT_WALLET_API_URL=<dev or prod api url>
AGENT_WALLET_API_KEY=<local only>
AGENT_WALLET_WALLET_ID=<wallet uuid>
```

The CAW production wallet still needs:

- Base Sepolia ETH for gas.
- Base Sepolia USDC for payment.
- USDC allowance granted to:

```text
0x1047e3c9476b57ecb4c794737ead8f5c8b8c6b05
```

Allowance token:

```text
Base Sepolia USDC
0x036CbD53842c5426634e7929541eC2318f3dCF7e
```

## Next Development Steps

1. Fund the production CAW wallet on Base Sepolia:

```text
0x6346470a02ab22d8ecc967c980ed747689fa4304
```

2. Required test assets:

```text
Base Sepolia ETH for gas
Base Sepolia USDC for payment
```

3. Confirm the CAW chain env:

```env
CHAIN_ENV=base-sepolia
CAW_CHAIN_ID=TBASE_SETH
CAW_MODE=http
```

4. Create a real CAW Pact from the Dashboard or API after funding is ready.

5. Approve the Pact in the production Cobo Agentic Wallet App.

6. Refresh Pact status:

```bash
curl -s -X POST http://127.0.0.1:3000/api/wallet/caw/authorization/refresh
```

7. Grant USDC allowance to the deployed payment contract if the CAW flow requires a separate approval transaction.

8. Run real top-up payment and verify ledger settlement.

9. Continue x402 production work:

- Replace mock x402 credential verification.
- Determine whether Bank of AI x402 accepts CAW-backed external signer/payment adapter.
- If not, implement a CAW-backed x402 adapter.

Useful status checks:

```bash
caw status
caw wallet pair-status
curl -s http://127.0.0.1:3000/api/wallet/caw/status
```

Recommended test order:

1. Generate CAW pairing code.
2. Pair in Cobo Agentic Wallet app.
3. Create Pact.
4. Approve Pact in app.
5. Refresh Pact.
6. Request test tokens.
7. Run x402 paid resource.
8. Run real top-up payment.

## Important Notes

- A private key was used only as a temporary environment variable for contract deployment.
- The private key was not written into repository files.
- `.env` remains ignored by git and must not be committed.
- Current x402 integration is still a mock protocol adapter. It validates the product flow but does not yet produce a real Bank of AI x402 credential.
- The next major technical task is converting CAW payment results into a real x402 payment credential or implementing a CAW-backed x402 adapter.
