# CAW Developer Tutorial Notes

Date: 2026-06-03

Source file: `/Users/tnt/Downloads/Cobo Agentic Wallet 开发者教程.pdf`

This note records what was learned from the CAW developer tutorial and how it affects the current `cobo-agent-autopay` project.

## Key References From The Tutorial

### Production Environment

- Website: `https://agenticwallet.cobo.com/agentic-wallet`
- API: `https://api-core.agenticwallet.cobo.com/`
- Skill repository: `https://github.com/CoboGlobal/cobo-agentic-wallet/`
- iOS App Store: `https://apps.apple.com/app/id6761912352`
- Google Play: `https://play.google.com/store/apps/details?id=com.cobo.agenticwallet`

### Developer Environment

- Website: `https://agenticwallet.dev.cobo.com/agentic-wallet`
- API docs: `https://api-core.agenticwallet.dev.cobo.com/api/v1/docs`
- Dev skill repository: `https://github.com/cobosteven/cobo-agentic-wallet-dev`
- iOS TestFlight: `https://testflight.apple.com/join/Gs397pnJ`

The tutorial says its walkthrough uses the developer environment. This is important because the production mobile app may be unavailable in some App Store regions, while the developer environment provides a TestFlight path.

## Current Project State

The current project has already completed the following:

- Local Next.js app with bilingual UI.
- Prisma/Postgres persistence.
- Mock CAW payment flow.
- Mock x402 + CAW proof-of-concept flow.
- Base Sepolia `CreditsPayment` contract deployment.
- Production CAW CLI installed.
- Production CAW wallet created and active.
- Local `.env` switched to `CAW_MODE=http` with CAW production profile credentials.

Current production CAW wallet metadata:

- Agent name: `cobo-agent-autopay`
- Agent ID: `caw_agent_093bca402f6e43db`
- Wallet UUID: `351b97b6-4ae5-4d74-8656-b869bb0f6103`
- Wallet name: `cobo-agent-autopay's Wallet`
- Wallet status: `active`
- Wallet paired: `false`

Sensitive values such as CAW API keys and private keys remain local-only and must not be committed.

## Important Difference: Production vs Developer CAW

The project currently uses the production CAW environment:

- `AGENT_WALLET_API_URL=https://api.agenticwallet.cobo.com`
- `CAW_MODE=http`

The PDF tutorial demonstrates the developer CAW environment:

- CLI onboarding should use `caw onboard --env dev`.
- Dev API docs are available at `https://api-core.agenticwallet.dev.cobo.com/api/v1/docs`.
- The dev app path is TestFlight, which may solve the user's "region unavailable" issue.

This means there are two possible integration tracks:

1. Continue with production CAW.
2. Switch to CAW developer environment for easier testing and App access.

For this project, the developer environment is the better next step if the user cannot download the production App.

## CAW CLI Flow From Tutorial

The tutorial's CLI flow is:

1. Install the CAW skill and CLI.
2. Run `caw onboard --env dev` for developer environment onboarding.
3. Keep the returned `session_id`.
4. Re-run `caw onboard --session-id <session_id>` until wallet status becomes `active`.
5. Read wallet credentials from the profile or `caw wallet current --show-api-key`.
6. Create a pairing code.
7. Pair in the CAW App.
8. Submit a Pact.
9. Wait for owner approval in the App.
10. Execute a transaction with `caw tx call --pact-id <pact_id>`.

The current project followed the same high-level flow, but against production CAW, not dev CAW.

## CAW API Flow From Tutorial

The API-level flow is:

1. `POST /api/v1/principals/provision`
2. Save the returned API key.
3. Use `X-API-Key` for subsequent requests.
4. `POST /api/v1/wallets` to create an MPC wallet.
5. `GET /api/v1/wallets` to check wallet status.
6. `POST /api/v1/wallets/{wallet_id}/addresses` to create an EVM-compatible address.
7. `POST /api/v1/wallets/pairs/initiate` to create a pairing code.
8. `POST /api/v1/pacts/submit` to create a Pact.
9. `GET /api/v1/pacts/{pact_id}` to check Pact status.

One important detail: at the API level, once a Pact is approved, the Pact returns a new Pact API key. Future API calls use that Pact API key to identify the approved authorization scope. The CLI hides this behind `--pact-id`.

## Pact Meaning In This Project

A Pact is the user's approval contract with the CAW agent. It limits what the agent can do:

- which chain can be used,
- which token can be spent,
- which contract can be called,
- how many transactions are allowed,
- whether the user must review the action,
- when the authorization ends.

For this project, a proper Pact should allow only the minimum required payment operation:

- Chain: Base Sepolia or CAW dev-supported test chain.
- Target contract: deployed `CreditsPayment` contract.
- Token: test USDC if token spending is used.
- Limit: small transaction count and small spend amount.
- Review: enabled until demo confidence improves.

## Impact On x402 + CAW Plan

The x402 + CAW combination remains feasible, but the tutorial confirms that CAW is primarily the wallet, authorization, and transaction execution layer. x402 is still a separate payment challenge/credential protocol.

The practical architecture should be:

1. Protected API returns `402 Payment Required`.
2. Frontend or agent reads the x402 payment requirement.
3. CAW submits or executes the corresponding on-chain payment under an approved Pact.
4. App backend verifies the payment result or transaction hash.
5. Backend returns the paid resource.

Current implementation already proves this architecture in mock mode. The missing production-grade pieces are:

- Real CAW Pact approval flow.
- Real transaction execution through CAW.
- Real x402 credential verification instead of mock credential verification.
- A CAW dev environment setup if production App access is blocked.

## App Region Issue

If the production Cobo Agentic Wallet App is unavailable in the user's region, use the developer path from the tutorial:

1. Open TestFlight link: `https://testflight.apple.com/join/Gs397pnJ`.
2. Install the dev CAW App through TestFlight.
3. Switch CLI onboarding to developer environment with `caw onboard --env dev`.
4. Use the dev CAW API/profile for local testing.

This should be treated as a separate environment from the production CAW wallet already created.

## Recommended Next Step

Because the user cannot download the production App due to region restrictions, the next development step should be:

1. Install/use the CAW developer skill if needed.
2. Create a separate dev CAW wallet with `caw onboard --env dev`.
3. Generate a dev pairing code.
4. Ask the user to install the TestFlight app and pair the dev wallet.
5. Update local `.env` to target the dev CAW API/profile for testing.
6. Run the local UI and validate the real CAW pairing/Pact flow.

Do not delete the existing production CAW profile. Keep production and dev wallets separate.
