'use client';

import { useEffect, useState } from 'react';
import { Key, Loader2, Save, CheckCircle2, XCircle } from 'lucide-react';
import SectionCard from '@/components/dashboard/v2/SectionCard';

type ConfigResp = {
  veniceApiKeyConfigured: boolean;
  veniceApiKeyMasked?: string;
  veniceModel: string;
  lowBalanceThresholdUsd?: number;
  defaultTopupUsd?: number;
};

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/**
 * 区块 1：Venice AI · x402 集成
 * - 状态：已配置 / 未配置 API Key
 * - 输入：API key（masked 显示）+ 模型 ID
 * - 保存：POST /api/config/venice { veniceApiKey, veniceModel }
 *
 * 数据源：/api/config/venice (GET/POST)
 */
export default function VeniceApiKey() {
  const [config, setConfig] = useState<ConfigResp | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('deepseek-v4-pro');
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/config/venice');
        if (!res.ok) {
          if (!cancelled) setLoadError(`HTTP ${res.status}`);
          return;
        }
        const data: ConfigResp = await res.json();
        if (!cancelled) {
          setConfig(data);
          if (data.veniceModel) setModel(data.veniceModel);
        }
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'fetch failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSave() {
    setSaveStatus('saving');
    try {
      const body: { veniceApiKey?: string; veniceModel?: string } = {
        veniceModel: model,
      };
      // 只在用户实际输入了新 key 时才提交 veniceApiKey
      if (apiKey.trim()) body.veniceApiKey = apiKey.trim();
      const res = await fetch('/api/config/venice', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data: ConfigResp = await res.json();
        setConfig(data);
        setApiKey(''); // 清空输入框（出于安全）
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

  const isConfigured = config?.veniceApiKeyConfigured === true;

  return (
    <SectionCard
      title="Venice AI · x402 集成"
      subtitle="API Key 与推理模型配置"
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
            <Key className="w-4 h-4 text-gray-500" />
            <span className="text-xs text-gray-500">API Key 状态：</span>
            {isConfigured ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                <CheckCircle2 className="w-3.5 h-3.5" />
                已配置
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
                <XCircle className="w-3.5 h-3.5" />
                未配置 API Key
              </span>
            )}
            {config?.veniceApiKeyMasked && (
              <code className="text-xs font-mono text-gray-500 ml-1">
                {config.veniceApiKeyMasked}
              </code>
            )}
          </div>

          {/* API Key 输入 */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              Venice API Key (ven_xxx)
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={isConfigured ? '保持空白不修改' : '粘贴 API key'}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
            />
          </div>

          {/* 模型 ID 输入 */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              模型 ID
            </label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
            />
          </div>

          {/* 当前显示 + 保存按钮 */}
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
              当前：{isConfigured ? '已配置' : '未设置'} · 模型：{model}
            </span>
          </div>
        </div>
      )}
    </SectionCard>
  );
}
