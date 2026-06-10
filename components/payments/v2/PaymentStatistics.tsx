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
        if (!cancelled) setSnapshot(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'fetch failed');
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const loading = snapshot === null && !error;
  const stats = snapshot?.paymentStats;
  const orders = snapshot?.topupOrders ?? [];

  // 总额（所有非失败的）+ 占比
  const settledOrders = orders.filter((o) => o.status === 'credited' || o.status === 'pending_approval' || o.status === 'pending_policy');
  const autoCount = orders.filter((o) => o.reason !== 'manual').length;
  const manualCount = orders.length - autoCount;
  const totalCount = autoCount + manualCount;

  return (
    <SectionCard
      title="支付统计"
      subtitle="24 小时 / 30 天支出与笔数；自动 vs 人工触发"
      loading={loading}
    >
      {error ? (
        <p className="text-xs text-red-600">加载失败：{error}</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4">
          {/* 24h 支出 */}
          <div>
            <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
              <Activity className="w-3.5 h-3.5" />
              24h 支出
            </div>
            <p className="text-lg font-semibold text-gray-900">
              ${formatUsdc(stats?.spent24hUsdcMinor ?? 0)}
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5">{stats?.txCount24h ?? 0} 笔</p>
          </div>

          {/* 30d 支出 */}
          <div>
            <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
              <Calendar className="w-3.5 h-3.5" />
              30d 支出
            </div>
            <p className="text-lg font-semibold text-gray-900">
              ${formatUsdc(stats?.spent30dUsdcMinor ?? 0)}
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5">{stats?.txCount30d ?? 0} 笔</p>
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
              共 {settledOrders.length} 笔有效订单
            </p>
          </div>
        </div>
      )}
    </SectionCard>
  );
}
