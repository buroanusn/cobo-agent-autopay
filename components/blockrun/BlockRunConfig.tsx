'use client';

import { useEffect, useState } from 'react';
import { Zap, Loader2, Save, CheckCircle2, XCircle, Globe, Server } from 'lucide-react';
import SectionCard from '@/components/dashboard/v2/SectionCard';

type BlockRunConfig = {
  configured: boolean;
  model: string;
  useTestnet: boolean;
  minBalance: number;
};

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/**
 * BlockRun · x402 Config
 * - Status: configured / not configured
 * - Environment: Mainnet / Testnet (radio)
 * - Model ID input (default: openai/gpt-oss-20b)
 * - Save button
 * - Current status display
 *
 * API: GET/POST /api/blockrun/config
 */
export default function BlockRunConfig() {
  const [config, setConfig] = useState<BlockRunConfig | null>(null);
  const [model, setModel] = useState('openai/gpt-oss-20b');
  const [useTestnet, setUseTestnet] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/blockrun/config');
        if (!res.ok) {
          if (!cancelled) setLoadError(`HTTP ${res.status}`);
          return;
        }
        const data: BlockRunConfig = await res.json();
        if (!cancelled) {
          setConfig(data);
          setModel(data.model);
          setUseTestnet(data.useTestnet);
        }
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'fetch failed');
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
      const res = await fetch('/api/blockrun/config', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model, useTestnet }),
      });
      if (res.ok) {
        const data: BlockRunConfig = await res.json();
        setConfig(data);
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

  const isConfigured = config?.configured === true;

  return (
    <SectionCard
      title="BlockRun · x402 集成"
      subtitle="模型配置与网络设置"
    >
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          加载中...
        </div>
      ) : loadError ? (
        <p className="text-xs text-red-600">加载失败：{loadError}</p>
      ) : (
        <div className="space-y-4">
          {/* 状态标签 */}
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-gray-500" />
            <span className="text-xs text-gray-500">状态：</span>
            {isConfigured ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                <CheckCircle2 className="w-3.5 h-3.5" />
                已配置
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
                <XCircle className="w-3.5 h-3.5" />
                未配置
              </span>
            )}
          </div>

          {/* 环境切换 */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">网络环境</label>
            <div className="inline-flex rounded-lg border border-gray-300 bg-white p-0.5">
              <button
                onClick={() => setUseTestnet(false)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  !useTestnet
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                主网
              </button>
              <button
                onClick={() => setUseTestnet(true)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  useTestnet
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Server className="w-3.5 h-3.5" />
                测试网
              </button>
            </div>
            <p className="text-[11px] text-gray-400 mt-1.5">
              {useTestnet
                ? '测试网 (Base Sepolia) — 推荐开发阶段使用'
                : '主网 (Base Mainnet) — 真实 USDC 交易'}
            </p>
          </div>

          {/* 模型 ID 输入 */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">模型 ID</label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
            />
          </div>

          {/* 保存按钮 + 当前状态 */}
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={handleSave}
              disabled={saveStatus === 'saving'}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
              <span className="inline-flex items-center gap-1 text-sm text-emerald-600 font-medium">
                <CheckCircle2 className="w-4 h-4" />
                已保存
              </span>
            )}
            {saveStatus === 'error' && (
              <span className="inline-flex items-center gap-1 text-sm text-red-600 font-medium">
                <XCircle className="w-4 h-4" />
                保存失败，请重试
              </span>
            )}
            <span className="text-[11px] text-gray-400">
              当前：{isConfigured ? '已配置' : '未设置'} · 模型：{model} · {useTestnet ? '测试网' : '主网'}
            </span>
          </div>
        </div>
      )}
    </SectionCard>
  );
}
