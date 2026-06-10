'use client';

import { useEffect, useState } from 'react';
import { Sparkles, Loader2, Bot, AlertCircle } from 'lucide-react';
import SectionCard from '@/components/dashboard/v2/SectionCard';
import { formatUsdc } from '@/lib/domain/money';

type Snapshot = {
  guardrails?: {
    singleLimitUsdcMinor: number;
    dailyLimitUsdcMinor: number;
    reviewThresholdUsdcMinor: number;
    allowedChains: string[];
    generatedBy: string;
    updatedAt: string;
  };
};

type RecommendResp = {
  recommendation?: {
    singleLimitUsdcMinor: number;
    dailyLimitUsdcMinor: number;
    reviewThresholdUsdcMinor: number;
    allowedChains: string[];
    generatedBy: string;
    updatedAt: string;
  };
  note?: string;
};

type RiskProfile = 'conservative' | 'balanced' | 'growth';

/**
 * 区块 4：Guardrails
 * - 状态标签：AI 推荐（generatedBy=ai_direct）/ 系统默认（generatedBy=system_default）
 * - 4 项限额：免审批上限（reviewThresholdUsdcMinor）/ 单笔上限 / 每日上限 / 允许链
 * - 按钮：生成 AI 推荐（POST /api/guardrails/recommend）
 *
 * 数据源：/api/credits/balance → guardrails，POST /api/guardrails/recommend
 */
export default function GuardrailsCard() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [recommendation, setRecommendation] = useState<NonNullable<RecommendResp['recommendation']> | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // 表单
  const [agentCount, setAgentCount] = useState(2);
  const [dailySpendUsdc, setDailySpendUsdc] = useState(10);
  const [riskProfile, setRiskProfile] = useState<RiskProfile>('balanced');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/credits/balance');
        if (res.ok) {
          const data: Snapshot = await res.json();
          if (!cancelled) setSnapshot(data);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // 优先显示推荐，否则显示 snapshot.guardrails
  const displayed = recommendation ?? snapshot?.guardrails;
  const isAi = displayed?.generatedBy === 'ai_direct';

  async function handleRecommend() {
    setAiBusy(true);
    setAiError(null);
    try {
      const res = await fetch('/api/guardrails/recommend', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ agentCount, dailySpendUsdc, riskProfile }),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}${errText ? `: ${errText.slice(0, 200)}` : ''}`);
      }
      const data: RecommendResp = await res.json();
      setRecommendation(data.recommendation ?? null);
      setNote(data.note ?? null);
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'fetch failed');
    } finally {
      setAiBusy(false);
    }
  }

  return (
    <SectionCard
      title="Guardrails"
      subtitle="支付策略限额与 AI 推荐生成"
      loading={loading}
    >
      <div className="space-y-5">
        {/* 状态 + 4 项指标 */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500">当前策略</span>
            <span
              className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded ${
                isAi
                  ? 'bg-blue-50 text-blue-700'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {isAi ? <Sparkles className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
              {isAi ? 'AI 推荐' : '系统默认'}
            </span>
          </div>

          {displayed ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-lg bg-gray-50 px-3 py-2.5">
                <p className="text-[11px] text-gray-500">免审批上限</p>
                <p className="text-sm font-semibold text-amber-700 mt-0.5">
                  ${formatUsdc(displayed.reviewThresholdUsdcMinor)}
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 px-3 py-2.5">
                <p className="text-[11px] text-gray-500">单笔上限</p>
                <p className="text-sm font-semibold text-gray-900 mt-0.5">
                  ${formatUsdc(displayed.singleLimitUsdcMinor)}
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 px-3 py-2.5">
                <p className="text-[11px] text-gray-500">每日上限</p>
                <p className="text-sm font-semibold text-gray-900 mt-0.5">
                  ${formatUsdc(displayed.dailyLimitUsdcMinor)}
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 px-3 py-2.5">
                <p className="text-[11px] text-gray-500">允许链</p>
                <p className="text-sm font-semibold text-gray-900 mt-0.5 truncate" title={displayed.allowedChains.join(', ')}>
                  {displayed.allowedChains.length > 0 ? displayed.allowedChains.join(', ') : '—'}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-500">暂无 Guardrails 配置</p>
          )}
        </div>

        {/* AI 推荐表单 */}
        <div className="pt-4 border-t border-gray-100">
          <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            生成 AI 推荐
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
            <div>
              <label className="block text-[11px] text-gray-500 mb-1">Agent 数量</label>
              <input
                type="number"
                min={1}
                max={20}
                value={agentCount}
                onChange={(e) => setAgentCount(Math.max(1, Number(e.target.value) || 1))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-[11px] text-gray-500 mb-1">每日预期支出 (USDC)</label>
              <input
                type="number"
                min={1}
                max={10000}
                step={1}
                value={dailySpendUsdc}
                onChange={(e) => setDailySpendUsdc(Math.max(1, Number(e.target.value) || 1))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-[11px] text-gray-500 mb-1">风险偏好</label>
              <select
                value={riskProfile}
                onChange={(e) => setRiskProfile(e.target.value as RiskProfile)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="conservative">保守 (0.7x)</option>
                <option value="balanced">平衡 (1.0x)</option>
                <option value="growth">激进 (1.5x)</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRecommend}
              disabled={aiBusy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {aiBusy ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  生成中…
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  生成 AI 推荐
                </>
              )}
            </button>
            {aiError && (
              <span className="inline-flex items-center gap-1 text-sm text-red-600">
                <AlertCircle className="w-4 h-4" />
                {aiError}
              </span>
            )}
          </div>
          {note && (
            <p className="text-[11px] text-gray-500 mt-2 italic">{note}</p>
          )}
        </div>
      </div>
    </SectionCard>
  );
}
