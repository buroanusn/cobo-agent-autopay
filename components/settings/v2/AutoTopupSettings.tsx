'use client';

import { useEffect, useState } from 'react';
import { Loader2, Save, CheckCircle2, XCircle } from 'lucide-react';
import SectionCard from '@/components/dashboard/v2/SectionCard';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/**
 * 区块 1：自动充值设置
 * - 加载：GET /api/settings → veniceBalanceThreshold
 * - 保存：POST /api/settings { veniceBalanceThreshold }
 * - 文档要求："Venice 余额低于此值时自动充值（USD）" + "保存" 按钮
 *   + 提示 "当前阈值将在下次余额轮询时生效（每 60 秒检查一次）"
 */
export default function AutoTopupSettings() {
  const [threshold, setThreshold] = useState<number>(5);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/settings');
        if (!res.ok) {
          if (!cancelled) setLoadError(`HTTP ${res.status}`);
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          if (data.veniceBalanceThreshold !== undefined) {
            setThreshold(Number(data.veniceBalanceThreshold));
          }
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

  return (
    <SectionCard
      title="自动充值设置"
      subtitle="Venice 余额低于此值时自动触发 x402 充值"
    >
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          加载中...
        </div>
      ) : loadError ? (
        <p className="text-xs text-red-600">加载失败：{loadError}</p>
      ) : (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Venice 余额低于此值时自动充值（USD）
          </label>
          <div className="flex items-center gap-3 flex-wrap">
            <input
              type="number"
              min={0.1}
              max={1000}
              step={0.1}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="w-32 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <span className="text-sm text-gray-500">USD</span>
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
                阈值已保存
              </span>
            )}
            {saveStatus === 'error' && (
              <span className="inline-flex items-center gap-1 text-sm text-red-600 font-medium">
                <XCircle className="w-4 h-4" />
                保存失败，请重试
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-2">
            当前阈值将在下次余额轮询时生效（每 60 秒检查一次）
          </p>
        </div>
      )}
    </SectionCard>
  );
}
