# Agent Credits Schema And Flow

## Existing Files

- `lib/domain/services.ts`: domain actions for wallet connect, CAW authorization, agent run, auto top-up, and settlement.
- `lib/store/memory.ts`: current in-memory persistence boundary.
- `lib/domain/types.ts`: domain records and order states.
- `lib/domain/constants.ts`: Base, USDC, pricing, thresholds, and default spend policy.

## Recommended Durable Tables

- `users`: id, email, caw wallet address, timestamps.
- `credit_accounts`: user id, balance credits, low balance threshold, auto top-up credits, updated timestamp.
- `caw_authorizations`: user id, wallet address, pact id, status, limits, spend counters, window starts, expiry.
- `agent_usage_events`: user id, task name, prompt or task reference, input/output tokens, credits charged, status.
- `topup_orders`: user id, wallet address, order id, bytes32 order id, USDC minor amount, credits, status, tx hash, failure reason.
- `ledger_entries`: user id, type, credits delta, balance after, order id, usage event id, USDC minor amount, tx hash.
- `chain_events_seen`: unique event id, tx hash, log index, order id, processed timestamp.

## State Flow

```text
agent run
  -> charge credits
  -> if balance < threshold, create top-up order
  -> check backend policy
  -> call CAW gateway
  -> order becomes caw_submitted or chain_pending
  -> listener/webhook receives CreditsPurchased
  -> verify order, amount, and event id
  -> credit account and append ledger entry in one transaction
```

## Database Transaction Rules

- Charge usage and append its ledger entry in one transaction.
- Create a top-up order only after checking no active pending order exists for the user.
- Settlement must lock or atomically update the order so duplicate webhooks cannot double-credit.
- Updating account balance and inserting the settlement ledger entry must be atomic.
- Policy spend counters should be updated when CAW execution is accepted; if the real CAW API gives final denial after submission, record a compensating state or retry-safe failure.

## Token Usage Charging

When real agent usage is available, replace prompt-length estimation with explicit usage input:

- input tokens
- output tokens
- model id or task type
- price version
- credits charged

Keep a price snapshot on the usage event so historical ledger entries remain auditable after pricing changes.
