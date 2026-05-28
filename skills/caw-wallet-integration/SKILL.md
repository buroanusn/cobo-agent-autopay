---
name: caw-wallet-integration
description: Use when wiring or reviewing Cobo Agentic Wallet (CAW) integration for this project, including wallet connection, MPC non-custodial mode, Pact authorization, spending limits, policy denial handling, CAW mock/http gateway behavior, and CAW-executed contract calls.
---

# CAW Wallet Integration

## Workflow

Use this skill whenever a task touches CAW wallet behavior or authorization.

1. Keep all vendor-specific API calls inside `lib/caw/gateway.ts`.
2. Maintain two modes: `CAW_MODE=mock` for local development and `CAW_MODE=http` for real integration.
3. Treat CAW Pact as wallet-side enforcement, not as the only risk control.
4. Keep backend policy checks before every CAW payment execution.
5. Map CAW denial/failure into top-up order states and user-visible reasons.

## Required Policy Shape

Default policy for MVP:

- single transaction limit: 5 USDC
- daily limit: 20 USDC
- monthly limit: 100 USDC
- validity: 7 days
- allowed network: Base or Base Sepolia for testnet
- allowed token: USDC only
- allowed target: deployed `CreditsPayment` contract only
- allowed action: buy credits/top-up only

## Integration Rules

- Do not expose CAW API keys to the browser.
- Do not let UI routes call CAW directly; route through backend APIs.
- Do not request unlimited token approval or unlimited wallet authority.
- Use stable request/order ids so retries are safe.
- Keep mock responses behaviorally close to real CAW: pact id, status, tx hash, denial reason, and pending/confirmed distinctions.

## Project References

Read `references/caw-contract.md` before implementing the real CAW HTTP adapter or updating Pact/contract-call payloads.
