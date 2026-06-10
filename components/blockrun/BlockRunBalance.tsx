'use client';

import { useEffect, useState } from 'react';
import { Loader2, RefreshCw, DollarSign, AlertTriangle, Save, CheckCircle2, XCircle } from 'lucide-react';
import SectionCard from '@/components/dashboard/v2/SectionCard';

type BalanceResp = {
  balanceUsdc: number;
  minBalance: number;
  isBelowThreshold: boolean;
  updatedAt?: string;
};

/**
 * BlockRun CAW Wallet USDC Balance
 * - USDC balance display ($X.XX USDC)
 * - Refresh button
 * - Red alert when balance below threshold
 * - Min balance threshold input + save
 *
 * API: GET /api/blockrun/balance
 */
export default function BlockRunBalance() {
  const [data, setData] = useState<BalanceResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [thresholdInput, setThresholdInput] = useState(5);
  const [thresholdSaveStatus, setThresholdSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  async function load() {
    try {
      const res = await fetch('/api/blockrun/balance');
      if (!res.ok) {
        setError(`HTTP ${res.status}`);
        return;
      }
      const json: BalanceResp = await res.json();
      setData(json);
      setThresholdInput(json.minBalance ?? 5);
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

  async function handleSaveThreshold() {
    setThresholdSaveStatus('saving');
    try {
      const res = await fetch('/api/blockrun/config', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ minBalance: thresholdInput }),
      });
      if (res.ok) {
        setThresholdSaveStatus('saved');
        setTimeout(() => setThresholdSaveStatus('idle'), 2000);
        // Refresh balance with new threshold
        await load();
      } else {
        setThresholdSaveStatus('error');
        setTimeout(() => setThresholdSaveStatus('idle'), 3000);
      }
    } catch {
      setThresholdSaveStatus('error');
      setTimeout(() => setThresholdSaveStatus('idle'), 3000);
    }
  }

  return (
    <SectionCard
      title="CAW 钱包余额"
      subtitle="USDC 余额"
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

      {!loading && data && (
        <div className="space-y-4">
          {/* 余额显示 */}
          <div className={`rounded-xl px-4 py-4 ${data.isBelowThreshold ? 'bg-red-50 border border-red-100' : 'bg-emerald-50'}`}>
            <div className="flex items-center gap-2 mb-1.5">
              <DollarSign className={`w-5 h-5 ${data.isBelowThreshold ? 'text-red-500' : 'text-emerald-600'}`} />
              <span className="text-xs font-medium text-gray-700">USDC 余额</span>
              {data.isBelowThreshold && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-100 px-1.5 py-0.5 rounded-full">
                  <AlertTriangle className="w-3 h-3" />
                  不足
                </span>
              )}
            </div>
            <p className={`text-2xl font-bold ${data.isBelowThreshold ? 'text-red-600' : 'text-emerald-700'}`}>
              ${data.balanceUsdc.toFixed(2)} USDC
            </p>
            <p className="text-xs text-gray-500 mt-1">
              最低阈值：${data.minBalance.toFixed(2)} USDC
            </p>
          </div>

          {data.updatedAt && (
            <p className="text-[11px] text-gray-400">
              更新于：{new Date(data.updatedAt).toLocaleString('zh-CN')}
            </p>
          )}

          {/* 最低阈值设置 */}
          <div className="pt-3 border-t border-gray-100">
            <label className="block text-xs font-medium text-gray-500 mb-1.5">最低余额阈值（USDC）</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0.1}
                max={1000}
                step={0.1}
                value={thresholdInput}
                onChange={(e) => setThresholdInput(Number(e.target.value) || 0)}
                className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <span className="text-[11px] text-gray-500">USDC</span>
              <button
                onClick={handleSaveThreshold}
                disabled={thresholdSaveStatus === 'saving'}
                className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {thresholdSaveStatus === 'saving' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                保存阈值
              </button>
              {thresholdSaveStatus === 'saved' && (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                  <CheckCircle2 className="w-3 h-3" />
                  已保存
                </span>
              )}
              {thresholdSaveStatus === 'error' && (
                <span className="inline-flex items-center gap-1 text-xs text-red-600">
                  <XCircle className="w-3 h-3" />
                  保存失败
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 空数据占位 */}
      {!loading && !data && !error && (
        <p className="text-xs text-gray-400 text-center py-4">暂无余额数据</p>
      )}
    </SectionCard>
  );
}
