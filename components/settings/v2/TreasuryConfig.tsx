'use client';

import { useEffect, useState } from 'react';
import { Loader2, Save, CheckCircle2, XCircle, ShieldCheck } from 'lucide-react';
import SectionCard from '@/components/dashboard/v2/SectionCard';

type TreasuryData = {
  apiKey: string;
  apiKeySet: boolean;
  apiUrl: string;
  pactId: string;
  topupAmount: number;
  treasuryStatus: string;
  treasuryLastAmount: number | null;
  treasuryLastTransferAt: string | null;
};

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/**
 * Settings 区块：Treasury 配置
 * - 4 字段表单：API Key / API URL / Pact ID / 充值金额
 * - API Key 脱敏显示，修改时才发送完整值
 * - 底部展示互充状态
 */
export default function TreasuryConfig() {
  const [data, setData] = useState<TreasuryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  // 表单状态（可编辑）
  const [apiKey, setApiKey] = useState('');
  const [apiUrl, setApiUrl] = useState('');
  const [pactId, setPactId] = useState('');
  const [topupAmount, setTopupAmount] = useState(20);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/settings/treasury');
        if (!res.ok) {
          if (!cancelled) setError(`HTTP ${res.status}`);
          return;
        }
        const d: TreasuryData = await res.json();
        if (!cancelled) {
          setData(d);
          setApiKey(d.apiKey || '');
          setApiUrl(d.apiUrl || '');
          setPactId(d.pactId || '');
          setTopupAmount(d.topupAmount || 20);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'fetch failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  async function handleSave() {
    setSaveStatus('saving');
    try {
      const res = await fetch('/api/settings/treasury', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          apiKey: apiKey.includes('*') ? undefined : apiKey,
          apiUrl,
          pactId,
          topupAmount,
        }),
      });
      if (res.ok) {
        setSaveStatus('saved');
        // 重新加载以获取脱敏后的 key
        const fresh = await fetch('/api/settings/treasury');
        if (fresh.ok) {
          const d: TreasuryData = await fresh.json();
          setData(d);
          setApiKey(d.apiKey || '');
        }
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

  const statusLabel: Record<string, { text: string; color: string }> = {
    idle: { text: '空闲', color: 'text-gray-500' },
    transferring: { text: '转账中…', color: 'text-blue-600' },
    completed: { text: '已完成', color: 'text-emerald-600' },
    failed: { text: '失败', color: 'text-red-600' },
  };

  return (
    <SectionCard
      title="Treasury 钱包配置"
      subtitle="Spending 钱包 USDC 不足时，Treasury 自动补充（Base Mainnet）"
    >
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          加载中…
        </div>
      ) : error ? (
        <p className="text-sm text-red-500">{error}</p>
      ) : (
        <div className="space-y-4">
          {/* API Key */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Treasury API Key
            </label>
            <input
              type="text"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-xxxx 或 AGENT_..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {data?.apiKeySet && (
              <p className="text-[11px] text-gray-400 mt-1">
                已配置：{data.apiKey}（留空则保留原值）
              </p>
            )}
          </div>

          {/* API URL */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Treasury API URL（可选）
            </label>
            <input
              type="text"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="默认使用 CAW_API_URL"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Pact ID */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Treasury Pact ID
            </label>
            <input
              type="text"
              value={pactId}
              onChange={(e) => setPactId(e.target.value)}
              placeholder="Cobo Pact UUID"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Top-up Amount */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              每次互充金额（USDC）
            </label>
            <input
              type="number"
              value={topupAmount}
              onChange={(e) => setTopupAmount(Number(e.target.value))}
              min={1}
              max={50}
              className="w-32 rounded-lg border border-gray-300 px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-[11px] text-gray-400 mt-1">
              受 Pact 限额保护，单笔最高 50 USDC
            </p>
          </div>

          {/* 互充状态 */}
          {data && data.treasuryStatus !== 'idle' && (
            <div className="rounded-lg bg-gray-50 border border-gray-200 p-3">
              <div className="flex items-center gap-2 text-xs">
                <ShieldCheck className="w-4 h-4 text-blue-500" />
                <span className="font-medium text-gray-700">互充状态：</span>
                <span className={statusLabel[data.treasuryStatus]?.color ?? 'text-gray-500'}>
                  {statusLabel[data.treasuryStatus]?.text ?? data.treasuryStatus}
                </span>
                {data.treasuryLastAmount && (
                  <span className="text-gray-400">
                    · {data.treasuryLastAmount} USDC
                  </span>
                )}
                {data.treasuryLastTransferAt && (
                  <span className="text-gray-400">
                    · {new Date(data.treasuryLastTransferAt).toLocaleTimeString()}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* 保存按钮 */}
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={handleSave}
              disabled={saveStatus === 'saving'}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2
                         text-sm font-medium text-white hover:bg-blue-700
                         disabled:opacity-50 transition-colors"
            >
              {saveStatus === 'saving' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              保存
            </button>
            {saveStatus === 'saved' && (
              <span className="flex items-center gap-1 text-sm text-emerald-600">
                <CheckCircle2 className="w-4 h-4" /> 已保存
              </span>
            )}
            {saveStatus === 'error' && (
              <span className="flex items-center gap-1 text-sm text-red-500">
                <XCircle className="w-4 h-4" /> 保存失败
              </span>
            )}
          </div>
        </div>
      )}
    </SectionCard>
  );
}
