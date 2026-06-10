'use client';

import { useEffect, useState } from 'react';
import { Coins, Sparkles, Send, RefreshCw, ShieldCheck, Loader2, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import SectionCard from '@/components/dashboard/v2/SectionCard';
import { DEFAULT_SPEND_POLICY, USDC_MINOR_UNITS } from '@/lib/domain/constants';
import { formatUsdc } from '@/lib/domain/money';

type Pact = {
  id: string;
  name: string;
  status: string;
  intent: string;
  expiresAt: string;
  remaining?: { txCountRemaining?: number; timeRemainingSeconds?: number };
};

type PactsResp = {
  ok?: boolean;
  pacts?: Pact[];
  hasBaseUsdcPact?: boolean;
  error?: string;
};

type CawStatus = {
  runtime?: { faucetTokenId?: string };
  app?: { activeAuthorization?: boolean };
  authorization?: { expiresAt?: string; remainingUsdcMinor?: number };
};

type PactPreview = {
  intent: string;
  originalIntent: string;
  executionPlan: string;
  draftedBy: 'agent_llm' | 'agent_deterministic';
  warnings: string[];
  limits: {
    singleLimitUsdcMinor: number;
    dailyLimitUsdcMinor: number;
    monthlyLimitUsdcMinor: number;
    validDays: number;
  };
};

type AuthResp = {
  preview?: PactPreview;
  authorization?: { pactId?: string; status?: string };
  ok?: boolean;
  error?: string;
};

const DEFAULT_LIMITS: { singleLimitUsdcMinor: number; dailyLimitUsdcMinor: number; monthlyLimitUsdcMinor: number; validDays: number } = {
  singleLimitUsdcMinor: DEFAULT_SPEND_POLICY.singleLimitUsdcMinor,
  dailyLimitUsdcMinor: DEFAULT_SPEND_POLICY.dailyLimitUsdcMinor,
  monthlyLimitUsdcMinor: DEFAULT_SPEND_POLICY.monthlyLimitUsdcMinor,
  validDays: DEFAULT_SPEND_POLICY.validDays,
};

/**
 * 区块 5：Pact 授权状态
 * - 活跃 Pact 数量
 * - Base USDC Pact 状态（就绪 / 缺少）
 * - Pact 列表：tx 剩余 / 过期时间
 * - Pact 参数配置：4 个输入
 * - 5 按钮：领取测试币 / 生成 Pact 计划 / 提交 Pact / 刷新 Pact / 刷新 Authorization / 授权 USDC
 * - Pact 预览：Intent / 起草来源 / 原始意图 / 执行计划 / 校验提示
 *
 * 数据源：
 *   GET  /api/wallet/caw/pacts
 *   POST /api/wallet/caw/faucet
 *   POST /api/wallet/caw/authorization (previewOnly=true/false)
 *   POST /api/wallet/caw/authorization/refresh
 *   POST /api/wallet/caw/approve
 */
export default function PactAuthorization({ onAfterAction }: { onAfterAction?: () => void }) {
  const [pacts, setPacts] = useState<PactsResp | null>(null);
  const [cawStatus, setCawStatus] = useState<CawStatus | null>(null);
  const [preview, setPreview] = useState<PactPreview | null>(null);
  const [busy, setBusy] = useState<'faucet' | 'preview' | 'submit' | 'refreshAuth' | 'approve' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Pact 参数
  const [intent, setIntent] = useState('Allow CAW to spend USDC on Base for CreditsPayment and Venice x402 top-ups.');
  const [limits, setLimits] = useState(DEFAULT_LIMITS);

  // 授权 USDC 数量（默认 1 USDC，用 USDC_MINOR_UNITS 而不是硬编 1_000_000）
  const [approveAmount, setApproveAmount] = useState(USDC_MINOR_UNITS);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [pres, sres] = await Promise.allSettled([
        fetch('/api/wallet/caw/pacts'),
        fetch('/api/wallet/caw/status'),
      ]);
      if (cancelled) return;
      if (pres.status === 'fulfilled' && pres.value.ok) {
        try {
          const data: PactsResp = await pres.value.json();
          if (!cancelled) setPacts(data);
        } catch {
          // ignore
        }
      }
      if (sres.status === 'fulfilled' && sres.value.ok) {
        try {
          const data: CawStatus = await sres.value.json();
          if (!cancelled) setCawStatus(data);
        } catch {
          // ignore
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleFaucet() {
    setBusy('faucet');
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch('/api/wallet/caw/faucet', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tokenId: cawStatus?.runtime?.faucetTokenId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : `HTTP ${res.status}`);
      }
      setSuccessMsg('测试币申请已提交');
      onAfterAction?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : '请求失败');
    } finally {
      setBusy(null);
    }
  }

  async function handlePreview() {
    setBusy('preview');
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch('/api/wallet/caw/authorization', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          intent,
          singleLimitUsdcMinor: limits.singleLimitUsdcMinor,
          dailyLimitUsdcMinor: limits.dailyLimitUsdcMinor,
          monthlyLimitUsdcMinor: limits.monthlyLimitUsdcMinor,
          validDays: limits.validDays,
          previewOnly: true,
        }),
      });
      const data: AuthResp = await res.json();
      if (!res.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : `HTTP ${res.status}`);
      }
      setPreview(data.preview ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '请求失败');
    } finally {
      setBusy(null);
    }
  }

  async function handleSubmit() {
    setBusy('submit');
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch('/api/wallet/caw/authorization', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          intent,
          singleLimitUsdcMinor: limits.singleLimitUsdcMinor,
          dailyLimitUsdcMinor: limits.dailyLimitUsdcMinor,
          monthlyLimitUsdcMinor: limits.monthlyLimitUsdcMinor,
          validDays: limits.validDays,
          previewOnly: false,
        }),
      });
      const data: AuthResp = await res.json();
      if (!res.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : `HTTP ${res.status}`);
      }
      setSuccessMsg(`Pact 已提交：${data.authorization?.pactId ?? ''}，请在 Cobo App 审批`);
      setPreview(null);
      onAfterAction?.();
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
      if (!res.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : `HTTP ${res.status}`);
      }
      setSuccessMsg('Authorization 已刷新');
      onAfterAction?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : '请求失败');
    } finally {
      setBusy(null);
    }
  }

  async function handleApprove() {
    setBusy('approve');
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch('/api/wallet/caw/approve', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ amountUsdcMinor: approveAmount }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : `HTTP ${res.status}`);
      }
      setSuccessMsg('USDC 授权已提交');
      onAfterAction?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : '请求失败');
    } finally {
      setBusy(null);
    }
  }

  const activePacts = pacts?.pacts?.filter((p) => p.status === 'active') ?? [];
  const hasBaseUsdc = pacts?.hasBaseUsdcPact === true;

  return (
    <SectionCard
      title="Pact 授权状态"
      subtitle="活跃 Pact 数量、Base USDC Pact、参数与提交流程"
      loading={pacts === null}
    >
      {error && (
        <div className="mb-3 flex items-start gap-2 rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-xs text-red-700">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {successMsg && (
        <div className="mb-3 flex items-start gap-2 rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2 text-xs text-emerald-700">
          <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="space-y-5">
        {/* 头部指标 */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="rounded-lg bg-gray-50 px-3 py-2.5">
            <p className="text-[11px] text-gray-500">活跃 Pact</p>
            <p className="text-base font-semibold text-gray-900 mt-0.5">
              {activePacts.length} 个
            </p>
          </div>
          <div className="rounded-lg bg-gray-50 px-3 py-2.5">
            <p className="text-[11px] text-gray-500">Base USDC Pact</p>
            <p className="text-base font-semibold mt-0.5 flex items-center gap-1">
              {hasBaseUsdc ? (
                <span className="inline-flex items-center gap-1 text-emerald-700">
                  <CheckCircle2 className="w-4 h-4" />就绪
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-red-600">
                  <XCircle className="w-4 h-4" />缺少
                </span>
              )}
            </p>
          </div>
          <div className="rounded-lg bg-gray-50 px-3 py-2.5 col-span-2 md:col-span-1">
            <p className="text-[11px] text-gray-500">即将过期</p>
            <p className="text-base font-semibold text-gray-900 mt-0.5">
              {cawStatus?.authorization?.expiresAt
                ? new Date(cawStatus.authorization.expiresAt).toLocaleDateString('zh-CN')
                : '—'}
            </p>
          </div>
        </div>

        {/* Pact 列表 */}
        {activePacts.length > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-600 mb-2">活跃 Pact 列表</p>
            <div className="space-y-1.5">
              {activePacts.map((p) => (
                <div key={p.id} className="flex items-center justify-between px-3 py-2 rounded-lg border border-gray-200 bg-white">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{p.name || p.id}</p>
                    <p className="text-[11px] font-mono text-gray-500 mt-0.5">{p.id}</p>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-gray-600 flex-shrink-0">
                    <span>tx 剩余 {p.remaining?.txCountRemaining ?? '—'}</span>
                    <span>到期 {p.expiresAt ? new Date(p.expiresAt).toLocaleDateString('zh-CN') : '—'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pact 参数配置 + Intent */}
        <div className="border-t border-gray-100 pt-4">
          <p className="text-xs font-medium text-gray-600 mb-2">Pact 参数配置</p>
          <textarea
            value={intent}
            onChange={(e) => setIntent(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-3 resize-none"
            placeholder="Pact intent（自然语言描述）"
          />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] text-gray-500 mb-1">单笔 USDC</label>
              <input
                type="number"
                min={0.01}
                step={0.01}
                value={limits.singleLimitUsdcMinor / USDC_MINOR_UNITS}
                onChange={(e) => setLimits((l) => ({ ...l, singleLimitUsdcMinor: Math.round((Number(e.target.value) || 0) * USDC_MINOR_UNITS) }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-[11px] text-gray-500 mb-1">每日 USDC</label>
              <input
                type="number"
                min={0.01}
                step={0.01}
                value={limits.dailyLimitUsdcMinor / USDC_MINOR_UNITS}
                onChange={(e) => setLimits((l) => ({ ...l, dailyLimitUsdcMinor: Math.round((Number(e.target.value) || 0) * USDC_MINOR_UNITS) }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-[11px] text-gray-500 mb-1">每月 USDC</label>
              <input
                type="number"
                min={0.01}
                step={0.01}
                value={limits.monthlyLimitUsdcMinor / USDC_MINOR_UNITS}
                onChange={(e) => setLimits((l) => ({ ...l, monthlyLimitUsdcMinor: Math.round((Number(e.target.value) || 0) * USDC_MINOR_UNITS) }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-[11px] text-gray-500 mb-1">有效天数</label>
              <input
                type="number"
                min={1}
                max={365}
                value={limits.validDays}
                onChange={(e) => setLimits((l) => ({ ...l, validDays: Math.max(1, Number(e.target.value) || 1) }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* 5 按钮 */}
        <div className="border-t border-gray-100 pt-4">
          <p className="text-xs font-medium text-gray-600 mb-2">操作</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleFaucet}
              disabled={busy !== null}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {busy === 'faucet' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Coins className="w-4 h-4" />}
              领取测试币
            </button>
            <button
              onClick={handlePreview}
              disabled={busy !== null}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {busy === 'preview' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              生成 Pact 计划
            </button>
            <button
              onClick={handleSubmit}
              disabled={busy !== null || !preview}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {busy === 'submit' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              提交 Pact
            </button>
            <button
              onClick={handleRefreshAuth}
              disabled={busy !== null}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {busy === 'refreshAuth' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              刷新 Authorization
            </button>
            <button
              onClick={handleApprove}
              disabled={busy !== null}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {busy === 'approve' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              授权 USDC
            </button>
          </div>

          {/* 授权 USDC 数量输入 */}
          <div className="mt-3 flex items-center gap-2">
            <label className="text-[11px] text-gray-500">授权数量 (USDC):</label>
            <input
              type="number"
              min={0.01}
              step={0.01}
              value={approveAmount / USDC_MINOR_UNITS}
              onChange={(e) => setApproveAmount(Math.round((Number(e.target.value) || 0) * USDC_MINOR_UNITS))}
              className="w-32 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <span className="text-[11px] text-gray-500">({formatUsdc(approveAmount)})</span>
          </div>
        </div>

        {/* Pact 预览 */}
        {preview && (
          <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <p className="text-sm font-semibold text-gray-900">Pact 预览</p>
              <span
                className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${
                  preview.draftedBy === 'agent_llm'
                    ? 'bg-blue-50 text-blue-700'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {preview.draftedBy === 'agent_llm' ? 'Agent LLM' : 'Deterministic'}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div>
                <span className="text-gray-500">Intent：</span>
                <p className="text-gray-900 mt-0.5">{preview.intent}</p>
              </div>
              <div>
                <span className="text-gray-500">原始意图：</span>
                <p className="text-gray-900 mt-0.5 italic">{preview.originalIntent}</p>
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
                    {preview.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  );
}
