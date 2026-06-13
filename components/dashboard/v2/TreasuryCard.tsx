'use client';

import { useEffect, useState } from 'react';
import { ShieldCheck, ArrowRightLeft, Loader2 } from 'lucide-react';

type SweepStatus = {
  treasuryStatus?: string;
  treasuryLastAmount?: number | null;
  treasuryLastTransferAt?: string | null;
};

/**
 * Dashboard 区块：Treasury 互充状态卡片
 * 从 /api/credits/topup/sweep-status 读取 treasuryStatus 字段
 */
export default function TreasuryCard() {
  const [status, setStatus] = useState<SweepStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/credits/topup/sweep-status');
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) {
            setStatus({
              treasuryStatus: data.treasuryStatus,
              treasuryLastAmount: data.treasuryLastAmount,
              treasuryLastTransferAt: data.treasuryLastTransferAt,
            });
          }
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    // 每 30 秒刷新
    const timer = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
    idle: { label: '待命', color: 'text-gray-500', bg: 'bg-gray-100' },
    transferring: { label: '转账中', color: 'text-blue-600', bg: 'bg-blue-50' },
    completed: { label: '已完成', color: 'text-emerald-600', bg: 'bg-emerald-50' },
    failed: { label: '失败', color: 'text-red-600', bg: 'bg-red-50' },
  };

  const current = status?.treasuryStatus
    ? statusConfig[status.treasuryStatus] ?? statusConfig.idle
    : null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="bg-blue-50 p-2.5 rounded-lg flex-shrink-0">
          <ArrowRightLeft className="w-5 h-5 text-blue-600" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-gray-500 font-medium">Treasury 互充</p>
          {loading ? (
            <Loader2 className="w-4 h-4 text-gray-300 animate-spin mt-1" />
          ) : current ? (
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`inline-flex items-center gap-1 text-sm font-semibold ${current.color}`}>
                <ShieldCheck className="w-3.5 h-3.5" />
                {current.label}
              </span>
              {status?.treasuryLastAmount && (
                <span className="text-xs text-gray-400">
                  {status.treasuryLastAmount} USDC
                </span>
              )}
            </div>
          ) : (
            <p className="text-sm font-semibold mt-0.5 text-gray-400">未配置</p>
          )}
          {!loading && status?.treasuryLastTransferAt && (
            <p className="text-[11px] text-gray-400 mt-0.5">
              上次：{new Date(status.treasuryLastTransferAt).toLocaleString()}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
