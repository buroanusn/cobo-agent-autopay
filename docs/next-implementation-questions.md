# Next Implementation Questions

This document records what is already implemented in the MVP, what is still missing for a real deployment, what information is needed from the project owner, and the recommended next task.

## Current State

The project already has a runnable MVP for the core product logic:

- Agent tasks consume internal credits.
- A low credit balance can trigger automatic top-up.
- Backend policy checks enforce single, daily, monthly, and expiry limits.
- CAW integration is isolated behind `lib/caw/gateway.ts`.
- `CAW_MODE=mock` can run the full local flow without real CAW credentials.
- `CAW_MODE=http` provides the production adapter boundary for real CAW APIs.
- `CreditsPayment.sol` defines a Base USDC payment contract with an order-linked `CreditsPurchased` event.
- The webhook endpoint settles top-up orders idempotently.

Validation completed:

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm audit --audit-level=moderate`

## Not Finished Yet

These items are still required before this can handle real user funds:

- Real CAW API integration: the current production adapter is structurally ready, but it needs the approved CAW API paths, payloads, credentials, and transaction status behavior.
- Persistent database: the current ledger uses an in-memory store and will reset on restart.
- Chain event listener: the webhook exists, but there is no worker listening to Base `CreditsPurchased` events yet.
- Contract toolchain: `CreditsPayment.sol` is present, but there is no Foundry or Hardhat setup, deployment script, or contract test suite.
- Real wallet authorization UI: the dashboard currently uses a demo CAW wallet address and mock Pact activation.
- User system: the app currently has one demo user and no login, tenant isolation, or request authentication.
- Real agent token usage: the current implementation estimates credits from prompt length instead of consuming actual model usage data.
- Operations tools: there is no admin view for stuck orders, failed payments, policy revocation, or manual credit adjustment.
- Production security: webhook authentication, rate limiting, request signing, audit logs, and secrets management still need to be added.

## Information Needed From You

Please provide or decide the following before the next implementation pass:

- CAW access: SDK/API docs, API key, test environment, how to create Pact authorization, how to execute a contract call, and how to query transaction status.
- Network target: whether the first real integration should use Base Sepolia or Base mainnet. Recommended default: Base Sepolia first.
- Database choice: whether to use an existing database or add a new one. Recommended default: Postgres with Prisma.
- Agent runtime: which agent stack produces token usage, for example OpenAI Agents SDK, LangChain, a custom runner, or another service.
- Auth model: whether an existing login/user system should be integrated or whether the project should add a minimal user table first.
- Spend policy: whether the default limits should stay at 5 USDC per transaction, 20 USDC per day, 100 USDC per month, and 7-day validity.
- Treasury setup: target treasury address, deployment wallet, RPC provider, and whether treasury rotation is needed.

## Recommended Next Task

Upgrade the MVP into a testnet-ready integration:

- Add Prisma and a durable schema for users, credit accounts, authorizations, top-up orders, usage events, and ledger entries.
- Replace `lib/store/memory.ts` with a database-backed repository while keeping the same domain service behavior.
- Add Foundry or Hardhat for contract compile/test/deploy.
- Add Base Sepolia configuration and deployment scripts for `CreditsPayment.sol`.
- Add a chain listener that reads `CreditsPurchased` events and calls the existing settlement logic.
- Keep `CAW_MODE=mock` for local development and wire `CAW_MODE=http` once real CAW details are available.
- Change agent usage input so callers can pass actual token usage and credits charged, instead of using prompt-length estimation.

## Suggested Request To Give Codex

Use this as the next implementation request:

```text
把当前 MVP 升级成 Base Sepolia 测试网版本：
1. 加 Prisma + Postgres schema，替换内存账本。
2. 加 Foundry 或 Hardhat，给 CreditsPayment.sol 写测试和部署脚本。
3. 加 Base Sepolia 配置和链上事件监听器。
4. 保留 CAW mock，同时按真实 CAW 文档完善 CAW http adapter。
5. 把 agent 扣费接口改成支持真实 token usage。
```
