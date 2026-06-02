# CAW 小额免密支付项目说明

## 项目是什么

这是一个 CAW 小额免密支付 Demo。它模拟一个 Agent 产品里的积分消费场景：用户先授权 CAW 钱包在安全额度内自动支付，Agent 执行任务时消耗站内积分；当积分不足或低于阈值时，后端按风控规则触发 CAW 钱包用测试网 USDC 自动购买积分。

当前项目默认跑在 Base Sepolia 测试网配置上，不需要真实主网资金。没有真实 CAW 凭证时，项目使用 mock 模式完整演示业务流程；拿到 CAW 测试环境凭证后，可以切换到真实 CAW SDK 调用。

## 核心流程

```text
用户打开 Dashboard
  -> 连接或配对 CAW 钱包
  -> 创建 Pact 授权
  -> 用户在 Cobo App 审批授权
  -> Agent 执行任务并扣站内积分
  -> 积分低于阈值
  -> 后端检查单笔/日/月限额
  -> CAW 钱包调用积分购买合约
  -> 链上事件或回调确认
  -> 后端给用户账户增加积分
```

## 主要模块都是什么

| 模块 | 位置 | 作用 |
| --- | --- | --- |
| Dashboard UI | `components/dashboard-client.tsx` | 用户操作台，展示余额、CAW 授权、测试币、支付统计、订单、流水，并支持中英文切换。 |
| 页面入口 | `app/dashboard/page.tsx` | 加载 Dashboard 首屏数据并渲染 UI。 |
| 业务服务 | `lib/domain/services.ts` | 负责积分扣减、低余额检查、自动充值、Pact 创建、授权刷新、测试币申请等核心业务逻辑。 |
| 领域类型 | `lib/domain/types.ts` | 定义用户、账户、授权、订单、流水、Dashboard 快照等类型。 |
| 链和额度配置 | `lib/domain/constants.ts` | 配置 Base/Base Sepolia、USDC 地址、默认积分额度、默认支付额度。 |
| CAW 网关 | `lib/caw/gateway.ts` | 封装 mock 模式和真实 Cobo Agentic Wallet SDK 调用。 |
| 存储接口 | `lib/store/repository.ts` | 定义业务层依赖的数据访问接口。 |
| 内存存储 | `lib/store/memory-repository.ts`、`lib/store/memory.ts` | 无数据库时的本地演示数据存储。 |
| Prisma 存储 | `lib/store/prisma-repository.ts`、`lib/store/prisma-client.ts` | 使用 Postgres 持久化用户、账户、订单、流水、授权等数据。 |
| Prisma Schema | `prisma/schema.prisma` | 数据库表结构定义。 |
| API 路由 | `app/api/**/route.ts` | Dashboard 调用的后端接口。 |
| 积分购买合约 | `contracts/CreditsPayment.sol` | 真实链上支付时 CAW 钱包要调用的合约。 |

## API 都是什么

| API | 作用 |
| --- | --- |
| `GET /api/credits/balance` | 获取 Dashboard 快照，包括用户、余额、授权、订单、流水、网络配置。 |
| `POST /api/credits/consume` | 模拟 Agent 执行任务并扣积分；必要时触发自动充值。 |
| `POST /api/wallet/caw/connect` | 连接或记录 CAW 钱包地址。 |
| `POST /api/wallet/caw/pairing-code` | 生成 CAW 钱包配对码。 |
| `POST /api/wallet/caw/authorization` | 创建 Pact 授权。 |
| `POST /api/wallet/caw/authorization/refresh` | 刷新 Pact 状态，拿到激活后的 Pact API Key。 |
| `POST /api/wallet/caw/faucet` | 申请测试币，真实模式下走 CAW Faucet。 |
| `POST /api/topups/manual` | 手动触发一次积分充值。 |
| `POST /api/guardrails/recommend` | 根据风险偏好和预算生成 guardrails 建议。 |
| `POST /api/webhooks/chain/credits-payment` | 链上积分购买事件回调入口，用于幂等结算订单。 |

## 本地环境

项目当前使用：

- Next.js 15
- React 19
- TypeScript
- Prisma 6
- Postgres
- Cobo Agentic Wallet SDK
- viem
- Base Sepolia 测试网

本地启动：

```bash
npm install
npm run db:generate
npm run db:migrate
npm run dev
```

打开：

```text
http://localhost:3000/dashboard
```

## 环境变量

本地 mock 演示：

```env
DATABASE_URL="postgresql://agent_to_token:agent_to_token@localhost:5432/agent_to_token?schema=public"
STORAGE_DRIVER=prisma
CHAIN_ENV=base-sepolia
CAW_MODE=mock
CAW_CHAIN_ID=BASE_SEPOLIA
CAW_FAUCET_TOKEN_ID=BASE_SEPOLIA_USDC
```

真实 CAW 测试网接入：

```env
CAW_MODE=http
AGENT_WALLET_API_URL=...
AGENT_WALLET_API_KEY=...
AGENT_WALLET_WALLET_ID=...
CHAIN_ENV=base-sepolia
CAW_CHAIN_ID=BASE_SEPOLIA
CAW_FAUCET_TOKEN_ID=BASE_SEPOLIA_USDC
PAYMENT_CONTRACT_ADDRESS=...
TREASURY_ADDRESS=...
BASE_RPC_URL=...
DEPLOYER_PRIVATE_KEY=...
```

说明：

- `CAW_MODE=mock`：不调用真实 CAW，适合无凭证、无测试币时演示产品流程。
- `CAW_MODE=http`：调用真实 Cobo Agentic Wallet SDK。
- `PAYMENT_CONTRACT_ADDRESS`：真实支付必须配置，CAW 会调用这个积分购买合约。
- `CAW_FAUCET_TOKEN_ID`：测试币申请用的 token id，默认是 `BASE_SEPOLIA_USDC`。

部署积分购买合约：

```bash
npm run contract:compile
npm run contract:deploy
```

部署脚本会读取 `.env` 中的 `BASE_RPC_URL`、`DEPLOYER_PRIVATE_KEY`、
`TREASURY_ADDRESS` 和 `CHAIN_ENV`，然后输出 `PAYMENT_CONTRACT_ADDRESS`。

注意：当前 `CreditsPayment` 合约通过 `USDC.transferFrom` 收款，因此真实
`buyCredits` 调用前，CAW 钱包必须先给该合约 USDC allowance。

## 当前完成状态

已完成：

- 本地 Postgres/Prisma 数据库接入。
- Dashboard 中英文切换。
- CAW mock 模式完整闭环。
- Cobo Agentic Wallet SDK 真实网关接入。
- Base Sepolia 测试网默认配置。
- 测试币申请 API。
- Pact 授权创建和刷新 API。
- 站内积分扣减、自动充值、订单、流水、统计。
- 链上结算 webhook 的幂等入口。
- x402 + CAW mock PoC：模拟 HTTP 402 付款要求、CAW mock 支付、付款凭证重试和资源返回。

## x402 与 CAW 的结合方案

Bank of AI 的 x402 Agent 文档可以借鉴，但不能直接照搬。可借鉴的是
`HTTP 402 Payment Required -> 读取 payment requirements -> 付款 -> 带凭证重试`
这个协议流程；不能直接照搬的是 Agent 持有私钥的模型，因为本项目的核心是
CAW/Pact 授权支付，不把用户钱包私钥交给 Agent。

当前 mock PoC 的落地方式：

```text
Agent 请求付费资源
  -> 本地 seller 返回 x402 payment requirements
  -> 后端调用 CAW gateway 执行 1 USDC mock 支付
  -> 写入 topup_orders、ledger_entries、chain_events_seen
  -> 生成 mock x402 payment credential
  -> 重试请求并返回付费资源
```

验证入口：

```bash
curl -i http://localhost:3000/api/x402/resource
curl -s -X POST http://localhost:3000/api/x402/resource -H 'content-type: application/json' -d '{}'
```

Dashboard 入口：

```text
http://localhost:3000/dashboard
```

点击 `运行 x402 付费资源` / `Run x402 Paid Resource`，页面会展示付款凭证、资源内容和流程记录；
同时充值订单、账本和支付统计会更新，作为真实数据库记录。

已验证：

- `npm run typecheck`
- `npm run lint`
- `npx prisma validate`
- `GET /api/credits/balance`
- `POST /api/wallet/caw/faucet`
- `GET /dashboard`

## 还需要什么才能真正在测试网上跑通

1. 提供 Cobo Agentic Wallet 测试环境的 API URL、API Key、Wallet ID。
2. 部署 `contracts/CreditsPayment.sol` 到 Base Sepolia。
3. 把合约地址填入 `PAYMENT_CONTRACT_ADDRESS`。
4. 使用 CAW Faucet 或其他测试水龙头给钱包准备 Base Sepolia ETH 和测试 USDC。
5. 让 CAW 钱包给 `PAYMENT_CONTRACT_ADDRESS` 授权 USDC allowance。
6. 在 Cobo App 中审批 Pact。
7. 刷新授权，拿到 Pact API Key。
8. 执行手动充值或触发低余额自动充值。

## 安全边界

这个 Demo 有两层控制：

- 后端业务控制：单笔、日、月限额，订单幂等，余额阈值，重复结算保护。
- CAW/Pact 控制：限制链、合约地址、函数、支付额度和授权有效期。

真实生产前还需要补充：

- 用户登录和多用户隔离。
- Pact API Key 加密存储。
- 合约部署和事件监听服务。
- 更严格的风控策略和审计日志。
- 主网环境的人工复核流程。
