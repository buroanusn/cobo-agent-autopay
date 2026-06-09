'use client';

import { ExternalLink } from 'lucide-react';

type LedgerEntry = {
  id: string;
  createdAt: string;
  type: string;
  usdcMinor?: number;
  txHash?: string;
  status?: string;
};

export default function RecentPayments({ entries }: { entries: LedgerEntry[] }) {
  if (!entries || entries.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm text-center">
        <p className="text-gray-400 text-sm">暂无支付记录</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900">最近支付记录</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">时间</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">金额 (USDC)</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">交易哈希</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {entries.slice(0, 6).map((entry) => (
              <tr key={entry.id} className="hover:bg-gray-50/50">
                <td className="px-6 py-3.5 text-gray-600 whitespace-nowrap">
                  {formatDate(entry.createdAt)}
                </td>
                <td className="px-6 py-3.5 font-medium text-gray-900 whitespace-nowrap">
                  {entry.usdcMinor ? `$${(entry.usdcMinor / 1_000_000).toFixed(2)}` : '—'}
                </td>
                <td className="px-6 py-3.5 whitespace-nowrap">
                  {entry.txHash ? (
                    <a
                      href={`https://basescan.org/tx/${entry.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-mono text-xs"
                    >
                      {entry.txHash.slice(0, 10)}...{entry.txHash.slice(-6)}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="px-6 py-3.5 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    entry.status === 'credited' || entry.status === 'completed'
                      ? 'bg-emerald-50 text-emerald-700'
                      : entry.status === 'failed'
                      ? 'bg-red-50 text-red-700'
                      : 'bg-amber-50 text-amber-700'
                  }`}>
                    {entry.status === 'credited' || entry.status === 'completed' ? '成功'
                      : entry.status === 'failed' ? '失败'
                      : '处理中'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-6 py-3 border-t border-gray-100 text-xs text-gray-400 text-right">
        仅显示最近 6 条
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}
