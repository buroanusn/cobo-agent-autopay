'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import StatCard from '@/components/dashboard/v2/StatCard';
import { formatUsdc } from '@/lib/domain/money';

type Snapshot = {
  topupOrders?: Array<{ status: string; amountUsdcMinor: number }>;
};

type CawTx = { amount?: string; status?: string };

function parseCawAmountMinor(raw?: string): number {
  if (!raw) return 0;
  const num = parseFloat(raw.replace(/[^0-9.]/g, ''));
  return isNaN(num) ? 0 : Math.round(num * 1_000_000);
}

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
  const [cawTxs, setCawTxs] = useState<CawTx[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function loadOrders() {
      try {
        const res = await fetch('/api/credits/balance');
        if (!res.ok) return;
        const data: Snapshot = await res.json();
        if (!cancelled) setOrders(data.topupOrders ?? []);
      } catch { /* ignore */ }
    }
    async function loadCaw() {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 25_000);
        const res = await fetch('/api/wallet/caw/transactions?limit=20', { signal: ctrl.signal });
        clearTimeout(timer);
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setCawTxs(data?.records ?? []);
        }
      } catch { /* ignore */ }
    }
    loadOrders();
    // Stagger CAW fetch to avoid concurrent requests
    const cawTimer = setTimeout(loadCaw, 10000);
    return () => {
      cancelled = true;
      clearTimeout(cawTimer);
    };
  }, []);

  const loading = orders === null && cawTxs.length === 0;

  const credited = (orders ?? []).filter((o) => o.status === 'credited');
  const processing = (orders ?? []).filter((o) => PROCESSING_STATUSES.has(o.status));
  const failed = (orders ?? []).filter((o) => o.status === 'failed');
  const topupTotalUsdcMinor = credited.reduce((sum, o) => sum + o.amountUsdcMinor, 0);

  // CAW successful transactions
  const cawSuccess = cawTxs.filter((t) => {
    const s = (t.status ?? '').toLowerCase();
    return s === 'success' || s === 'completed';
  });
  const cawFailed = cawTxs.filter((t) => {
    const s = (t.status ?? '').toLowerCase();
    return s === 'failed' || s === 'failure' || s === 'rejected';
  });
  const cawSuccessTotal = cawSuccess.reduce((sum, t) => sum + parseCawAmountMinor(t.amount), 0);

  const totalUsdcMinor = topupTotalUsdcMinor + cawSuccessTotal;
  const totalCredited = credited.length + cawSuccess.length;
  const totalFailed = failed.length + cawFailed.length;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <StatCard
        label="成功支付"
        value={loading ? '—' : `$${formatUsdc(totalUsdcMinor)}`}
        icon={CheckCircle2}
        iconClass="text-emerald-600"
        iconBg="bg-emerald-50"
        loading={loading}
        hint={loading ? '加载中' : `${totalCredited} 笔 USDC 已到账`}
      />
      <StatCard
        label="处理中"
        value={loading ? '—' : `${processing.length} 笔`}
        icon={Clock}
        iconClass="text-amber-600"
        iconBg="bg-amber-50"
        loading={loading}
        hint="等待 CAW 或链上确认"
      />
      <StatCard
        label="失败"
        value={loading ? '—' : `${totalFailed} 笔`}
        icon={XCircle}
        iconClass="text-red-600"
        iconBg="bg-red-50"
        loading={loading}
        hint="策略拒绝或执行失败"
      />
    </div>
  );
}
