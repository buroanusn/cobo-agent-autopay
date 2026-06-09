'use client';

import { useEffect, useState } from 'react';
import { Shield, Sparkles, RefreshCw } from 'lucide-react';

type GuardrailsSnapshot = {
  singleLimitUsdcMinor: number;
  dailyLimitUsdcMinor: number;
  reviewThresholdUsdcMinor: number;
  allowedChains: string[];
  generatedBy: string;
};

function fmtUsdc(minor: number) {
  return `$${(minor / 1_000_000).toFixed(2)}`;
}

export default function GuardrailsPanel({ snapshot }: { snapshot: { guardrails: GuardrailsSnapshot } | null }) {
  const [recommending, setRecommending] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  if (!snapshot) return null;
  const g = snapshot.guardrails;

  async function handleRecommend() {
    setRecommending(true);
    setResult(null);
    try {
      const res = await fetch('/api/guardrails/recommend', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ agentCount: 2, dailySpendUsdc: 10, riskProfile: 'balanced' }),
      });
      if (!res.ok) throw new Error('Recommend failed');
      const data = await res.json();
      setResult(data.note ?? 'AI 推荐已生成。最终设置需在 Cobo App 内确认。');
    } catch {
      setResult('推荐请求失败，请重试。');
    } finally {
      setRecommending(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-4">
        <Shield className="w-4 h-4 text-blue-600" />
        Guardrails
        <span className="text-xs text-gray-400 font-normal bg-gray-100 px-2 py-0.5 rounded-full">{g.generatedBy === 'ai_direct' ? 'AI 推荐' : '系统默认'}</span>
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500">免审批上限</p>
          <p className="text-sm font-bold text-gray-900 mt-1">{fmtUsdc(g.reviewThresholdUsdcMinor)}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500">单笔上限</p>
          <p className="text-sm font-bold text-gray-900 mt-1">{fmtUsdc(g.singleLimitUsdcMinor)}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500">每日上限</p>
          <p className="text-sm font-bold text-gray-900 mt-1">{fmtUsdc(g.dailyLimitUsdcMinor)}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500">允许链</p>
          <p className="text-sm font-bold text-gray-900 mt-1">{g.allowedChains.join(', ') || '—'}</p>
        </div>
      </div>
      <div className="mt-4 flex items-start gap-3">
        <button
          onClick={handleRecommend}
          disabled={recommending}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {recommending ? (
            <RefreshCw className="w-3 h-3 animate-spin" />
          ) : (
            <Sparkles className="w-3 h-3 text-amber-500" />
          )}
          {recommending ? '生成中...' : '生成 AI 推荐'}
        </button>
        {result && (
          <p className="text-xs text-blue-700 bg-blue-50 rounded-lg px-3 py-1.5 flex-1">{result}</p>
        )}
      </div>
    </div>
  );
}
