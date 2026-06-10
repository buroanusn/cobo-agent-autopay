'use client';

import { useEffect, useState } from 'react';
import { Wallet, Coins, Activity, CalendarClock } from 'lucide-react';
import StatCard from './StatCard';

type BalanceResponse = { ok?: boolean; balance?: number; snapshot?: { usdBalance?: number } };
type SnapshotResponse = {
  account?: { balanceCredits?: number };
  paymentStats?: { txCount30d?: number };
};

type Stats = {
  veniceBalance: number | null;
  cawAddress: string | null;
  monthlyTopups: number | null;
  creditBalance: number | null;
};

function shortAddr(addr: string | null | undefined): string | null {
  if (!addr) return null;
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/**
 * 区块 1：4 个数据卡
 * - Venice 余额：/api/venice/balance
 * - CAW 钱包地址：/api/wallet/caw/status
 * - 本月充值次数：/api/credits/balance → paymentStats.txCount30d
 * - 积分余额：/api/credits/balance → account.balanceCredits
 */
export default function StatsSection() {
  const [stats, setStats] = useState<Stats>({
    veniceBalance: null,
    cawAddress: null,
    monthlyTopups: null,
    creditBalance: null,
  });
  const [loading, setLoading] = useState({
    venice: true,
    caw: true,
    credits: true,
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // 3 个独立 fetch 改成 Promise.allSettled 并行，避免串行等待
      const [balanceRes, statusRes, creditsRes] = await Promise.allSettled([
        fetch('/api/venice/balance'),
        fetch('/api/wallet/caw/status'),
        fetch('/api/credits/balance'),
      ]);

      // Venice balance
      if (balanceRes.status === 'fulfilled') {
        try {
          const data: BalanceResponse = await balanceRes.value.json();
          if (!cancelled) {
            setStats((s) => ({
              ...s,
              veniceBalance: data.balance ?? data.snapshot?.usdBalance ?? null,
            }));
          }
        } catch {
          // 静默 — 卡片单独显示失败态
        }
      }
      if (!cancelled) setLoading((l) => ({ ...l, venice: false }));

      // CAW status
      if (statusRes.status === 'fulfilled') {
        try {
          const data = await statusRes.value.json();
          if (!cancelled) {
            setStats((s) => ({
              ...s,
              cawAddress: data?.app?.connectedWalletAddress ?? data?.runtime?.walletAddress ?? null,
            }));
          }
        } catch {
          // ignore
        }
      }
      if (!cancelled) setLoading((l) => ({ ...l, caw: false }));

      // Credits / snapshot
      if (creditsRes.status === 'fulfilled') {
        try {
          const data: SnapshotResponse = await creditsRes.value.json();
          if (!cancelled) {
            setStats((s) => ({
              ...s,
              monthlyTopups: data.paymentStats?.txCount30d ?? null,
              creditBalance: data.account?.balanceCredits ?? null,
            }));
          }
        } catch {
          // ignore
        }
      }
      if (!cancelled) setLoading((l) => ({ ...l, credits: false }));
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <StatCard
        label="Venice 余额"
        value={stats.veniceBalance !== null ? `$${stats.veniceBalance.toFixed(2)}` : '—'}
        icon={Activity}
        iconClass="text-emerald-600"
        iconBg="bg-emerald-50"
        loading={loading.venice}
        hint={stats.veniceBalance !== null ? 'USD' : '未配置 API Key'}
      />
      <StatCard
        label="CAW 钱包地址"
        value={shortAddr(stats.cawAddress) ?? '未配置'}
        icon={Wallet}
        iconClass="text-blue-600"
        iconBg="bg-blue-50"
        loading={loading.caw}
        hint={stats.cawAddress ? 'Base' : '需绑定'}
      />
      <StatCard
        label="本月充值次数"
        value={stats.monthlyTopups !== null ? `${stats.monthlyTopups} 笔` : '—'}
        icon={CalendarClock}
        iconClass="text-purple-600"
        iconBg="bg-purple-50"
        loading={loading.credits}
        hint="近 30 天"
      />
      <StatCard
        label="积分余额"
        value={stats.creditBalance !== null ? stats.creditBalance.toLocaleString() : '—'}
        icon={Coins}
        iconClass="text-indigo-600"
        iconBg="bg-indigo-50"
        loading={loading.credits}
        hint="站内积分"
      />
    </div>
  );
}
