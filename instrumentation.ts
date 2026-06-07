// instrumentation.ts
// Next.js 15.5+ instrumentation hook is stable. No `experimental.instrumentationHook: true` flag needed.
// `register()` is called once when the dev server (or production server) boots.
// Next.js dev HMR does NOT re-run register() when instrumentation.ts itself is edited.
//
// ⚠️ v1.20 R4.0 实现 (cobo-agent-autopay 2026-06-07):
//   - 动态 import R3.4 sweep heartbeat module. 不能静态 import (会拉 services
//     → store → node:crypto 整条链触发 webpack UnhandledSchemeError).
//   - 永远 swallow 错误 — heartbeat 启动失败不能挂 dev server.
//   - 跳过 Edge runtime (heartbeat 用 setInterval, Node-only).

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { startR34SweepHeartbeat } = await import("@/lib/r34-sweep-heartbeat");
    startR34SweepHeartbeat();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(
      "[instrumentation] startR34SweepHeartbeat failed",
      error instanceof Error ? error.message : error
    );
  }
}
