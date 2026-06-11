'use client';

import { useEffect, useState } from 'react';
import { ShieldCheck, Sparkles, Loader2, Bot, AlertCircle, CheckCircle2, Save, Info, Zap } from 'lucide-react';
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
  pactDetails?: {
    reviewIfAmountUsdcMinor: number;
    denyIfAmountUsdcMinor: number;
    remainingUsdcMinor: number;
    completionTimeElapsedDays: number;
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

const RECOMMENDED = {
  singleLimit: 80,
  dailyLimit: 300,
  reviewThreshold: 150,
  allowedChains: ['Base'],
};

const CHAIN_OPTIONS = [
  { value: 'Base', label: 'Base 主网 (8453)', desc: '低手续费、高速，X402 协议首选' },
  { value: 'TBASE_SETH', label: 'Base Sepolia 测试网', desc: '测试阶段可用' },
  { value: 'Ethereum', label: 'Ethereum 主网', desc: '高安全性但手续费高' },
];

export default function GuardrailsView() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [recommendation, setRecommendation] = useState<NonNullable<RecommendResp['recommendation']> | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiBusy, setAiBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // AI 推荐表单
  const [agentCount, setAgentCount] = useState(2);
  const [dailySpendUsdc, setDailySpendUsdc] = useState(40);
  const [riskProfile, setRiskProfile] = useState<RiskProfile>('balanced');

  // 编辑表单
  const [editMode, setEditMode] = useState(false);
  const [editSingleLimit, setEditSingleLimit] = useState(RECOMMENDED.singleLimit);
  const [editDailyLimit, setEditDailyLimit] = useState(RECOMMENDED.dailyLimit);
  const [editReviewThreshold, setEditReviewThreshold] = useState(RECOMMENDED.reviewThreshold);
  const [editChains, setEditChains] = useState<string[]>(RECOMMENDED.allowedChains);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/credits/balance');
        if (res.ok) {
          const data: Snapshot = await res.json();
          if (!cancelled) {
            setSnapshot(data);
            if (data.guardrails) {
              setEditSingleLimit(data.guardrails.singleLimitUsdcMinor / 1_000_000);
              setEditDailyLimit(data.guardrails.dailyLimitUsdcMinor / 1_000_000);
              setEditReviewThreshold(data.guardrails.reviewThresholdUsdcMinor / 1_000_000);
              setEditChains(data.guardrails.allowedChains?.length ? data.guardrails.allowedChains : RECOMMENDED.allowedChains);
            }
          }
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const displayed = recommendation ?? snapshot?.guardrails;
  const isAi = displayed?.generatedBy === 'ai_direct';

  function toggleChain(chain: string) {
    setEditChains((prev) =>
      prev.includes(chain) ? prev.filter((c) => c !== chain) : [...prev, chain]
    );
  }

  function applyRecommended() {
    setEditSingleLimit(RECOMMENDED.singleLimit);
    setEditDailyLimit(RECOMMENDED.dailyLimit);
    setEditReviewThreshold(RECOMMENDED.reviewThreshold);
    setEditChains(RECOMMENDED.allowedChains);
  }

  async function handleRecommend() {
    setAiBusy(true);
    setAiError(null);
    setSuccessMsg(null);
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
      setSuccessMsg('AI 推荐已生成，可在编辑模式下微调后保存');
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'fetch failed');
    } finally {
      setAiBusy(false);
    }
  }

  async function handleSave() {
    setSaveBusy(true);
    setAiError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          guardrails: {
            singleLimitUsdcMinor: Math.round(editSingleLimit * 1_000_000),
            dailyLimitUsdcMinor: Math.round(editDailyLimit * 1_000_000),
            reviewThresholdUsdcMinor: Math.round(editReviewThreshold * 1_000_000),
            allowedChains: editChains,
          },
        }),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}${errText ? `: ${errText.slice(0, 200)}` : ''}`);
      }
      setSuccessMsg('Guardrails 已保存');
      setEditMode(false);
      const balanceRes = await fetch('/api/credits/balance');
      if (balanceRes.ok) {
        const data: Snapshot = await balanceRes.json();
        setSnapshot(data);
      }
    } catch (e) {
      setAiError(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSaveBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* 推荐配置说明 */}
      <SectionCard title="Guardrails 推荐配置" subtitle="Base 链为主，适合高频小额 Token 充值（X402 协议）">
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 pr-4 text-xs font-medium text-gray-500">项目</th>
                  <th className="text-left py-2 pr-4 text-xs font-medium text-gray-500">推荐设置值</th>
                  <th className="text-left py-2 text-xs font-medium text-gray-500">说明</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr>
                  <td className="py-2.5 pr-4 text-gray-900 font-medium">单笔上限</td>
                  <td className="py-2.5 pr-4 text-blue-700 font-semibold">${RECOMMENDED.singleLimit}</td>
                  <td className="py-2.5 text-gray-600">覆盖一次正常 Token 充值</td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-4 text-gray-900 font-medium">每日上限</td>
                  <td className="py-2.5 pr-4 text-blue-700 font-semibold">${RECOMMENDED.dailyLimit}</td>
                  <td className="py-2.5 text-gray-600">适合日常高效用户（推荐默认）</td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-4 text-gray-900 font-medium">审批阈值</td>
                  <td className="py-2.5 pr-4 text-amber-700 font-semibold">${RECOMMENDED.reviewThreshold}</td>
                  <td className="py-2.5 text-gray-600">${RECOMMENDED.reviewThreshold} 以下自动，以上需手机审批</td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-4 text-gray-900 font-medium">允许链</td>
                  <td className="py-2.5 pr-4 text-blue-700 font-semibold">{RECOMMENDED.allowedChains.join(', ')}</td>
                  <td className="py-2.5 text-gray-600">主网，低手续费高速</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex items-start gap-2 rounded-lg bg-blue-50 border border-blue-100 px-3 py-2.5 text-xs text-blue-800">
            <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              <p className="font-medium">为什么以 Base 链为主？</p>
              <ul className="list-disc list-inside text-blue-700 space-y-0.5">
                <li>Base 链手续费低、速度快，非常适合高频小额 Token 充值（X402 协议）</li>
                <li>与 Cobo Wallet 兼容性好</li>
                <li>测试阶段可同时允许 Base + TBASE_SETH，正式上线仅允许 Base 主网</li>
              </ul>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* 当前 Guardrails 状态 */}
      <SectionCard
        title="当前 Guardrails 配置"
        subtitle="点击右上角编辑修改参数"
        loading={loading}
        action={
          <div className="flex items-center gap-2">
            {editMode && (
              <button
                onClick={applyRecommended}
                className="inline-flex items-center gap-1 rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors"
              >
                <Zap className="w-3.5 h-3.5" />
                应用推荐值
              </button>
            )}
            <button
              onClick={() => setEditMode(!editMode)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              {editMode ? '取消' : '编辑'}
            </button>
          </div>
        }
      >
        <div className="space-y-5">
          {aiError && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{aiError}</span>
            </div>
          )}
          {successMsg && (
            <div className="flex items-start gap-2 rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2 text-xs text-emerald-700">
              <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* 状态标签 */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">当前策略</span>
            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded ${
              isAi ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-600'
            }`}>
              {isAi ? <Sparkles className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
              {isAi ? 'AI 推荐' : '系统默认'}
            </span>
          </div>

          {/* 限额展示/编辑 */}
          {displayed ? (
            editMode ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[11px] text-gray-500 mb-1">单笔上限 (USDC)</label>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={editSingleLimit}
                      onChange={(e) => setEditSingleLimit(Number(e.target.value) || 0)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-500 mb-1">每日上限 (USDC)</label>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={editDailyLimit}
                      onChange={(e) => setEditDailyLimit(Number(e.target.value) || 0)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-500 mb-1">审批阈值 (USDC)</label>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={editReviewThreshold}
                      onChange={(e) => setEditReviewThreshold(Number(e.target.value) || 0)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* 允许链选择 */}
                <div>
                  <label className="block text-[11px] text-gray-500 mb-2">允许链</label>
                  <div className="flex flex-wrap gap-2">
                    {CHAIN_OPTIONS.map((chain) => (
                      <button
                        key={chain.value}
                        onClick={() => toggleChain(chain.value)}
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                          editChains.includes(chain.value)
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                        }`}
                        title={chain.desc}
                      >
                        {editChains.includes(chain.value) && <CheckCircle2 className="w-3.5 h-3.5" />}
                        {chain.label}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleSave}
                  disabled={saveBusy}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {saveBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  保存配置
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
                  <p className="text-[11px] text-gray-500">审批阈值</p>
                  <p className="text-sm font-semibold text-amber-700 mt-0.5">
                    ${formatUsdc(displayed.reviewThresholdUsdcMinor)}
                  </p>
                </div>
                <div className="rounded-lg bg-gray-50 px-3 py-2.5">
                  <p className="text-[11px] text-gray-500">允许链</p>
                  <p className="text-sm font-semibold text-gray-900 mt-0.5 truncate" title={displayed.allowedChains.join(', ')}>
                    {displayed.allowedChains.length > 0 ? displayed.allowedChains.join(', ') : '—'}
                  </p>
                </div>
              </div>
            )
          ) : (
            <p className="text-xs text-gray-500">暂无 Guardrails 配置</p>
          )}

          {/* Pact 详情 */}
          {snapshot?.pactDetails && (
            <div className="pt-4 border-t border-gray-100">
              <p className="text-xs font-medium text-gray-600 mb-3">Pact 限额详情</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-lg bg-blue-50 px-3 py-2.5">
                  <p className="text-[11px] text-blue-600">审批金额</p>
                  <p className="text-sm font-semibold text-blue-900 mt-0.5">
                    ${formatUsdc(snapshot.pactDetails.reviewIfAmountUsdcMinor)}
                  </p>
                </div>
                <div className="rounded-lg bg-red-50 px-3 py-2.5">
                  <p className="text-[11px] text-red-600">拒绝金额</p>
                  <p className="text-sm font-semibold text-red-900 mt-0.5">
                    ${formatUsdc(snapshot.pactDetails.denyIfAmountUsdcMinor)}
                  </p>
                </div>
                <div className="rounded-lg bg-emerald-50 px-3 py-2.5">
                  <p className="text-[11px] text-emerald-600">剩余额度</p>
                  <p className="text-sm font-semibold text-emerald-900 mt-0.5">
                    ${formatUsdc(snapshot.pactDetails.remainingUsdcMinor)}
                  </p>
                </div>
                <div className="rounded-lg bg-gray-50 px-3 py-2.5">
                  <p className="text-[11px] text-gray-500">已用天数</p>
                  <p className="text-sm font-semibold text-gray-900 mt-0.5">
                    {snapshot.pactDetails.completionTimeElapsedDays} 天
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </SectionCard>

      {/* AI 推荐 */}
      <SectionCard title="AI 推荐" subtitle="基于 Agent 数量、日均支出、风险偏好生成 Guardrails 推荐">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                <><Loader2 className="w-4 h-4 animate-spin" /> 生成中…</>
              ) : (
                <><Sparkles className="w-4 h-4" /> 生成 AI 推荐</>
              )}
            </button>
            {aiError && (
              <span className="inline-flex items-center gap-1 text-sm text-red-600">
                <AlertCircle className="w-4 h-4" />{aiError}
              </span>
            )}
          </div>

          {recommendation && (
            <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-blue-600" />
                <p className="text-sm font-semibold text-gray-900">AI 推荐结果</p>
                <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">
                  {recommendation.generatedBy === 'ai_direct' ? 'AI 生成' : '系统默认'}
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-gray-500">单笔限额</span>
                  <p className="font-semibold text-gray-900">${formatUsdc(recommendation.singleLimitUsdcMinor)}</p>
                </div>
                <div>
                  <span className="text-gray-500">每日限额</span>
                  <p className="font-semibold text-gray-900">${formatUsdc(recommendation.dailyLimitUsdcMinor)}</p>
                </div>
                <div>
                  <span className="text-gray-500">审批阈值</span>
                  <p className="font-semibold text-amber-700">${formatUsdc(recommendation.reviewThresholdUsdcMinor)}</p>
                </div>
                <div>
                  <span className="text-gray-500">允许链</span>
                  <p className="font-semibold text-gray-900">{recommendation.allowedChains.join(', ')}</p>
                </div>
              </div>
              {note && <p className="text-[11px] text-gray-500 mt-3 italic">{note}</p>}
              <p className="text-[11px] text-blue-600 mt-2">→ 点击上方「编辑」可基于此推荐微调，然后保存</p>
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
