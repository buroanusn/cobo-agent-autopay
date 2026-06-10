# API 接口文档

> 自动生成于 2026-06-10 · 基于 `app/api/` 下 34 个 Next.js Route Handler 源码

---

## 接口列表总览

| #   | 接口名称               | Method          | Path                                  | 所属模块       |
| --- | ------------------ | --------------- | ------------------------------------- | ---------- |
| 1   | 登录                 | POST            | /api/auth/login                       | Auth       |
| 2   | 登出                 | POST            | /api/auth/logout                      | Auth       |
| 3   | 绑定 Cobo ID         | POST            | /api/account/cobo-id                  | Account    |
| 4   | 运行 Agent 任务        | POST            | /api/agent/run                        | Agent      |
| 5   | 获取 Venice 配置       | GET             | /api/config/venice                    | Config     |
| 6   | 保存 Venice 配置       | POST            | /api/config/venice                    | Config     |
| 7   | 积分余额快照             | GET             | /api/credits/balance                  | Credits    |
| 8   | 手动触发自动充值           | POST            | /api/credits/topup/auto               | Credits    |
| 9   | 过期滞留充值订单           | POST            | /api/credits/topup/expire-stale       | Credits    |
| 10  | 查询充值清扫状态           | GET             | /api/credits/topup/sweep-status       | Credits    |
| 11  | 查询充值清扫状态(GET)      | GET             | /api/credits/topup/expire-stale       | Credits    |
| 12  | AI Guardrails 推荐   | POST            | /api/guardrails/recommend             | Guardrails |
| 13  | 获取系统设置             | GET             | /api/settings                         | Settings   |
| 14  | 保存系统设置             | POST            | /api/settings                         | Settings   |
| 15  | Venice 账户余额        | GET             | /api/venice/balance                   | Venice     |
| 16  | Venice 推理          | POST            | /api/venice/inference                 | Venice     |
| 17  | Venice 推理日志        | GET             | /api/venice/logs                      | Venice     |
| 18  | 创建/预览 Venice Pact  | POST            | /api/venice/pact                      | Venice     |
| 19  | 刷新 Venice Pact     | POST            | /api/venice/pact/refresh              | Venice     |
| 20  | SIWE-X 签名          | POST            | /api/venice/sign-message              | Venice     |
| 21  | Venice x402 Top-up | GET/POST        | /api/venice/x402-topup                | Venice     |
| 22  | 授权 USDC            | POST            | /api/wallet/caw/approve               | Wallet     |
| 23  | 创建/预览 CAW 授权       | POST            | /api/wallet/caw/authorization         | Wallet     |
| 24  | 刷新 CAW 授权          | POST            | /api/wallet/caw/authorization/refresh | Wallet     |
| 25  | 连接 CAW 钱包          | POST            | /api/wallet/caw/connect               | Wallet     |
| 26  | 发现 CAW 钱包          | GET             | /api/wallet/caw/discover              | Wallet     |
| 27  | 领取测试币              | POST            | /api/wallet/caw/faucet                | Wallet     |
| 28  | CAW Onboarding     | GET/POST        | /api/wallet/caw/onboarding            | Wallet     |
| 29  | 查询 CAW Pacts       | GET             | /api/wallet/caw/pacts                 | Wallet     |
| 30  | 生成配对码              | POST            | /api/wallet/caw/pairing-code          | Wallet     |
| 31  | 刷新配对状态             | POST            | /api/wallet/caw/pairing-code/refresh  | Wallet     |
| 32  | CAW Runtime Config | GET/POST/DELETE | /api/wallet/caw/runtime-config        | Wallet     |
| 33  | CAW 集成状态           | GET             | /api/wallet/caw/status                | Wallet     |
| 34  | CAW 交易记录           | GET             | /api/wallet/caw/transactions          | Wallet     |
| 35  | 链上 Credits 支付回调    | POST            | /api/webhooks/chain/credits-payment   | Webhook    |
| 36  | x402 资源支付          | POST            | /api/x402/resource/pay                | x402       |
| 37  | x402 资源访问          | GET/POST        | /api/x402/resource                    | x402       |

---

## 接口详情

### 1. 登录

- **Method**：POST
- **Path**：/api/auth/login
- **描述**：邮箱登录或创建账户，设置 session cookie
- **请求参数**：
  
  | 字段    | 类型     | 必填  | 说明   |
  | ----- | ------ | --- | ---- |
  | email | string | 是   | 用户邮箱 |
- **响应示例**：
  
  ```json
  {
  "user": { "id": "user_xxx", "email": "test@agent.local" },
  "snapshot": { "account": {}, "topupOrders": [], "paymentStats": {} }
  }
  ```
- **前端调用位置**：login/page.tsx · submit() · 表单提交时
- **测试状态**：✅ 构建通过，前端调用对齐

---

### 2. 登出

- **Method**：POST
- **Path**：/api/auth/logout
- **描述**：清除 session cookie
- **请求参数**：无
- **响应示例**：
  
  ```json
  { "ok": true }
  ```
- **前端调用位置**：layout/TopNav.tsx · handleLogout() · 退出按钮；layout/Sidebar.tsx · form action
- **测试状态**：✅ 构建通过

---

### 3. 绑定 Cobo ID

- **Method**：POST
- **Path**：/api/account/cobo-id
- **描述**：将 Cobo ID 绑定到当前用户账户
- **请求参数**：
  
  | 字段     | 类型     | 必填  | 说明                   |
  | ------ | ------ | --- | -------------------- |
  | coboId | string | 是   | Cobo 平台 ID（3-128 字符） |
- **响应示例**：
  
  ```json
  {
  "user": {},
  "binding": { "coboId": "xxx", "status": "bound" },
  "snapshot": {}
  }
  ```
- **前端调用位置**：未在当前前端页面中使用（后端预留接口）
- **测试状态**：✅ 构建通过

---

### 4. 运行 Agent 任务

- **Method**：POST
- **Path**：/api/agent/run
- **描述**：执行一次 Agent 任务，积分不足时自动触发充值
- **请求参数**：
  
  | 字段       | 类型     | 必填  | 说明    |
  | -------- | ------ | --- | ----- |
  | taskName | string | 是   | 任务名称  |
  | prompt   | string | 是   | 任务提示词 |
- **响应示例**：
  
  ```json
  {
  "ok": true,
  "topup": { "status": "pending", "order": { "orderId": "ORD_xxx" } },
  "usageEvent": { "estimatedCredits": 1000, "creditsCharged": 750 }
  }
  ```
- **前端调用位置**：dashboard/v2/AgentSection.tsx · handleRun() · 运行 Agent 按钮
- **测试状态**：✅ 构建通过，前端调用对齐

---

### 5. 获取 Venice 配置

- **Method**：GET
- **Path**：/api/config/venice
- **描述**：获取 Venice API Key 配置状态和模型设置
- **请求参数**：无
- **响应示例**：
  
  ```json
  {
  "veniceApiKeyConfigured": true,
  "veniceApiKeyMasked": "ven_****xxxx",
  "veniceModel": "llama-3.3-70b",
  "lowBalanceThresholdUsd": 5,
  "defaultTopupUsd": 10
  }
  ```
- **前端调用位置**：venice/v2/VeniceApiKey.tsx · useEffect load · 页面加载时
- **测试状态**：✅ 构建通过

---

### 6. 保存 Venice 配置

- **Method**：POST
- **Path**：/api/config/venice
- **描述**：保存 Venice API Key 和模型 ID
- **请求参数**：
  
  | 字段           | 类型     | 必填  | 说明                      |
  | ------------ | ------ | --- | ----------------------- |
  | veniceApiKey | string | 否   | Venice API key（ven_xxx） |
  | veniceModel  | string | 否   | 推理模型 ID                 |
- **响应示例**：
  
  ```json
  {
  "ok": true,
  "updated": ["venice_api_key", "venice_inference_model"],
  "veniceApiKeyConfigured": true,
  "veniceApiKeyMasked": "ven_****xxxx",
  "veniceModel": "llama-3.3-70b"
  }
  ```
- **前端调用位置**：venice/v2/VeniceApiKey.tsx · handleSave() · 保存按钮
- **测试状态**：✅ 构建通过

---

### 7. 积分余额快照

- **Method**：GET
- **Path**：/api/credits/balance
- **描述**：获取用户积分账户完整快照（余额、充值订单、支付统计、Pact 详情、Guardrails、待审批、账本）
- **请求参数**：无
- **响应示例**：
  
  ```json
  {
  "user": { "id": "user_xxx", "email": "test@agent.local" },
  "account": {
    "balanceCredits": 1800,
    "lowBalanceThresholdCredits": 1000,
    "autoTopupCredits": 1000
  },
  "topupOrders": [
    {
      "id": "xxx",
      "orderId": "ORD_xxx",
      "amountUsdcMinor": 1000000,
      "status": "credited",
      "txHash": "0x...",
      "createdAt": "2026-06-10T..."
    }
  ],
  "paymentStats": {
    "spent24hUsdcMinor": 0,
    "spent30dUsdcMinor": 0,
    "txCount24h": 0,
    "txCount30d": 0,
    "automaticPayments": 0,
    "manualApprovalPayments": 0
  },
  "pactDetails": {
    "reviewIfAmountUsdcMinor": 2000000,
    "denyIfAmountUsdcMinor": 5000000,
    "remainingUsdcMinor": 20000000,
    "completionTimeElapsedDays": 7
  },
  "guardrails": {
    "singleLimitUsdcMinor": 1000000,
    "dailyLimitUsdcMinor": 5000000,
    "reviewThresholdUsdcMinor": 2000000,
    "allowedChains": ["BASE_ETH"]
  },
  "pendingApprovals": [],
  "ledgerEntries": []
  }
  ```
- **前端调用位置**：
  - dashboard/v2/StatsSection.tsx · load() · 页面加载
  - dashboard/v2/RecentPaymentsSection.tsx · load() · 页面加载
  - payments/v2/PaymentStatsCards.tsx · load()
  - payments/v2/PaymentStatistics.tsx · load()
  - payments/v2/PactAndApprovalCard.tsx · load()
  - payments/v2/TransactionRecords.tsx · load()
  - venice/v2/CreditAccount.tsx · load()
  - settings/v2/GuardrailsCard.tsx · load()
- **测试状态**：✅ 构建通过，前端字段对齐

---

### 8. 手动触发自动充值

- **Method**：POST
- **Path**：/api/credits/topup/auto
- **描述**：手动触发一次自动充值流程
- **请求参数**：无
- **响应示例**：
  
  ```json
  {
  "status": "submitted",
  "order": { "orderId": "ORD_xxx", "status": "caw_submitted" }
  }
  ```
- **前端调用位置**：未在当前前端页面中使用（后端/调试接口）
- **测试状态**：✅ 构建通过

---

### 9. 过期滞留充值订单

- **Method**：POST
- **Path**：/api/credits/topup/expire-stale
- **描述**：将超过超时时间的 pending 状态订单标记为 approval_expired
- **请求参数**：
  
  | 字段        | 类型     | 必填  | 说明             |
  | --------- | ------ | --- | -------------- |
  | timeoutMs | number | 否   | 超时毫秒数，默认 30 分钟 |
- **响应示例**：
  
  ```json
  {
  "cutoffIso": "2026-06-10T...",
  "timeoutMs": 1800000,
  "expiredCount": 0,
  "expiredOrders": []
  }
  ```
- **前端调用位置**：未在当前前端页面中使用（cron 清扫接口）
- **测试状态**：✅ 构建通过

---

### 10. 查询充值清扫状态

- **Method**：GET
- **Path**：/api/credits/topup/sweep-status
- **描述**：查询 R3.4 sweep heartbeat 运行状态（无需认证）
- **请求参数**：无
- **响应示例**：
  
  ```json
  {
  "running": true,
  "lastTickAt": "2026-06-10T...",
  "veniceBalanceThreshold": 5
  }
  ```
- **前端调用位置**：未在当前前端页面中使用（监控接口）
- **测试状态**：✅ 构建通过

---

### 11. 查询过期清扫说明

- **Method**：GET
- **Path**：/api/credits/topup/expire-stale
- **描述**：返回清扫接口的使用说明
- **请求参数**：无
- **响应示例**：
  
  ```json
  {
  "defaultTimeoutMs": 1800000,
  "description": "POST to sweep topup orders..."
  }
  ```
- **前端调用位置**：未在当前前端页面中使用
- **测试状态**：✅ 构建通过

---

### 12. AI Guardrails 推荐

- **Method**：POST
- **Path**：/api/guardrails/recommend
- **描述**：基于 Agent 数量、日均支出、风险偏好生成 Guardrails 推荐
- **请求参数**：
  
  | 字段             | 类型     | 必填  | 说明                                     |
  | -------------- | ------ | --- | -------------------------------------- |
  | agentCount     | number | 是   | Agent 数量                               |
  | dailySpendUsdc | number | 是   | 日均支出 (USDC)                            |
  | riskProfile    | string | 是   | "conservative" / "balanced" / "growth" |
- **响应示例**：
  
  ```json
  {
  "recommendation": {
    "singleLimitUsdcMinor": 5000000,
    "dailyLimitUsdcMinor": 10000000,
    "reviewThresholdUsdcMinor": 2000000,
    "allowedChains": ["BASE_ETH"],
    "generatedBy": "ai_direct"
  },
  "note": "Demo recommendation only..."
  }
  ```
- **前端调用位置**：settings/v2/GuardrailsCard.tsx · handleRecommend() · 生成 AI 推荐按钮
- **测试状态**：✅ 构建通过

---

### 13. 获取系统设置

- **Method**：GET
- **Path**：/api/settings
- **描述**：获取运行时配置（Venice 余额阈值等）
- **请求参数**：无
- **响应示例**：
  
  ```json
  {
  "veniceBalanceThreshold": 5
  }
  ```
- **前端调用位置**：settings/v2/AutoTopupSettings.tsx · useEffect load · 页面加载
- **测试状态**：✅ 构建通过

---

### 14. 保存系统设置

- **Method**：POST
- **Path**：/api/settings
- **描述**：保存 Venice 余额自动充值阈值
- **请求参数**：
  
  | 字段                     | 类型     | 必填  | 说明             |
  | ---------------------- | ------ | --- | -------------- |
  | veniceBalanceThreshold | number | 否   | 阈值 USD（0-1000） |
- **响应示例**：
  
  ```json
  { "ok": true, "settings": { "veniceBalanceThreshold": 5 } }
  ```
- **前端调用位置**：settings/v2/AutoTopupSettings.tsx · handleSave() · 保存按钮
- **测试状态**：✅ 构建通过

---

### 15. Venice 账户余额

- **Method**：GET
- **Path**：/api/venice/balance
- **描述**：查询 Venice AI 账户余额（USD）
- **请求参数**：无
- **响应示例**：
  
  ```json
  { "ok": true, "balance": 25.50 }
  ```
- **前端调用位置**：
  - venice/v2/VeniceBalance.tsx · load() · 页面加载 + 刷新按钮
  - dashboard/v2/StatsSection.tsx · load()
  - settings/v2/VeniceConfig.tsx · loadVenice()
- **测试状态**：✅ 构建通过

---

### 16. Venice 推理

- **Method**：POST
- **Path**：/api/venice/inference
- **描述**：调用 Venice chat completions API
- **请求参数**：
  
  | 字段           | 类型     | 必填  | 说明    |
  | ------------ | ------ | --- | ----- |
  | prompt       | string | 是   | 提示词   |
  | systemPrompt | string | 否   | 系统提示词 |
  | model        | string | 否   | 模型 ID |
- **响应示例**：
  
  ```json
  {
  "ok": true,
  "result": {
    "choices": [{ "message": { "content": "Hello!" } }],
    "usage": { "prompt_tokens": 10, "completion_tokens": 5 },
    "model": "llama-3.3-70b"
  }
  }
  ```
- **前端调用位置**：venice/v2/VeniceInference.tsx · handleInference() · 运行 inference 按钮
- **测试状态**：✅ 构建通过

---

### 17. Venice 推理日志

- **Method**：GET
- **Path**：/api/venice/logs
- **描述**：获取最近推理记录（最多 20 条）
- **请求参数**：无
- **响应示例**：
  
  ```json
  {
  "ok": true,
  "logs": [
    {
      "id": "log_xxx",
      "prompt": "Hello",
      "model": "llama-3.3-70b",
      "status": "completed",
      "creditsCharged": 100,
      "createdAt": "2026-06-10T..."
    }
  ]
  }
  ```
- **前端调用位置**：venice/v2/VeniceInference.tsx · useEffect load + 推理后刷新
- **测试状态**：✅ 构建通过

---

### 18. 创建/预览 Venice Pact

- **Method**：POST
- **Path**：/api/venice/pact
- **描述**：创建或预览 Venice x402 授权 Pact
- **请求参数**：
  
  | 字段                    | 类型      | 必填  | 说明                 |
  | --------------------- | ------- | --- | ------------------ |
  | amountUsdcMinor       | number  | 否   | 单笔限额 (minor units) |
  | dailyLimitUsdcMinor   | number  | 否   | 每日限额               |
  | monthlyLimitUsdcMinor | number  | 否   | 每月限额               |
  | validDays             | number  | 否   | 有效天数               |
  | previewOnly           | boolean | 否   | true=仅预览，false=提交  |
- **响应示例**：
  
  ```json
  {
  "preview": {
    "intent": "Authorize Venice AI x402 top-ups...",
    "executionPlan": "...",
    "draftedBy": "agent_deterministic",
    "warnings": [],
    "limits": { "singleLimitUsdcMinor": 1000000 }
  }
  }
  ```
- **前端调用位置**：未在当前前端页面中使用（Venice Pact 独立于 CAW Pact）
- **测试状态**：✅ 构建通过

---

### 19. 刷新 Venice Pact

- **Method**：POST
- **Path**：/api/venice/pact/refresh
- **描述**：刷新 Venice x402 授权状态
- **请求参数**：无
- **响应示例**：
  
  ```json
  { "ok": true }
  ```
- **前端调用位置**：未在当前前端页面中使用
- **测试状态**：✅ 构建通过

---

### 20. SIWE-X 签名

- **Method**：POST
- **Path**：/api/venice/sign-message
- **描述**：使用 CAW 钱包生成 EIP-712 SIWE-X 签名（用于 Venice 钱包认证模式）
- **请求参数**：
  
  | 字段      | 类型     | 必填  | 说明                   |
  | ------- | ------ | --- | -------------------- |
  | uri     | string | 否   | 目标 URI，默认 Venice API |
  | chainId | string | 否   | 链 ID，默认 BASE_ETH     |
- **响应示例**：
  
  ```json
  {
  "ok": true,
  "walletAddress": "0x...",
  "chainId": "BASE_ETH",
  "headerName": "X-Sign-In-With-X",
  "headerValue": "base64...",
  "decoded": {
    "message": "...",
    "signature": "0x...",
    "txId": "..."
  }
  }
  ```
- **前端调用位置**：venice/v2/VeniceInference.tsx · handleSign() · SIWE 模式签名按钮
- **测试状态**：✅ 构建通过

---

### 21. Venice x402 Top-up

- **Method**：GET / POST
- **Path**：/api/venice/x402-topup
- **描述**：GET 查看 x402 challenge；POST 执行真实充值
- **请求参数**（POST）：
  
  | 字段              | 类型      | 必填  | 说明                 |
  | --------------- | ------- | --- | ------------------ |
  | usdAmount       | number  | 否   | 充值金额 USD           |
  | amountUsdcMinor | number  | 否   | 充值金额 (minor units) |
  | confirmed       | boolean | 是   | 必须为 true 才执行       |
- **响应示例**（GET）：
  
  ```json
  {
  "ok": true,
  "requirements": { "accepts": [{ "network": "base", "asset": "0x8335..." }] },
  "selected": { "network": "base", "payTo": "0x..." }
  }
  ```
- **响应示例**（POST）：
  
  ```json
  {
  "ok": true,
  "topup": { "status": "pending", "orderId": "ORD_xxx" }
  }
  ```
- **前端调用位置**：venice/v2/X402Topup.tsx · handleFetchChallenge() + handleTopup()
- **测试状态**：✅ 构建通过

---

### 22. 授权 USDC

- **Method**：POST
- **Path**：/api/wallet/caw/approve
- **描述**：授权 USDC 给 CreditsPayment 合约
- **请求参数**：
  
  | 字段              | 类型     | 必填  | 说明                 |
  | --------------- | ------ | --- | ------------------ |
  | amountUsdcMinor | number | 否   | 授权数量 (minor units) |
- **响应示例**：
  
  ```json
  { "ok": true }
  ```
- **前端调用位置**：wallet/v2/PactAuthorization.tsx · handleApprove() · 授权 USDC 按钮
- **测试状态**：✅ 构建通过

---

### 23. 创建/预览 CAW 授权

- **Method**：POST
- **Path**：/api/wallet/caw/authorization
- **描述**：预览或提交 CAW Pact 授权
- **请求参数**：
  
  | 字段                    | 类型      | 必填  | 说明               |
  | --------------------- | ------- | --- | ---------------- |
  | intent                | string  | 是   | Pact 意图描述        |
  | singleLimitUsdcMinor  | number  | 是   | 单笔限额             |
  | dailyLimitUsdcMinor   | number  | 是   | 每日限额             |
  | monthlyLimitUsdcMinor | number  | 是   | 每月限额             |
  | validDays             | number  | 是   | 有效天数             |
  | previewOnly           | boolean | 是   | true=预览，false=提交 |
- **响应示例**（预览）：
  
  ```json
  {
  "preview": {
    "intent": "Allow CAW to spend USDC...",
    "originalIntent": "...",
    "executionPlan": "...",
    "draftedBy": "agent_deterministic",
    "warnings": [],
    "limits": {}
  }
  }
  ```
- **响应示例**（提交）：
  
  ```json
  {
  "authorization": { "pactId": "pact_xxx", "status": "pending_approval" }
  }
  ```
- **前端调用位置**：wallet/v2/PactAuthorization.tsx · handlePreview() + handleSubmit()
- **测试状态**：✅ 构建通过

---

### 24. 刷新 CAW 授权

- **Method**：POST
- **Path**：/api/wallet/caw/authorization/refresh
- **描述**：从 CAW 同步最新授权状态
- **请求参数**：无
- **响应示例**：
  
  ```json
  { "ok": true }
  ```
- **前端调用位置**：wallet/v2/PactAuthorization.tsx · handleRefreshAuth() · 刷新 Authorization 按钮
- **测试状态**：✅ 构建通过

---

### 25. 连接 CAW 钱包

- **Method**：POST
- **Path**：/api/wallet/caw/connect
- **描述**：将 CAW 钱包绑定到当前用户（优先 CLI，回退 Gateway）
- **请求参数**：
  
  | 字段            | 类型     | 必填  | 说明          |
  | ------------- | ------ | --- | ----------- |
  | cawWalletId   | string | 否   | CAW 钱包 UUID |
  | walletAddress | string | 否   | 钱包地址        |
- **响应示例**：
  
  ```json
  {
  "connection": { "connectionId": "cli_xxx", "walletAddress": "0x..." },
  "snapshot": {}
  }
  ```
- **前端调用位置**：wallet/v2/CawMobilePairing.tsx · callApi(connect) · 连接 CAW 按钮
- **测试状态**：✅ 构建通过

---

### 26. 发现 CAW 钱包

- **Method**：GET
- **Path**：/api/wallet/caw/discover
- **描述**：运行 `caw wallet list` 发现本地可用钱包
- **请求参数**：无
- **响应示例**：
  
  ```json
  {
  "ok": true,
  "wallets": [
    {
      "walletUuid": "xxx",
      "walletName": "default",
      "agentId": "caw_agent_xxx",
      "apiUrl": "https://api.agenticwallet.cobo.com",
      "env": "prod",
      "isActive": true,
      "status": "active"
    }
  ]
  }
  ```
- **前端调用位置**：wallet/v2/CawWalletBinding.tsx · handleDiscover() · 检测本机钱包按钮
- **测试状态**：✅ 构建通过

---

### 27. 领取测试币

- **Method**：POST
- **Path**：/api/wallet/caw/faucet
- **描述**：通过 CAW 领取测试 ETH/USDC
- **请求参数**：
  
  | 字段      | 类型     | 必填  | 说明    |
  | ------- | ------ | --- | ----- |
  | tokenId | string | 否   | 代币 ID |
- **响应示例**：
  
  ```json
  { "ok": true }
  ```
- **前端调用位置**：wallet/v2/PactAuthorization.tsx · handleFaucet() · 领取测试币按钮
- **测试状态**：✅ 构建通过

---

### 28. CAW Onboarding

- **Method**：GET / POST
- **Path**：/api/wallet/caw/onboarding
- **描述**：GET 获取 onboarding 状态；POST 推进 onboarding 流程
- **请求参数**（POST）：
  
  | 字段        | 类型     | 必填  | 说明          |
  | --------- | ------ | --- | ----------- |
  | agentName | string | 否   | Agent 名称    |
  | apiUrl    | string | 否   | CAW API URL |
  | answers   | object | 否   | 用户回答        |
- **响应示例**：
  
  ```json
  {
  "onboarding": { "status": "wallet_active", "walletId": "xxx" },
  "connection": { "walletAddress": "0x..." },
  "snapshot": {}
  }
  ```
- **前端调用位置**：未在当前前端页面中使用（CLI onboarding 流程）
- **测试状态**：✅ 构建通过

---

### 29. 查询 CAW Pacts

- **Method**：GET
- **Path**：/api/wallet/caw/pacts
- **描述**：查询 CAW Pact 列表，检测是否有 Base USDC Pact
- **请求参数**：Query param `status`（默认 "active"）
- **响应示例**：
  
  ```json
  {
  "ok": true,
  "status": "active",
  "pacts": [
    {
      "id": "pact_xxx",
      "name": "Venice x402",
      "intent": "...",
      "status": "active",
      "expiresAt": "2026-06-17T...",
      "remaining": { "txCountRemaining": 50 }
    }
  ],
  "hasBaseUsdcPact": true,
  "boundWallet": { "walletUuid": "xxx", "source": "runtime-config" }
  }
  ```
- **前端调用位置**：
  - wallet/v2/OnboardingOverview.tsx · load()
  - wallet/v2/PactAuthorization.tsx · load()
  - settings/v2/CawWalletInfo.tsx · load()
- **测试状态**：✅ 构建通过

---

### 30. 生成配对码

- **Method**：POST
- **Path**：/api/wallet/caw/pairing-code
- **描述**：生成 CAW 手机配对码
- **请求参数**：无
- **响应示例**：
  
  ```json
  {
  "pairingSession": {
    "code": "123456",
    "status": "generated",
    "expiresAt": "2026-06-10T..."
  },
  "snapshot": {}
  }
  ```
- **前端调用位置**：wallet/v2/CawMobilePairing.tsx · callApi(generate) · 生成配对码按钮
- **测试状态**：✅ 构建通过

---

### 31. 刷新配对状态

- **Method**：POST
- **Path**：/api/wallet/caw/pairing-code/refresh
- **描述**：从 CAW CLI 同步最新配对状态
- **请求参数**：无
- **响应示例**：
  
  ```json
  {
  "pairingSession": { "code": "123456", "status": "paired" },
  "snapshot": {}
  }
  ```
- **前端调用位置**：wallet/v2/CawMobilePairing.tsx · callApi(refresh) · 刷新配对状态按钮
- **测试状态**：✅ 构建通过

---

### 32. CAW Runtime Config

- **Method**：GET / POST / DELETE
- **Path**：/api/wallet/caw/runtime-config
- **描述**：管理 CAW 运行时配置（钱包绑定、API URL 等）
- **请求参数**（POST）：
  
  | 字段         | 类型     | 必填  | 说明       |
  | ---------- | ------ | --- | -------- |
  | walletUuid | string | 是   | 钱包 UUID  |
  | walletName | string | 否   | 钱包名称     |
  | apiUrl     | string | 否   | API URL  |
  | agentId    | string | 否   | Agent ID |
- **请求参数**（GET）：Query param `autobind=1` 自动从 caw CLI profile 绑定
- **响应示例**（GET）：
  
  ```json
  {
  "ok": true,
  "entries": [
    { "key": "caw_wallet_uuid", "value": "xxx" }
  ]
  }
  ```
- **响应示例**（POST）：
  
  ```json
  {
  "ok": true,
  "written": 1,
  "current": { "walletUuid": "xxx", "walletName": "default" }
  }
  ```
- **前端调用位置**：wallet/v2/CawWalletBinding.tsx · handleBind() · 绑定钱包按钮 + handleAutoBind()
- **测试状态**：✅ 构建通过

---

### 33. CAW 集成状态

- **Method**：GET
- **Path**：/api/wallet/caw/status
- **描述**：获取 CAW 集成完整状态（运行时、App、支付就绪度、链上读数）
- **请求参数**：无
- **响应示例**：
  
  ```json
  {
  "runtime": {
    "mode": "http",
    "walletPaired": true,
    "walletAddress": "0x...",
    "chainId": "BASE_ETH"
  },
  "app": {
    "connectedWalletAddress": "0x...",
    "authorizationStatus": "active",
    "pactId": "pact_xxx",
    "activeAuthorization": true
  },
  "spendReadiness": {
    "requiredUsdcMinor": 1000000,
    "remainingUsdcMinor": 20000000,
    "allowanceUsdcMinor": 10000000,
    "walletUsdcMinor": 50000000,
    "gasEth": "0.01"
  },
  "cawConfigured": true,
  "readyForRealPayment": true,
  "missing": []
  }
  ```
- **前端调用位置**：
  - dashboard/v2/StatsSection.tsx · load()
  - dashboard/v2/ReadinessSection.tsx · load()
  - wallet/v2/OnboardingOverview.tsx · load()
  - wallet/v2/CawMobilePairing.tsx · load()
  - wallet/v2/CawWalletBinding.tsx · load()
  - wallet/v2/PactAuthorization.tsx · load()
  - wallet/v2/PaymentReadiness.tsx · load()
  - venice/v2/X402Topup.tsx · load()
  - settings/v2/VeniceConfig.tsx · loadCaw()
  - settings/v2/CawWalletInfo.tsx · load()
- **测试状态**：✅ 构建通过

---

### 34. CAW 交易记录

- **Method**：GET
- **Path**：/api/wallet/caw/transactions
- **描述**：查询 CAW 钱包交易记录
- **请求参数**：Query param `limit`（默认 50）
- **响应示例**：
  
  ```json
  {
  "records": [
    {
      "id": "tx_xxx",
      "walletId": "xxx",
      "type": "TRANSFER",
      "from": "0x...",
      "to": "0x...",
      "amount": "1.000000",
      "status": "success",
      "txHash": "0x...",
      "createdAt": "2026-06-10T..."
    }
  ]
  }
  ```
- **前端调用位置**：payments/v2/TransactionRecords.tsx · load() · 双源兜底
- **测试状态**：✅ 构建通过

---

### 35. 链上 Credits 支付回调

- **Method**：POST
- **Path**：/api/webhooks/chain/credits-payment
- **描述**：链上 CreditsPayment 合约事件回调，结算充值订单（无需用户认证）
- **请求参数**：
  
  | 字段              | 类型     | 必填  | 说明               |
  | --------------- | ------ | --- | ---------------- |
  | orderId         | string | 否   | 订单 ID            |
  | onchainOrderId  | string | 否   | 链上订单 ID          |
  | amountUsdcMinor | number | 是   | 金额 (minor units) |
  | txHash          | string | 否   | 交易哈希             |
  | eventId         | string | 否   | 事件 ID            |
- **响应示例**：
  
  ```json
  { "status": "credited", "order": { "orderId": "ORD_xxx", "status": "credited" } }
  ```
- **前端调用位置**：无（链上 webhook，非前端调用）
- **测试状态**：✅ 构建通过

---

### 36. x402 资源支付

- **Method**：POST
- **Path**：/api/x402/resource/pay
- **描述**：为 x402 资源创建支付订单
- **请求参数**：无
- **响应示例**：
  
  ```json
  {
  "status": "submitted",
  "x402": {
    "amountUsdcMinor": 10000,
    "credits": 10,
    "paymentProof": "ORD_xxx",
    "paymentHeader": "x-payment-proof"
  }
  }
  ```
- **前端调用位置**：未在当前前端页面中使用（x402 协议接口）
- **测试状态**：✅ 构建通过

---

### 37. x402 资源访问

- **Method**：GET / POST
- **Path**：/api/x402/resource
- **描述**：访问受 x402 保护的资源，无支付证明返回 402
- **请求参数**：
  
  | 字段           | 类型     | 必填  | 说明                  |
  | ------------ | ------ | --- | ------------------- |
  | paymentProof | string | 否   | 支付证明（Header 或 Body） |
- **响应示例**（有支付证明）：
  
  ```json
  {
  "ok": true,
  "resource": { "insight": "x402 request unlocked..." },
  "paymentVerified": true,
  "payment": { "orderId": "ORD_xxx", "txHash": "0x..." }
  }
  ```
- **响应示例**（无支付证明，HTTP 402）：
  
  ```json
  {
  "x402Version": 1,
  "error": "payment_required",
  "accepts": [{ "scheme": "exact", "network": "base-sepolia", "maxAmountRequired": "10000" }]
  }
  ```
- **前端调用位置**：未在当前前端页面中使用（x402 协议接口）
- **测试状态**：✅ 构建通过

---

## 待修复问题

> 基于代码分析发现的潜在问题（非阻塞，构建和页面渲染均正常）

| #   | 问题                     | 文件                             | 说明                                                                                                                                                                                       |
| --- | ---------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Venice Balance 响应结构不一致 | venice/balance/route.ts        | 后端返回 `{ ok, balance }`（单个数字），前端 VeniceBalance.tsx 读取 `data.snapshot?.usdBalance` / `data.snapshot?.diemBalance` / `data.snapshot?.epoch`（三字段结构）。实际 balance API 只返回数字，DIEM/Epoch 永远显示 "—" |
| 2   | Settings API 500 错误    | settings/route.ts              | 未认证时返回 500 而非 401（`requireCurrentUser()` 抛出的 AuthRequiredError 应被 errorJson 捕获为 401）                                                                                                     |
| 3   | Pacts API 500 错误       | wallet/caw/pacts/route.ts      | `caw pact list` 命令在 dev 环境可能失败（caw CLI 未配置），导致 500                                                                                                                                       |
| 4   | CawWalletBinding 超长文件  | wallet/v2/CawWalletBinding.tsx | 约 12KB，建议拆分为子组件                                                                                                                                                                          |
| 5   | login-client.tsx 未使用   | components/login-client.tsx    | 旧版登录组件，login/page.tsx 已有独立实现，可删除                                                                                                                                                         |
