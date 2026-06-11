'use client';

import { useState } from 'react';
import { Loader2, CheckCircle2, AlertCircle, Sparkles, Send, RefreshCw, ShieldCheck } from 'lucide-react';
import SectionCard from '@/components/dashboard/v2/SectionCard';
import { USDC_MINOR_UNITS } from '@/lib/domain/constants';
import { formatUsdc } from '@/lib/domain/money';

type Preset = {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  riskLevel: string;
  riskColor: string;
  reviewThreshold: number;   // 免审批金额
  singleLimit: number;       // 单笔最高上限
  validDays: number;         // 授权有效期
  cumulativeLimit: number;   // 累计支出上限
};

const PRESETS: Preset[] = [
  {
    id: 'light-explorer',
    name: '轻度探索者',
    nameEn: 'Light Explorer',
    description: '适合新手 / 测试用户，偶尔使用 Agent，想极致简单安全',
    riskLevel: '极低',
    riskColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    reviewThreshold: 50,
    singleLimit: 30,
    validDays: 30,
    cumulativeLimit: 500,
  },
  {
    id: 'daily-agent',
    name: '日常高效用户',
    nameEn: 'Daily Agent',
    description: '每天稳定使用多个 Agent，中等消耗量（推荐默认）',
    riskLevel: '低（推荐）',
    riskColor: 'bg-blue-50 text-blue-700 border-blue-200',
    reviewThreshold: 150,
    singleLimit: 80,
    validDays: 60,
    cumulativeLimit: 2000,
  },
  {
    id: 'heavy-operator',
    name: '重度 Agent 用户',
    nameEn: 'Heavy Operator',
    description: '重度使用 AI Agent，24h 持续运行，消耗量大',
    riskLevel: '中',
    riskColor: 'bg-amber-50 text-amber-700 border-amber-200',
    reviewThreshold: 400,
    singleLimit: 200,
    validDays: 90,
    cumulativeLimit: 8000,
  },
];

type Params = {
  reviewThreshold: number;
  singleLimit: number;
  validDays: number;
  cumulativeLimit: number;
};

type PreviewResp = {
  preview?: {
    intent: string;
    originalIntent: string;
    executionPlan: string;
    draftedBy: string;
    warnings: string[];
    limits: {
      singleLimitUsdcMinor: number;
      dailyLimitUsdcMinor: number;
      monthlyLimitUsdcMinor: number;
      validDays: number;
    };
  };
  authorization?: { pactId?: string; status?: string };
  ok?: boolean;
  error?: string;
};

export default function PactTemplates() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [params, setParams] = useState<Params | null>(null);
  const [preview, setPreview] = useState<PreviewResp['preview'] | null>(null);
  const [busy, setBusy] = useState<'preview' | 'submit' | 'refreshAuth' | 'approve' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const selectedPreset = PRESETS.find((p) => p.id === selectedId);

  function selectPreset(preset: Preset) {
    setSelectedId(preset.id);
    setParams({
      reviewThreshold: preset.reviewThreshold,
      singleLimit: preset.singleLimit,
      validDays: preset.validDays,
      cumulativeLimit: preset.cumulativeLimit,
    });
    setPreview(null);
    setError(null);
    setSuccessMsg(null);
  }

  function update<K extends keyof Params>(key: K, value: number) {
    if (!params) return;
    setParams({ ...params, [key]: value });
  }

  const intent = selectedPreset && params
    ? `${selectedPreset.name}模板：免审批$${params.reviewThreshold}，单笔$${params.singleLimit}，累计$${params.cumulativeLimit}，${params.validDays}天`
    : '';

  async function handlePreview() {
    if (!params) return;
    setBusy('preview');
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch('/api/wallet/caw/authorization', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          intent,
          singleLimitUsdcMinor: params.singleLimit * USDC_MINOR_UNITS,
          dailyLimitUsdcMinor: params.cumulativeLimit * USDC_MINOR_UNITS,
          monthlyLimitUsdcMinor: params.cumulativeLimit * USDC_MINOR_UNITS,
          validDays: params.validDays,
          previewOnly: true,
        }),
      });
      const data: PreviewResp = await res.json();
      if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : `HTTP ${res.status}`);
      setPreview(data.preview ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '请求失败');
    } finally {
      setBusy(null);
    }
  }

  async function handleSubmit() {
    if (!params) return;
    setBusy('submit');
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch('/api/wallet/caw/authorization', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          intent,
          singleLimitUsdcMinor: params.singleLimit * USDC_MINOR_UNITS,
          dailyLimitUsdcMinor: params.cumulativeLimit * USDC_MINOR_UNITS,
          monthlyLimitUsdcMinor: params.cumulativeLimit * USDC_MINOR_UNITS,
          validDays: params.validDays,
          previewOnly: false,
        }),
      });
      const data: PreviewResp = await res.json();
      if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : `HTTP ${res.status}`);
      setSuccessMsg(`Pact 已提交：${data.authorization?.pactId ?? ''}，请在 Cobo App 审批`);
      setPreview(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '请求失败');
    } finally {
      setBusy(null);
    }
  }

  async function handleRefreshAuth() {
    setBusy('refreshAuth');
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch('/api/wallet/caw/authorization/refresh', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : `HTTP ${res.status}`);
      setSuccessMsg('Authorization 已刷新');
    } catch (e) {
      setError(e instanceof Error ? e.message : '请求失败');
    } finally {
      setBusy(null);
    }
  }

  async function handleApprove() {
    if (!params) return;
    setBusy('approve');
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch('/api/wallet/caw/approve', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ amountUsdcMinor: params.cumulativeLimit * USDC_MINOR_UNITS }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : `HTTP ${res.status}`);
      setSuccessMsg('USDC 授权已提交');
    } catch (e) {
      setError(e instanceof Error ? e.message : '请求失败');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* 模板选择 */}
      <SectionCard title="选择预设模板" subtitle="点击选择，然后调整下方参数">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {PRESETS.map((p) => {
            const active = selectedId === p.id;
            return (
              <div
                key={p.id}
                onClick={() => selectPreset(p)}
                className={`rounded-xl border-2 p-5 cursor-pointer transition-all ${
                  active
                    ? 'border-blue-500 bg-blue-50/30 shadow-md'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">{p.name}</h3>
                    <span className="text-[11px] text-gray-400 font-mono">{p.nameEn}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${p.riskColor}`}>
                    风险{p.riskLevel}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-3">{p.description}</p>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded bg-gray-50 px-2.5 py-1.5">
                    <span className="text-gray-500">免审批</span>
                    <span className="font-semibold text-gray-900 ml-1">${p.reviewThreshold}</span>
                  </div>
                  <div className="rounded bg-gray-50 px-2.5 py-1.5">
                    <span className="text-gray-500">单笔上限</span>
                    <span className="font-semibold text-gray-900 ml-1">${p.singleLimit}</span>
                  </div>
                  <div className="rounded bg-gray-50 px-2.5 py-1.5">
                    <span className="text-gray-500">有效期</span>
                    <span className="font-semibold text-gray-900 ml-1">{p.validDays}天</span>
                  </div>
                  <div className="rounded bg-gray-50 px-2.5 py-1.5">
                    <span className="text-gray-500">累计上限</span>
                    <span className="font-semibold text-gray-900 ml-1">${p.cumulativeLimit}</span>
                  </div>
                </div>

                {active && (
                  <div className="mt-3 flex items-center gap-1.5 text-xs text-blue-600 font-medium">
                    <CheckCircle2 className="w-4 h-4" /> 已选择
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </SectionCard>

      {/* 参数调整 + 操作 */}
      {params && selectedPreset && (
        <SectionCard title="调整参数并生成 Pact" subtitle={`${selectedPreset.name} · 每项均可单独修改`}>
          <div className="space-y-5">
            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-xs text-red-700">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {successMsg && (
              <div className="flex items-start gap-2 rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2 text-xs text-emerald-700">
                <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* 4 个可调参数 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">免审批金额 (USDC)</label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={params.reviewThreshold}
                  onChange={(e) => update('reviewThreshold', Math.max(1, Number(e.target.value) || 1))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-[10px] text-gray-400 mt-1">低于此金额自动通过</p>
              </div>
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">单笔最高上限 (USDC)</label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={params.singleLimit}
                  onChange={(e) => update('singleLimit', Math.max(1, Number(e.target.value) || 1))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-[10px] text-gray-400 mt-1">单次交易不可超过</p>
              </div>
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">授权有效期（天）</label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  step={1}
                  value={params.validDays}
                  onChange={(e) => update('validDays', Math.max(1, Number(e.target.value) || 1))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-[10px] text-gray-400 mt-1">到期后需重新授权</p>
              </div>
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">累计支出上限 (USDC)</label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={params.cumulativeLimit}
                  onChange={(e) => update('cumulativeLimit', Math.max(1, Number(e.target.value) || 1))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-[10px] text-gray-400 mt-1">有效期内总支出上限</p>
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
              <button
                onClick={handlePreview}
                disabled={busy !== null}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {busy === 'preview' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                预览 Pact
              </button>
              <button
                onClick={handleSubmit}
                disabled={busy !== null || !preview}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {busy === 'submit' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                提交 Pact
              </button>
              <button
                onClick={handleRefreshAuth}
                disabled={busy !== null}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {busy === 'refreshAuth' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                刷新 Authorization
              </button>
              <button
                onClick={handleApprove}
                disabled={busy !== null}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {busy === 'approve' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                授权 USDC
              </button>
            </div>

            {/* Pact 预览 */}
            {preview && (
              <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  <p className="text-sm font-semibold text-gray-900">Pact 预览</p>
                  <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${
                    preview.draftedBy === 'agent_llm' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {preview.draftedBy === 'agent_llm' ? 'Agent LLM' : 'Deterministic'}
                  </span>
                </div>
                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-gray-500">Intent：</span>
                    <p className="text-gray-900 mt-0.5">{preview.intent}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">执行计划：</span>
                    <p className="text-gray-900 mt-0.5">{preview.executionPlan}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">限额：</span>
                    <p className="text-gray-900 mt-0.5">
                      单笔 ${formatUsdc(preview.limits.singleLimitUsdcMinor)} ·
                      每日 ${formatUsdc(preview.limits.dailyLimitUsdcMinor)} ·
                      每月 ${formatUsdc(preview.limits.monthlyLimitUsdcMinor)} ·
                      {preview.limits.validDays} 天
                    </p>
                  </div>
                  {preview.warnings.length > 0 && (
                    <div>
                      <span className="text-amber-600 font-medium">校验提示：</span>
                      <ul className="list-disc list-inside text-gray-700 mt-0.5">
                        {preview.warnings.map((w, i) => <li key={i}>{w}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
