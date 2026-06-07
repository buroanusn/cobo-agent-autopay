# Cobo Agent Autopay + Venice AI 集成

> AI Agent 使用 Cobo Agentic Wallet (CAW) 钱包，通过 x402 开放支付协议自动向 Venice AI 充值 USDC 并调用推理 API。

---

## 项目功能

### 核心能力

| 功能 | 说明 |
|---|---|
| **邮箱登录** | 输入邮箱即可创建账号，Web Crypto API HMAC 签名 cookie session，无需第三方 OAuth |
| **CAW 钱包自动绑定** | Dashboard 自动发现本机 caw CLI 配置的钱包，支持自动绑定和手动输入 UUID |
| **Pact 授权管理** | 系统生成 Pact 计划（AI 草拟 + 规则），提交到 CAW App 审批 |
| **USDC 余额监控** | 链上 USDC 余额、Gas 余额、Pact 剩余额度实时展示 |
| **交易历史** | 展示 CAW 钱包的所有交易记录 |
| **Venice AI 集成** | 完整的 Venice API 接入：余额查询、x402 充值、推理调用、操作日志 |

### Venice AI 集成详情

| API | 端点 | 说明 |
|---|---|---|
| 配置管理 | `GET/POST /api/config/venice` | 运行时设置 Venice API Key、模型 |
| 余额查询 | `GET /api/venice/balance?refresh=1` | Billing API（Bearer Key）+ x402 钱包余额双路径查询 |
| x402 充值 | `POST /api/venice/x402-topup` | 通过 `caw fetch` 用 CAW 钱包 USDC 向 Venice 充值 |
| 推理调用 | `POST /api/venice/inference` | 双认证模式：Bearer API Key 或 X-Sign-In-With-X 钱包签名 |
| 操作日志 | `GET /api/venice/logs` | 推理 + 充值操作的完整历史记录 |

---

## 快速开始

### 1. 安装依赖

```bash
cd cobo-agent-autopay
npm install
```

### 2. 安装 caw CLI

```bash
npm install -g @cobo/agentic-wallet  # 提供 caw 命令行
caw setup                             # 配置 API Key 和钱包
```

### 3. 配置环境变量

复制 `.env.example` 为 `.env`：

```bash
# === 基础配置 ===
STORAGE_DRIVER=memory          # memory（开发）或 prisma（持久化）
CHAIN_ENV=base-sepolia         # base-sepolia（测试网）或 base-mainnet（主网）

# === CAW 链配置 ===
CAW_CHAIN_ID=TBASE_SETH        # TBASE_SETH（测试网）或 BASE_ETH（主网）

# === Venice 配置（可选，也可从 Dashboard 设置）===
VENICE_API_KEY=ven_...         # Venice API Key
VENICE_INFERENCE_MODEL=llama-3.3-70b
```

> **注意**：`AGENT_WALLET_*` 环境变量**不需要**手动填写。Dashboard 的"自动绑定"功能会从本机 `~/.cobo-agentic-wallet/profiles/` 自动读取并注入运行时代理，重启后需要重新绑定。

### 4. 启动项目

```bash
# ⚠️ 开发模式下必须设置 HTTPS_PROXY（原因见下）
HTTPS_PROXY=http://127.0.0.1:1082 NO_PROXY=localhost,127.0.0.1 npm run dev
```

打开 `http://localhost:3000`，进入登录页面。

> **关于 HTTPS_PROXY**：系统代理软件（Clash/Surge/V2Ray 等）会将 CAW 和 Venice API 的 DNS 解析到虚拟 IP（`198.18.x.x`）。Go 和 curl 能自动走系统代理，但 **Node.js 不能**。因此 dev server 必须显式设置 `HTTPS_PROXY`，或者通过 `launch.json` 等工具注入。

---

## 完整使用流程

### 第一步：登录

1. 打开 `http://localhost:3000`
2. 输入邮箱地址（如 `demo@agent.local`），点击登录
3. 系统自动创建账号并跳转到 Dashboard

### 第二步：连接 CAW 钱包

Dashboard 的 **"CAW 钱包绑定"** 面板提供三种方式：

1. **自动绑定**（推荐）：点击"自动绑定"——系统扫描本机 `~/.cobo-agentic-wallet/profiles/`，自动读取并注入凭证
2. **手动输入 UUID**：粘贴钱包 UUID → 绑定
3. **生成配对码**：如果钱包需要手机配对，生成 8 位配对码 → 在 CAW App 中输入完成配对

### 第三步：创建 Pact 授权

1. 在 **"Pact 管理"** 卡片中，点击 **"生成 Pact 计划"**
2. 系统自动生成 Pact 预览（意图、策略、限额）
3. 确认后点击 **"提交 Pact"**——通过 `caw pact submit` 提交到 CAW
4. 在手机 CAW App 中审批 Pact
5. 审批后点击 **"刷新 Pact"**——系统用 `caw pact list` 同步状态
6. Dashboard 显示 Pact 状态为 **"active"**

### 第四步：配置 Venice

1. 在 **"Venice AI"** 面板中输入 Venice API Key
2. 点击保存——API Key 存入运行时配置
3. 点击 **"刷新余额"**——查询 Venice 账户余额

### 第五步：x402 充值

1. 确保 CAW 钱包在对应链上有 USDC 余额
2. 在 Venice 面板中设置充值金额（默认 $5 USDC）
3. 点击 **"用 CAW 钱包 x402 充值"**
4. 系统调用 `caw fetch` 自动完成 x402 支付流程（Venice 返回 402 → CAW 付 USDC → 重试）

### 第六步：运行推理

1. 选择认证模式（API Key / 钱包签名）
2. 输入 Prompt，点击 **"运行推理"**
3. 系统调用 Venice `/api/v1/chat/completions`

---

## 技术架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Dashboard (Next.js)                        │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │ 登录/Session│ │ CAW 钱包管理  │  │  Venice AI 面板       │  │
│  │ 邮箱→HMAC  │ │ 绑定/Pact    │  │ 配置/余额/x402/推理   │  │
│  └──────┬─────┘ └──────┬───────┘  └──────────┬────────────┘  │
│         │              │                      │               │
│  ┌──────┴──────────────┴──────────────────────┴──────────┐   │
│  │              API Routes (Next.js)                       │  │
│  │  /api/auth/*  /api/wallet/caw/*  /api/venice/*         │  │
│  └──────┬────────────┬──────────────────────┬──────────────┘  │
└─────────┼────────────┼──────────────────────┼─────────────────┘
          │            │                      │
   ┌──────┴──────┐  ┌──┴──────────────┐  ┌───┴─────────────────┐
   │  Web Crypto  │  │  caw CLI (Go)   │  │  Venice API         │
   │  Auth        │  │  (替代 SDK)      │  │  Bearer Key         │
   │  Session     │  │                 │  │  x402 支付           │
   └─────────────┘  │   execSync()     │  │  SIWE-X 签名         │
                    └──────┬──────────┘  └─────────┬────────────┘
                           │                      │
                    ┌──────┴──────┐        ┌──────┴──────┐
                    │  CAW 钱包   │        │  Venice AI  │
                    │  Base/Solana│        │  x402 收款  │
                    │  USDC 链上  │        │  积分账户    │
                    └─────────────┘        └─────────────┘
```

### 关键技术决策

| 决策 | 原因 |
|---|---|
| **`caw CLI` 替代 `@cobo/agentic-wallet` SDK** | Node.js HTTPS 无法走系统代理（CAW/Venice API DNS 被代理软件重定向到 `198.18.x.x` 虚拟 IP）。Go 写的 `caw` CLI 能正常通过代理建立 TLS 连接 |
| **`eval('require')('child_process')`** | webpack 静态分析会尝试打包 `child_process` 导致构建失败。用 `eval('require')` 绕过，仅在服务端函数体内部动态加载 |
| **运行时配置（RuntimeConfig）** | `AGENT_WALLET_*` 凭证通过 Dashboard 自动绑定注入 `process.env`，重启后需重新绑定。无需手动编辑 `.env` |
| **EIP-712 替代 EIP-191** | CAW SDK 只支持 EIP-712 typed data 签名，不支持 `personal_sign`，因此用 EIP-712 构造等价的 SIWE-X 消息 |
| **`caw fetch` 做 x402** | CAW 的 `caw fetch --protocol x402` 自动处理 x402 支付挑战（402 → 签名 → 重试），无需手动构造 `X-402-Payment` 头 |
| **双存储驱动** | `memory` 用于快速开发（重启丢数据），`prisma` 用于持久化（PostgreSQL） |

### 已知限制

| 限制 | 说明 |
|---|---|
| **Node.js 不走系统代理** | 开发环境必须设置 `HTTPS_PROXY=http://127.0.0.1:1082`，否则 CAW 和 Venice API 都连不上 |
| **caw CLI 必须预装** | 所有 CAW API 调用（配对码生成、Pact 提交、交易发送）都依赖 `caw` 命令 |
| **运行时配置不持久化** | `STORAGE_DRIVER=memory` 时，Venice API Key 和 CAW 凭证在重启后丢失。切换到 `prisma` 可持久化 |

---

## 项目结构

```
cobo-agent-autopay/
├── app/
│   ├── api/
│   │   ├── auth/login/             # 邮箱登录
│   │   ├── auth/logout/            # 退出
│   │   ├── config/venice/          # Venice 配置管理
│   │   ├── venice/
│   │   │   ├── balance/            # 余额查询
│   │   │   ├── x402-topup/         # x402 充值
│   │   │   ├── sign-message/       # SIWE-X 签名
│   │   │   ├── inference/          # 推理调用
│   │   │   └── logs/               # 操作日志
│   │   ├── wallet/caw/
│   │   │   ├── connect/            # 钱包连接
│   │   │   ├── discover/           # 发现本机钱包
│   │   │   ├── runtime-config/     # 运行时配置
│   │   │   ├── pairing-code/       # 配对码生成/刷新
│   │   │   ├── authorization/      # Pact 提交/预览/刷新
│   │   │   ├── pacts/              # Pact 列表
│   │   │   └── transactions/       # 交易历史
│   │   └── credits/                # Token 余额管理
│   ├── dashboard/page.tsx          # Dashboard 页面
│   └── login/page.tsx              # 登录页面
├── components/
│   ├── dashboard-client.tsx        # Dashboard 前端（含 Venice + CAW 面板）
│   └── login-client.tsx            # 登录前端
├── lib/
│   ├── venice/
│   │   ├── client.ts               # Venice HTTP 客户端（Bearer 认证）
│   │   ├── balance.ts              # 余额查询逻辑
│   │   ├── siwe.ts                 # EIP-712 SIWE-X 签名
│   │   ├── topup.ts                # x402 充值
│   │   ├── inference.ts            # 推理调用
│   │   └── types.ts                # Venice 类型定义
│   ├── caw/
│   │   ├── gateway.ts              # CAW 网关（Mock + Http 双模式，已弃用 SDK 调用）
│   │   ├── pact-drafter.ts         # Pact 计划 AI 草拟
│   │   └── runtime-config-store.ts # CAW 运行时配置存储
│   ├── config/store.ts             # 运行时配置管理
│   ├── domain/
│   │   ├── services.ts             # 核心业务逻辑（所有 CAW API 调用走 caw CLI）
│   │   ├── types.ts                # 领域类型
│   │   ├── constants.ts            # 常量
│   │   └── money.ts                # 金额计算
│   ├── store/
│   │   ├── venice.ts               # Venice 运行时存储
│   │   ├── memory.ts               # 内存存储（createId, nowIso）
│   │   └── prisma-repository.ts    # Prisma 持久化
│   ├── auth/session.ts             # 认证（Web Crypto API）
│   └── r34-sweep-heartbeat.ts      # 定时订单过期扫描
├── prisma/schema.prisma            # 数据库 Schema
└── package.json
```

---

## 环境变量参考

| 变量 | 必填 | 说明 |
|---|---|---|
| `STORAGE_DRIVER` | 可选 | `memory`（默认，开发用）或 `prisma` |
| `DATABASE_URL` | prisma 模式 | PostgreSQL 连接串 |
| `CHAIN_ENV` | 可选 | `base-sepolia`（默认）或 `base-mainnet` |
| `CAW_CHAIN_ID` | 可选 | `TBASE_SETH`（默认）或 `BASE_ETH` |
| `CAW_MODE` | 可选 | `http`（默认）或 `mock`（需同时设 `CAW_ALLOW_MOCK=true`） |
| `VENICE_API_KEY` | 可选 | Venice API Key（也可从 Dashboard 设置） |
| `VENICE_BASE_URL` | 可选 | Venice API 地址，默认 `https://api.venice.ai` |
| `VENICE_INFERENCE_MODEL` | 可选 | 推理模型，默认 `llama-3.3-70b` |
| `AUTH_SESSION_SECRET` | 生产必填 | Session 签名密钥 |
| `HTTPS_PROXY` | 开发必填 | `http://127.0.0.1:1082`（系统代理地址） |

---

## 技术栈

- **框架**: Next.js 15.5.18 (App Router)
- **语言**: TypeScript 5.8
- **CAW 交互**: `caw` CLI (Go) — 替代 `@cobo/agentic-wallet` SDK
- **链上**: viem ^2.51.3 (EVM 交互，仅用于 calldata 编码)
- **数据库**: Prisma 6.19 + PostgreSQL 16（可选内存存储）
- **前端**: React 19.1
- **认证**: Web Crypto API (HMAC-SHA256 via `crypto.subtle`)
