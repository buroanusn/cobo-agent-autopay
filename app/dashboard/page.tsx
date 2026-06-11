'use client';

import AppLayout from '@/components/layout/AppLayout';
import AgentSelector from '@/components/dashboard/v2/AgentSelector';
import StatsSection from '@/components/dashboard/v2/StatsSection';
import ReadinessSection from '@/components/dashboard/v2/ReadinessSection';
import AgentSection from '@/components/dashboard/v2/AgentSection';
import RecentPaymentsSection from '@/components/dashboard/v2/RecentPaymentsSection';

/**
 * Dashboard — 按需求文档 §二 重写
 * - 顶部：Agent 选择器（静态只读）
 * - 区块 1：4 个数据卡（Venice 余额 / CAW 钱包地址 / 本月充值次数 / 积分余额）
 * - 区块 2：真实 CAW 接入状态条
 * - 区块 3：Agent 执行
 * - 区块 4：最近支付记录（最多 6 条）
 *
 * 数据严格来源于后端 API：
 *   /api/venice/balance
 *   /api/wallet/caw/status
 *   /api/credits/balance
 *   /api/agent/run
 *
 * 注：「支付锁状态」字段（运行中/支付中/冷却中）— 现有 API 无独立暴露，
 *     按 §1 决策拿掉，数据卡从 5 个改为 4 个。
 */
export default function DashboardPage() {
  return (
    <AppLayout title="工作台">
      <div className="space-y-6">
        {/* 顶部 Agent 选择器 */}
        <div className="flex items-center justify-between">
          <AgentSelector />
        </div>

        {/* 区块 1：4 个数据卡 */}
        <StatsSection />

        {/* 区块 2：真实 CAW 接入状态条 */}
        <ReadinessSection />

        {/* 区块 3 + 区块 4 并排（大屏并排，小屏堆叠） */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <AgentSection />
          <RecentPaymentsSection />
        </div>
      </div>
    </AppLayout>
  );
}
