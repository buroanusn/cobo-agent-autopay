'use client';

import { useEffect, useState } from 'react';
import { Loader2, RefreshCw, DollarSign, Coins, Clock } from 'lucide-react';
import SectionCard from '@/components/dashboard/v2/SectionCard';

type BalanceResp = {
  ok?: boolean;
  balance?: number;
  snapshot?: {
    usdBalance?: number;
    diemBalance?: number;
    epoch?: number | string;
  };
  updatedAt?: string;
  error?: string;
};

const FORMAT_FN: Record<string, (v: unknown) => string> = {
  USD: (v) => (typeof v === 'number' ? `$${v.toFixed(2)}` : '—'),
  DIEM: (v) => (typeof v === 'number' ? v.toString() : '—'),
  Epoch: (v) => (v === undefined || v === null ? '—' : String(v)),
};

const ICON_CLASS: Record<string, string> = {
  USD: 'text-emerald-600',
  DIEM: 'text-amber-600',
  Epoch: 'text-blue-600',
};

const BG_CLASS: Record<string, string> = {
  USD: 'bg-emerald-50',
  DIEM: 'bg-amber-50',
  Epoch: 'bg-blue-50',
};

/**
 * 区块 2：Venice 账户余额
 * - 三列：USD / DIEM / Epoch
 * - 更新时间显示
 * - 刷新按钮
 *
 * 数据源：/api/venice/balance
 *
 * Venice billing API 返回结构不固定，按原始字段尽量展示；
 * 至少展示 USD；DIEM/Epoch 缺失时显示 — 而非报错。
 */
export default function VeniceBalance() {
  const [data, setData] = useState<BalanceResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    try {
      const res = await fetch('/api/venice/balance');
      if (!res.ok) {
        if (res.status === 402 || res.status === 401) {
          // 未配置 API Key 时的常见情况 — 显示占位
          setError(null);
          setData({ ok: false, error: res.status === 402 ? '需要有效 API Key' : '需要鉴权' });
          return;
        }
        setError(`HTTP ${res.status}`);
        return;
      }
      const json: BalanceResp = await res.json();
      setData(json);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'fetch failed');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleRefresh() {
    setRefreshing(true);
    await load();
  }

  const cards = [
    { label: 'USD', value: data?.snapshot?.usdBalance ?? data?.balance, icon: DollarSign, key: 'USD' },
    { label: 'DIEM', value: data?.snapshot?.diemBalance, icon: Coins, key: 'DIEM' },
    { label: 'Epoch', value: data?.snapshot?.epoch, icon: Clock, key: 'Epoch' },
  ];

  return (
    <SectionCard
      title="Venice 账户余额"
      subtitle="USD / DIEM / Epoch 三类余额"
      loading={loading}
      action={
        <button
          onClick={handleRefresh}
          disabled={refreshing || loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {refreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          {refreshing ? '刷新中…' : '刷新余额'}
        </button>
      }
    >
      {error ? (
        <p className="text-xs text-red-600 mb-3">加载失败：{error}</p>
      ) : null}

      {!loading && data?.error && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-3">
          {data.error}。请先在「Venice AI · x402 集成」配置有效 API Key。
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.key} className={`${BG_CLASS[c.key]} rounded-xl px-4 py-3`}>
              <div className="flex items-center gap-2 mb-1.5">
                <Icon className={`w-4 h-4 ${ICON_CLASS[c.key]}`} />
                <span className="text-xs font-medium text-gray-700">{c.label}</span>
              </div>
              <p className={`text-xl font-semibold ${ICON_CLASS[c.key]}`}>
                {FORMAT_FN[c.key](c.value)}
              </p>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-gray-400 mt-3">
        更新时间：{data?.updatedAt ? new Date(data.updatedAt).toLocaleString('zh-CN') : '—'}
      </p>
    </SectionCard>
  );
}
