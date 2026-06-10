'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, Coins, Inbox, ArrowUpCircle, ArrowDownCircle, Gift } from 'lucide-react';
import SectionCard from '@/components/dashboard/v2/SectionCard';
import { USDC_MINOR_UNITS, CREDITS_PER_USDC } from '@/lib/domain/constants';
import { formatUsdc } from '@/lib/domain/money';

type LedgerEntry = {
  id: string;
  type: 'opening_grant' | 'agent_usage' | 'auto_topup';
  creditsDelta: number;
  balanceAfterCredits: number;
  usdcMinor?: number;
  orderId?: string;
  createdAt: string;
};

type Snapshot = {
  account?: {
    balanceCredits: number;
    lowBalanceThresholdCredits: number;
    autoTopupCredits: number;
  };
  ledgerEntries?: LedgerEntry[];
};

const TYPE_LABEL: Record<string, string> = {
  opening_grant: '初始赠送',
  agent_usage: 'Agent 消耗',
  auto_topup: '充值到账',
};

const TYPE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  opening_grant: Gift,
  agent_usage: ArrowDownCircle,
  auto_topup: ArrowUpCircle,
};

const TYPE_COLOR: Record<string, string> = {
  opening_grant: 'text-gray-600 bg-gray-50',
  agent_usage: 'text-red-700 bg-red-50',
  auto_topup: 'text-emerald-700 bg-emerald-50',
};

/**
 * 区块 4：积分账户
 * - 状态：余额充足 / 低于阈值
 * - 余额 / 阈值 / 自动充值
 * - 最近账本 12 条
 *
 * 数据源：/api/credits/balance → account + ledgerEntries
 */
export default function CreditAccount() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/credits/balance');
        if (res.ok) {
          const data: Snapshot = await res.json();
          if (!cancelled) setSnapshot(data);
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

  const account = snapshot?.account;
  const ledger = snapshot?.ledgerEntries ?? [];
  const balance = account?.balanceCredits ?? 0;
  const threshold = account?.lowBalanceThresholdCredits ?? 0;
  const autoTopup = account?.autoTopupCredits ?? 0;
  const isLow = balance < threshold;

  return (
    <SectionCard
      title="积分账户"
      subtitle="站内积分余额、阈值与最近账本"
      loading={loading}
    >
      {account && (
        <>
          {/* 状态徽标 */}
          <div className="flex items-center gap-2 mb-4">
            {isLow ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 px-2.5 py-1 rounded">
                <AlertTriangle className="w-3.5 h-3.5" />
                余额低于阈值
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded">
                <CheckCircle2 className="w-3.5 h-3.5" />
                余额充足
              </span>
            )}
          </div>

          {/* 3 指标 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
            <div className="rounded-lg bg-indigo-50 px-4 py-3">
              <div className="flex items-center gap-2 mb-1">
                <Coins className="w-4 h-4 text-indigo-600" />
                <span className="text-xs font-medium text-gray-700">余额</span>
              </div>
              <p className="text-xl font-semibold text-indigo-600">
                {balance.toLocaleString()}
              </p>
            </div>
            <div className="rounded-lg bg-gray-50 px-4 py-3">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4 text-gray-500" />
                <span className="text-xs font-medium text-gray-700">阈值</span>
              </div>
              <p className="text-xl font-semibold text-gray-900">
                {threshold.toLocaleString()}
              </p>
            </div>
            <div className="rounded-lg bg-gray-50 px-4 py-3">
              <div className="flex items-center gap-2 mb-1">
                <ArrowUpCircle className="w-4 h-4 text-gray-500" />
                <span className="text-xs font-medium text-gray-700">自动充值</span>
              </div>
              <p className="text-xl font-semibold text-gray-900">
                {autoTopup.toLocaleString()}
              </p>
              <p className="text-[11px] text-gray-500 mt-0.5">
                ≈ {formatUsdc(Math.ceil((autoTopup * USDC_MINOR_UNITS) / CREDITS_PER_USDC))} USDC
              </p>
            </div>
          </div>
        </>
      )}

      {/* 最近账本 */}
      <div>
        <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600 mb-2">
          <Inbox className="w-3.5 h-3.5" />
          最近账本（最多 12 条）
        </div>
        {ledger.length === 0 ? (
          <p className="text-xs text-gray-500 text-center py-4">暂无账本记录</p>
        ) : (
          <div className="space-y-1.5">
            {ledger.slice(0, 12).map((e) => {
              const Icon = TYPE_ICON[e.type] ?? Coins;
              const colorCls = TYPE_COLOR[e.type] ?? 'text-gray-600 bg-gray-50';
              const label = TYPE_LABEL[e.type] ?? e.type;
              const isPositive = e.creditsDelta > 0;
              return (
                <div
                  key={e.id}
                  className="flex items-center justify-between px-3 py-2 rounded-lg border border-gray-100 bg-white"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium ${colorCls}`}>
                      <Icon className="w-3 h-3" />
                      {label}
                    </span>
                    <span className={`text-sm font-mono ${isPositive ? 'text-emerald-700' : 'text-red-700'}`}>
                      {isPositive ? '+' : ''}{e.creditsDelta.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-gray-500 flex-shrink-0">
                    {e.usdcMinor !== undefined && e.usdcMinor > 0 && (
                      <span>{formatUsdc(e.usdcMinor)} USDC</span>
                    )}
                    <span>余额 {e.balanceAfterCredits.toLocaleString()}</span>
                    <span className="font-mono">{new Date(e.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </SectionCard>
  );
}
