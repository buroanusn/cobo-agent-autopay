// lib/r34-sweep-heartbeat.ts
// R4.0 — heartbeat that drives R3.4 expireStaleTopupOrders() sweep
// on a fixed interval. The sweep transitions caw_submitted / chain_pending /
// pending_approval / pending_policy topup_orders older than 30 minutes
// to status="approval_expired".
//
// ⚠️ v1.20 修法 (cobo-agent-autopay 2026-06-07 cron R4.0 实现):
//   - 文件顶层 **不** 静态 import `@/lib/domain/services` 或 `@/lib/store`.
//     services → store → memory-repo → node:crypto 静态链会触发 webpack
//     UnhandledSchemeError (v1.16 trap).
//   - tick 内部用 `await import("@/lib/domain/services")` 动态加载
//     expireStaleTopupOrders. webpack 把 dynamic import 切成独立 async chunk,
//     不在静态 module graph 里.
//   - `import "server-only"` 防客户端误 import.
//   - globalThis 守卫防 HMR 重复启动.
//   - 所有错误 swallow —— heartbeat 启动失败不能让 dev server 挂.
//   - 默认 5 分钟 (300000ms) 一轮, env `R34_SWEEP_INTERVAL_MS` 覆盖.
//   - instrumentation.ts 启动 register() (Next.js 15 stable hook).
//   - 此外: 第一次 GET /api/credits/topup/sweep-status 调
//     ensureR34SweepHeartbeatRunning() 懒启动, 适配 cron tick
//     单次实现 (避免 dev server 重启).
//
// ⚠️ v1.20 已知限制:
//   - tick 改 `lib/domain/services.ts` (例如改 STALE_TOPUP_TIMEOUT_MS) 不会
//     生效: dynamic import 缓存的 chunk 仍跑老代码. 必须 dev server 重启
//     或调 stopR34SweepHeartbeat + startR34SweepHeartbeat 拿新 chunk.
//   - 改 `lib/r34-sweep-heartbeat.ts` 本身 HMR 不会重跑 setInterval, 旧
//     handle 继续用旧文件. 同上, 重启或 stop+start 解决.

import "server-only";

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000; // 5 min
const MIN_INTERVAL_MS = 30 * 1000; // 30s sanity floor
const FIRST_TICK_DELAY_MS = 5_000;
const BALANCE_CHECK_INTERVAL_MS = 60_000; // 60s

// ── Venice balance ────────────────────────────────────────────────────────
const VENICE_X402_WALLET = "0xaa56c463fd074dbb4f7d02f6902a8ea7841aa67d";

function resolveVeniceBalanceThreshold(): number {
  return Number(
    process.env.VENICE_BALANCE_THRESHOLD ?? 5
  );
}

type R34SweepHeartbeatState = {
  intervalHandle: ReturnType<typeof setInterval> | undefined;
  balanceHandle: ReturnType<typeof setInterval> | undefined;
  firstTickTimer: ReturnType<typeof setTimeout> | undefined;
  lastRunAt: string | undefined;
  lastError: string | undefined;
  lastExpiredCount: number | undefined;
  lastFailedCount: number | undefined;
  lastCutoffIso: string | undefined;
  consecutiveFailures: number;
  startedAt: string | undefined;
  // Venice balance polling
  veniceBalanceUsd: number;
  veniceBalanceThreshold: number;
  lastBalanceCheckAt: string | undefined;
};

declare global {
  // eslint-disable-next-line no-var
  var __R34_SWEEP_HEARTBEAT_STATE__: R34SweepHeartbeatState | undefined;
}

function getState(): R34SweepHeartbeatState {
  if (!globalThis.__R34_SWEEP_HEARTBEAT_STATE__) {
    globalThis.__R34_SWEEP_HEARTBEAT_STATE__ = {
      intervalHandle: undefined,
      balanceHandle: undefined,
      firstTickTimer: undefined,
      lastRunAt: undefined,
      lastError: undefined,
      lastExpiredCount: undefined,
      lastFailedCount: undefined,
      lastCutoffIso: undefined,
      consecutiveFailures: 0,
      startedAt: undefined,
      veniceBalanceUsd: 0,
      veniceBalanceThreshold: resolveVeniceBalanceThreshold(),
      lastBalanceCheckAt: undefined
    };
  }
  return globalThis.__R34_SWEEP_HEARTBEAT_STATE__;
}

function resolveIntervalMs(): number {
  const raw = Number.parseInt(process.env.R34_SWEEP_INTERVAL_MS ?? "", 10);
  if (Number.isFinite(raw) && raw >= MIN_INTERVAL_MS) return raw;
  return DEFAULT_INTERVAL_MS;
}

type R34SweepTickResult = {
  ok: boolean;
  expiredCount?: number;
  failedCount?: number;
  cutoffIso?: string;
  error?: string;
};

async function runR34SweepTick(): Promise<R34SweepTickResult> {
  // ⚠️ Dynamic import — 切 chunk, 避开静态 module graph.
  const services = await import("@/lib/domain/services");
  const state = getState();
  try {
    const result = await services.expireStaleTopupOrders({});

    return {
      ok: true,
      expiredCount: result.expiredCount,
      failedCount: result.failedCount,
      cutoffIso: result.cutoffIso
    };
  } catch (caught) {
    return {
      ok: false,
      error: caught instanceof Error ? caught.message : "unknown_error"
    };
  }
}

// ── Venice balance polling (60s independent timer) ─────────────────────
async function checkVeniceBalance(): Promise<void> {
  const state = getState();
  state.veniceBalanceThreshold = resolveVeniceBalanceThreshold();
  try {
    const services = await import("@/lib/domain/services");
    // Mock mode: VENICE_MOCK_BALANCE overrides real balance check
    const mockBalanceStr = process.env.VENICE_MOCK_BALANCE;
    let usdBalance: number;
    if (mockBalanceStr !== undefined) {
      usdBalance = Number(mockBalanceStr);
      console.log(`[venice-balance] MOCK balance=${usdBalance}, threshold=${state.veniceBalanceThreshold}`);
    } else {
      const balance = await services.refreshVeniceBalance?.({ walletAddress: VENICE_X402_WALLET });
      usdBalance = balance?.usdBalance ?? 0;
    }
    state.veniceBalanceUsd = usdBalance;
    state.lastBalanceCheckAt = new Date().toISOString();

    // Below threshold → auto top-up if lock is idle
    if (usdBalance < state.veniceBalanceThreshold) {
      const topup = await import("@/lib/venice/topup");
      const lockState = topup.getPaymentLockState();
      if (lockState === "idle") {
        const repo = await import("@/lib/store").then(m => m.getCreditRepository());
        const users = await repo.listUsers?.() ?? [];
        for (const user of users) {
          if (!user.cawWalletAddress) continue;
          try {
            const auth = await repo.getActiveAuthorization(user.userId);
            if (!auth || auth.status !== "active") continue;
            const pactId = auth.pactId;
            await topup.runVeniceX402Topup({
              userId: user.userId,
              walletAddress: user.cawWalletAddress,
              pactId,
              usdAmount: state.veniceBalanceThreshold
            });
          } catch (e) {
            console.warn("[venice-balance] Auto top-up failed for user:", user.userId, e);
          }
        }
      } else {
        console.log(`[venice-balance] Balance below threshold but lock busy (${lockState}), skipping auto top-up`);
      }
    }
  } catch (balanceErr) {
    console.warn("[venice-balance] balance check failed:", balanceErr);
  }
}

function tickWithState(): Promise<void> {
  return runR34SweepTick()
    .then((result) => {
      const state = getState();
      state.lastRunAt = new Date().toISOString();
      if (result.ok) {
        state.lastError = undefined;
        state.lastExpiredCount = result.expiredCount;
        state.lastFailedCount = result.failedCount;
        state.lastCutoffIso = result.cutoffIso;
        state.consecutiveFailures = 0;
      } else {
        state.lastError = result.error ?? "unknown_error";
        state.consecutiveFailures += 1;
      }
    })
    .catch((caught: unknown) => {
      const state = getState();
      state.lastRunAt = new Date().toISOString();
      state.lastError = caught instanceof Error ? caught.message : "unknown_error";
      state.consecutiveFailures += 1;
    });
}

export function startR34SweepHeartbeat(): void {
  const state = getState();
  if (state.intervalHandle) return; // already running
  const intervalMs = resolveIntervalMs();
  state.startedAt = new Date().toISOString();
  // 5s 后跑首轮, 让 dev server 启动期别太挤
  state.firstTickTimer = setTimeout(() => {
    void tickWithState();
  }, FIRST_TICK_DELAY_MS);
  state.intervalHandle = setInterval(() => {
    void tickWithState();
  }, intervalMs);
  // eslint-disable-next-line no-console
  console.log(
    `[r34-sweep-heartbeat] started, interval=${intervalMs}ms, first-tick-in=${FIRST_TICK_DELAY_MS}ms`
  );
  // Start independent balance checker (60s)
  if (!state.balanceHandle) {
    void checkVeniceBalance(); // immediate first check
    state.balanceHandle = setInterval(() => {
      void checkVeniceBalance();
    }, BALANCE_CHECK_INTERVAL_MS);
  }
}

export function stopR34SweepHeartbeat(): void {
  const state = getState();
  if (state.firstTickTimer) {
    clearTimeout(state.firstTickTimer);
    state.firstTickTimer = undefined;
  }
  if (state.intervalHandle) {
    clearInterval(state.intervalHandle);
    state.intervalHandle = undefined;
    // eslint-disable-next-line no-console
    console.log("[r34-sweep-heartbeat] stopped");
  }
  if (state.balanceHandle) {
    clearInterval(state.balanceHandle);
    state.balanceHandle = undefined;
  }
}

export function ensureR34SweepHeartbeatRunning(): void {
  const state = getState();
  if (!state.intervalHandle) {
    startR34SweepHeartbeat();
  }
}

export type R34SweepHeartbeatStatus = {
  running: boolean;
  startedAt: string | undefined;
  lastRunAt: string | undefined;
  lastError: string | undefined;
  lastExpiredCount: number | undefined;
  lastFailedCount: number | undefined;
  lastCutoffIso: string | undefined;
  consecutiveFailures: number;
  intervalMs: number;
  veniceBalanceUsd: number;
  veniceBalanceThreshold: number;
  lastBalanceCheckAt: string | undefined;
};

export function getR34SweepHeartbeatStatus(): R34SweepHeartbeatStatus {
  const state = getState();
  return {
    running: Boolean(state.intervalHandle),
    startedAt: state.startedAt,
    lastRunAt: state.lastRunAt,
    lastError: state.lastError,
    lastExpiredCount: state.lastExpiredCount,
    lastFailedCount: state.lastFailedCount,
    lastCutoffIso: state.lastCutoffIso,
    consecutiveFailures: state.consecutiveFailures,
    intervalMs: resolveIntervalMs(),
    veniceBalanceUsd: state.veniceBalanceUsd,
    veniceBalanceThreshold: state.veniceBalanceThreshold,
    lastBalanceCheckAt: state.lastBalanceCheckAt
  };
}
