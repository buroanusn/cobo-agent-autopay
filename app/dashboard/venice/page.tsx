'use client';

import { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import AgentSelector from '@/components/dashboard/v2/AgentSelector';
import VeniceApiKey from '@/components/venice/v2/VeniceApiKey';
import VeniceBalance from '@/components/venice/v2/VeniceBalance';
import X402Topup from '@/components/venice/v2/X402Topup';
import CreditAccount from '@/components/venice/v2/CreditAccount';
import VeniceInference from '@/components/venice/v2/VeniceInference';

/**
 * Venice — 按需求文档 §四 重写
 *
 * 区块：
 *  1. Venice API Key（API key + 模型 + 保存）
 *  2. Venice 账户余额（USD / DIEM / Epoch + 刷新）
 *  3. x402 Top-up（CAW 钱包 → Venice；金额 + 前置校验 + 3 按钮）
 *  4. 积分账户（余额/阈値/自动充値 + 最近账本 12 条）
 *  5. Inference（Bearer / SIWE 认证模式切换 + 提示词 + 2 按钮 + 历史）
 *
 * 数据严格来源于后端 API：
 *   /api/config/venice
 *   /api/venice/balance
 *   /api/venice/x402-topup
 *   /api/venice/inference
 *   /api/venice/sign-message
 *   /api/venice/logs
 *   /api/credits/balance
 *   /api/wallet/caw/status
 */
export default function VenicePage() {
  // x402 top-up 完成后触发 credit 区块 / 余额区块重新拉
  const [reloadKey, setReloadKey] = useState(0);
  const triggerReload = () => setReloadKey((k) => k + 1);

  return (
    <AppLayout title="Venice.ai">
      <div className="space-y-6">
        {/* 顶部 Agent 选择器（多 Agent 预留，静态只读） */}
        <div className="flex items-center justify-between">
          <AgentSelector />
        </div>

        {/* 区块 1：Venice API Key */}
        <VeniceApiKey />

        {/* 区块 2 + 区块 3 并排 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <VeniceBalance key={`balance-${reloadKey}`} />
          <X402Topup onAfterAction={triggerReload} />
        </div>

        {/* 区块 4：积分账户 */}
        <CreditAccount key={`credit-${reloadKey}`} />

        {/* 区块 5：Inference */}
        <VeniceInference />
      </div>
    </AppLayout>
  );
}
