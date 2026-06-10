'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Activity, Coins, Fuel } from 'lucide-react';
import SectionCard from '@/components/dashboard/v2/SectionCard';
import { formatUsdc } from '@/lib/domain/money';

type StatusResp = {
  spendReadiness?: {
    requiredUsdcMinor?: number;
    remainingUsdcMinor?: number;
    allowanceUsdcMinor?: number;
    walletUsdcMinor?: number;
    gasEth?: string;
    pactExpiresAt?: string;
    error?: string;
  };
  missing?: string[];
  readyForRealPayment?: boolean;
};

/**
 * 区块 6：支付就绪
 * 文档要求：下一笔需要 / Pact 剩余 / USDC 授权 / Gas / 缺少配置列表
 *
 * 数据源：/api/wallet/caw/status → spendReadiness + missing
 */
export default function PaymentReadiness() {
  const [status, setStatus] = useState<StatusResp | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/wallet/caw/status');
        if (res.ok) {
          const data: StatusResp = await res.json();
          if (!cancelled) setStatus(data);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const r = status?.spendReadiness;
  const ready = status?.readyForRealPayment === true;
  const missing = status?.missing ?? [];

  return (
    <SectionCard
      title="支付就绪"
      subtitle="下一笔支付需要检查的 4 项指标"
      loading={loading}
    >
      {r?.error && (
        <div className="mb-3 flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 text-xs text-amber-700">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>链上读数不可用：{r.error}</span>
        </div>
      )}

      <div className="space-y-3">
        {/* 4 项指标 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-lg bg-gray-50 px-3 py-2.5">
            <p className="text-[11px] text-gray-500 flex items-center gap-1">
              <Activity className="w-3 h-3" />
              下一笔需要
            </p>
            <p className="text-sm font-semibold text-gray-900 mt-0.5">
              {r?.requiredUsdcMinor !== undefined ? `$${formatUsdc(r.requiredUsdcMinor)}` : '—'}
            </p>
          </div>
          <div className="rounded-lg bg-gray-50 px-3 py-2.5">
            <p className="text-[11px] text-gray-500">Pact 剩余</p>
            <p className="text-sm font-semibold text-gray-900 mt-0.5">
              {r?.remainingUsdcMinor !== undefined ? `$${formatUsdc(r.remainingUsdcMinor)}` : '—'}
            </p>
          </div>
          <div className="rounded-lg bg-gray-50 px-3 py-2.5">
            <p className="text-[11px] text-gray-500 flex items-center gap-1">
              <Coins className="w-3 h-3" />
              USDC 授权
            </p>
            <p className="text-sm font-semibold text-gray-900 mt-0.5">
              {r?.allowanceUsdcMinor !== undefined ? `$${formatUsdc(r.allowanceUsdcMinor)}` : '—'}
            </p>
          </div>
          <div className="rounded-lg bg-gray-50 px-3 py-2.5">
            <p className="text-[11px] text-gray-500 flex items-center gap-1">
              <Fuel className="w-3 h-3" />
              Gas
            </p>
            <p className="text-sm font-semibold text-gray-900 mt-0.5">{r?.gasEth ?? '—'}</p>
          </div>
        </div>

        {/* 状态徽标 */}
        <div className="flex items-center gap-2">
          {ready ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded">
              <CheckCircle2 className="w-3.5 h-3.5" />
              全部就绪，可执行真实支付
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 px-2.5 py-1 rounded">
              <AlertTriangle className="w-3.5 h-3.5" />
              存在阻塞项，需先修复
            </span>
          )}
        </div>

        {/* 缺少配置列表 */}
        {missing.length > 0 && (
          <div>
            <p className="text-xs font-medium text-red-600 mb-1.5">缺少配置：</p>
            <div className="flex flex-wrap gap-1.5">
              {missing.map((m, i) => (
                <span
                  key={i}
                  className="text-[11px] px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-100"
                >
                  {m}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  );
}
