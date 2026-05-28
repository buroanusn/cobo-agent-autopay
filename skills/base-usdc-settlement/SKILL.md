---
name: base-usdc-settlement
description: Use when implementing or reviewing Base/Base Sepolia USDC payment settlement for this project, including CreditsPayment.sol, USDC decimal handling, event listeners, webhook settlement, confirmations, idempotency, contract tests, and deployment scripts.
---

# Base USDC Settlement

## Workflow

Use this skill whenever a task touches the payment contract, chain listener, or settlement webhook.

1. Treat USDC as 6-decimal minor units everywhere.
2. Keep settlement order-linked with both app order id and onchain bytes32 order id.
3. Confirm `CreditsPurchased` events before crediting the ledger.
4. Settle through the same domain function used by the webhook to preserve idempotency.
5. Test duplicate events, mismatched amounts, reverted transfers, and already fulfilled orders.

## Contract Rules

- Keep `CreditsPayment.sol` small and auditable.
- Do not add DEX routing to the MVP settlement path.
- Ensure one `orderId` can be fulfilled only once.
- Emit payer, credit account, order id, USDC amount, and credits.
- Transfer USDC to treasury, not to the backend.

## Listener Rules

- Use tx hash + log index as the event identity when available.
- Wait for a configurable confirmation count before settlement.
- On reorg or unknown status, do not credit until the event is final enough for the configured environment.
- Listener retries must not double-credit.

## Project References

Read `references/settlement-flow.md` before adding Foundry/Hardhat, deployment scripts, or a Base event listener.
