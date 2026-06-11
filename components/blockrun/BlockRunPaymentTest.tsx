'use client';

import { useEffect, useState } from 'react';
import { Loader2, Send, AlertCircle, CheckCircle2, XCircle, Minus } from 'lucide-react';
import SectionCard from '@/components/dashboard/v2/SectionCard';

type ConfigResp = {
  configured: boolean;
  model: string;
  useTestnet: boolean;
  minBalance: number;
};

type CawStatus = {
  runtime?: { mode?: string; walletPaired?: boolean };
  app?: { connectedWalletAddress?: string; activeAuthorization?: boolean };
  walletAddress?: string;
};

type BalanceResp = {
  balanceUsdc: number;
  minBalance: number;
  isBelowThreshold: boolean;
};

type PactStatusResp = {
  hasPact: boolean;
  pactId?: string;
  network?: string;
  status?: string;
  error?: string;
};

type StepsDisplay = {
  received402: boolean | null;
  price?: string;
  signed: boolean | null;
  txHash: string | null;
  gotResult: boolean | null;
};

type TestResult = {
  ok: boolean;
  error?: string;
  duration?: number;
  costUsdc?: number;
  steps?: StepsDisplay;
  pactId?: string;
  pactNetwork?: string;
};

/**
 * x402 支付链路测试卡片
 * 一键验证 CAW 钱包 → BlockRun 的 x402 支付流程
 * 失败也是测试结果，不置灰按钮
 */
export default function BlockRunPaymentTest() {
  const [config, setConfig] = useState<ConfigResp | null>(null);
  const [cawStatus, setCawStatus] = useState<CawStatus | null>(null);
  const [balance, setBalance] = useState<BalanceResp | null>(null);
  const [pactStatus, setPactStatus] = useState<PactStatusResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [c1, c2, c3, c4] = await Promise.allSettled([
        fetch('/api/blockrun/config'),
        fetch('/api/wallet/caw/status'),
        fetch('/api/blockrun/balance'),
        fetch('/api/blockrun/pact-status'),
      ]);
      if (cancelled) return;
      if (c1.status === 'fulfilled' && c1.value.ok) {
        try { setConfig(await c1.value.json()); } catch {}
      }
      if (c2.status === 'fulfilled' && c2.value.ok) {
        try { setCawStatus(await c2.value.json()); } catch {}
      }
      if (c3.status === 'fulfilled' && c3.value.ok) {
        try { setBalance(await c3.value.json()); } catch {}
      }
      if (c4.status === 'fulfilled' && c4.value.ok) {
        try { setPactStatus(await c4.value.json()); } catch {}
      }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  async function handleTest() {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch('/api/blockrun/inference', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          prompt: 'x402 payment test',
          model: config?.model || 'openai/gpt-oss-20b',
        }),
      });
      const data: TestResult = await res.json();
      setResult(data);
    } catch (e) {
      setResult({
        ok: false,
        error: e instanceof Error ? e.message : 'Test failed',
      });
    } finally {
      setBusy(false);
    }
  }

  const networkLabel = config?.useTestnet ? '测试网 (Base Sepolia)' : '主网 (Base Mainnet)';
  const isHttpMode = cawStatus?.runtime?.mode === 'http';
  const walletPaired = cawStatus?.runtime?.walletPaired || !!cawStatus?.walletAddress;
  const s = result?.steps;
  const stepIcon = (val: boolean | null | undefined) => {
    if (val === true) return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
    if (val === false) return <XCircle className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-gray-300" />;
  };
  const isTestnet = config?.useTestnet;
  const explorerUrl = isTestnet ? 'https://sepolia.basescan.org/tx/' : 'https://basescan.org/tx/';

  return (
    <SectionCard
      title="x402 支付链路测试"
      subtitle="验证 CAW 钱包 → BlockRun 的 x402 支付流程"
      loading={loading}
    >
      <div className="space-y-4">
        {/* 区域1：环境状态 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-gray-50 px-3 py-2">
            <p className="text-[11px] text-gray-500">当前网络</p>
            <p className="text-sm font-medium text-gray-900 mt-0.5">{networkLabel}</p>
          </div>
          <div className="rounded-lg bg-gray-50 px-3 py-2">
            <p className="text-[11px] text-gray-500">CAW 模式</p>
            <p className={`text-sm font-medium mt-0.5 flex items-center gap-1 ${isHttpMode ? 'text-emerald-700' : 'text-amber-700'}`}>
              {isHttpMode ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              {isHttpMode ? '真实 HTTP' : 'Mock 模式'}
            </p>
            {!isHttpMode && <p className="text-[10px] text-amber-600">Mock 模式无法真实支付</p>}
          </div>
          <div className="rounded-lg bg-gray-50 px-3 py-2">
            <p className="text-[11px] text-gray-500">CAW 钱包</p>
            <p className={`text-sm font-medium mt-0.5 flex items-center gap-1 ${walletPaired ? 'text-emerald-700' : 'text-red-600'}`}>
              {walletPaired ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              {walletPaired ? '已连接' : '未连接'}
            </p>
          </div>
          <div className="rounded-lg bg-gray-50 px-3 py-2">
            <p className="text-[11px] text-gray-500">USDC 余额</p>
            <p className={`text-sm font-medium mt-0.5 ${balance?.isBelowThreshold ? 'text-red-600' : 'text-emerald-700'}`}>
              {balance ? `$${balance.balanceUsdc.toFixed(2)}` : '—'}
            </p>
          </div>
        </div>

        {/* BlockRun Pact 状态 */}
        {pactStatus && (
          <div className={`rounded-lg px-3 py-2 text-xs ${pactStatus.hasPact && pactStatus.status === 'active' ? 'bg-emerald-50' : 'bg-red-50'}`}>
            <div className="flex items-center gap-1.5">
              {pactStatus.hasPact && pactStatus.status === 'active' ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <XCircle className="w-3.5 h-3.5 text-red-500" />
              )}
              <span className="font-medium">BlockRun Pact：</span>
              {pactStatus.hasPact && pactStatus.status === 'active' ? (
                <span className="text-emerald-700">
                  {pactStatus.pactId} · {pactStatus.network}
                </span>
              ) : (
                <span className="text-red-700">未找到 BlockRun Pact，请先在上方创建</span>
              )}
            </div>
          </div>
        )}

        {/* 区域2：测试说明 + 按钮 */}
        <p className="text-xs text-gray-500">
          测试金额 $0.001 USDC（单次推理费用），点击下方按钮将发起一次完整的 x402 支付并消耗真实{isTestnet ? '测试网' : ''} USDC。
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleTest}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {busy ? '测试中...' : '一键测试 x402 支付'}
          </button>
          {result && (
            <span className={`text-xs font-medium ${result.ok ? 'text-emerald-600' : 'text-red-600'}`}>
              {result.ok ? '测试通过' : '测试失败'}
            </span>
          )}
        </div>

        {/* 区域3：分步结果展示 */}
        {result && (
          <div className="border-t border-gray-100 pt-3 space-y-2">
            <p className="text-xs font-medium text-gray-600">测试结果</p>

            {/* 步骤1：402 响应 */}
            <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-xs">
              <div className="flex items-center gap-2">
                {s ? stepIcon(s.received402) : stepIcon(false)}
                <span className="text-gray-700">402 响应</span>
              </div>
              <span className="text-gray-500 font-mono">
                {s?.price || (result.ok ? '已收到' : '—')}
              </span>
            </div>

            {/* 步骤2：CAW 签名 */}
            <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-xs">
              <div className="flex items-center gap-2">
                {s ? stepIcon(s.signed) : stepIcon(null)}
                <span className="text-gray-700">CAW 签名</span>
              </div>
              <span className="text-gray-500">
                {s?.signed === true ? '已完成' : s?.signed === false ? '失败' : '—'}
              </span>
            </div>

            {/* 步骤3：链上结算 */}
            <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-xs">
              <div className="flex items-center gap-2">
                {s?.txHash ? stepIcon(true) : (s?.signed === true ? stepIcon(false) : stepIcon(null))}
                <span className="text-gray-700">链上结算</span>
              </div>
              <span className="text-gray-500 font-mono">
                {s?.txHash ? (
                  <a
                    href={`${explorerUrl}${s.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 underline"
                  >
                    {s.txHash.slice(0, 10)}...
                  </a>
                ) : s?.signed === true ? (
                  <span className="text-red-500">未找到 txHash</span>
                ) : '—'}
              </span>
            </div>

            {/* 步骤4：推理结果 */}
            <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-xs">
              <div className="flex items-center gap-2">
                {result.ok ? stepIcon(true) : (s?.gotResult ? stepIcon(true) : stepIcon(false))}
                <span className="text-gray-700">推理返回</span>
              </div>
              <span className={`${result.ok ? 'text-emerald-600' : 'text-red-500'}`}>
                {result.ok ? '收到结果' : (result.error || '失败')}
              </span>
            </div>

            {/* 额外信息 */}
            {result.duration !== undefined && (
              <p className="text-[11px] text-gray-400 text-right">耗时：{result.duration}ms</p>
            )}
            {result.pactId && (
              <p className="text-[11px] text-gray-400 text-right">Pact: {result.pactId}</p>
            )}
          </div>
        )}
      </div>
    </SectionCard>
  );
}
