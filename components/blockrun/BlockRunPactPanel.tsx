'use client';

import { useEffect, useState } from 'react';
import { Loader2, Send, RefreshCw, Sparkles, ShieldCheck, AlertCircle, CheckCircle2, XCircle, Server, Globe } from 'lucide-react';
import SectionCard from '@/components/dashboard/v2/SectionCard';
import { DEFAULT_SPEND_POLICY, USDC_MINOR_UNITS } from '@/lib/domain/constants';
import { formatUsdc } from '@/lib/domain/money';

type PactStatus = {
  hasPact: boolean;
  pactId?: string;
  network?: string;
  status?: string;
  singleLimitUsd?: number;
  dailyLimitUsd?: number;
  monthlyLimitUsd?: number;
  expiresAt?: string;
  error?: string;
};

type ConfigResp = {
  configured: boolean;
  model: string;
  useTestnet: boolean;
  minBalance: number;
};

type PactPreview = {
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

type AuthResp = {
  preview?: PactPreview;
  authorization?: { pactId?: string; status?: string };
  ok?: boolean;
  error?: string;
};

/**
 * BlockRun Pact 授权管理
 * 独立于 Venice 的 mainnet Pact，使用 blockrun_x402 scope
 * 网络根据当前 BLOCKRUN_USE_TESTNET 动态选择
 */
export default function BlockRunPactPanel() {
  const [pactStatus, setPactStatus] = useState<PactStatus | null>(null);
  const [config, setConfig] = useState<ConfigResp | null>(null);
  const [preview, setPreview] = useState<PactPreview | null>(null);
  const [busy, setBusy] = useState<'preview' | 'submit' | 'refresh' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Pact limits
  const [limits, setLimits] = useState({
    singleUsdc: 1,
    dailyUsdc: 5,
    monthlyUsdc: 20,
    validDays: 7,
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [pactRes, configRes] = await Promise.allSettled([
          fetch('/api/blockrun/pact-status'),
          fetch('/api/blockrun/config'),
        ]);
        if (cancelled) return;

        if (pactRes.status === 'fulfilled' && pactRes.value.ok) {
          const data: PactStatus = await pactRes.value.json();
          if (!cancelled) setPactStatus(data);
        }
        if (configRes.status === 'fulfilled' && configRes.value.ok) {
          const data: ConfigResp = await configRes.value.json();
          if (!cancelled) setConfig(data);
        }
      } catch {
        // ignore
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const networkLabel = config?.useTestnet ? '测试网 (Base Sepolia)' : '主网 (Base Mainnet)';
  const isActive = pactStatus?.status === 'active';
  const hasNetworkMismatch = pactStatus?.hasPact && pactStatus?.network &&
    ((config?.useTestnet && pactStatus.network !== 'eip155:84532') ||
     (!config?.useTestnet && pactStatus.network !== 'eip155:8453'));

  async function handlePreview() {
    setBusy('preview'); setError(null); setSuccessMsg(null);
    try {
      const res = await fetch('/api/blockrun/pact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          amountUsdc: limits.singleUsdc,
          dailyLimitUsdc: limits.dailyUsdc,
          monthlyLimitUsdc: limits.monthlyUsdc,
          validDays: limits.validDays,
          previewOnly: true,
        }),
      });
      const data: AuthResp = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setPreview(data.preview ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '请求失败');
    } finally { setBusy(null); }
  }

  async function handleSubmit() {
    setBusy('submit'); setError(null); setSuccessMsg(null);
    try {
      const res = await fetch('/api/blockrun/pact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          amountUsdc: limits.singleUsdc,
          dailyLimitUsdc: limits.dailyUsdc,
          monthlyLimitUsdc: limits.monthlyUsdc,
          validDays: limits.validDays,
        }),
      });
      const data: AuthResp = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setSuccessMsg(`Pact 已提交：${data.authorization?.pactId ?? ''}，请在 Cobo App 审批`);
      setPreview(null);
      // Reload pact status after a delay
      setTimeout(async () => {
        const r = await fetch('/api/blockrun/pact-status');
        if (r.ok) setPactStatus(await r.json());
      }, 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : '请求失败');
    } finally { setBusy(null); }
  }

  async function handleRefresh() {
    setBusy('refresh'); setError(null); setSuccessMsg(null);
    try {
      const res = await fetch('/api/blockrun/pact/refresh', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setSuccessMsg('Pact 状态已刷新');
      // Reload
      const r = await fetch('/api/blockrun/pact-status');
      if (r.ok) setPactStatus(await r.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : '请求失败');
    } finally { setBusy(null); }
  }

  const titleNetwork = config?.useTestnet ? '测试网' : '主网';

  return (
    <SectionCard
      title={`BlockRun Pact 授权（${titleNetwork}）`}
      subtitle={`当前网络：${networkLabel} — 独立于 Venice 的 mainnet Pact`}
    >
      <div className="space-y-4">
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

        {/* Pact 状态 */}
        <div className={`rounded-lg px-4 py-3 ${isActive ? 'bg-emerald-50 border border-emerald-100' : 'bg-amber-50 border border-amber-100'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className={`w-5 h-5 ${isActive ? 'text-emerald-600' : 'text-amber-600'}`} />
              <span className="text-sm font-medium text-gray-900">
                {isActive ? 'Pact 已激活' : 'Pact 未创建'}
              </span>
            </div>
            {pactStatus?.network && (
              <span className="text-[11px] font-mono text-gray-500 bg-white/80 px-2 py-0.5 rounded">
                {pactStatus.network}
              </span>
            )}
          </div>
          {pactStatus?.pactId && (
            <p className="text-[11px] font-mono text-gray-500 mt-1">ID: {pactStatus.pactId}</p>
          )}
          {!pactStatus?.hasPact && (
            <p className="text-xs text-amber-700 mt-1">尚未创建 BlockRun 的 Pact，请在下方的参数配置后提交</p>
          )}
        </div>

        {/* 网络不匹配警告 */}
        {hasNetworkMismatch && (
          <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>当前 Pact 是 {pactStatus?.network} 网络的，与当前选择的 {networkLabel} 不匹配。请创建新 Pact 或切换网络。</span>
          </div>
        )}

        {/* Pact 参数配置 */}
        <div className="border-t border-gray-100 pt-3">
          <p className="text-xs font-medium text-gray-600 mb-2">Pact 参数</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] text-gray-500 mb-1">单笔 USDC</label>
              <input
                type="number" min={0.01} step={0.01}
                value={limits.singleUsdc}
                onChange={(e) => setLimits(l => ({ ...l, singleUsdc: Number(e.target.value) || 0 }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-[11px] text-gray-500 mb-1">每日 USDC</label>
              <input
                type="number" min={0.01} step={0.01}
                value={limits.dailyUsdc}
                onChange={(e) => setLimits(l => ({ ...l, dailyUsdc: Number(e.target.value) || 0 }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-[11px] text-gray-500 mb-1">每月 USDC</label>
              <input
                type="number" min={0.01} step={0.01}
                value={limits.monthlyUsdc}
                onChange={(e) => setLimits(l => ({ ...l, monthlyUsdc: Number(e.target.value) || 0 }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-[11px] text-gray-500 mb-1">有效天数</label>
              <input
                type="number" min={1} max={365}
                value={limits.validDays}
                onChange={(e) => setLimits(l => ({ ...l, validDays: Math.max(1, Number(e.target.value) || 1) }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* 按钮 */}
        <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-3">
          <button
            onClick={handlePreview}
            disabled={busy !== null}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {busy === 'preview' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            预览 Pact 计划
          </button>
          <button
            onClick={handleSubmit}
            disabled={busy !== null}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {busy === 'submit' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            提交 Pact
          </button>
          <button
            onClick={handleRefresh}
            disabled={busy !== null}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {busy === 'refresh' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            刷新 Pact 状态
          </button>
        </div>

        {/* Pact 预览 */}
        {preview && (
          <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <p className="text-sm font-semibold text-gray-900">Pact 预览</p>
              <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                {preview.draftedBy === 'agent_llm' ? 'Agent LLM' : 'Deterministic'}
              </span>
            </div>
            <div className="space-y-2 text-xs">
              <div>
                <span className="text-gray-500">Intent：</span>
                <p className="text-gray-900 mt-0.5">{preview.intent}</p>
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
  );
}
