'use client';

import { useEffect, useState } from 'react';
import { Activity, Calendar, Bot, User } from 'lucide-react';
import SectionCard from '@/components/dashboard/v2/SectionCard';
import { formatUsdc } from '@/lib/domain/money';

type Snapshot = {
  topupOrders?: Array<{ status: string; reason: string; amountUsdcMinor: number; createdAt: string }>;
  paymentStats?: {
    spent24hUsdcMinor: number;
    spent30dUsdcMinor: number;
    txCount24h: number;
    txCount30d: number;
    automaticPayments: number;
    manualApprovalPayments: number;
  };
};

type CawTx = {
  amount?: string;
  status?: string;
  createdAt?: string;
  type?: string;
};

function formatPct(part: number, total: number): string {
  if (total === 0) return '0%';
  return `${Math.round((part / total) * 100)}%`;
}

/**
 * 区块 2：支付统计
 * - 24h 支出 / 30d 支出 / 24h 笔数 / 30d 笔数
 * - 自动 vs 人工占比
 * 数据源：/api/credits/balance → paymentStats
 */
export default function PaymentStatistics() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [cawTxs, setCawTxs] = useState<CawTx[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function loadSnapshot() {
      try {
        const res = await fetch('/api/credits/balance');
        if (!res.ok) {
          // Don't set error — CAW data may still be available
          return;
        }
        const data: Snapshot = await res.json();
        if (!cancelled) setSnapshot(data);
      } catch {
        // ignore — CAW data may still load
      }
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
    loadSnapshot();
    // Stagger CAW fetch to avoid 3 concurrent requests
    const cawTimer = setTimeout(loadCaw, 5000);
    return () => {
      cancelled = true;
      clearTimeout(cawTimer);
    };
  }, []);

  const loading = snapshot === null && cawTxs.length === 0;
  const stats = snapshot?.paymentStats;
  const orders = snapshot?.topupOrders ?? [];

  // Parse CAW transaction amounts (string like "1.5" or "1.5 USDC") → minor units
  function parseCawAmountMinor(raw?: string): number {
    if (!raw) return 0;
    const num = parseFloat(raw.replace(/[^0-9.]/g, ''));
    return isNaN(num) ? 0 : Math.round(num * 1_000_000);
  }

  const cawSuccess = cawTxs.filter((t) => {
    const s = (t.status ?? '').toLowerCase();
    return s === 'success' || s === 'completed';
  });

  const now = Date.now();
  const dayAgo = now - 24 * 60 * 60 * 1000;
  const monthAgo = now - 30 * 24 * 60 * 60 * 1000;

  const caw24h = cawSuccess.filter((t) => t.createdAt && Date.parse(t.createdAt) >= dayAgo);
  const caw30d = cawSuccess.filter((t) => t.createdAt && Date.parse(t.createdAt) >= monthAgo);
  const cawSpent24h = caw24h.reduce((s, t) => s + parseCawAmountMinor(t.amount), 0);
  const cawSpent30d = caw30d.reduce((s, t) => s + parseCawAmountMinor(t.amount), 0);

  // Merge: CAW stats + topup stats
  const mergedSpent24h = (stats?.spent24hUsdcMinor ?? 0) + cawSpent24h;
  const mergedSpent30d = (stats?.spent30dUsdcMinor ?? 0) + cawSpent30d;
  const mergedTx24h = (stats?.txCount24h ?? 0) + caw24h.length;
  const mergedTx30d = (stats?.txCount30d ?? 0) + caw30d.length;

  // 总额（所有非失败的）+ 占比
  const settledOrders = orders.filter((o) => o.status === 'credited' || o.status === 'pending_approval' || o.status === 'pending_policy');
  const topupAutoCount = orders.filter((o) => o.reason !== 'manual').length;
  const topupManualCount = orders.length - topupAutoCount;

  // CAW: transfer = 自动, deposit = 人工, message_sign = 不算
  const cawPayments = cawTxs.filter((t) => (t.type ?? '') !== 'message_sign');
  const cawAutoCount = cawPayments.filter((t) => (t.type ?? '') === 'transfer').length;
  const cawManualCount = cawPayments.filter((t) => (t.type ?? '') === 'deposit').length;

  const autoCount = topupAutoCount + cawAutoCount;
  const manualCount = topupManualCount + cawManualCount;
  const totalCount = autoCount + manualCount;

  return (
    <SectionCard
      title="支付统计"
      subtitle="24 小时 / 30 天支出与笔数；自动 vs 人工触发"
      loading={loading}
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4">
          {/* 24h 支出 */}
          <div>
            <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
              <Activity className="w-3.5 h-3.5" />
              24h 支出
            </div>
            <p className="text-lg font-semibold text-gray-900">
              ${formatUsdc(mergedSpent24h)}
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5">{mergedTx24h} 笔</p>
          </div>

          {/* 30d 支出 */}
          <div>
            <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
              <Calendar className="w-3.5 h-3.5" />
              30d 支出
            </div>
            <p className="text-lg font-semibold text-gray-900">
              ${formatUsdc(mergedSpent30d)}
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5">{mergedTx30d} 笔</p>
          </div>

          {/* 自动 vs 人工 */}
          <div className="col-span-2">
            <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
              <Bot className="w-3.5 h-3.5" />
              触发方式
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-xs font-medium">
                  <Bot className="w-3 h-3" />
                  自动 {formatPct(autoCount, totalCount)}
                </span>
                <span className="text-xs text-gray-500">{autoCount} 笔</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-50 text-purple-700 text-xs font-medium">
                  <User className="w-3 h-3" />
                  人工 {formatPct(manualCount, totalCount)}
                </span>
                <span className="text-xs text-gray-500">{manualCount} 笔</span>
              </div>
            </div>
            <p className="text-[11px] text-gray-400 mt-1">
              共 {settledOrders.length + cawSuccess.length} 笔有效订单
            </p>
          </div>
        </div>
    </SectionCard>
  );
}
