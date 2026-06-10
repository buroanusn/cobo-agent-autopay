'use client';

import { useEffect, useState } from 'react';
import { ExternalLink, CircleSlash, CheckCircle2, Clock, Send, XCircle, AlertCircle } from 'lucide-react';
import SectionCard from './SectionCard';
import { formatUsdc } from '@/lib/domain/money';

type TopupOrder = {
  id: string;
  amountUsdcMinor: number;
  status: string;
  reason: string;
  createdAt: string;
  txHash?: string;
  orderId?: string;
};

type SnapshotResponse = {
  topupOrders?: TopupOrder[];
};

const STATUS_STYLE: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  credited: { label: '成功', color: 'text-emerald-700 bg-emerald-50', icon: CheckCircle2 },
  failed: { label: '失败', color: 'text-red-700 bg-red-50', icon: XCircle },
  caw_submitted: { label: '已提交', color: 'text-blue-700 bg-blue-50', icon: Send },
  chain_pending: { label: '链上处理中', color: 'text-blue-700 bg-blue-50', icon: Clock },
  pending_approval: { label: '待审批', color: 'text-amber-700 bg-amber-50', icon: AlertCircle },
  approval_expired: { label: '审批超时', color: 'text-gray-600 bg-gray-50', icon: CircleSlash },
  pending_policy: { label: '策略中', color: 'text-gray-600 bg-gray-50', icon: Clock },
};

function styleFor(status: string) {
  return STATUS_STYLE[status] ?? { label: status, color: 'text-gray-600 bg-gray-50', icon: CircleSlash };
}

function timeAgo(iso: string): string {
  const t = Date.parse(iso);
  if (!t) return '—';
  const diff = Date.now() - t;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小时前`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} 天前`;
  return new Date(t).toLocaleDateString('zh-CN');
}

function shortenHash(hash?: string): string {
  if (!hash) return '—';
  if (hash.length < 14) return hash;
  return `${hash.slice(0, 6)}…${hash.slice(-4)}`;
}

function baseScanUrl(hash?: string): string | null {
  if (!hash || !hash.startsWith('0x')) return null;
  return `https://basescan.org/tx/${hash}`;
}

/**
 * 区块 4：最近支付记录（最多 6 条）
 * 数据源：/api/credits/balance → topupOrders[]（已按 createdAt 倒序，前 12 条）
 * 字段：createdAt / reason → Agent 名称 / amountUsdcMinor / txHash / status
 */
export default function RecentPaymentsSection() {
  const [orders, setOrders] = useState<TopupOrder[] | null>(null);
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
        const data: SnapshotResponse = await res.json();
        if (!cancelled) setOrders((data.topupOrders ?? []).slice(0, 6));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'fetch failed');
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SectionCard
      title="最近支付记录"
      subtitle="最近 6 条 Topup Order（按时间倒序）"
      loading={orders === null && !error}
    >
      {error ? (
        <p className="text-xs text-red-600">加载失败：{error}</p>
      ) : !orders || orders.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-6">暂无支付记录</p>
      ) : (
        <div className="overflow-x-auto -mx-6 px-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-gray-100">
                <th className="text-left font-medium pb-2 pr-4">时间</th>
                <th className="text-left font-medium pb-2 pr-4">Agent</th>
                <th className="text-right font-medium pb-2 pr-4">金额</th>
                <th className="text-left font-medium pb-2 pr-4">txHash</th>
                <th className="text-left font-medium pb-2">状态</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const s = styleFor(o.status);
                const Icon = s.icon;
                const hashUrl = baseScanUrl(o.txHash);
                return (
                  <tr key={o.id} className="border-b border-gray-50 last:border-b-0">
                    <td className="py-2.5 pr-4 text-gray-600 whitespace-nowrap">{timeAgo(o.createdAt)}</td>
                    <td className="py-2.5 pr-4 text-gray-700">默认 Agent</td>
                    <td className="py-2.5 pr-4 text-right font-mono text-gray-900">
                      {formatUsdc(o.amountUsdcMinor)}
                    </td>
                    <td className="py-2.5 pr-4 font-mono text-xs">
                      {hashUrl ? (
                        <a
                          href={hashUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700"
                        >
                          {shortenHash(o.txHash)}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-gray-400">{shortenHash(o.txHash)}</span>
                      )}
                    </td>
                    <td className="py-2.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${s.color}`}>
                        <Icon className="w-3 h-3" />
                        {s.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}
