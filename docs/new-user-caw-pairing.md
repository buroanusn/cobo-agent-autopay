# 新用户 CAW 钱包配对流程

本文档用于把本项目部署给另一个用户或另一个团队成员时，说明如何让对方配对自己的 Cobo Agentic Wallet。

## 当前项目模式

当前版本是单钱包部署模式。

一份部署只读取一组后端 CAW 配置：

```env
AGENT_WALLET_API_URL=...
AGENT_WALLET_API_KEY=...
AGENT_WALLET_WALLET_ID=...
CAW_WALLET_ADDRESS=...
```

因此，页面上的“生成配对码”不是创建新钱包，而是给当前部署环境变量里的 `AGENT_WALLET_WALLET_ID` 生成手机配对码。

如果部署给另一个新用户，不能继续使用旧用户已经配对过的钱包。需要先创建一个新的 CAW Agent Wallet，并把部署切换到这个新钱包。

## 新用户首次配对步骤

1. 在部署机器或开发机器安装并登录 CAW CLI。
2. 使用 CAW CLI 创建新的 Agent Wallet。
3. 记录新钱包的非敏感信息：
   - Wallet ID / Wallet UUID
   - Agent ID
   - EVM wallet address
   - CAW API URL
4. 把新钱包的 API Key 只写入部署环境变量，不要写入 git。
5. 更新部署环境变量：

```env
AGENT_WALLET_API_URL=<new-caw-api-url>
AGENT_WALLET_API_KEY=<new-caw-api-key>
AGENT_WALLET_WALLET_ID=<new-wallet-uuid>
CAW_WALLET_ADDRESS=<new-evm-wallet-address>
CAW_MODE=http
CAW_CHAIN_ID=TBASE_SETH
CHAIN_ENV=base-sepolia
```

6. 重启网站。
7. 打开页面，确认“CAW 钱包配对”显示为待完成。
8. 点击“生成配对码”。
9. 新用户打开手机 Cobo Agentic Wallet App。
10. 输入页面显示的 8 位配对码。
11. 配对成功后，页面点击“连接 CAW”。
12. 给该新钱包准备 Base Sepolia ETH 和 Base Sepolia USDC。
13. 创建 Pact，让新用户在手机 App 里批准。
14. 给支付合约授权 USDC allowance。
15. 再执行真实小额支付。

## 已配对钱包为什么不能再次输入验证码

CAW 配对码用于把一个 Agent Wallet 的所有权转移给手机 App 用户。

如果当前钱包已经配对完成，页面再生成或展示配对码时，新用户在手机输入可能会看到“验证失败”。这通常表示当前部署仍然指向旧钱包，或者该钱包已经完成配对。

处理方式：

```text
新用户 = 新 CAW Agent Wallet + 新环境变量 + 新配对码
旧钱包换手机 = 走 CAW restore / re-pair 流程
```

## 不能提交到 git 的内容

以下内容只能放在本地或部署平台环境变量里：

```text
AGENT_WALLET_API_KEY
CAW_API_KEY
CAW_PACT_API_KEY
私钥
助记词
临时配对码
```

## 后续产品化方向

当前是单钱包演示版。要做成真正多用户产品，需要后端为每个业务用户保存独立的 CAW wallet id、wallet address、pairing status、Pact id 和授权状态。

推荐下一步：

1. 增加用户登录或用户选择。
2. 为每个用户创建独立 CAW Agent Wallet。
3. 把 CAW 钱包配置从 `.env` 迁移到数据库。
4. 页面按当前登录用户展示对应配对码和授权状态。
5. 支付时按用户读取对应 Pact 和 CAW wallet。
