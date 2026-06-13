# AGENTS.md

## Quick commands

```bash
npm run dev          # dev server (Next.js)
npm run build        # production build
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm run db:generate  # prisma generate
npm run db:migrate   # prisma migrate dev
npm run db:studio    # Prisma Studio (visual DB)
```

After schema changes: `npm run db:generate && npm run db:migrate`.

## Architecture

Next.js 15.5 App Router (TypeScript, Tailwind). SQLite via Prisma for persistence. No monorepo.

- `app/` — Pages + API routes. Frontend: dashboard (wallet, venice, blockrun, pact, guardrails, payments, settings). Backend: REST API routes under `app/api/`.
- `lib/` — Business logic. Key modules: `caw/cli.ts` (CAW CLI wrapper), `venice/topup.ts` (x402 payments), `r34-sweep-heartbeat.ts` (background heartbeat), `secrets/store.ts` (AES-256-GCM encrypted user secrets), `store/` (repository abstraction).
- `contracts/` — Solidity (`CreditsPayment.sol`). Compile with `npm run contract:compile`, deploy with `npm run contract:deploy`.
- `prisma/` — Schema + migrations. `schema.prisma` is the source of truth.
- `scripts/` — DB init, contract deploy, test helpers.
- `skills/` — Skill YAML definitions (not runtime code).

## Critical gotchas

**Webpack + dynamic imports**: Files in `lib/` that import `node:crypto` or other Node-only modules MUST be dynamically imported, not statically. Static imports of `lib/domain/services` → `lib/store` → `node:crypto` cause webpack `UnhandledSchemeError`. See `lib/r34-sweep-heartbeat.ts` for the pattern. `next.config.mjs` externalizes `@cobo/agentic-wallet`, `@prisma/client`, and `prisma` from server bundle.

**CAW CLI isolation**: Each app user gets an isolated `HOME` directory under `CAW_CLI_HOME_ROOT` (must be an absolute path). The `caw` binary runs with this custom HOME to avoid profile collisions. Proxy env vars (`http_proxy`, `https_proxy`, etc.) are stripped from the CLI subprocess to prevent local proxy hijacking.

**Heartbeat / instrumentation**: The R3.4 sweep heartbeat starts via `instrumentation.ts` `register()` hook (Next.js 15 stable). It does NOT restart on HMR — editing `r34-sweep-heartbeat.ts` requires a dev server restart. Changes to `lib/domain/services.ts` also require restart due to dynamic import caching.

**Storage driver**: `STORAGE_DRIVER=prisma` uses SQLite; otherwise falls back to in-memory repository. Default is Prisma.

**Security**: User secrets (Treasury API keys etc.) are encrypted with AES-256-GCM, key derived from `NEXTAUTH_SECRET` via SHA-256. Never commit `.env.local` or `.env` files.

## Environment variables

Copy `.env.example` to `.env.local`. Required vars:
- `AGENT_WALLET_API_URL`, `AGENT_WALLET_API_KEY`, `AGENT_WALLET_WALLET_ID` — CAW HTTP API
- `NEXTAUTH_SECRET` — Session + encryption key
- `CHAIN_ENV` — `base-mainnet` or `base-sepolia`
- `CAW_CLI_HOME_ROOT` — Absolute path for per-user CAW CLI homes
- `DATABASE_URL` — Default `file:./dev.db`

Optional: `VENICE_API_KEY`, `OPENAI_API_KEY` (Pact AI drafting), `TREASURY_ADDRESS`, `SPENDING_WALLET_ADDRESS`.

Auto top-up is OFF by default. Enable with `VENICE_AUTO_X402_TOPUP_ENABLED=1` or `BLOCKRUN_AUTO_TOPUP_ENABLED=1`.

## Testing

No test framework configured. Verify with `npm run typecheck && npm run lint && npm run build`.

## Code style

- Strict TypeScript (`strict: true`), `@/*` path alias maps to project root.
- Server-only files use `import "server-only"`.
- ESLint flat config (`eslint.config.mjs`). No Prettier configured.
- Prisma model names are PascalCase; table names are snake_case via `@@map`.
