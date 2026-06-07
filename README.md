# Cobo Agent Autopay + Venice AI 集成

> AI Agent 使用 Cobo Agentic Wallet (CAW) 钱包，通过 x402 开放支付协议自动向 Venice AI 充值 USDC 并调用推理 API。

---

## 项目功能

### 核心能力

| 功能 | 说明 |
|---|---|
| **邮箱登录** | 输入邮箱即可创建账号，HMAC 签名 cookie session，无需第三方 OAuth |
| **CAW 钱包配对** | Dashboard 生成配对码 → 用户在 Cobo Agentic Wallet App 扫码/输入 → 自动绑定钱包地址 |
| **Pact 授权管理** | 用户用自然语言描述授权意图，系统生成 Pact 计划（确定性规则或 AI 草拟），提交到 CAW App 审批 |
| **USDC 余额监控** | 链上 USDC 余额、Gas 余额、Pact 剩余额度、每日/每月支出实时展示 |
| **交易历史** | 展示 CAW 钱包的所有交易记录，自动识别 x402 支付、手动支付、策略拒绝等类型 |
| **Venice AI 集成** | 完整的 Venice API 接入：余额查询、x402 充值、推理调用、操作日志 |

### Venice AI 集成详情

| API | 端点 | 说明 |
|---|---|---|
| 配置管理 | `GET/POST /api/config/venice` | 运行时设置 Venice API Key、模型、余额阈值 |
| 余额查询 | `GET /api/venice/balance?refresh=1` | Billing API（Bearer Key）+ x402 钱包余额双路径查询 |
| x402 充值查看 | `GET /api/venice/x402-topup` | 向 Venice 发请求，获取 402 支付挑战（accepts[] 列表） |
| x402 充值执行 | `POST /api/venice/x402-topup` | 通过 `caw fetch --protocol x402` 用 CAW 钱包 USDC 向 Venice 充值 |
| SIWE-X 签名 | `POST /api/venice/sign-message` | 用 CAW 钱包签名 EIP-712 typed data，生成 `X-Sign-In-With-X` 请求头 |
| 推理调用 | `POST /api/venice/inference` | 双认证模式：Bearer API Key **或** `X-Sign-In-With-X` 钱包签名 |
| 操作日志 | `GET /api/venice/logs` | 推理 + 充值操作的完整历史记录 |

### 认证模式对比

| 模式 | 认证方式 | 费用来源 | 前置条件 |
|---|---|---|---|
| **API Key** | Authorization: Bearer + API Key | Venice 账户余额 | Venice API Key |
| **X-Sign-In-With-X** | `X-Sign-In-With-X: <base64>` | 钱包绑定的 Venice 余额 | CAW 钱包 + Pact + `caw tx sign-message` |

---

## 快速开始

### 1. 安装依赖

```bash
cd cobo-agent-autopay
npm install
```

### 2. 配置环境变量

复制 `.env` 并填写：

```bash
# === 基础配置 ===
STORAGE_DRIVER=memory          # memory（开发）或 prisma（持久化）
CHAIN_ENV=base-mainnet         # base-sepolia（测试网）或 base-mainnet（主网）

# === CAW 配置 ===
CAW_MODE=http                  # mock（离线）或 http（真实 CAW）
AGENT_WALLET_API_URL=https://api.agenticwallet.dev.cobo.com
AGENT_WALLET_API_KEY=AGENT_... # 你的 CAW dev API Key
AGENT_WALLET_WALLET_ID=...     # 你的 CAW 钱包 UUID

# === Venice 配置（可选，也可从 Dashboard 设置）===
VENICE_API_KEY=ven_...         # Venice API Key
VENICE_INFERENCE_MODEL=llama-3.3-70b

# === CAW 链配置 ===
CAW_CHAIN_ID=BASE_ETH          # BASE_ETH（主网）或 TBASE_SETH（测试网）
```

### 3. 启动数据库（如使用 Prisma）

```bash
# 安装 PostgreSQL 后
createdb agent_to_token
npm run db:generate
npm run db:migrate
# .env 中设 STORAGE_DRIVER=prisma
```

### 4. 启动项目

```bash
npm run dev
```

打开 `http://localhost:3000`，进入登录页面。

---

## 完整使用流程

### 第一步：登录

1. 打开 `http://localhost:3000`
2. 输入邮箱地址，点击登录
3. 系统自动创建账号并跳转到 Dashboard

### 第二步：连接 CAW 钱包

1. 在 Dashboard 的 **"CAW 授权"** 卡片中，点击 **"生成配对码"**
2. 系统调用 CAW API 生成一个临时配对码（30 分钟有效）
3. 打开手机上的 **Cobo Agentic Wallet App（dev 版）**
4. 输入配对码完成配对
5. 配对成功后，Dashboard 自动显示绑定的钱包地址

### 第三步：创建 Pact 授权

1. 在 **"Pact 管理"** 卡片中，填写授权意图（如："允许 Agent 在 Base 链上使用 USDC 向 Venice AI 支付推理费用"）
2. 设置单笔上限、每日上限、每月上限、有效天数
3. 点击 **"生成 Pact 计划"** — 系统生成 PactSpec 预览（含策略、限额、警告）
4. 确认后点击 **"提交 Pact"** — 提交到 CAW App
5. 在手机 CAW App 中审批 Pact
6. 审批通过后 Dashboard 显示 Pact 状态为 **"active"**

### 第四步：配置 Venice

1. 在 Dashboard 的 **"Venice AI"** 面板中，输入 Venice API Key
2. 点击保存 — API Key 存入运行时配置
3. 点击 **"刷新余额"** — 查询 Venice 账户的 Billing 余额

### 第五步：x402 充值（用 CAW 钱包给 Venice 打钱）

1. 确保 CAW 钱包在 Base 链上有 USDC 余额
2. 在 Venice 面板中点击 **"查看 x402 challenge"** — 向 Venice 发请求获取支付要求（收款地址、金额等）
3. 设置充值金额（默认 $5 USDC）
4. 点击 **"用 CAW 钱包 x402 充值"** — 系统调用 `caw fetch` 自动完成 x402 支付：
   - CAW 钱包签名支付交易
   - USDC 从钱包转到 Venice 收款地址
   - Venice 自动给对应钱包地址充值等值积分
5. 再次点击 **"刷新余额"** 查看充值结果

### 第六步：运行推理

**方式 A — API Key 模式：**

1. 选择认证模式为 **"API Key (Bearer)"**
2. 输入 Prompt，点击 **"运行推理"**
3. 系统用 Venice API Key 调用 `/api/v1/chat/completions`

**方式 B — 钱包签名模式：**

1. 选择认证模式为 **"X-Sign-In-With-X"**
2. 点击 **"生成签名"** — 系统调用 `caw tx sign-message` 用 EIP-712 typed data 签名
3. 签名成功后，输入 Prompt 点击 **"运行推理"**
4. 系统用钱包签名的 `X-Sign-In-With-X` 头调用 Venice 推理 API

### 第七步：查看日志

- 在 Venice 面板底部查看 **"Inference 历史"** — 包含所有推理调用和充值操作记录
- 每条记录显示：Prompt、模型、响应、Token 数、耗时、状态

---

## 技术架构

```
┌─────────────────────────────────────────────────────┐
│                    Dashboard (Next.js)               │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │ 登录/Session│ │ CAW 钱包  │  │  Venice AI 面板   │  │
│  │ 邮箱→HMAC  │ │ 配对/Pact │  │ 配置/余额/x402/推理│  │
│  └──────┬─────┘ └────┬─────┘  └────────┬──────────┘  │
│         │            │                 │              │
│  ┌──────┴────────────┴─────────────────┴──────────┐  │
│  │              API Routes (Next.js)               │  │
│  │  /api/auth/*  /api/wallet/caw/*  /api/venice/* │  │
│  └──────┬────────────┬─────────────────┬──────────┘  │
└─────────┼────────────┼─────────────────┼─────────────┘
          │            │                 │
   ┌──────┴──────┐  ┌──┴──────────┐  ┌──┴──────────────┐
   │  Auth       │  │  CAW SDK    │  │  Venice API     │
   │  Session    │  │  @cobo/     │  │  Bearer Key     │
   │  (HMAC)     │  │  agentic-   │  │  x402 支付      │
   └─────────────┘  │  wallet     │  │  SIWE-X 签名    │
                    └──────┬──────┘  └────────┬────────┘
                           │                  │
                    ┌──────┴──────┐    ┌──────┴──────┐
                    │  CAW 钱包   │    │  Venice AI  │
                    │  Base/Solana│    │  x402 收款  │
                    │  USDC 链上  │    │  积分账户    │
                    └─────────────┘    └─────────────┘
```

### 关键技术决策

| 决策 | 原因 |
|---|---|
| EIP-712 替代 EIP-191 | CAW SDK 只支持 EIP-712 typed data 签名，不支持 `personal_sign`，因此用 EIP-712 构造等价的 SIWE-X 消息 |
| `caw fetch` CLI 做 x402 | CAW 的 `caw fetch --protocol x402` 自动处理 x402 支付挑战（402 → 签名 → 重试），无需手动构造 `X-402-Payment` 头 |
| 双存储驱动 | `memory` 用于快速开发（重启丢数据），`prisma` 用于持久化（PostgreSQL） |
| 双认证模式 | Venice 支持 Bearer API Key 和钱包签名两种认证，灵活适配不同场景 |

---

## 项目结构

```
cobo-agent-autopay/
├── app/
│   ├── api/
│   │   ├── auth/login/         # 邮箱登录
│   │   ├── auth/logout/        # 退出
│   │   ├── config/venice/      # Venice 配置管理
│   │   ├── venice/
│   │   │   ├── balance/        # 余额查询
│   │   │   ├── x402-topup/     # x402 充值（GET=查看挑战, POST=执行支付）
│   │   │   ├── sign-message/   # SIWE-X 签名生成
│   │   │   ├── inference/      # 推理调用
│   │   │   └── logs/           # 操作日志
│   │   ├── wallet/caw/         # CAW 钱包管理（配对/连接/Pact/审批/交易）
│   │   └── credits/            # Token 余额管理
│   ├── dashboard/page.tsx      # Dashboard 页面
│   └── login/page.tsx          # 登录页面
├── components/
│   ├── dashboard-client.tsx    # Dashboard 前端（含 Venice 面板）
│   └── login-client.tsx        # 登录前端
├── lib/
│   ├── venice/
│   │   ├── client.ts           # Venice HTTP 客户端（Bearer 认证）
│   │   ├── balance.ts          # 余额查询逻辑
│   │   ├── siwe.ts             # EIP-712 SIWE-X 签名
│   │   ├── topup.ts            # x402 充值（caw fetch）
│   │   ├── inference.ts        # 推理调用
│   │   └── types.ts            # Venice 类型定义
│   ├── caw/gateway.ts          # CAW SDK 封装（Mock + Http 双模式）
│   ├── config/store.ts         # 运行时配置
│   ├── store/
│   │   ├── venice.ts           # Venice 运行时存储
│   │   ├── memory.ts           # 内存存储
│   │   └── prisma-repository.ts# Prisma 持久化
│   ├── domain/                 # 业务逻辑
│   └── auth/session.ts         # 认证
├── prisma/schema.prisma        # 数据库 Schema
└── package.json
```

---

## 环境变量参考

| 变量 | 必填 | 说明 |
|---|---|---|
| `CAW_MODE` | ✅ | `mock`（离线）或 `http`（真实 CAW） |
| `AGENT_WALLET_API_URL` | http 模式必填 | CAW API 地址，dev 环境：`https://api.agenticwallet.dev.cobo.com` |
| `AGENT_WALLET_API_KEY` | http 模式必填 | CAW API Key |
| `AGENT_WALLET_WALLET_ID` | http 模式必填 | CAW 钱包 UUID |
| `CAW_CHAIN_ID` | 可选 | `BASE_ETH`（主网）或 `TBASE_SETH`（测试网） |
| `CHAIN_ENV` | 可选 | `base-mainnet` 或 `base-sepolia` |
| `STORAGE_DRIVER` | 可选 | `memory` 或 `prisma` |
| `DATABASE_URL` | prisma 必填 | PostgreSQL 连接串 |
| `VENICE_API_KEY` | 可选 | Venice API Key（也可从 Dashboard 设置） |
| `VENICE_BASE_URL` | 可选 | Venice API 地址，默认 `https://api.venice.ai` |
| `AUTH_SESSION_SECRET` | 生产必填 | Session 签名密钥 |

---

## 技术栈

- **框架**: Next.js 15.5.18 (App Router)
- **语言**: TypeScript 5.8
- **CAW SDK**: `@cobo/agentic-wallet` ^0.1.7
- **链上**: viem ^2.51.3 (EVM 交互)
- **数据库**: Prisma 6.19 + PostgreSQL 16（可选内存存储）
- **前端**: React 19.1
