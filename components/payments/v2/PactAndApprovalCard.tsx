'use client';

import { useEffect, useState } from 'react';
import { ShieldCheck, Clock, Inbox } from 'lucide-react';
import SectionCard from '@/components/dashboard/v2/SectionCard';
import { formatUsdc } from '@/lib/domain/money';

type PactDetails = {
  reviewIfAmountUsdcMinor: number;
  denyIfAmountUsdcMinor: number;
  remainingUsdcMinor: number;
  completionTimeElapsedDays: number;
  completionAmountSpentUsdcMinor?: number;
  txCount24hLimit?: number;
  amount24hLimitUsdcMinor?: number;
};

type PendingApproval = {
  id: string;
  amountUsdcMinor: number;
  walletAddress: string;
  createdAt: string;
};

type Snapshot = {
  pactDetails?: PactDetails;
  pendingApprovals?: PendingApproval[];
};

function timeAgo(iso: string): string {
  const t = Date.parse(iso);
  if (!t) return '—';
  const diff = Date.now() - t;
  const min = Math.floor(diff / 60_000);
  if (min < 60) return `${min} 分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小时前`;
  return `${Math.floor(hr / 24)} 天前`;
}

/**
 * 区块 3 + 区块 4 合并到一个 SectionCard：
 *  - Pact 管理：4 项（需审批上限/拒绝上限/剩余额度/剩余天数）
 *  - 待审批列表：pendingApprovals[]，无数据显示「暂无待审批」
 *
 * 数据源：/api/credits/balance → pactDetails + pendingApprovals
 */
export default function PactAndApprovalCard() {
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
  const pact = snapshot?.pactDetails;
  const approvals = snapshot?.pendingApprovals ?? [];

  return (
    <SectionCard
      title="Pact 管理 & 待审批"
      subtitle="当前 Pact 的策略限额与待审批订单"
      loading={loading}
    >
      {error ? (
        <p className="text-xs text-red-600">加载失败：{error}</p>
      ) : (
        <div className="space-y-5">
          {/* Pact 4 项指标 */}
          <div>
            <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-2">
              <ShieldCheck className="w-3.5 h-3.5" />
              Pact 策略
            </div>
            {pact ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="rounded-lg bg-gray-50 px-3 py-2.5">
                  <p className="text-[11px] text-gray-500">超过需审批</p>
                  <p className="text-sm font-semibold text-amber-700 mt-0.5">
                    ${formatUsdc(pact.reviewIfAmountUsdcMinor)}
                  </p>
                </div>
                <div className="rounded-lg bg-gray-50 px-3 py-2.5">
                  <p className="text-[11px] text-gray-500">超过直接拒绝</p>
                  <p className="text-sm font-semibold text-red-600 mt-0.5">
                    ${formatUsdc(pact.denyIfAmountUsdcMinor)}
                  </p>
                </div>
                <div className="rounded-lg bg-gray-50 px-3 py-2.5">
                  <p className="text-[11px] text-gray-500">剩余额度</p>
                  <p className="text-sm font-semibold text-emerald-700 mt-0.5">
                    ${formatUsdc(pact.remainingUsdcMinor)}
                  </p>
                </div>
                <div className="rounded-lg bg-gray-50 px-3 py-2.5">
                  <p className="text-[11px] text-gray-500">剩余天数</p>
                  <p className="text-sm font-semibold text-gray-900 mt-0.5">
                    {pact.completionTimeElapsedDays} 天
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-500">暂无活跃 Pact</p>
            )}
          </div>

          {/* 待审批列表 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <Inbox className="w-3.5 h-3.5" />
                待审批列表
                {approvals.length > 0 && (
                  <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 text-[10px] font-medium">
                    {approvals.length}
                  </span>
                )}
              </div>
            </div>
            {approvals.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-4">暂无待审批</p>
            ) : (
              <div className="space-y-1.5">
                {approvals.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-amber-50/50 border border-amber-100"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-mono text-gray-900 truncate">
                        ${formatUsdc(a.amountUsdcMinor)}
                      </p>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        {a.walletAddress.slice(0, 6)}…{a.walletAddress.slice(-4)} · {timeAgo(a.createdAt)}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1 text-[11px] text-amber-700">
                      <Clock className="w-3 h-3" />
                      等待 Cobo App
                    </span>
                  </div>
                ))}
                <p className="text-[11px] text-gray-400 mt-2">
                  大额支付会显示在这里；审批动作在 Cobo App 内完成。
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </SectionCard>
  );
}
