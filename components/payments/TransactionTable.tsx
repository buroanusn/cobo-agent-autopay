'use client';

import { ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';

type TxRecord = {
  id: string;
  time: string;
  createdAt?: string;
  amount: string;
  token: string;
  usdcMinor?: number;
  txHash: string | null;
  status: string;
  subStatus: string;
};

export default function TransactionTable({ records }: { records: TxRecord[] }) {
  const [page, setPage] = useState(1);
  const perPage = 10;
  const totalPages = Math.max(1, Math.ceil(records.length / perPage));
  const paginated = records.slice((page - 1) * perPage, page * perPage);

  if (!records || records.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm text-center">
        <p className="text-gray-400 text-sm">暂无交易记录</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">时间</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">类型</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">金额 (USDC)</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">交易哈希</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {paginated.map((tx) => (
              <tr key={tx.id} className="hover:bg-gray-50/50">
                <td className="px-6 py-3.5 text-gray-600 whitespace-nowrap">
                  {formatDate(tx.createdAt || tx.time)}
                </td>
                <td className="px-6 py-3.5 text-gray-900 whitespace-nowrap">
                  {tx.token || 'USDC'}
                </td>
                <td className="px-6 py-3.5 font-medium text-gray-900 whitespace-nowrap">
                  {tx.usdcMinor
                    ? `$${(tx.usdcMinor / 1_000_000).toFixed(2)}`
                    : tx.amount
                    ? `$${tx.amount}`
                    : '—'}
                </td>
                <td className="px-6 py-3.5 whitespace-nowrap">
                  {tx.txHash ? (
                    <a
                      href={`https://basescan.org/tx/${tx.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-mono text-xs"
                    >
                      {tx.txHash.slice(0, 10)}...{tx.txHash.slice(-6)}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="px-6 py-3.5 whitespace-nowrap">
                  <StatusBadge status={tx.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100">
          <p className="text-xs text-gray-400">
            第 {page} / {totalPages} 页，共 {records.length} 条
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="p-1.5 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
              className="p-1.5 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; cls: string }> = {
    completed: { label: '成功', cls: 'bg-emerald-50 text-emerald-700' },
    credited: { label: '成功', cls: 'bg-emerald-50 text-emerald-700' },
    failed: { label: '失败', cls: 'bg-red-50 text-red-700' },
    pending: { label: '处理中', cls: 'bg-amber-50 text-amber-700' },
    caw_submitted: { label: '已提交', cls: 'bg-blue-50 text-blue-700' },
    chain_pending: { label: '链上处理中', cls: 'bg-amber-50 text-amber-700' },
    pending_approval: { label: '待审批', cls: 'bg-purple-50 text-purple-700' },
  };
  const match = config[status] || { label: status, cls: 'bg-gray-50 text-gray-600' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${match.cls}`}>
      {match.label}
    </span>
  );
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}
