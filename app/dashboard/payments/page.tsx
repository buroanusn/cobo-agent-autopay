'use client';

import AppLayout from '@/components/layout/AppLayout';
import AgentSelector from '@/components/dashboard/v2/AgentSelector';
import PaymentStatsCards from '@/components/payments/v2/PaymentStatsCards';
import PaymentStatistics from '@/components/payments/v2/PaymentStatistics';
import PactAndApprovalCard from '@/components/payments/v2/PactAndApprovalCard';
import TransactionRecords from '@/components/payments/v2/TransactionRecords';

/**
 * Payments — 按需求文档 §五 重写
 *
 * 区块：
 *  1. 3 个统计卡（成功支付 / 处理中 / 失败）
 *  2. 支付统计（24h/30d 支出 + 笔数 + 自动 vs 人工）
 *  3. Pact 管理（超过需审批/超过直接拒绝/剩余额度/剩余天数）
 *  4. 待审批列表
 *  5. 完整交易记录（分页 + 7 种状态 + BaseScan 可点 + 双源兜底）
 *
 * 数据严格来源于后端 API：
 *   /api/credits/balance  → topupOrders / paymentStats / pactDetails / pendingApprovals
 *   /api/wallet/caw/transactions  → CAW tx records（有 CAW wallet 时）
 */
export default function PaymentsPage() {
  return (
    <AppLayout title="支付">
      <div className="space-y-6">
        {/* 顶部 Agent 选择器（静态只读，多 Agent 预留） */}
        <div className="flex items-center justify-between">
          <AgentSelector />
        </div>

        {/* 区块 1：3 个统计卡 */}
        <PaymentStatsCards />

        {/* 区块 2 + 区块 3+4 并排（大屏并排，小屏堆叠） */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <PaymentStatistics />
          <PactAndApprovalCard />
        </div>

        {/* 区块 5：完整交易记录 */}
        <TransactionRecords />
      </div>
    </AppLayout>
  );
}
