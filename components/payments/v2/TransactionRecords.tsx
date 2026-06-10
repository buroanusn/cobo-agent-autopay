'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  CircleSlash,
  CheckCircle2,
  Clock,
  Send,
  XCircle,
  AlertCircle,
  Inbox,
} from 'lucide-react';
import SectionCard from '@/components/dashboard/v2/SectionCard';
import { formatUsdc } from '@/lib/domain/money';

type CawTxRecord = {
  id: string;
  walletId: string;
  pactId?: string;
  type: string;
  requestType?: string;
  chainId: string;
  tokenId: string;
  from: string;
  to: string;
  amount: string;
  status: string;
  statusCode?: number;
  subStatus?: string;
  txHash?: string;
  requestId?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
};

type TopupOrder = {
  id: string;
  orderId?: string;
  amountUsdcMinor: number;
  status: string;
  reason: string;
  createdAt: string;
  txHash?: string;
  walletAddress: string;
};

type TxStatus =
  | 'success' // credited / completed
  | 'failed' // failed
  | 'processing' // pending (CAW) / pending_policy
  | 'submitted' // caw_submitted
  | 'chain_pending' // chain_pending
  | 'pending_approval' // pending_approval
  | 'expired'; // approval_expired

type TxRow = {
  id: string;
  source: 'caw' | 'topup';
  createdAt: string;
  agent: string;          // 文档要求 Agent 列；现在固定 "默认 Agent"
  type: string;
  amountText: string;     // e.g. "$1.00" / "1.00 USDC"
  txHash?: string;
  status: TxStatus;
  statusLabel: string;
};

const STATUS_STYLE: Record<TxStatus, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  success: { label: '成功', color: 'text-emerald-700 bg-emerald-50', icon: CheckCircle2 },
  failed: { label: '失败', color: 'text-red-700 bg-red-50', icon: XCircle },
  processing: { label: '处理中', color: 'text-amber-700 bg-amber-50', icon: Clock },
  submitted: { label: '已提交', color: 'text-blue-700 bg-blue-50', icon: Send },
  chain_pending: { label: '链上处理中', color: 'text-blue-700 bg-blue-50', icon: Clock },
  pending_approval: { label: '待审批', color: 'text-purple-700 bg-purple-50', icon: AlertCircle },
  expired: { label: '审批超时', color: 'text-gray-600 bg-gray-50', icon: CircleSlash },
};

function mapTopupStatus(s: string): TxStatus {
  switch (s) {
    case 'credited': return 'success';
    case 'failed': return 'failed';
    case 'pending_policy': return 'processing';
    case 'caw_submitted': return 'submitted';
    case 'chain_pending': return 'chain_pending';
    case 'pending_approval': return 'pending_approval';
    case 'approval_expired': return 'expired';
    default: return 'processing';
  }
}

function mapCawStatus(s: string): TxStatus {
  const v = s.toLowerCase();
  if (v === 'success' || v === 'completed' || v === 'credited') return 'success';
  if (v === 'failed' || v === 'failure' || v === 'rejected') return 'failed';
  if (v === 'submitted' || v === 'caw_submitted') return 'submitted';
  if (v === 'chain_pending' || v === 'pending_onchain') return 'chain_pending';
  if (v === 'pending_approval' || v === 'pending_user_approval') return 'pending_approval';
  if (v === 'expired' || v === 'approval_expired') return 'expired';
  return 'processing';
}

function shortHash(h?: string): string {
  if (!h) return '—';
  if (h.length < 14) return h;
  return `${h.slice(0, 6)}…${h.slice(-4)}`;
}

function baseScanUrl(h?: string): string | null {
  if (!h || !h.startsWith('0x')) return null;
  return `https://basescan.org/tx/${h}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

/**
 * 区块 5：完整交易记录
 * 数据源（双源 + 兜底）：
 *   1) /api/wallet/caw/transactions?limit=100  （需要绑定 CAW wallet，否则 500）
 *   2) /api/credits/balance → topupOrders[]    （兜底，永远有）
 *
 * 文档要求：分页（每页 10 条）+ 7 种状态 + BaseScan 可点 + Agent 名称列
 */
export default function TransactionRecords() {
  const [rows, setRows] = useState<TxRow[] | null>(null);
  const [cawError, setCawError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const perPage = 10;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // 双源
      const [cawResult, snapshotResult] = await Promise.allSettled([
        fetch('/api/wallet/caw/transactions?limit=100'),
        fetch('/api/credits/balance'),
      ]);

      const out: TxRow[] = [];

      // 1) CAW tx records
      if (cawResult.status === 'fulfilled' && cawResult.value.ok) {
        try {
          const data = await cawResult.value.json();
          const records: CawTxRecord[] = data?.records ?? [];
          for (const r of records) {
            const status = mapCawStatus(r.status);
            out.push({
              id: r.id,
              source: 'caw',
              createdAt: r.createdAt,
              agent: '默认 Agent',
              type: r.type || r.requestType || r.tokenId || 'CAW',
              amountText: r.amount || (r.tokenId ? `0 ${r.tokenId}` : '—'),
              txHash: r.txHash,
              status,
              statusLabel: STATUS_STYLE[status].label,
            });
          }
        } catch {
          // ignore parse error
        }
      } else if (cawResult.status === 'fulfilled') {
        if (!cancelled) setCawError(`CAW tx API HTTP ${cawResult.value.status}`);
      } else {
        if (!cancelled) setCawError(cawResult.reason?.message ?? 'CAW tx fetch failed');
      }

      // 2) topupOrders 兜底
      if (snapshotResult.status === 'fulfilled' && snapshotResult.value.ok) {
        try {
          const data = await snapshotResult.value.json();
          const orders: TopupOrder[] = data?.topupOrders ?? [];
          for (const o of orders) {
            const status = mapTopupStatus(o.status);
            out.push({
              id: o.id,
              source: 'topup',
              createdAt: o.createdAt,
              agent: '默认 Agent',
              type: o.reason === 'manual' ? '手动充值' : '自动充值',
              amountText: `$${formatUsdc(o.amountUsdcMinor)}`,
              txHash: o.txHash,
              status,
              statusLabel: STATUS_STYLE[status].label,
            });
          }
        } catch {
          // ignore
        }
      }

      // 按时间倒序
      out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

      if (!cancelled) setRows(out);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const totalPages = useMemo(() => {
    if (!rows) return 1;
    return Math.max(1, Math.ceil(rows.length / perPage));
  }, [rows]);

  const paginated = useMemo(() => {
    if (!rows) return [];
    return rows.slice((page - 1) * perPage, page * perPage);
  }, [rows, page]);

  const loading = rows === null;

  return (
    <SectionCard
      title="完整交易记录"
      subtitle={
        cawError
          ? 'CAW 交易记录不可用，以下为 topup orders 兜底'
          : 'CAW 交易 + topup orders（按时间倒序）'
      }
      loading={loading}
    >
      {!loading && rows && rows.length === 0 ? (
        <div className="py-8 text-center text-sm text-gray-500">
          <Inbox className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          暂无交易记录
        </div>
      ) : (
        <>
          <div className="overflow-x-auto -mx-6 px-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-gray-100">
                  <th className="text-left font-medium pb-2 pr-4">时间</th>
                  <th className="text-left font-medium pb-2 pr-4">Agent</th>
                  <th className="text-left font-medium pb-2 pr-4">类型</th>
                  <th className="text-right font-medium pb-2 pr-4">金额 (USDC)</th>
                  <th className="text-left font-medium pb-2 pr-4">txHash</th>
                  <th className="text-left font-medium pb-2">状态</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((r) => {
                  const s = STATUS_STYLE[r.status];
                  const Icon = s.icon;
                  const url = baseScanUrl(r.txHash);
                  return (
                    <tr key={`${r.source}-${r.id}`} className="border-b border-gray-50 last:border-b-0">
                      <td className="py-2.5 pr-4 text-gray-600 whitespace-nowrap">
                        {formatDate(r.createdAt)}
                      </td>
                      <td className="py-2.5 pr-4 text-gray-700">{r.agent}</td>
                      <td className="py-2.5 pr-4 text-gray-700 whitespace-nowrap">{r.type}</td>
                      <td className="py-2.5 pr-4 text-right font-mono text-gray-900 whitespace-nowrap">
                        {r.amountText}
                      </td>
                      <td className="py-2.5 pr-4 font-mono text-xs">
                        {url ? (
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700"
                          >
                            {shortHash(r.txHash)}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-gray-400">{shortHash(r.txHash)}</span>
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-500">
                第 {page} / {totalPages} 页，共 {rows!.length} 条
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  上一页
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  下一页
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </SectionCard>
  );
}
