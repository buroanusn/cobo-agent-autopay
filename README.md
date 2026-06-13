# Cobo Agent Autopay

> 为 AI Agent 提供自动小额免密支付基础设施

当 AI Agent 调用 Venice AI / BlockRun 等付费 API 时，传统方式需要人工充值、手动审批每笔支付。Cobo Agent Autopay 通过 Cobo Agentic Wallet（CAW）+ Pact 授权框架，实现了 Agent 自动感知余额 → 自动触发链上 USDC 支付 → 自动续费的全链路闭环，全程无需人工介入。

---

## 解决什么问题

| 痛点 | 本项目方案 |
|------|-----------|
| Agent 调用付费 API 需要人工充值 | 心跳轮询余额，低于阈值自动触发 x402 支付 |
| 每笔支付都需要手动审批 | CAW Pact 预授权限额，单笔/日/月限额内免审批 |
| 多个 Agent 共享钱包难以管理 | 多用户隔离，每个用户独立 CAW HOME、独立 Pact |
| 钱包 USDC 耗尽后 Agent 停摆 | Treasury 双钱包互充：Treasury → Spending 自动补充 |
| 支付安全无法控制 | Guardrails 限额策略 + AES-256-GCM 加密存储敏感配置 |

---

## 核心功能

### 🏠 工作台（Dashboard）
- 4 个实时数据卡：Venice 余额 / CAW 钱包地址 / 本月充值次数 / 积分余额
- CAW 接入状态自检（钱包/配对/Pact/合约 逐项检查）
- Agent 任务执行面板（一键运行，余额不足自动触发充值）
- Treasury 互充状态卡片

### 💰 Venice AI 集成
- x402 协议原生支付：Agent 钱包直接支付 USDC，Venice 自动到账
- SIWE 签名认证：通过 CAW Pact 签名查询 Venice 余额
- 自动充值：余额低于阈值时心跳自动触发 x402 top-up
- 积分账户管理：站内积分余额、阈值、自动充值配置

### 🔗 BlockRun 集成
- x402 按次付费：每次推理消耗 ~$0.001 USDC
- 支持 Base Mainnet / Base Sepolia 切换
- 钱包余额监控 + 最低余额阈值

### 🏦 CAW 钱包管理
- 手机配对码生成 / 刷新配对状态
- 钱包自动发现 / 手动绑定
- 网络切换（Base Mainnet / Base Sepolia）
- Pact 授权管理（创建/审批/刷新）

### 🔄 Treasury 双钱包互充
- Spending 钱包 USDC 不足时，Treasury 自动发起链上转账
- AES-256-GCM 加密存储 Treasury API Key
- 防重复：Cooldown 60s + transferInProgress 双重保护
- Fire-and-forget 异步旁路，不阻塞主流程

### 🛡️ Guardrails
- 默认限额：单笔 1 USDC / 日 5 USDC / 月 20 USDC
- AI 推荐策略生成
- 白名单地址 / 链限制

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Next.js 15 (App Router) + React 19 + Tailwind CSS 3 |
| 后端 | Next.js API Routes + Prisma ORM + SQLite |
| 钱包 | Cobo Agentic Wallet SDK + CLI（caw v0.2.86+） |
| 链 | Base Mainnet (Chain ID 8453) + USDC (0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913) |
| AI | Venice AI (x402) + BlockRun (x402) + OpenAI (Pact 草稿，可选) |
| 加密 | AES-256-GCM（密钥从 NEXTAUTH_SECRET 派生） |

---

## 项目结构

```
cobo-agent-autopay/
├── app/
│   ├── api/                          # API 路由
│   │   ├── auth/                     # 登录/登出
│   │   ├── wallet/caw/               # CAW 钱包管理（配对/绑定/发现）
│   │   ├── venice/                   # Venice AI（余额/充值/Pact/推理）
│   │   ├── blockrun/                 # BlockRun（余额/推理/Pact）
│   │   ├── credits/                  # 积分系统（余额/充值/心跳）
│   │   ├── settings/                 # 配置（通用 + Treasury）
│   │   └── agent/                    # Agent 任务执行
│   └── dashboard/                    # 前端页面
│       ├── page.tsx                  # 工作台
│       ├── wallet/                   # 钱包管理
│       ├── venice/                   # Venice 配置
│       ├── blockrun/                 # BlockRun 配置
│       ├── payments/                 # 支付记录
│       ├── pact/                     # Pact 管理
│       ├── guardrails/               # 限额策略
│       └── settings/                 # 系统设置
├── components/                       # React 组件（54 个）
├── lib/
│   ├── caw/                          # CAW CLI 封装 + Treasury 转账
│   ├── venice/                       # Venice x402 支付 + 余额
│   ├── blockrun/                     # BlockRun 推理 + 余额
│   ├── secrets/                      # AES-256-GCM 加密存储
│   ├── domain/                       # 业务逻辑（服务/类型/常量）
│   ├── store/                        # 数据仓库（Prisma 实现）
│   ├── auth/                         # Session 认证
│   └── r34-sweep-heartbeat.ts        # 心跳轮询（余额检查 + 自动充值）
├── prisma/
│   ├── schema.prisma                 # 数据模型
│   └── migrations/                   # 数据库迁移
└── scripts/                          # 部署脚本（合约编译/DB 初始化）
```

---

## 快速开始

### 前置条件

- Node.js 18+
- [Cobo Agentic Wallet CLI](https://github.com/nicepkg/caw)（caw v0.2.86+）
- Base Mainnet 上有 USDC 的 CAW 钱包

### 1. 安装依赖

```bash
git clone https://github.com/0xpadawans/cobo-agent-autopay.git
cd cobo-agent-autopay
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
cp .env.example .env.local
```

编辑 `.env.local`，填写以下关键配置：

```bash
# ── CAW 钱包 ──
AGENT_WALLET_API_URL=https://api.agenticwallet.cobo.com
AGENT_WALLET_API_KEY=caw_你的API密钥
CAW_WALLET_ID=你的钱包UUID
CAW_WALLET_ADDRESS=0x你的钱包地址

# ── Base 主网 ──
CHAIN_ENV=base-mainnet
CAW_CHAIN_ID=BASE_ETH
BASE_RPC_URL=https://mainnet.base.org
USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913

# ── 安全 ──
NEXTAUTH_SECRET=随机生成的32字节密钥

# ── CAW CLI HOME（绝对路径）──
CAW_CLI_HOME_ROOT=/absolute/path/to/cobo-agent-autopay/.caw-cli-homes
```

### 3. 初始化数据库

```bash
npx prisma generate
npx prisma db push
```

### 4. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000，使用邮箱注册/登录。

### 5. 绑定钱包

1. 进入「钱包」页面
2. 点击「检测本机钱包」
3. 选择钱包并绑定
4. 生成配对码，在 Cobo App 中输入完成配对
5. 创建 Pact 并在手机上审批

---

## 部署

### Vercel

```bash
npm run build
# 部署到 Vercel，配置环境变量
```

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
RUN npx prisma generate && npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

### 环境变量说明

| 变量 | 必填 | 说明 |
|------|------|------|
| `AGENT_WALLET_API_URL` | ✅ | CAW API 地址 |
| `AGENT_WALLET_API_KEY` | ✅ | CAW API 密钥 |
| `CAW_WALLET_ID` | ✅ | CAW 钱包 UUID |
| `CAW_WALLET_ADDRESS` | ✅ | 钱包链上地址 |
| `NEXTAUTH_SECRET` | ✅ | Session + 加密密钥派生源 |
| `CHAIN_ENV` | ✅ | `base-mainnet` 或 `base-sepolia` |
| `CAW_CLI_HOME_ROOT` | ✅ | CAW CLI HOME 根目录（绝对路径） |
| `VENICE_API_KEY` | 可选 | Venice AI API Key（如需 Venice 推理） |
| `OPENAI_API_KEY` | 可选 | Pact 草稿 AI 生成（不用则走确定性本地草稿） |
| `TREASURY_ADDRESS` | 可选 | Treasury 钱包地址（互充功能） |
| `SPENDING_WALLET_ADDRESS` | 可选 | Spending 钱包地址（互充功能） |

---

## 核心流程

### 自动充值流程

```
Agent 调用 Venice API
    ↓
积分余额不足
    ↓
心跳检测（60s 轮询）
    ↓
runVeniceX402Topup()
    ↓
CAW 钱包 → x402 支付 USDC → Venice 到账
    ↓
积分余额恢复
```

### Treasury 互充流程

```
Venice 积分不足
    ↓
心跳 60s 轮询
    ↓
runVeniceX402Topup()
    ↓
CAW 钱包 USDC 不足 → X402_INSUFFICIENT_BALANCE
    ↓
fire-and-forget
    ↓
onInsufficientWalletBalance()
    ↓
从 SQLite 读取加密的 Treasury 配置
    ↓
runTreasuryTransfer()
    ↓
caw tx transfer → Treasury → Spending 链上转账
    ↓
60s 后心跳重试 → Venice x402 充值成功 ✅
```

---

## 开发命令

```bash
npm run dev          # 启动开发服务器
npm run build        # 构建生产版本
npm run typecheck    # TypeScript 类型检查
npm run lint         # ESLint 检查
npm run db:studio    # 打开 Prisma Studio（数据库可视化）
npm run db:generate  # 重新生成 Prisma Client
npm run db:migrate   # 运行数据库迁移
```

---

## 安全设计

- **API Key 加密存储**：AES-256-GCM，密钥从 NEXTAUTH_SECRET SHA-256 派生
- **网络传输脱敏**：GET 接口返回 `sk-ab12****ef56` 格式
- **Pact 限额保护**：受 Cobo Pact 策略约束，单笔最高 50 USDC
- **防重复转账**：模块级 `transferInProgress` 标志 + 60s 冷却期
- **Session 认证**：HMAC-SHA256 签名 Cookie，7 天有效期
- **环境变量隔离**：`.env.local` 在 `.gitignore` 中，不提交敏感信息

---

## 许可证

Private — 仅限内部使用
