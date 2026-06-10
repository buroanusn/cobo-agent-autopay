'use client';

import { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import AgentSelector from '@/components/dashboard/v2/AgentSelector';
import OnboardingOverview from '@/components/wallet/v2/OnboardingOverview';
import CawOnboardingGuide from '@/components/wallet/v2/CawOnboardingGuide';
import CawMobilePairing from '@/components/wallet/v2/CawMobilePairing';
import CawWalletBinding from '@/components/wallet/v2/CawWalletBinding';
import PactAuthorization from '@/components/wallet/v2/PactAuthorization';
import PaymentReadiness from '@/components/wallet/v2/PaymentReadiness';

/**
 * Wallet — 按需求文档 §三 重写
 *
 * 区块：
 *  1. 演示流程总览（4 步进度条）
 *  2. 新用户接入 CAW 指南（静态）
 *  3. CAW 手机配对（3 按钮）
 *  4. CAW 钱包绑定（检测/自动/手动/网络/钱包信息）
 *  5. Pact 授权状态（活跃数/Base USDC Pact/列表/参数/5 按钮/Pact 预览）
 *  6. 支付就绪（4 指标/缺少列表）
 *
 * 数据严格来源于后端 API：
 *   /api/wallet/caw/status
 *   /api/wallet/caw/pacts
 *   /api/wallet/caw/pairing-code (POST)
 *   /api/wallet/caw/pairing-code/refresh (POST)
 *   /api/wallet/caw/connect (POST)
 *   /api/wallet/caw/discover (GET)
 *   /api/wallet/caw/faucet (POST)
 *   /api/wallet/caw/authorization (POST)
 *   /api/wallet/caw/authorization/refresh (POST)
 *   /api/wallet/caw/approve (POST)
 */
export default function WalletPage() {
  // 任何动作完成后，让 OnboardingOverview 重新拉数据以刷新 4 步进度
  const [reloadKey, setReloadKey] = useState(0);
  const triggerReload = () => setReloadKey((k) => k + 1);

  return (
    <AppLayout title="Wallet">
      <div className="space-y-6">
        {/* 顶部 Agent 选择器（多 Agent 预留，静态只读） */}
        <div className="flex items-center justify-between">
          <AgentSelector />
        </div>

        {/* 区块 1 + 区块 2 并排（演示流程 + 接入指南） */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <OnboardingOverview reloadKey={reloadKey} />
          <CawOnboardingGuide />
        </div>

        {/* 区块 3 + 区块 4 并排（手机配对 + 钱包绑定） */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CawMobilePairing onAfterAction={triggerReload} />
          <CawWalletBinding onAfterAction={triggerReload} />
        </div>

        {/* 区块 5：Pact 授权（最重，单独占满） */}
        <PactAuthorization onAfterAction={triggerReload} />

        {/* 区块 6：支付就绪 */}
        <PaymentReadiness />
      </div>
    </AppLayout>
  );
}
