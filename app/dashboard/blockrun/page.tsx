'use client';

import AppLayout from '@/components/layout/AppLayout';
import BlockRunConfig from '@/components/blockrun/BlockRunConfig';
import BlockRunPactPanel from '@/components/blockrun/BlockRunPactPanel';
import BlockRunPaymentTest from '@/components/blockrun/BlockRunPaymentTest';
import BlockRunBalance from '@/components/blockrun/BlockRunBalance';
import BlockRunInference from '@/components/blockrun/BlockRunInference';
import BlockRunLogs from '@/components/blockrun/BlockRunLogs';

export default function BlockRunPage() {
  return (
    <AppLayout title="BlockRun">
      <div className="space-y-6">
        {/* 区块 1：BlockRun 配置（全宽） */}
        <BlockRunConfig />

        {/* 区块 2：BlockRun Pact 授权（全宽） */}
        <BlockRunPactPanel />

        {/* 区块 3：x402 支付链路测试（全宽） */}
        <BlockRunPaymentTest />

        {/* 区块 4 + 5 并排 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <BlockRunBalance />
          <BlockRunInference />
        </div>

        {/* 区块 6：推理历史日志（全宽） */}
        <BlockRunLogs />
      </div>
    </AppLayout>
  );
}
