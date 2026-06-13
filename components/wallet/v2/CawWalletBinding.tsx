'use client';

import { useEffect, useState } from 'react';
import { Search, Zap, AlertCircle, Loader2, Wallet } from 'lucide-react';
import SectionCard from '@/components/dashboard/v2/SectionCard';

type WalletSummary = {
  walletUuid: string;
  walletName: string;
  agentId: string;
  agentName: string;
  apiUrl: string;
  env: 'dev' | 'prod' | 'unknown';
  isActive: boolean;
  status: string;
  onboardedAt: string;
};

type DiscoverResp = {
  ok: boolean;
  wallets?: WalletSummary[];
  error?: string;
};

type CawStatus = {
  runtime?: {
    mode?: 'mock' | 'http';
    chainId?: string;
    chainName?: string;
    walletId?: string;
    walletName?: string;
    walletStatus?: string;
    walletAddress?: string;
  };
  app?: { connectedWalletAddress?: string };
};

const CHAIN_OPTIONS = [
  { id: 'TBASE_SETH', name: 'Base Sepolia（测试网）' },
  { id: 'BASE_ETH', name: 'Base Mainnet（主网）' },
];

function shortAddr(a?: string | null): string {
  if (!a) return '—';
  if (a.length < 12) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

/**
 * 区块 4：CAW 钱包绑定
 * - 状态标签：已配置 / 缺少
 * - 按钮：检测本机钱包 / 自动绑定默认钱包
 * - 手动绑定：钱包 UUID 输入框 + 绑定按钮
 * - 网络选择：主网 / 测试网（默认显示当前 chain）
 * - 钱包信息展示：钱包 ID / 钱包名称 / 状态 / 链 / 钱包地址 / App 钱包
 *
 * 数据源：
 *   GET /api/wallet/caw/discover   检测本机钱包
 *   POST /api/wallet/caw/connect   自动绑定或手动绑定
 *   GET /api/wallet/caw/status     展示已绑定钱包
 */
export default function CawWalletBinding({ onAfterAction }: { onAfterAction?: () => void }) {
  const [cawStatus, setCawStatus] = useState<CawStatus | null>(null);
  const [wallets, setWallets] = useState<WalletSummary[] | null>(null);
  const [detectError, setDetectError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'detect' | 'auto' | 'manual' | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [manualUuid, setManualUuid] = useState('');
  const [selectedChain, setSelectedChain] = useState<string>('TBASE_SETH');

  useEffect(() => {
    let cancelled = false;
    async function loadStatus() {
      try {
        const res = await fetch('/api/wallet/caw/status');
        if (res.ok) {
          const data: CawStatus = await res.json();
          if (!cancelled) {
            setCawStatus(data);
            if (data.runtime?.chainId) setSelectedChain(data.runtime.chainId);
          }
        }
      } catch {
        // ignore
      }
    }
    loadStatus();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleDetect() {
    setBusy('detect');
    setDetectError(null);
    setActionMsg(null);
    try {
      const res = await fetch('/api/wallet/caw/discover');
      const data: DiscoverResp = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setWallets(data.wallets ?? []);
    } catch (e) {
      setDetectError(e instanceof Error ? e.message : '检测失败');
    } finally {
      setBusy(null);
    }
  }

  type ConfigCheck = {
    cliAvailable: boolean;
    envVars: { apiUrl: boolean; apiKey: boolean; walletId: boolean };
    issues: string[];
    suggestions: string[];
  };

  async function preflightCheck(): Promise<ConfigCheck | null> {
    try {
      const res = await fetch('/api/wallet/caw/config-check');
      if (res.ok) return await res.json();
    } catch {
      // ignore — proceed without preflight
    }
    return null;
  }

  async function handleAutoBind() {
    setBusy('auto');
    setActionMsg(null);
    const check = await preflightCheck();
    if (check && check.issues.length > 0) {
      setActionMsg(
        `配置问题：\n${check.issues.join('\n')}\n\n修复建议：\n${check.suggestions.join('\n')}`
      );
      setBusy(null);
      return;
    }
    try {
      const res = await fetch('/api/wallet/caw/connect', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : `HTTP ${res.status}`);
      }
      setActionMsg('已自动绑定默认钱包');
      const sres = await fetch('/api/wallet/caw/status');
      if (sres.ok) setCawStatus(await sres.json());
      onAfterAction?.();
    } catch (e) {
      setActionMsg(`绑定失败：${e instanceof Error ? e.message : 'unknown'}`);
    } finally {
      setBusy(null);
    }
  }

  async function handleManualBind() {
    if (!manualUuid.trim()) {
      setActionMsg('请先输入钱包 UUID');
      return;
    }
    setBusy('manual');
    setActionMsg(null);
    const check = await preflightCheck();
    if (check && check.issues.length > 0) {
      setActionMsg(
        `配置问题：\n${check.issues.join('\n')}\n\n修复建议：\n${check.suggestions.join('\n')}`
      );
      setBusy(null);
      return;
    }
    try {
      const res = await fetch('/api/wallet/caw/connect', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ cawWalletId: manualUuid.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : `HTTP ${res.status}`);
      }
      setActionMsg('手动绑定成功');
      setManualUuid('');
      const sres = await fetch('/api/wallet/caw/status');
      if (sres.ok) setCawStatus(await sres.json());
      onAfterAction?.();
    } catch (e) {
      setActionMsg(`绑定失败：${e instanceof Error ? e.message : 'unknown'}`);
    } finally {
      setBusy(null);
    }
  }

  const runtime = cawStatus?.runtime;
  const app = cawStatus?.app;
  const isConfigured = !!(runtime?.walletId && (app?.connectedWalletAddress ?? runtime.walletAddress));

  return (
    <SectionCard
      title="CAW 钱包绑定"
      subtitle="检测本机 CAW 钱包、绑定 UUID、查看链和地址"
    >
      {/* 状态标签 + 按钮行 */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium ${
            isConfigured
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-red-50 text-red-700'
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isConfigured ? 'bg-emerald-500' : 'bg-red-500'
            }`}
          />
          {isConfigured ? '已配置' : '缺少'}
        </span>

        <button
          onClick={handleDetect}
          disabled={busy !== null}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {busy === 'detect' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          检测本机钱包
        </button>

        <button
          onClick={handleAutoBind}
          disabled={busy !== null}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {busy === 'auto' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          自动绑定默认钱包
        </button>
      </div>

      {/* 手动绑定 */}
      <div className="rounded-lg bg-gray-50 p-3 mb-4">
        <p className="text-xs font-medium text-gray-600 mb-2">手动绑定</p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={manualUuid}
            onChange={(e) => setManualUuid(e.target.value)}
            placeholder="钱包 UUID"
            className="flex-1 min-w-[180px] rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={handleManualBind}
            disabled={busy !== null}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {busy === 'manual' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
            绑定
          </button>
        </div>
      </div>

      {/* 网络选择 */}
      <div className="mb-4">
        <p className="text-xs font-medium text-gray-600 mb-2">网络选择</p>
        <div className="flex flex-wrap gap-2">
          {CHAIN_OPTIONS.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedChain(c.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                selectedChain === c.id
                  ? 'bg-blue-50 border-blue-300 text-blue-700'
                  : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-gray-400 mt-1.5">当前 runtime chain: {selectedChain}</p>
      </div>

      {/* 钱包信息展示 */}
      <div className="space-y-2 border-t border-gray-100 pt-3">
        <div className="flex items-center justify-between py-1">
          <span className="text-xs text-gray-500">钱包 ID</span>
          <span className="text-xs font-mono text-gray-900">{runtime?.walletId ?? '—'}</span>
        </div>
        <div className="flex items-center justify-between py-1">
          <span className="text-xs text-gray-500">钱包名称</span>
          <span className="text-xs text-gray-900">{runtime?.walletName ?? '—'}</span>
        </div>
        <div className="flex items-center justify-between py-1">
          <span className="text-xs text-gray-500">状态</span>
          <span className="text-xs text-gray-900">{runtime?.walletStatus ?? '—'}</span>
        </div>
        <div className="flex items-center justify-between py-1">
          <span className="text-xs text-gray-500">链</span>
          <span className="text-xs text-gray-900">
            {runtime?.chainId ?? '—'} {runtime?.chainName ? `· ${runtime.chainName}` : ''}
          </span>
        </div>
        <div className="flex items-center justify-between py-1">
          <span className="text-xs text-gray-500">钱包地址</span>
          <span className="text-xs font-mono text-gray-900" title={runtime?.walletAddress ?? ''}>
            {shortAddr(runtime?.walletAddress ?? app?.connectedWalletAddress)}
          </span>
        </div>
        <div className="flex items-center justify-between py-1">
          <span className="text-xs text-gray-500">App 钱包</span>
          <span className="text-xs font-mono text-gray-900" title={app?.connectedWalletAddress ?? ''}>
            {shortAddr(app?.connectedWalletAddress)}
          </span>
        </div>
      </div>

      {/* 检测结果 */}
      {detectError && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-xs text-red-700">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{detectError}</span>
        </div>
      )}

      {wallets && wallets.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium text-gray-600 mb-2">本机检测到 {wallets.length} 个钱包</p>
          <div className="space-y-1.5">
            {wallets.map((w) => (
              <button
                key={w.walletUuid}
                onClick={() => setManualUuid(w.walletUuid)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50/30 transition-colors text-left"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">{w.walletName}</p>
                  <p className="text-[11px] font-mono text-gray-500 mt-0.5">{w.walletUuid}</p>
                </div>
                <span
                  className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${
                    w.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {w.isActive ? 'active' : w.status}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {actionMsg && (
        <div className="mt-3 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 text-xs text-amber-800 whitespace-pre-line">
          {actionMsg}
        </div>
      )}
    </SectionCard>
  );
}
