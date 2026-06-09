# 功能开发顺序

Last updated: 2026-06-09, Asia/Shanghai.

本文档用于约束后续开发节奏：一个功能一个功能做。每个功能完成后再进入下一个功能，避免同时修改登录、CAW、Venice、x402、后台任务和 UI，导致用户流程无法测试。

## 开发原则

- 真实环境优先，主流程不做 mock。
- 开发和测试阶段，任何真实支付、真实 Pact 提交、真实 CAW 交易、真实链上操作都必须先得到用户明确确认。
- 产品运行阶段的自动支付必须建立在用户明确开启自动支付、批准 Pact、配置限额之后；后台只能在授权范围内执行。
- 保留现有 CAW SDK + CreditsPayment 流程，不在未验证前删除。
- CAW CLI 用于新用户创建 CAW 钱包、绑定账号、提交/刷新 Pact、后续查询交易。
- UI 默认只展示用户当前要做的下一步；高级诊断和手动接口放在折叠区域。
- 不提交 `.env`、CAW credential、本地钱包资料、`.DS_Store` 或其他私密文件。
- 每个功能完成后运行项目约定验证：

```bash
npm run db:generate
npm run typecheck
npm run lint
npm run contract:compile
npm run build
git diff --check
```

## 当前基线

已经具备：

- 邮箱登录和多用户数据库隔离。
- Cobo ID 绑定字段和 API。
- CAW CLI onboarding 基础能力。
- CAW 钱包创建、配对码生成、配对状态刷新。
- Dashboard 首屏简化和可见操作日志。
- CreditsPayment + CAW SDK 的现有积分支付链路。
- Venice API：
  - balance 查询
  - inference 调用
  - x402 payment requirement discovery
  - x402 top-up 执行接口
- Venice x402 top-up 已限制为 Base mainnet USDC，并要求 active non-mock Pact。

需要注意：

- 本地如果出现 `users.coboId does not exist`，优先处理数据库 migration 状态，而不是改业务逻辑。
- 当前 Cobo ID 对普通新用户不够直观，需要先把首次使用流程讲清楚或调整为更自然的绑定方式。
- CreditsPayment 当前主要是 Base Sepolia 测试网流程；Venice x402 top-up 是 Base mainnet 真实 USDC 流程。

## 开发顺序

### 1. 新用户首次使用流程校准

目标：用户用邮箱注册后，能看懂下一步，并能完成 CAW 钱包创建/配对。

状态：已完成实现和验证，本功能只做本地 commit，不 push。

范围：

- 检查本地数据库 migration 是否包含 `users.coboId`、CAW onboarding、Venice Pact 等字段。
- Cobo ID 已降级为高级/可选输入；主流程使用邮箱 Web 账号作为产品身份。
- 让默认流程变成：
  1. 邮箱登录。
  2. 创建 CAW 钱包。
  3. Web 端生成配对码。
  4. 用户在手机 CAW App 输入配对码。
  5. Web 端显示钱包地址和配对状态。
- 保留手动绑定入口，但不要作为新用户默认路径。
- 在关键按钮和 API 调用上记录可见日志：
  - 开始创建钱包
  - 创建成功/失败
  - 配对码生成成功/失败
  - 配对状态刷新
  - 阻塞原因

完成标准：

- 新用户不需要理解 Cobo ID 或内部 CAW UUID，就能完成页面上的创建和配对。
- Dashboard 首屏只出现当前阶段需要的动作。
- 登录、钱包创建、配对状态的失败原因能在页面上看到。

### 2. CAW CLI 钱包状态与交易记录

目标：绑定成功后，用户和开发者能看到 CAW 钱包的关键状态。

范围：

- 新增 CAW CLI transaction listing 能力。
- 为每个登录用户读取自己隔离 CAW CLI HOME 下的钱包资料。
- 在 Dashboard 上展示简化交易记录：
  - 时间
  - 类型
  - 链
  - token
  - 金额
  - 状态
  - tx hash 或 CAW tx id
- 高级区域展示原始诊断信息，默认隐藏。

完成标准：

- 用户能知道 CAW 是否已配对、是否可执行交易、最近交易是否成功。
- 交易查询不会触发真实交易。

### 3. Venice 专用 Pact 模板

目标：用户在 CAW App 审批时能看懂这个 Pact 只用于 Venice x402 自动充值。

范围：

- Venice Pact preview/template 明确展示：
  - Base mainnet
  - USDC
  - Venice x402 payTo
  - 单笔上限
  - 每日上限
  - 每月上限
  - 有效期
  - 用途：Venice token top-up for agent operation
- 后端校验 Pact 只能用于 Venice x402 top-up，不能复用 CreditsPayment Pact。
- Preview 只生成模板，不提交真实 Pact。
- Submit Pact 前必须有用户确认。

完成标准：

- 用户能先预览 Pact 内容。
- Pact 提交和刷新状态都能在页面日志中看到。
- 未 active 的 Venice Pact 不能执行 x402 top-up。

### 4. Venice 余额监控面板

目标：用户能在不付款的情况下查看 Venice token/billing 状态和充值需求。

范围：

- 展示 Venice balance。
- 展示 Venice payment requirement discovery 结果。
- 展示当前是否需要充值。
- 提供 top-up amount 输入，但不自动付款。
- 清楚区分：
  - 查询余额：不花钱
  - 发现 x402 requirement：不花钱
  - 提交 Pact：需要手机 App 审批
  - x402 top-up：真实付款

完成标准：

- 页面能解释当前是否缺 token。
- 用户点击查询类按钮不会触发真实支付。

### 5. Venice 手动 x402 充值闭环

目标：先跑通一次人工确认的真实 Venice x402 top-up，再做自动化。

范围：

- 用户输入充值金额。
- 页面显示真实支付确认：
  - Base mainnet
  - USDC
  - 金额
  - Venice payTo
  - 将消耗真实资金
- 前端发送 `confirmed: true` 前必须经过显式确认。
- 后端继续校验：
  - `CHAIN_ENV=base-mainnet`
  - bound CAW wallet
  - active `venice_x402` Pact
  - Pact 未过期
  - 单笔/日/月额度足够
  - Venice requirement 接受 Base mainnet USDC
- 记录成功/失败/超时。

完成标准：

- 真实充值只能在用户确认后发生。
- 成功后 Dashboard 能看到 Venice 余额变化或充值记录。
- 失败时能看到失败原因，不吞掉 x402/CAW 错误。

### 6. Venice inference 独立运行

目标：用户能单独运行 Venice inference，验证 token 余额是否能支持 Agent 调用。

范围：

- 保持 inference 和 top-up 分开。
- inference 失败时显示：
  - 是否是余额不足
  - 是否需要 x402 top-up
  - 是否是 Venice API key 或网络错误
- 不在 inference 按钮里隐式触发真实支付。

完成标准：

- 用户能独立验证 Venice API 调用。
- 余额不足时只提示下一步，不自动付款。

### 7. 自动支付策略与开关

目标：把“token 余额不足时自动 x402 充值”做成可控产品能力。

范围：

- 新增自动支付设置：
  - 是否开启自动支付
  - 余额阈值
  - 单次充值金额
  - 每日/月度预算
  - 最大连续失败次数
- 只有在用户明确开启自动支付、Venice Pact active、预算足够时才允许后台执行。
- 后台执行前记录决策日志：
  - 当前余额
  - 阈值
  - 计划充值金额
  - Pact 和预算检查结果
- 开发测试阶段仍然需要用户确认真实自动支付测试窗口。

完成标准：

- 自动支付不会在未授权、未开启、额度不足时执行。
- 用户可以关闭自动支付。
- 每次自动支付都有记录。

### 8. 后台轮询和结算任务

目标：让系统不依赖用户停留在 Dashboard。

范围：

- Pact 状态轮询。
- Pairing 状态轮询。
- CAW tx 状态轮询。
- x402 top-up/order settlement 状态轮询。
- 失败重试和超时处理。

完成标准：

- 用户离开页面后，关键状态仍能推进。
- 超时和失败会落库，Dashboard 可见。

### 9. 管理台记录简化

目标：MVP 阶段账单和充值记录清楚，不做复杂财务系统。

范围：

- 保留三类核心记录：
  - Venice balance snapshot
  - x402 top-up record
  - CAW transaction record
- 每条记录展示：
  - 时间
  - 金额
  - 状态
  - 失败原因
  - 关联 tx/order id
- 默认隐藏底层 ledger 细节。

完成标准：

- 用户能回答：余额多少、花了多少钱、哪次失败、为什么失败。

### 10. 生产安全存储

目标：部署到共享生产环境前，解决 CAW CLI HOME 和密钥安全。

范围：

- CAW CLI HOME 不能裸露本地 credential。
- 设计加密存储或 secret manager。
- 区分开发机、本地 demo、生产部署的 credential 策略。
- 增加访问控制、审计日志和备份策略。

完成标准：

- 生产部署不会把 CAW credential 暴露在普通文件目录。
- 文档清楚说明如何轮换和吊销凭证。

### 11. 通知功能

目标：MVP 之后再做，不阻塞自动支付主流程。

范围：

- 邮件通知。
- 消息推送。
- 失败告警。
- 预算接近上限提醒。

完成标准：

- 通知不影响支付链路幂等性。
- 通知失败不会导致支付状态错误。

## 每个功能的交付方式

每个功能单独交付：

1. 先确认本功能范围。
2. 修改代码或文档。
3. 运行验证命令。
4. 更新 `docs/handoff-for-next-development.md`。
5. 提交一个 commit。
6. 按当前用户指令决定是否推送；如果用户明确要求不 push，则只保留本地 commit。
7. 再开始下一个功能。

## 建议下一步

下一个要做的功能是：

```text
1. 新用户首次使用流程校准
```

原因：

- 当前用户已经在登录和 Cobo ID 处遇到困惑。
- 如果新用户流程不清楚，后续 Pact、Venice top-up、自动支付都无法稳定测试。
- 这个功能不触发真实支付，风险最低，能先把测试入口打通。
