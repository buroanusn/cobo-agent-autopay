'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Loader2, CheckCircle2, AlertCircle, XCircle,
  Sparkles, Send, RefreshCw, Globe, Zap,
} from 'lucide-react';
import SectionCard from '@/components/dashboard/v2/SectionCard';
import { USDC_MINOR_UNITS } from '@/lib/domain/constants';
import { formatUsdc } from '@/lib/domain/money';

// ─── Presets ─────────────────────────────────────────────────────────

type Preset = {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  riskLevel: string;
  riskColor: string;
  reviewThreshold: number;
  singleLimit: number;
  validDays: number;
  cumulativeLimit: number;
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

// ─── Types ────────────────────────────────────────────────────────────

type CawPact = {
  id: string;
  name: string;
  status: string;
  intent: string;
  expiresAt: string;
  remaining?: { txCountRemaining?: number; timeRemainingSeconds?: number };
};

type CawPactsResp = {
  ok?: boolean;
  pacts?: CawPact[];
  hasBaseUsdcPact?: boolean;
  error?: string;
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

type PactDbStatus = {
  pactId: string;
  pactIdShort: string | null;
  status: string;
  expiresAt: string;
  singleLimitUsd: number;
  dailyLimitUsd: number;
  monthlyLimitUsd: number;
  createdAt: string;
};

type AllPactStatus = {
  credits: PactDbStatus | null;
  venice: PactDbStatus | null;
  blockrun: PactDbStatus | null;
};

type BlockRunConfig = {
  useTestnet: boolean;
  model: string;
  minBalance: number;
  network: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────

function networkLabel(network?: string): string {
  if (network === 'TBASE_SETH') return 'Base Sepolia (测试网)';
  if (network === 'BASE_ETH') return 'Base Mainnet';
  return network ?? '未知';
}

// ─── Main Component ──────────────────────────────────────────────────

export default function UnifiedPactView() {
  // All CAW pacts
  const [cawPacts, setCawPacts] = useState<CawPactsResp | null>(null);
  const [dbPacts, setDbPacts] = useState<AllPactStatus | null>(null);

  // Venice state
  const [venicePreview, setVenicePreview] = useState<PactPreview | null>(null);
  const [veniceBusy, setVeniceBusy] = useState<'preview' | 'submit' | 'refresh' | null>(null);
  const [veniceError, setVeniceError] = useState<string | null>(null);
  const [veniceSuccess, setVeniceSuccess] = useState<string | null>(null);
  const [veniceSingle, setVeniceSingle] = useState(1);
  const [veniceDaily, setVeniceDaily] = useState(5);
  const [veniceMonthly, setVeniceMonthly] = useState(20);
  const [veniceDays, setVeniceDays] = useState(7);

  // BlockRun state
  const [brConfig, setBrConfig] = useState<BlockRunConfig | null>(null);
  const [brPreview, setBrPreview] = useState<PactPreview | null>(null);
  const [brBusy, setBrBusy] = useState<'preview' | 'submit' | 'refresh' | null>(null);
  const [brError, setBrError] = useState<string | null>(null);
  const [brSuccess, setBrSuccess] = useState<string | null>(null);
  const [brSingle, setBrSingle] = useState(1);
  const [brDaily, setBrDaily] = useState(5);
  const [brMonthly, setBrMonthly] = useState(20);
  const [brDays, setBrDays] = useState(7);

  // Preset state
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [presetParams, setPresetParams] = useState<{
    reviewThreshold: number;
    singleLimit: number;
    validDays: number;
    cumulativeLimit: number;
  } | null>(null);

  // ── Load data ──

  const loadCawPacts = useCallback(async () => {
    try {
      const res = await fetch('/api/wallet/caw/pacts');
      if (res.ok) setCawPacts(await res.json());
    } catch { /* ignore */ }
  }, []);

  const loadBlockRun = useCallback(async () => {
    try {
      const [pactRes, configRes] = await Promise.allSettled([
        fetch('/api/pact/status'),
        fetch('/api/blockrun/config'),
      ]);
      if (pactRes.status === 'fulfilled' && pactRes.value.ok) {
        setDbPacts(await pactRes.value.json());
      }
      if (configRes.status === 'fulfilled' && configRes.value.ok) {
        const data = await configRes.value.json();
        setBrConfig(data.config ?? data);
      }
    } catch { /* ignore */ }
  }, []);

  function selectPreset(preset: Preset) {
    setSelectedPresetId(preset.id);
    setPresetParams({
      reviewThreshold: preset.reviewThreshold,
      singleLimit: preset.singleLimit,
      validDays: preset.validDays,
      cumulativeLimit: preset.cumulativeLimit,
    });
    // Fill Venice
    setVeniceSingle(preset.singleLimit);
    setVeniceDaily(preset.cumulativeLimit);
    setVeniceMonthly(preset.cumulativeLimit);
    setVeniceDays(preset.validDays);
    // Fill BlockRun
    setBrSingle(preset.singleLimit);
    setBrDaily(preset.cumulativeLimit);
    setBrMonthly(preset.cumulativeLimit);
    setBrDays(preset.validDays);
  }

  function updatePresetParam(key: 'reviewThreshold' | 'singleLimit' | 'validDays' | 'cumulativeLimit', value: number) {
    if (!presetParams) return;
    const next = { ...presetParams, [key]: value };
    setPresetParams(next);
    // Sync to Venice / BlockRun
    setVeniceSingle(next.singleLimit);
    setVeniceDaily(next.cumulativeLimit);
    setVeniceMonthly(next.cumulativeLimit);
    setVeniceDays(next.validDays);
    setBrSingle(next.singleLimit);
    setBrDaily(next.cumulativeLimit);
    setBrMonthly(next.cumulativeLimit);
    setBrDays(next.validDays);
  }

  useEffect(() => {
    loadCawPacts();
    loadBlockRun();
  }, [loadCawPacts, loadBlockRun]);

  // ── Venice handlers ──

  async function handleVenicePreview() {
    setVeniceBusy('preview');
    setVeniceError(null);
    setVeniceSuccess(null);
    try {
      const res = await fetch('/api/venice/pact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          amountUsdcMinor: veniceSingle * USDC_MINOR_UNITS,
          dailyLimitUsdcMinor: veniceDaily * USDC_MINOR_UNITS,
          monthlyLimitUsdcMinor: veniceMonthly * USDC_MINOR_UNITS,
          validDays: veniceDays,
          previewOnly: true,
        }),
      });
      const data: AuthResp = await res.json();
      if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : `HTTP ${res.status}`);
      setVenicePreview(data.preview ?? null);
    } catch (e) {
      setVeniceError(e instanceof Error ? e.message : '请求失败');
    } finally {
      setVeniceBusy(null);
    }
  }

  async function handleVeniceSubmit() {
    setVeniceBusy('submit');
    setVeniceError(null);
    setVeniceSuccess(null);
    try {
      const res = await fetch('/api/venice/pact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          amountUsdcMinor: veniceSingle * USDC_MINOR_UNITS,
          dailyLimitUsdcMinor: veniceDaily * USDC_MINOR_UNITS,
          monthlyLimitUsdcMinor: veniceMonthly * USDC_MINOR_UNITS,
          validDays: veniceDays,
        }),
      });
      const data: AuthResp = await res.json();
      if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : `HTTP ${res.status}`);
      setVeniceSuccess(`Pact 已提交：${data.authorization?.pactId ?? ''}，请在 Cobo App 审批`);
      setVenicePreview(null);
      setTimeout(loadCawPacts, 3000);
    } catch (e) {
      setVeniceError(e instanceof Error ? e.message : '请求失败');
    } finally {
      setVeniceBusy(null);
    }
  }

  async function handleVeniceRefresh() {
    setVeniceBusy('refresh');
    setVeniceError(null);
    setVeniceSuccess(null);
    try {
      const res = await fetch('/api/venice/pact/refresh', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : `HTTP ${res.status}`);
      setVeniceSuccess('Venice Pact 状态已刷新');
      loadCawPacts();
    } catch (e) {
      setVeniceError(e instanceof Error ? e.message : '请求失败');
    } finally {
      setVeniceBusy(null);
    }
  }

  // ── BlockRun handlers ──

  async function handleBrPreview() {
    setBrBusy('preview');
    setBrError(null);
    setBrSuccess(null);
    try {
      const res = await fetch('/api/blockrun/pact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          amountUsdcMinor: brSingle * USDC_MINOR_UNITS,
          dailyLimitUsdcMinor: brDaily * USDC_MINOR_UNITS,
          monthlyLimitUsdcMinor: brMonthly * USDC_MINOR_UNITS,
          validDays: brDays,
          previewOnly: true,
        }),
      });
      const data: AuthResp = await res.json();
      if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : `HTTP ${res.status}`);
      setBrPreview(data.preview ?? null);
    } catch (e) {
      setBrError(e instanceof Error ? e.message : '请求失败');
    } finally {
      setBrBusy(null);
    }
  }

  async function handleBrSubmit() {
    setBrBusy('submit');
    setBrError(null);
    setBrSuccess(null);
    try {
      const res = await fetch('/api/blockrun/pact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          amountUsdcMinor: brSingle * USDC_MINOR_UNITS,
          dailyLimitUsdcMinor: brDaily * USDC_MINOR_UNITS,
          monthlyLimitUsdcMinor: brMonthly * USDC_MINOR_UNITS,
          validDays: brDays,
        }),
      });
      const data: AuthResp = await res.json();
      if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : `HTTP ${res.status}`);
      setBrSuccess(`Pact 已提交：${data.authorization?.pactId ?? ''}，请在 Cobo App 审批`);
      setBrPreview(null);
      setTimeout(loadBlockRun, 3000);
    } catch (e) {
      setBrError(e instanceof Error ? e.message : '请求失败');
    } finally {
      setBrBusy(null);
    }
  }

  async function handleBrRefresh() {
    setBrBusy('refresh');
    setBrError(null);
    setBrSuccess(null);
    try {
      const res = await fetch('/api/blockrun/pact/refresh', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : `HTTP ${res.status}`);
      setBrSuccess('BlockRun Pact 状态已刷新');
      loadBlockRun();
    } catch (e) {
      setBrError(e instanceof Error ? e.message : '请求失败');
    } finally {
      setBrBusy(null);
    }
  }

  // ── Derived ──

  const activePacts = cawPacts?.pacts?.filter((p) => p.status === 'active') ?? [];
  const hasBaseUsdc = cawPacts?.hasBaseUsdcPact === true;
  const brNetwork = brConfig?.network ?? 'TBASE_SETH';
  const brPactStatus = dbPacts?.blockrun;
  const venicePactStatus = dbPacts?.venice;

  // ── Render ──

  return (
    <div className="space-y-6">

      {/* ─────────── Section 0: Preset Selector ─────────── */}
      <SectionCard title="选择预设模板" subtitle="点击选择档位，自动填充下方 Venice / BlockRun 参数（均可单独微调）">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {PRESETS.map((p) => {
            const active = selectedPresetId === p.id;
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
                    <span className="text-gray-500">累计上限</span>
                    <span className="font-semibold text-gray-900 ml-1">${p.cumulativeLimit}</span>
                  </div>
                  <div className="rounded bg-gray-50 px-2.5 py-1.5">
                    <span className="text-gray-500">有效期</span>
                    <span className="font-semibold text-gray-900 ml-1">{p.validDays}天</span>
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

      {/* ─────────── Section 0.5: Preset Params Adjustment ─────────── */}
      {presetParams && selectedPresetId && (
        <SectionCard title="调整参数" subtitle={`${PRESETS.find(p => p.id === selectedPresetId)?.name ?? ''} · 每项均可单独修改，修改后自动同步到 Venice / BlockRun`}>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">免审批金额 (USDC)</label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={presetParams.reviewThreshold}
                  onChange={(e) => updatePresetParam('reviewThreshold', Math.max(1, Number(e.target.value) || 1))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-[10px] text-gray-400 mt-1">低于此金额自动通过</p>
              </div>
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">单笔最高限额 (USDC)</label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={presetParams.singleLimit}
                  onChange={(e) => updatePresetParam('singleLimit', Math.max(1, Number(e.target.value) || 1))}
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
                  value={presetParams.validDays}
                  onChange={(e) => updatePresetParam('validDays', Math.max(1, Number(e.target.value) || 1))}
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
                  value={presetParams.cumulativeLimit}
                  onChange={(e) => updatePresetParam('cumulativeLimit', Math.max(1, Number(e.target.value) || 1))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-[10px] text-gray-400 mt-1">有效期内总支出上限</p>
              </div>
            </div>
          </div>
        </SectionCard>
      )}

      {/* ─────────── Section 2: Venice Pact (Mainnet) ─────────── */}
      <SectionCard
        title={
          <span className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-blue-600" />
            Venice Pact（Base Mainnet）
          </span>
        }
        subtitle="venice_x402 scope · 用于 Venice AI 推理扣款"
      >
        <div className="space-y-5">
          <VeniceStatusMessage venicePact={venicePactStatus ?? null} />

          {veniceError && (
            <ErrorMessage message={veniceError} />
          )}
          {veniceSuccess && (
            <SuccessMessage message={veniceSuccess} />
          )}

          {/* 参数 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <NumberInput label="单笔上限 (USDC)" value={veniceSingle} onChange={setVeniceSingle} min={0.01} step={0.01} hint="单次最大" />
            <NumberInput label="每日上限 (USDC)" value={veniceDaily} onChange={setVeniceDaily} min={0.01} step={0.01} hint="24h 累计" />
            <NumberInput label="每月上限 (USDC)" value={veniceMonthly} onChange={setVeniceMonthly} min={0.01} step={0.01} hint="30天累计" />
            <NumberInput label="有效天数" value={veniceDays} onChange={setVeniceDays} min={1} max={365} step={1} hint="到期需重建" />
          </div>

          {/* 按钮 */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
            <ActionButton
              onClick={handleVenicePreview}
              busy={veniceBusy === 'preview'}
              disabled={veniceBusy !== null}
              icon={<Sparkles className="w-4 h-4" />}
              label="预览 Pact"
            />
            <ActionButton
              onClick={handleVeniceSubmit}
              busy={veniceBusy === 'submit'}
              disabled={veniceBusy !== null || !venicePreview}
              icon={<Send className="w-4 h-4" />}
              label="提交 Pact"
            />
            <ActionButton
              onClick={handleVeniceRefresh}
              busy={veniceBusy === 'refresh'}
              disabled={veniceBusy !== null}
              icon={<RefreshCw className="w-4 h-4" />}
              label="刷新状态"
              variant="secondary"
            />
          </div>

          {/* 预览 */}
          {venicePreview && <PactPreviewCard preview={venicePreview} />}
        </div>
      </SectionCard>

      {/* ─────────── Section 3: BlockRun Pact ─────────── */}
      <SectionCard
        title={
          <span className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-600" />
            BlockRun Pact（{networkLabel(brNetwork)}）
          </span>
        }
        subtitle="blockrun_x402 scope · 用于 BlockRun x402 实时扣款"
      >
        <div className="space-y-5">
          {/* BlockRun Pact 状态 */}
          <div className="flex items-center gap-3 text-sm">
            {brPactStatus?.status === 'active' ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-700">
                <CheckCircle2 className="w-4 h-4" />
                Pact 已激活
                {brPactStatus.pactIdShort && (
                  <span className="text-[11px] font-mono text-gray-500 ml-1">ID: {brPactStatus.pactIdShort}</span>
                )}
              </span>
            ) : brPactStatus ? (
              <span className="inline-flex items-center gap-1.5 text-amber-600">
                <AlertCircle className="w-4 h-4" />
                Pact 存在但状态: {brPactStatus.status}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-gray-500">
                <XCircle className="w-4 h-4" />
                尚未创建 BlockRun Pact
              </span>
            )}
            <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-gray-100 text-gray-600">
              {brNetwork}
            </span>
          </div>

          {brError && <ErrorMessage message={brError} />}
          {brSuccess && <SuccessMessage message={brSuccess} />}

          {/* 参数 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <NumberInput label="单笔上限 (USDC)" value={brSingle} onChange={setBrSingle} min={0.01} step={0.01} hint="单次最大" />
            <NumberInput label="每日上限 (USDC)" value={brDaily} onChange={setBrDaily} min={0.01} step={0.01} hint="24h 累计" />
            <NumberInput label="每月上限 (USDC)" value={brMonthly} onChange={setBrMonthly} min={0.01} step={0.01} hint="30天累计" />
            <NumberInput label="有效天数" value={brDays} onChange={setBrDays} min={1} max={365} step={1} hint="到期需重建" />
          </div>

          {/* 按钮 */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
            <ActionButton
              onClick={handleBrPreview}
              busy={brBusy === 'preview'}
              disabled={brBusy !== null}
              icon={<Sparkles className="w-4 h-4" />}
              label="预览 Pact"
            />
            <ActionButton
              onClick={handleBrSubmit}
              busy={brBusy === 'submit'}
              disabled={brBusy !== null || !brPreview}
              icon={<Send className="w-4 h-4" />}
              label="提交 Pact"
            />
            <ActionButton
              onClick={handleBrRefresh}
              busy={brBusy === 'refresh'}
              disabled={brBusy !== null}
              icon={<RefreshCw className="w-4 h-4" />}
              label="刷新状态"
              variant="secondary"
            />
          </div>

          {/* 预览 */}
          {brPreview && <PactPreviewCard preview={brPreview} />}
        </div>
      </SectionCard>

      {/* ─────────── Section 3: All CAW Pacts ─────────── */}
      <SectionCard
        title="CAW Pact 总览"
        subtitle="钱包中所有 Pact 授权（来自 Cobo App）"
        loading={cawPacts === null}
        action={
          <button
            onClick={loadCawPacts}
            className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
          >
            <RefreshCw className="w-3 h-3" /> 刷新
          </button>
        }
      >
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
          <div className="rounded-lg bg-gray-50 px-3 py-2.5">
            <p className="text-[11px] text-gray-500">活跃 Pact</p>
            <p className="text-base font-semibold text-gray-900 mt-0.5">{activePacts.length} 个</p>
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
            <p className="text-[11px] text-gray-500">网络说明</p>
            <p className="text-xs text-gray-700 mt-1">测试网 Pact ≠ 主网 Pact，不可互用</p>
          </div>
        </div>

        {activePacts.length > 0 ? (
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
        ) : (
          <p className="text-sm text-gray-500">暂无活跃 Pact，请在下方创建</p>
        )}
      </SectionCard>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────

function VeniceStatusMessage({ venicePact }: { venicePact: PactDbStatus | null }) {
  if (venicePact?.status === 'active') {
    return (
      <div className="flex items-center gap-2 text-sm text-emerald-700">
        <CheckCircle2 className="w-4 h-4" />
        <span>Venice Pact 已激活</span>
        {venicePact.pactIdShort && <span className="text-[11px] font-mono text-gray-500">ID: {venicePact.pactIdShort}</span>}
      </div>
    );
  }

  if (venicePact) {
    return (
      <div className="flex items-center gap-2 text-sm text-amber-600">
        <AlertCircle className="w-4 h-4" />
        <span>Venice Pact 状态: {venicePact.status}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm text-gray-500">
      <XCircle className="w-4 h-4" />
      <span>尚未创建 Venice Pact，请在下方配置参数后提交</span>
    </div>
  );
}

function NumberInput({
  label, value, onChange, min, max, step, hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  hint?: string;
}) {
  return (
    <div>
      <label className="block text-[11px] text-gray-500 mb-1">{label}</label>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Math.max(min ?? 0, Number(e.target.value) || 0))}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
      {hint && <p className="text-[10px] text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

function ActionButton({
  onClick, busy, disabled, icon, label, variant = 'primary',
}: {
  onClick: () => void;
  busy: boolean;
  disabled: boolean;
  icon: React.ReactNode;
  label: string;
  variant?: 'primary' | 'secondary';
}) {
  const cls = variant === 'primary'
    ? 'bg-blue-600 text-white shadow-sm hover:bg-blue-700'
    : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${cls}`}
    >
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
      {label}
    </button>
  );
}

function PactPreviewCard({ preview }: { preview: PactPreview }) {
  return (
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
        {preview.originalIntent && (
          <div>
            <span className="text-gray-500">原始意图：</span>
            <p className="text-gray-900 mt-0.5 italic">{preview.originalIntent}</p>
          </div>
        )}
        <div>
          <span className="text-gray-500">执行计划：</span>
          <p className="text-gray-900 mt-0.5 whitespace-pre-line">{preview.executionPlan}</p>
        </div>
        <div>
          <span className="text-gray-500">限额：</span>
          <p className="text-gray-900 mt-0.5">
            单笔 ${formatUsdc(preview.limits.singleLimitUsdcMinor)} ·{' '}
            每日 ${formatUsdc(preview.limits.dailyLimitUsdcMinor)} ·{' '}
            每月 ${formatUsdc(preview.limits.monthlyLimitUsdcMinor)} ·{' '}
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
  );
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-xs text-red-700">
      <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function SuccessMessage({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2 text-xs text-emerald-700">
      <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
      <span>{message}</span>
    </div>
  );
}
