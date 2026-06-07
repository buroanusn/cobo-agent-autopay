---
name: agent-credits-ledger
description: Use when working on this project's agent credit accounting, token usage charging, automatic low-balance top-up, ledger entries, top-up order states, idempotent settlement, or migration from the in-memory store to a durable database.
---

# Agent Credits Ledger

## Workflow

Use this skill whenever changes touch agent credit balances, usage charging, top-up order state, or the ledger.

1. Read the current domain flow in `lib/domain/services.ts` before editing.
2. Preserve the core sequence: consume credits, detect low balance, check backend policy, execute CAW payment, settle credits exactly once.
3. Keep ledger entries append-only. Balance changes must have a corresponding ledger entry.
4. Make top-up settlement idempotent by order id and chain event identity.
5. Keep CAW calls behind `lib/caw/gateway.ts`; domain code should depend on the gateway interface, not vendor-specific request shapes.

## Invariants

- Never credit a top-up before payment is confirmed or explicitly mock-confirmed.
- Never let an agent task create unlimited concurrent top-up orders for the same user.
- Never skip backend limits because CAW also enforces wallet-side policy; this project requires double control.
- Store USDC amounts in minor units, not floating point dollars.
- Treat the current prompt-length estimate as a placeholder. Prefer actual token usage when available.

## Project References

Read `references/schema-and-flow.md` before implementing database migration, repository changes, or token-usage based charging.
