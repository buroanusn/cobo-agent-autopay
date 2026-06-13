# Cobo Agent Autopay

**AI Agent 自动支付基础设施** — 基于 Cobo Agentic Wallet + x402 协议，让 AI Agent 具备自主支付能力。

---

## 项目背景

当前 AI Agent 生态面临一个核心瓶颈：**Agent 无法自主付费**。

当 Agent 调用 Venice AI、BlockRun 等付费推理服务时，传统流程需要：
1. 人工查看余额 → 人工充值 → 人工审批每笔支付
2. 余额耗尽后 Agent 直接停摆，需要人工介入恢复
3. 多个 Agent 共享钱包时，资金管理混乱、无法限额

**Cobo Agent Autopay** 解决了这个问题。它通过 Cobo Agentic Wallet（CAW）的链上钱包 + Pact 预授权框架，实现了：

- Agent 自动感知余额 → 自动触发 Base 链上 USDC 支付 → 自动续费
- 单笔/日/月限额内免审批，超出限额自动拦截
- Treasury 双钱包互充：主钱包 USDC 不足时，Treasury 自动补充
- 全程无人工介入，Agent 7×24 自主运行

---

## 核心功能

### 1. 自动充值（Auto Top-up）

心跳每 60 秒轮询 Venice AI / BlockRun 余额，低于阈值时自动触发 x402 支付：

```
Agent 调用付费 API → 积分不足 → 心跳检测 → CAW 钱包支付 USDC → Venice/BlockRun 到账 → 继续运行
```

### 2. Treasury 双钱包互充

当 Spending 钱包 USDC 不足导致 x402 支付失败时，Treasury 钱包自动发起链上转账补充：

```
Spending USDC 不足 → 触发 Treasury 转账 → caw tx transfer → Spending 余额恢复 → 重试 x402 支付
```

Treasury API Key 使用 AES-256-GCM 加密存储，密钥从 `NEXTAUTH_SECRET` SHA-256 派生。

### 3. CAW 钱包管理

- **手机配对**：生成一次性配对码，用户在 Cobo App 中输入完成绑定
- **钱包发现**：自动检测本机已有的 CAW 钱包 Profile
- **Pact 授权**：创建支付预授权（单笔/日/月限额），手机审批后生效
- **多用户隔离**：每个应用用户独立 CAW HOME 目录，互不干扰

### 4. x402 支付集成

支持两个 x402 支付节点：

| 服务 | 网络 | 用途 |
|------|------|------|
| Venice AI | Base Mainnet | LLM 推理付费，按 token 计费 |
| BlockRun | Base Sepolia / Mainnet | x402 按次推理付费，~$0.001/次 |

x402 是 HTTP 原生支付协议：服务端返回 402 Payment Required，客户端用钱包签名支付 USDC，服务端验证后返回结果。

### 5. 积分账户系统

- 站内积分余额管理（1 USDC = 1000 积分）
- 自动充值阈值配置
- 积分账本（充值/消费/赠送记录）
- 链上 Topup Order 生命周期管理

### 6. Guardrails 限额策略

- 默认限额：单笔 1 USDC / 日 5 USDC / 月 20 USDC
- 白名单地址 / 链限制
- AI 推荐策略生成（可选，需要 OpenAI API Key）

---

## 技术架构

```
┌─────────────────────────────────────────────────────┐
│                    前端 (Next.js)                     │
│  Dashboard │ Wallet │ Venice │ BlockRun │ Settings    │
└──────────────────────┬──────────────────────────────┘
                       │ REST API
┌──────────────────────┴──────────────────────────────┐
│                 API Routes (Next.js)                  │
│  auth │ wallet/caw │ venice │ blockrun │ credits      │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────────┐
│                   业务逻辑层 (lib/)                    │
│  caw/cli.ts │ venice/topup.ts │ secrets/store.ts      │
│  r34-sweep-heartbeat.ts (心跳轮询)                    │
└──────┬──────────────┬──────────────┬────────────────┘
       │              │              │
┌──────┴──────┐ ┌─────┴─────┐ ┌─────┴──────┐
│  Prisma/    │ │  CAW CLI  │ │ Venice AI  │
│  SQLite     │ │  (caw)    │ │ BlockRun   │
│  (本地DB)   │ │  (钱包)   │ │ (x402 API) │
└─────────────┘ └─────┬─────┘ └────────────┘
                      │
              ┌───────┴───────┐
              │  Base Mainnet │
              │  (USDC 链上)  │
              └───────────────┘
```

### 数据模型（Prisma + SQLite）

| 模型 | 说明 |
|------|------|
| `User` | 用户账户（邮箱、CAW 钱包绑定） |
| `CreditAccount` | 积分账户（余额、阈值） |
| `LedgerEntry` | 积分账本（充值/消费记录） |
| `TopupOrder` | 链上充值订单（状态机管理） |
| `CawAuthorization` | Pact 授权记录（限额、状态） |
| `CawPairingSession` | 配对码会话 |
| `CawOnboardingSession` | 钱包 Onboarding 状态 |
| `CawRuntimeCredential` | CAW 运行时凭据（加密） |
| `UserSecret` | 用户级加密配置（Treasury 等） |
| `Agent` / `AgentRun` | Agent 任务管理 |
| `VeniceTopupOrder` | Venice x402 充值订单 |
| `Guardrails` | 限额策略 |

---

## 使用的 API / SDK / AI 工具

### Cobo Agentic Wallet（CAW）

| 组件 | 用途 |
|------|------|
| `@cobo/agentic-wallet` SDK | Node.js SDK，钱包状态查询、Pact 管理 |
| `caw` CLI (v0.2.86+) | 命令行工具，钱包配对、Pact 创建、链上转账 |
| CAW HTTP API | `https://api.agenticwallet.cobo.com`，配对码/Pact/签名/转账 |

核心 API 端点：
- `POST /v1/pairing-codes` — 生成配对码
- `POST /v1/pacts` — 创建 Pact 授权
- `POST /v1/wallets/{id}/message-sign` — 消息签名（SIWE）
- `POST /v1/wallets/{id}/transactions` — 链上转账

### Venice AI

| API | 用途 |
|------|------|
| `POST /api/v1/chat/completions` | LLM 推理（Bearer / SIWE 认证） |
| `POST /api/v1/x402/top-up` | x402 USDC 充值（402 挑战 → 钱包支付） |
| `GET /api/v1/x402/balance/{address}` | SIWE 签名查询余额 |

### BlockRun

| API | 用途 |
|------|------|
| `POST /v1/chat/completions` | x402 按次推理（~$0.001/次） |
| 余额查询 | 通过 viem 读取链上 USDC 余额 |

### x402 协议

HTTP 原生支付协议（类似 HTTP 402 Payment Required）：
1. 客户端请求付费资源
2. 服务端返回 402 + `accepts[]`（支持的支付方式）
3. 客户端用钱包签名 USDC 支付
4. 服务端验证支付后返回资源

### AI 工具（可选）

| 工具 | 用途 |
|------|------|
| OpenAI GPT-4.1-mini | Pact 草稿 AI 生成（自然语言 → PactSpec） |
| Venice AI Llama-3.3-70b | Agent 推理任务执行 |

### 链上组件

| 组件 | 地址 |
|------|------|
| USDC 合约 (Base Mainnet) | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| CreditsPayment 合约 | 项目自部署，监听链上购买事件 |
| Base RPC | `https://mainnet.base.org` |

---

## 快速开始

### 前置条件

- Node.js 18+
- [Cobo Agentic Wallet CLI](https://github.com/nicepkg/caw) v0.2.86+
- Base Mainnet 上有 USDC 的 CAW 钱包

### 安装

```bash
git clone https://github.com/0xpadawans/cobo-agent-autopay.git
cd cobo-agent-autopay
npm install
```

### 配置

```bash
cp .env.example .env.local
```

编辑 `.env.local`：

```bash
# CAW 钱包
AGENT_WALLET_API_URL=https://api.agenticwallet.cobo.com
AGENT_WALLET_API_KEY=caw_你的...
CAW_WALLET_ID=d776846c-...
CAW_WALLET_ADDRESS=0xaa56...

# 安全
NEXTAUTH_SECRET=你的随机密钥

# CAW CLI（必须用绝对路径）
CAW_CLI_HOME_ROOT=/absolute/path/to/.caw-cli-homes

# 链
CHAIN_ENV=base-mainnet
CAW_CHAIN_ID=BASE_ETH
USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
```

### 初始化数据库

```bash
npx prisma generate
npx prisma db push
```

### 启动

```bash
npm run dev
```

访问 http://localhost:3000，注册/登录后进入 Dashboard。

### 首次使用

1. **钱包** → 检测本机钱包 → 绑定 → 生成配对码 → Cobo App 输入配对码
2. **Venice** → 创建 Pact → Cobo App 审批 → 签名查询余额
3. **设置** → 配置自动充值阈值 / Treasury 钱包（可选）
4. **工作台** → 运行 Agent 任务，观察自动充值

---

## 部署

### Vercel

```bash
npm run build
# 在 Vercel Dashboard 配置环境变量后部署
```

### Docker

```bash
docker build -t cobo-agent-autopay .
docker run -p 3000:3000 --env-file .env.local cobo-agent-autopay
```

### 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `AGENT_WALLET_API_URL` | ✅ | CAW API 地址 |
| `AGENT_WALLET_API_KEY` | ✅ | CAW API 密钥 |
| `CAW_WALLET_ID` | ✅ | CAW 钱包 UUID |
| `CAW_WALLET_ADDRESS` | ✅ | 钱包链上地址 |
| `NEXTAUTH_SECRET` | ✅ | Session + 加密密钥 |
| `CHAIN_ENV` | ✅ | `base-mainnet` 或 `base-sepolia` |
| `CAW_CLI_HOME_ROOT` | ✅ | CAW CLI HOME 根目录（绝对路径） |
| `VENICE_API_KEY` | 可选 | Venice AI API Key |
| `OPENAI_API_KEY` | 可选 | Pact 草稿 AI 生成 |
| `TREASURY_ADDRESS` | 可选 | Treasury 钱包地址 |
| `SPENDING_WALLET_ADDRESS` | 可选 | Spending 钱包地址 |

---

## 开发

```bash
npm run dev          # 开发服务器
npm run build        # 生产构建
npm run typecheck    # TypeScript 检查
npm run lint         # ESLint
npm run db:studio    # Prisma Studio（数据库可视化）
```

---

## License

Private — 仅限内部使用
