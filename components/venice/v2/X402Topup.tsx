'use client';

import { useEffect, useState } from 'react';
import { Loader2, Search, Send, AlertCircle, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import SectionCard from '@/components/dashboard/v2/SectionCard';
import { USDC_MINOR_UNITS } from '@/lib/domain/constants';
import { formatUsdc } from '@/lib/domain/money';

type CawStatus = {
  runtime?: { mode?: 'mock' | 'http' };
  app?: { activeAuthorization?: boolean; connectedWalletAddress?: string };
  readyForRealPayment?: boolean;
  missing?: string[];
};

type X402Accept = {
  network?: string;
  asset?: string;
  payTo?: string;
  maxAmountRequired?: string | number;
  description?: string;
};

type Requirements = {
  accepts?: X402Accept[];
};

type TopupResp = {
  ok: boolean;
  requirements?: Requirements;
  selected?: X402Accept;
  result?: { ok?: boolean; txHash?: string; error?: string };
  topup?: { status?: string; reason?: string; orderId?: string };
  error?: string;
};

const MIN_USD = 1;
const MAX_USD = 1000;

/**
 * 区块 3：x402 Top-up (CAW 钱包 → Venice)
 * - 金额输入 $1-$1000
 * - 前置校验状态：CAW 钱包 / Pact 状态
 * - 3 按钮：查看 x402 challenge / 用 CAW 钱包 x402 充値 / 执行中…
 *
 * 数据源：
 *   GET  /api/venice/x402-topup    查看 x402 challenge（不花钱）
 *   POST /api/venice/x402-topup    执行真实 top-up（需 confirmed: true + 已绑 CAW 钱包 + active Pact）
 *   GET  /api/wallet/caw/status    前置校验
 */
export default function X402Topup({ onAfterAction }: { onAfterAction?: () => void }) {
  const [cawStatus, setCawStatus] = useState<CawStatus | null>(null);
  const [amount, setAmount] = useState<number>(5);
  const [challenge, setChallenge] = useState<Requirements | null>(null);
  const [selected, setSelected] = useState<X402Accept | null>(null);
  const [challengeLoading, setChallengeLoading] = useState(false);
  const [topupLoading, setTopupLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [challengeError, setChallengeError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/wallet/caw/status');
        if (res.ok) {
          const data: CawStatus = await res.json();
          if (!cancelled) setCawStatus(data);
        }
      } catch {
        // ignore
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleFetchChallenge() {
    setChallengeLoading(true);
    setChallengeError(null);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch('/api/venice/x402-topup');
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}`);
      }
      const data: TopupResp = await res.json();
      setChallenge(data.requirements ?? null);
      setSelected(data.selected ?? null);
    } catch (e) {
      setChallengeError(e instanceof Error ? e.message : 'fetch failed');
    } finally {
      setChallengeLoading(false);
    }
  }

  async function handleTopup() {
    if (!confirmed) {
      setError('请先勾选"已确认真实支付"复选框');
      return;
    }
    if (amount < MIN_USD || amount > MAX_USD) {
      setError(`金额必须在 $${MIN_USD} - $${MAX_USD} 之间`);
      return;
    }
    setTopupLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch('/api/venice/x402-topup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          usdAmount: amount,
          amountUsdcMinor: Math.round(amount * USDC_MINOR_UNITS),
          confirmed: true,
        }),
      });
      const data: TopupResp = await res.json();
      if (!res.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : `HTTP ${res.status}`);
      }
      if (data.topup?.status === 'pending') {
        setSuccessMsg(`Top-up 已提交：订单 ${data.topup.orderId ?? ''}，等待链上确认`);
      } else if (data.topup?.status === 'blocked') {
        setError(`Top-up 被拦截：${data.topup.reason ?? ''}`);
      } else if (data.result?.ok) {
        setSuccessMsg(`Top-up 成功，tx：${data.result.txHash ?? '—'}`);
      } else if (data.result?.error) {
        setError(`Top-up 失败：${data.result.error}`);
      } else {
        setSuccessMsg('Top-up 已完成');
      }
      setConfirmed(false);
      onAfterAction?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'top-up failed');
    } finally {
      setTopupLoading(false);
    }
  }

  // 前置校验
  const hasWallet = !!cawStatus?.app?.connectedWalletAddress;
  const hasActivePact = cawStatus?.app?.activeAuthorization === true;
  const isHttpMode = cawStatus?.runtime?.mode === 'http';

  return (
    <SectionCard
      title="x402 Top-up（CAW 钱包 → Venice）"
      subtitle="用 CAW 钱包的真实 USDC 给 Venice 充值"
    >
      {/* 错误 / 成功提示 */}
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

      {/* 前置校验状态 */}
      <div className="mb-4 space-y-1.5">
        <p className="text-xs font-medium text-gray-600">前置校验</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
          <div className={`flex items-center gap-1.5 ${hasWallet ? 'text-emerald-700' : 'text-amber-700'}`}>
            {hasWallet ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
            <span>CAW 钱包：{hasWallet ? '已连接' : '未连接'}</span>
          </div>
          <div className={`flex items-center gap-1.5 ${isHttpMode ? 'text-emerald-700' : 'text-amber-700'}`}>
            {isHttpMode ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
            <span>CAW 模式：{isHttpMode ? '真实 HTTP' : 'Mock'}</span>
          </div>
          <div className={`flex items-center gap-1.5 ${hasActivePact ? 'text-emerald-700' : 'text-amber-700'}`}>
            {hasActivePact ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
            <span>Pact：{hasActivePact ? '已激活' : '需先激活'}</span>
          </div>
        </div>
        {!hasActivePact && (
          <p className="text-[11px] text-amber-700 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            需要先在 Wallet 页生成 Pact 计划并提交到 Cobo App 审批
          </p>
        )}
      </div>

      {/* 金额输入 */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-gray-500 mb-1.5">
          充值金额 (USD)
        </label>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">$</span>
          <input
            type="number"
            min={MIN_USD}
            max={MAX_USD}
            step={0.01}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value) || 0)}
            className="w-32 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <span className="text-[11px] text-gray-500">
            范围 $${MIN_USD} - $${MAX_USD} · ≈ {formatUsdc(Math.round(amount * USDC_MINOR_UNITS))} USDC
          </span>
        </div>
      </div>

      {/* 3 按钮 */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button
          onClick={handleFetchChallenge}
          disabled={challengeLoading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {challengeLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          查看 x402 challenge
        </button>
        <button
          onClick={handleTopup}
          disabled={topupLoading || !hasWallet || !hasActivePact}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {topupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {topupLoading ? '执行中…' : '用 CAW 钱包 x402 充值'}
        </button>
      </div>

      {/* 确认复选框 */}
      <label className="flex items-start gap-2 mb-4 text-xs text-gray-700 cursor-pointer">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <span>
          我确认要执行 <strong className="text-gray-900">真实 USDC 支付</strong>（Base mainnet，将消耗 {formatUsdc(Math.round(amount * USDC_MINOR_UNITS))} USDC）
        </span>
      </label>

      {/* x402 challenge 结果 */}
      {(challenge || challengeError) && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-xs font-medium text-gray-600 mb-2">x402 challenge 结果</p>
          {challengeError ? (
            <p className="text-xs text-red-600">{challengeError}</p>
          ) : challenge ? (
            <div className="space-y-1.5">
              <p className="text-[11px] text-gray-500">accepts 数量：{challenge.accepts?.length ?? 0}</p>
              {selected && (
                <div className="rounded-lg bg-blue-50/50 border border-blue-100 px-3 py-2 text-[11px]">
                  <p className="text-gray-700">
                    <span className="text-gray-500">已选：</span>
                    {selected.network} · {selected.asset} · payTo {selected.payTo?.slice(0, 10)}…
                  </p>
                  {selected.maxAmountRequired && (
                    <p className="text-gray-700 mt-0.5">
                      <span className="text-gray-500">max：</span>
                      {selected.maxAmountRequired}
                    </p>
                  )}
                </div>
              )}
              {challenge.accepts && challenge.accepts.length > 1 && (
                <details className="text-[11px]">
                  <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
                    查看所有 accepts ({challenge.accepts.length})
                  </summary>
                  <pre className="mt-1 p-2 rounded bg-gray-50 text-gray-700 overflow-x-auto">
                    {JSON.stringify(challenge.accepts, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          ) : null}
        </div>
      )}
    </SectionCard>
  );
}
