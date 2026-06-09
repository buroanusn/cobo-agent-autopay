'use client';

import { useEffect, useState, useCallback } from 'react';
import { Loader2, Save } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';

export default function SettingsPage() {
  const [veniceBalance, setVeniceBalance] = useState<number | null>(null);
  const [cawStatus, setCawStatus] = useState<any>(null);
  const [cawPacts, setCawPacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Threshold form state
  const [threshold, setThreshold] = useState<number>(5);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [thresholdLoading, setThresholdLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function loadAll() {
      const timeout = (ms: number) => new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms));
      const safeFetch = (url: string, ms = 5000) =>
        Promise.race([fetch(url).then(r => r.json().catch(() => ({error: 'parse'})), () => ({error: 'fetch'})), timeout(ms)])
          .catch(() => ({error: 'timeout'}));

      const [balData, statusData, pactsData] = await Promise.all([
        safeFetch('/api/venice/balance'),
        safeFetch('/api/wallet/caw/status'),
        safeFetch('/api/wallet/caw/pacts'),
      ]);
      if (cancelled) return;

      if (balData && !balData.error) setVeniceBalance(balData.balance ?? null);
      if (statusData && !statusData.error) setCawStatus(statusData);
      if (pactsData && !pactsData.error) setCawPacts(pactsData?.pacts ?? pactsData?.records ?? []);
      setLoading(false);
    }
    loadAll();
    return () => { cancelled = true; };
  }, []);

  // Load threshold
  useEffect(() => {
    let cancelled = false;
    async function loadThreshold() {
      try {
        const res = await Promise.race([
          fetch('/api/settings'),
          new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000)),
        ]) as Response;
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          if (data.veniceBalanceThreshold !== undefined) {
            setThreshold(Number(data.veniceBalanceThreshold));
          }
        }
      } catch {
        // ignore
      } finally {
        setThresholdLoading(false);
      }
    }
    loadThreshold();
    return () => { cancelled = true; };
  }, []);

  async function handleSaveThreshold() {
    setSaveStatus('saving');
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ veniceBalanceThreshold: threshold }),
      });
      if (res.ok) {
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } else {
        setSaveStatus('error');
        setTimeout(() => setSaveStatus('idle'), 3000);
      }
    } catch {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  }

  const runtime = cawStatus?.runtime;
  const app = cawStatus?.app;

  const content = loading ? (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
    </div>
  ) : (
    <div className="space-y-8">
      {/* Card 1: Auto-topup settings */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">自动充值设置</h3>
        {thresholdLoading ? (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            加载中...
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Venice 余额低于此值时自动充值（USD）
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={0.1}
                max={1000}
                step={0.1}
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="w-32 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent"
              />
              <span className="text-sm text-gray-500">USD</span>
              <button
                onClick={handleSaveThreshold}
                disabled={saveStatus === 'saving'}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#1D4ED8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saveStatus === 'saving' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    保存中...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    保存
                  </>
                )}
              </button>
              {saveStatus === 'saved' && (
                <span className="text-sm text-emerald-600 font-medium">✓ 阈值已保存</span>
              )}
              {saveStatus === 'error' && (
                <span className="text-sm text-red-600 font-medium">保存失败，请重试</span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-2">
              当前阈值将在下次余额轮询时生效（每 60 秒检查一次）
            </p>
          </div>
        )}
      </div>

      {/* Card 2: Venice config */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Venice 配置</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-gray-50">
            <span className="text-sm text-gray-600">API Key</span>
            <span className="text-sm font-mono text-gray-900">
              {runtime?.apiConfigured ? (
                <span className="text-gray-600">已配置</span>
              ) : (
                <span className="text-amber-600">未配置</span>
              )}
            </span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-50">
            <span className="text-sm text-gray-600">x402 余额</span>
            <span className="text-sm font-semibold text-gray-900">
              {veniceBalance !== null ? `$${veniceBalance.toFixed(2)} USD` : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-gray-600">充值地址</span>
            <span className="text-sm font-mono text-gray-600">
              {app?.connectedWalletAddress
                ? `${app.connectedWalletAddress.slice(0, 6)}...${app.connectedWalletAddress.slice(-4)}`
                : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Card 3: CAW wallet info */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">CAW 钱包信息</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-gray-50">
            <span className="text-sm text-gray-600">钱包地址</span>
            <span className="text-sm font-mono text-gray-900">
              {runtime?.walletAddress
                ? `${runtime.walletAddress.slice(0, 6)}...${runtime.walletAddress.slice(-4)}`
                : app?.connectedWalletAddress
                ? `${app.connectedWalletAddress.slice(0, 6)}...${app.connectedWalletAddress.slice(-4)}`
                : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-50">
            <span className="text-sm text-gray-600">运行模式</span>
            <span className="text-sm font-medium text-gray-900">
              {runtime?.mode === 'mock' ? 'Mock' : runtime?.mode === 'http' ? 'HTTP (Real)' : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-50">
            <span className="text-sm text-gray-600">配对状态</span>
            <span className={`text-sm font-medium ${runtime?.walletPaired ? 'text-emerald-600' : 'text-amber-600'}`}>
              {runtime?.walletPaired ? '已配对' : '未配对'}
            </span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-50">
            <span className="text-sm text-gray-600">授权状态</span>
            <span className={`text-sm font-medium ${app?.activeAuthorization ? 'text-emerald-600' : 'text-gray-500'}`}>
              {app?.authorizationStatus === 'active' ? '已授权' : app?.authorizationStatus || '—'}
            </span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-gray-600">活跃 Pact</span>
            <span className="text-sm font-medium text-gray-900">
              {cawPacts.length > 0 ? `${cawPacts.length} 个` : '0 个'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  return <AppLayout title="Settings">{content}</AppLayout>;
}
