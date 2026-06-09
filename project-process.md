# Project Process

更新日期: 2026-06-09

## 目标用户流程

用户已有自己的 Agent，运行在 Cobo + OpenClaw 或 Hermes 上。Agent 需要持续购买 Venice token 才能稳定运行。本项目的目标是提供一个 Web 管理台，完成用户注册、Cobo 钱包绑定、Venice x402 自动支付、支付记录展示和失败原因记录。

## 当前开发进度

### 第一阶段: 注册与绑定

当前状态: 部分完成。

- Web 端已有登录入口和基于邮箱的 demo 登录流程。
- 已有 Cobo ID 绑定接口和管理台入口。
- 已有 CAW pairing code、onboarding、status、authorization、pact 相关接口。
- 已有 CAW wallet discovery 和 runtime config 绑定能力，可读取本机 caw CLI profile 并绑定钱包配置。
- 管理台可以展示 CAW 钱包状态、active Pact 信息和 Venice x402 pact 检查结果。

还差:

- 真实邮箱注册/验证码/密码或 magic link 流程尚未完整产品化。
- 手机 APP 输入匹配码后的端到端状态确认仍依赖现有 CAW/CLI demo 流程，需要按真实 Cobo App 回调或轮询协议固化。
- “绑定成功后展示 Cobo 钱包信息”的 UI 已有基础，但需要按正式用户态清理 demo 文案和调试字段。
- 当前 runtime config 是进程内存，重启会丢失；正式 MVP 需要落库。

### 第二阶段: 自动支付运行

当前状态: 主链路已接入，默认保护关闭。

- 已有 Venice balance polling heartbeat，每 60 秒检查 Venice 余额。
- 已有 Venice billing balance 查询，失败时可尝试 x402 wallet balance fallback。
- 已有 Venice x402 top-up 执行路径，通过 `caw fetch` 自动处理 HTTP 402 challenge。
- x402 top-up 现在只使用 `venice_x402` purpose 的 active Pact，避免误用普通 credits payment Pact。
- 新增 payment lock，避免并发重复支付；执行异常时会释放锁。
- 后台自动 x402 充值默认关闭，只有设置 `VENICE_AUTO_X402_TOPUP_ENABLED=1` 才会真实触发支付。
- 管理台手动 x402 top-up 已补显式确认参数 `confirmed: true`。

还差:

- 自动支付目前只针对 demo user 检查；多用户生产模式需要按用户/Agent 维度调度。
- Venice token 余额阈值目前是进程内配置，需要落库并按用户或 Agent 单独配置。
- 需要确认 Venice x402 balance/top-up API 的最终字段和状态码格式，当前实现做了兼容解析，但未做真实联调。
- 需要把支付成功后的 Venice token 额度刷新和管理台记录做成明确的 top-up order，而不是复用 inference log。
- 需要明确 OpenClaw/Hermes Agent 如何读取“Venice token 已补充，可以继续运行”的状态。

### 第三阶段: 支付结果

当前状态: 基础记录能力存在，结果语义还不完整。

- x402 top-up 会记录成功/失败响应和耗时。
- stale top-up sweep 已恢复导出，可把超时的 `pending_policy` / `pending_approval` / `caw_submitted` / `chain_pending` 订单标记为 `approval_expired`。
- sweep heartbeat 会定时运行，手动 sweep API 会按当前登录用户执行。
- 管理台已有交易、top-up、inference log 等信息展示基础。

还差:

- x402 直接失败需要结构化记录失败类型、HTTP 状态、Venice error body 和 CAW stderr。
- Cobo 审批超时需要和具体 x402/top-up order 绑定，而不只是扫普通 top-up order。
- 成功后需要立即刷新 Venice balance，并把“充值前余额、充值金额、充值后余额”写入记录。
- 通知功能暂定后续迭代，MVP 阶段只要求管理台可查失败原因。

## 本次修复内容

- 修复合入 main 后的接口断裂:
  - `pickVeniceBaseUsdcAccept` 兼容导出。
  - `/api/venice/x402-topup` 改为按 active `venice_x402` Pact 执行。
  - `expireStaleTopupOrders` 和 `STALE_TOPUP_TIMEOUT_MS` 恢复导出。
  - `veniceChatCompletion` 调用改为 `runVeniceChatCompletion`。
  - 补 `fetchVeniceX402Balance`。
- 修复安全和运行风险:
  - CAW pacts route 从字符串 `execSync` 改为参数化 `spawnSync`，并白名单校验 status。
  - CAW discovery/runtime/pacts/settings 接口补登录校验。
  - x402 payment lock 在 `caw fetch` 抛错时释放。
  - HTTP status 解析兼容 `HTTP/2 200` 这类输出。
  - 手动绑定 wallet 时按 wallet UUID 匹配对应 profile API key。
- 降低真实支付风险:
  - Venice 自动 x402 top-up 默认关闭，必须显式设置 `VENICE_AUTO_X402_TOPUP_ENABLED=1`。
  - Venice balance threshold 设置会同步到当前进程环境，heartbeat 下一轮可读取。

## 距离完整 MVP 还差哪些

1. 真实用户注册体系: 邮箱注册、登录态、用户数据隔离。
2. Cobo App 绑定闭环: pairing code 从生成到手机确认再到 Web 端最终状态，需要按真实 Cobo 流程做端到端确认。
3. 配置落库: CAW runtime config、Venice API key、余额阈值、自动充值开关、Agent 绑定关系都需要持久化。
4. 自动支付订单模型: Venice x402 top-up 应有独立订单表或扩展现有 topup order，记录状态流转和失败原因。
5. 多 Agent/多用户调度: 当前 heartbeat 只覆盖 demo user，不适合生产多用户。
6. 成功后余额确认: x402 成功响应后应刷新 Venice balance，并在管理台展示充值前后对比。
7. 失败路径产品化: 区分 Venice x402 失败、CAW policy 拒绝、Cobo 审批超时、钱包余额不足、网络错误。
8. OpenClaw/Hermes 对接: 明确 Agent 运行时如何读取 Venice token 状态、如何暂停/恢复。
9. 管理台记录完善: 支付记录、失败原因、自动充值开关、阈值配置、CAW Pact 有效期都需要统一展示。
10. 通知后续迭代: 邮件/消息推送暂不进入 MVP，但需要保留事件接口。

## 下一步建议

1. 先把 Venice x402 top-up 独立订单模型补上，避免继续复用 inference log。
2. 把 runtime settings 落库，至少覆盖 Venice threshold、auto top-up enable、bound CAW profile。
3. 把 heartbeat 从 demo user 改为按 active Agent/user 扫描。
4. 做真实 Cobo App pairing 状态闭环，替换 CLI demo 假设。
5. 在可联调环境补 Venice x402 成功/失败/超时三类验收用例。
