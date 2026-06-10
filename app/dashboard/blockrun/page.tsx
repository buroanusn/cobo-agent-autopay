'use client';

import AppLayout from '@/components/layout/AppLayout';
import AgentSelector from '@/components/dashboard/v2/AgentSelector';
import BlockRunConfig from '@/components/blockrun/BlockRunConfig';
import BlockRunBalance from '@/components/blockrun/BlockRunBalance';
import BlockRunInference from '@/components/blockrun/BlockRunInference';
import BlockRunLogs from '@/components/blockrun/BlockRunLogs';

export default function BlockRunPage() {
  return (
    <AppLayout title="BlockRun">
      <div className="space-y-6">
        {/* 顶部 Agent 选择器 */}

        {/* 区块 1：BlockRun 配置（全宽） */}
        <BlockRunConfig />

        {/* 区块 2 + 区块 3 并排 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <BlockRunBalance />
          <BlockRunInference />
        </div>

        {/* 区块 4：推理历史日志（全宽） */}
        <BlockRunLogs />
      </div>
    </AppLayout>
  );
}
