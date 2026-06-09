'use client';

import { useEffect, useState } from 'react';
import { VenetianMask, Key, DollarSign, Activity, History, RefreshCw, Loader2, Zap, ChevronDown } from 'lucide-react';

type VeniceConfig = {
  veniceApiKeyConfigured: boolean;
  veniceApiKeyMasked: string;
  veniceModel: string;
  lowBalanceThresholdUsd: number;
  defaultTopupUsd: number;
};

type VeniceBalanceSnapshot = {
  id: string;
  fetchedAt: string;
  source: 'x402_wallet' | 'billing_api';
  canConsume: boolean;
  consumptionCurrency: 'USD' | 'DIEM' | 'VCU' | 'BUNDLED_CREDITS' | null;
  diemBalance: number;
  usdBalance: number;
  diemEpochAllocation: number;
  walletAddress?: string;
};

type VeniceInferenceLog = {
  id: string;
  prompt: string;
  model: string;
  response: string;
  inputTokens: number | null;
  outputTokens: number | null;
  status: 'completed' | 'failed';
  errorMessage?: string;
  durationMs: number;
  createdAt: string;
};

type VeniceX402Requirement = {
  protocol: 'x402';
  version: 2;
  network: string;
  asset: string;
  amount: string;
  payTo: string;
  extra?: { name?: string; version?: string; feePayer?: string };
};

type VeniceSiweXResult = {
  walletAddress: string;
  chainId: string;
  uri: string;
  headerName: 'X-Sign-In-With-X';
  headerValue: string;
  decoded: {
    message: { address: string; domain: string; uri: string; nonce: string; issuedAt: string; chainId: number };
    signature: string;
    txId: string;
  };
};

export default function VenicePanel({
  cawWalletAddress,
  hasActivePact,
  cawMode,
}: {
  cawWalletAddress?: string;
  hasActivePact: boolean;
  cawMode: 'mock' | 'http';
}) {
  const [config, setConfig] = useState<VeniceConfig | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [modelInput, setModelInput] = useState('');
  const [balance, setBalance] = useState<VeniceBalanceSnapshot | null>(null);
  const [balanceHistory, setBalanceHistory] = useState<VeniceBalanceSnapshot[]>([]);
  const [logs, setLogs] = useState<VeniceInferenceLog[]>([]);
  const [x402Req, setX402Req] = useState<VeniceX402Requirement | null>(null);
  const [topupUsd, setTopupUsd] = useState(5);
  const [promptInput, setPromptInput] = useState('用一句话介绍 Venice AI 的 x402 协议。');
  const [siweXResult, setSiweXResult] = useState<VeniceSiweXResult | null>(null);
  const [authMode, setAuthMode] = useState<'api_key' | 'siwe_x'>('api_key');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    loadConfig();
    loadBalance();
    loadX402Requirements();
    loadLogs();
  }, []);

  async function loadConfig() {
    try {
      const res = await fetch('/api/config/venice');
      const data = await res.json();
      if (res.ok) {
        setConfig(data);
        setModelInput(data.veniceModel ?? 'llama-3.3-70b');
        if (data.defaultTopupUsd) setTopupUsd(data.defaultTopupUsd);
      }
    } catch { /* ignore */ }
  }

  async function loadBalance() {
    try {
      const res = await fetch('/api/venice/balance');
      const data = await res.json();
      if (res.ok) {
        setBalance(data.snapshot ?? null);
        setBalanceHistory(data.history ?? []);
      }
    } catch { /* ignore */ }
  }

  async function loadLogs() {
    try {
      const res = await fetch('/api/venice/logs');
      const data = await res.json();
      if (res.ok) setLogs(data.logs ?? []);
    } catch { /* ignore */ }
  }

  async function loadX402Requirements() {
    try {
      const res = await fetch('/api/venice/x402-topup');
      const data = await res.json();
      if (res.ok) {
        setX402Req(data.selected);
      } else {
        setError(data.error ?? 'Failed to fetch x402 requirements');
      }
    } catch { /* ignore */ }
  }

  async function saveConfig() {
    setBusy('save'); setError(null); setInfo(null);
    try {
      const res = await fetch('/api/config/venice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ veniceApiKey: apiKeyInput, veniceModel: modelInput }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Save failed');
      setInfo(`Saved: ${data.updated?.join(', ') ?? 'config updated'}`);
      setApiKeyInput('');
      await loadConfig();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally { setBusy(null); }
  }

  async function refreshBalance() {
    setBusy('refresh'); setError(null);
    try {
      const res = await fetch('/api/venice/balance?refresh=1');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Refresh failed');
      setBalance(data.snapshot ?? null);
      setBalanceHistory(data.history ?? []);
      setInfo('Balance refreshed');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Refresh failed');
    } finally { setBusy(null); }
  }

  async function generateSiweXHeader() {
    if (!cawWalletAddress) { setError('Connect a CAW wallet first.'); return; }
    if (!hasActivePact) { setError('Create and approve an active Pact first.'); return; }
    setBusy('siwe'); setError(null);
    try {
      const res = await fetch('/api/venice/sign-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uri: 'https://api.venice.ai/api/v1/chat/completions' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Sign-message failed');
      setSiweXResult(data);
      setAuthMode('siwe_x');
      setInfo(`Signed SiweX header for ${data.walletAddress.slice(0, 6)}…${data.walletAddress.slice(-4)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign failed');
    } finally { setBusy(null); }
  }

  async function runTopup() {
    if (!cawWalletAddress) { setError('Connect a CAW wallet first.'); return; }
    if (!hasActivePact) { setError('Create and approve an active Pact first.'); return; }
    setBusy('topup'); setError(null); setInfo(null);
    try {
      const res = await fetch('/api/venice/x402-topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usdAmount: topupUsd, confirmed: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Top-up failed');
      setInfo(data.ok ? `x402 top-up submitted (${data.responseStatus}).` : `Top-up returned ${data.responseStatus}.`);
      setTimeout(loadBalance, 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Top-up failed');
    } finally { setBusy(null); }
  }

  async function runInference() {
    setBusy('inference'); setError(null); setInfo(null);
    try {
      const payload: { prompt: string; model: string; siweXHeader?: string } = {
        prompt: promptInput,
        model: modelInput,
      };
      if (authMode === 'siwe_x' && siweXResult) {
        payload.siweXHeader = siweXResult.headerValue;
      }
      const res = await fetch('/api/venice/inference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Inference failed');
      setInfo(`Inference ok via ${data.authMode ?? '?'} in ${data.log?.durationMs ?? '?'}ms (${data.log?.inputTokens ?? 0} in / ${data.log?.outputTokens ?? 0} out tokens)`);
      setTimeout(loadLogs, 200);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Inference failed');
    } finally { setBusy(null); }
  }

  const ready = config?.veniceApiKeyConfigured;
  const usdDisplay = balance?.usdBalance !== undefined ? `$${balance.usdBalance.toFixed(2)}` : '—';
  const diemDisplay = balance?.diemBalance !== undefined ? balance.diemBalance.toFixed(2) : '—';
  const epochDisplay = balance?.diemEpochAllocation ? `${balance.diemEpochAllocation} DIEM/epoch` : '—';

  const primaryBtn = 'inline-flex items-center gap-1.5 rounded-lg bg-[#2563EB] px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-[#1D4ED8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors';
  const secondaryBtn = 'inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors';

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <VenetianMask className="w-4 h-4 text-blue-600" />
          Venice AI · x402 集成
        </h3>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ready ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
          {ready ? '已配置' : '未配置 API Key'}
        </span>
      </div>

      <p className="text-[11px] text-gray-500 mb-4">
        Venice 通过 x402 标准（HTTP 402 + 链上 USDC）让钱包按调用付费。下方可设置 Venice API key、查账户余额、用 CAW 钱包做 x402 top-up、并跑一次 inference 测试。
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700 mb-4">⚠ {error}</div>
      )}
      {info && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-xs text-emerald-700 mb-4">✅ {info}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 1) API Key Config */}
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
            <Key className="w-3.5 h-3.5" /> Venice API Key
          </p>
          <p className="text-[10px] text-gray-400 mb-2">
            当前: {config?.veniceApiKeyMasked || '(未设置)'} · 模型: {config?.veniceModel || 'llama-3.3-70b'}
          </p>
          <input
            type="password"
            placeholder="粘贴 Venice API key (ven_xxx)"
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-xs mb-2 focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
          />
          <input
            placeholder="模型 ID (默认 llama-3.3-70b)"
            value={modelInput}
            onChange={(e) => setModelInput(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-xs mb-2 focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
          />
          <button className={primaryBtn} onClick={saveConfig} disabled={busy === 'save'}>
            {busy === 'save' ? '保存中…' : '保存'}
          </button>
          {cawWalletAddress && hasActivePact && ready && (
            <div className="mt-2">
              <button
                className={`${secondaryBtn} text-[10px]`}
                onClick={generateSiweXHeader}
                disabled={busy === 'siwe'}
              >
                {busy === 'siwe' ? '签名中…' : '生成 X-Sign-In-With-X 签名'}
              </button>
              {siweXResult && <span className="text-[10px] text-emerald-600 ml-2">✓ 已签</span>}
            </div>
          )}
        </div>

        {/* 2) Balance */}
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5" /> Venice 账户余额
          </p>
          {balance ? (
            <div className="grid grid-cols-3 gap-2 mb-2">
              <div>
                <p className="text-[10px] text-gray-400">USD</p>
                <p className="text-base font-bold text-gray-900">{usdDisplay}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400">DIEM</p>
                <p className="text-base font-bold text-gray-900">{diemDisplay}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400">Epoch</p>
                <p className="text-xs text-gray-700">{epochDisplay}</p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-400 mb-2">暂无余额快照</p>
          )}
          <p className="text-[10px] text-gray-400 mb-2">
            {balance ? `更新于 ${new Date(balance.fetchedAt).toLocaleString()} (${balance.source})` : '未设置 API key 时无法获取'}
          </p>
          <button className={secondaryBtn} onClick={refreshBalance} disabled={busy === 'refresh' || !ready}>
            {busy === 'refresh' ? '刷新中…' : '刷新余额'}
          </button>
        </div>

        {/* 3) x402 Top-up */}
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5" /> x402 Top-up (CAW 钱包 → Venice)
          </p>
          {x402Req ? (
            <p className="text-[10px] text-gray-500 font-mono mb-2">
              {x402Req.network} · {(Number(x402Req.amount) / 1_000_000).toFixed(2)} USDC → {x402Req.payTo.slice(0, 6)}…{x402Req.payTo.slice(-4)}
            </p>
          ) : (
            <p className="text-[10px] text-gray-400 mb-2">未获取 x402 challenge</p>
          )}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-gray-500">$</span>
            <input
              type="number"
              min={1}
              max={1000}
              value={topupUsd}
              onChange={(e) => setTopupUsd(Number(e.target.value))}
              className="w-20 rounded border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
            />
            <span className="text-[10px] text-gray-400">USDC</span>
          </div>
          <div className="flex gap-2">
            <button className={secondaryBtn} onClick={loadX402Requirements}>
              查看 x402 challenge
            </button>
            <button
              className={primaryBtn}
              onClick={runTopup}
              disabled={busy === 'topup' || !cawWalletAddress || !hasActivePact}
              title={!cawWalletAddress ? '需要先连接 CAW 钱包' : !hasActivePact ? '需要先激活 Pact' : ''}
            >
              {busy === 'topup' ? '执行中…' : '用 CAW 钱包 x402 充值'}
            </button>
          </div>
        </div>

        {/* 4) Inference test */}
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5" /> 跑一次 Venice Inference
          </p>
          <div className="flex items-center gap-3 mb-2">
            <label className="flex items-center gap-1 text-[10px] cursor-pointer">
              <input type="radio" name="veniceAuthMode" checked={authMode === 'api_key'} onChange={() => setAuthMode('api_key')} className="w-3 h-3" />
              API Key (Bearer)
            </label>
            <label className={`flex items-center gap-1 text-[10px] ${cawWalletAddress && hasActivePact ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}>
              <input type="radio" name="veniceAuthMode" disabled={!cawWalletAddress || !hasActivePact} checked={authMode === 'siwe_x'} onChange={() => setAuthMode('siwe_x')} className="w-3 h-3" />
              X-Sign-In-With-X (钱包签)
            </label>
            {authMode === 'siwe_x' && !siweXResult && (
              <button className="text-[10px] text-[#2563EB] underline" onClick={generateSiweXHeader} disabled={busy === 'siwe'}>
                {busy === 'siwe' ? '签名中…' : '生成签名'}
              </button>
            )}
            {authMode === 'siwe_x' && siweXResult && (
              <span className="text-[10px] text-emerald-600">✓ 已签 ({siweXResult.decoded.signature.slice(0, 10)}…)</span>
            )}
          </div>
          <textarea
            value={promptInput}
            onChange={(e) => setPromptInput(e.target.value)}
            rows={3}
            className="w-full rounded border border-gray-300 px-3 py-2 text-xs mb-2 focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
          />
          <button
            className={primaryBtn}
            onClick={runInference}
            disabled={busy === 'inference' || (authMode === 'api_key' ? !ready : !siweXResult)}
          >
            {busy === 'inference' ? '运行中…' : '运行 inference'}
          </button>
          {authMode === 'api_key' && !ready && <p className="text-[10px] text-gray-400 mt-1">需要先设置 API key</p>}
          {authMode === 'siwe_x' && !siweXResult && <p className="text-[10px] text-gray-400 mt-1">需要先生成钱包签名</p>}
        </div>
      </div>

      {/* Logs */}
      {logs.length > 0 && (
        <details className="mt-4" open>
          <summary className="cursor-pointer text-xs font-medium text-gray-500 flex items-center gap-1">
            <History className="w-3 h-3" />
            Inference 历史 ({logs.length} 条)
          </summary>
          <div className="mt-2 max-h-64 overflow-y-auto space-y-2">
            {logs.map((l) => (
              <div key={l.id} className={`rounded-lg p-2 text-[11px] ${l.status === 'completed' ? 'bg-emerald-50' : 'bg-red-50'}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className={`font-semibold ${l.status === 'completed' ? 'text-emerald-700' : 'text-red-700'}`}>
                    {l.status === 'completed' ? '✓' : '✗'} {l.model}
                  </span>
                  <span className="text-gray-400">{new Date(l.createdAt).toLocaleString()} · {l.durationMs}ms</span>
                </div>
                <p className="text-gray-500">→ {l.prompt}</p>
                {l.status === 'completed' ? (
                  <p className="text-gray-700 mt-1">{l.response}</p>
                ) : (
                  <p className="text-red-600 mt-1">{l.errorMessage}</p>
                )}
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Balance history */}
      {balanceHistory.length > 1 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-medium text-gray-500 flex items-center gap-1">
            <RefreshCw className="w-3 h-3" />
            余额历史 ({balanceHistory.length} 条)
          </summary>
          <div className="mt-2 space-y-1">
            {balanceHistory.map((b) => (
              <div key={b.id} className="text-[10px] font-mono text-gray-500 py-1 border-b border-gray-100">
                {new Date(b.fetchedAt).toLocaleString()} — USD ${b.usdBalance.toFixed(2)} · DIEM {b.diemBalance.toFixed(2)} · {b.source}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
