'use client';

import { useState, useEffect } from 'react';
import { Loader2, Save } from 'lucide-react';

export default function ThresholdForm() {
  const [threshold, setThreshold] = useState<number>(5);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/settings');
        if (res.ok) {
          const data = await res.json();
          if (data.veniceBalanceThreshold !== undefined) {
            setThreshold(Number(data.veniceBalanceThreshold));
          }
        }
      } catch (err) {
        console.error('Failed to load settings', err);
      } finally {
        setLoading(false);
      }
    }
    load();
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

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
        <Loader2 className="w-4 h-4 animate-spin" />
        加载中...
      </div>
    );
  }

  return (
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
          onClick={handleSave}
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
  );
}
