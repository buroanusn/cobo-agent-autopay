'use client';

import { useEffect, useState } from 'react';
import { Loader2, RefreshCw, DollarSign } from 'lucide-react';
import SectionCard from '@/components/dashboard/v2/SectionCard';

type VeniceBalanceResp = {
  success?: boolean;
  data?: {
    walletAddress?: string;
    balanceUsd?: number;
    canConsume?: boolean;
    minimumTopUpUsd?: number;
    suggestedTopUpUsd?: number;
  };
  error?: string;
};

export default function VeniceBalance() {
  const [data, setData] = useState<VeniceBalanceResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    try {
      const res = await fetch('/api/venice/balance');
      if (!res.ok) {
        if (res.status === 402 || res.status === 401) {
          setError(null);
          setData({ success: false, error: res.status === 402 ? '需要有效 API Key' : '需要鉴权' });
          return;
        }
        setError(`HTTP ${res.status}`);
        return;
      }
      const json: VeniceBalanceResp = await res.json();
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

  const balanceUsd = data?.data?.balanceUsd;

  return (
    <SectionCard
      title="Venice 账户余额"
      subtitle="USD 余额"
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

      <div className="rounded-xl bg-emerald-50 px-4 py-3">
        <div className="flex items-center gap-2 mb-1.5">
          <DollarSign className="w-4 h-4 text-emerald-600" />
          <span className="text-xs font-medium text-gray-700">USD</span>
        </div>
        <p className="text-xl font-semibold text-emerald-600">
          {balanceUsd !== undefined ? `$${balanceUsd.toFixed(2)}` : '—'}
        </p>
      </div>
    </SectionCard>
  );
}
