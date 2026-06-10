'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import StatCard from '@/components/dashboard/v2/StatCard';
import { formatUsdc } from '@/lib/domain/money';

type Snapshot = {
  topupOrders?: Array<{ status: string; amountUsdcMinor: number }>;
};

const PROCESSING_STATUSES = new Set(['pending_policy', 'caw_submitted', 'chain_pending', 'pending_approval']);

/**
 * 区块 1：3 个统计卡
 * - 成功支付：status=credited 的 topupOrders 总金额 + 笔数
 * - 处理中：status ∈ {pending_policy, caw_submitted, chain_pending, pending_approval} 笔数
 * - 失败：status=failed 笔数
 *
 * 数据源：/api/credits/balance → topupOrders[]
 */
export default function PaymentStatsCards() {
  const [orders, setOrders] = useState<Snapshot['topupOrders'] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/credits/balance');
        if (!res.ok) {
          if (!cancelled) setError(`HTTP ${res.status}`);
          return;
        }
        const data: Snapshot = await res.json();
        if (!cancelled) setOrders(data.topupOrders ?? []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'fetch failed');
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const loading = orders === null && !error;

  const credited = (orders ?? []).filter((o) => o.status === 'credited');
  const processing = (orders ?? []).filter((o) => PROCESSING_STATUSES.has(o.status));
  const failed = (orders ?? []).filter((o) => o.status === 'failed');
  const totalUsdcMinor = credited.reduce((sum, o) => sum + o.amountUsdcMinor, 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <StatCard
        label="成功支付"
        value={orders === null ? '—' : `$${formatUsdc(totalUsdcMinor)}`}
        icon={CheckCircle2}
        iconClass="text-emerald-600"
        iconBg="bg-emerald-50"
        loading={loading}
        hint={orders === null ? '加载中' : `${credited.length} 笔 USDC 已到账`}
      />
      <StatCard
        label="处理中"
        value={orders === null ? '—' : `${processing.length} 笔`}
        icon={Clock}
        iconClass="text-amber-600"
        iconBg="bg-amber-50"
        loading={loading}
        hint="等待 CAW 或链上确认"
      />
      <StatCard
        label="失败"
        value={orders === null ? '—' : `${failed.length} 笔`}
        icon={XCircle}
        iconClass="text-red-600"
        iconBg="bg-red-50"
        loading={loading}
        hint="策略拒绝或执行失败"
      />
    </div>
  );
}
