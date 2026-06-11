'use client';

import AppLayout from '@/components/layout/AppLayout';
import AgentSelector from '@/components/dashboard/v2/AgentSelector';
import CawMobilePairing from '@/components/wallet/v2/CawMobilePairing';
import CawWalletBinding from '@/components/wallet/v2/CawWalletBinding';

export default function WalletPage() {
  return (
    <AppLayout title="钱包">
      <div className="space-y-6">
        {/* 顶部 Agent 选择器（多 Agent 预留，静态只读） */}
        <div className="flex items-center justify-between">
          <AgentSelector />
        </div>

        {/* CAW 手机配对 + 钱包绑定 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CawMobilePairing />
          <CawWalletBinding />
        </div>

        {/* Pact 授权已移至 /dashboard/pact 统一管理 */}
      </div>
    </AppLayout>
  );
}
