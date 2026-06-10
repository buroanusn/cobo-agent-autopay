'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, Link2, Smartphone, AlertCircle, Loader2, Copy } from 'lucide-react';
import SectionCard from '@/components/dashboard/v2/SectionCard';

type PairingSession = {
  code?: string;
  status?: 'generated' | 'paired' | 'expired';
  expiresAt?: string;
};

type PairingResp = {
  pairingSession?: PairingSession;
  snapshot?: unknown;
};

type CawStatus = {
  app?: { connectedWalletAddress?: string };
  runtime?: { walletPaired?: boolean; walletAddress?: string };
};

function timeLeft(iso?: string): string {
  if (!iso) return '—';
  const t = Date.parse(iso);
  if (!t) return '—';
  const diff = t - Date.now();
  if (diff <= 0) return '已过期';
  const min = Math.floor(diff / 60_000);
  if (min < 1) return '< 1 分钟';
  if (min < 60) return `${min} 分钟`;
  return `${Math.floor(min / 60)} 小时 ${min % 60} 分钟`;
}

/**
 * 区块 3：CAW 手机配对
 * - 配对码显示 + 过期倒计时
 * - 3 按钮：生成配对码 / 刷新配对状态 / 连接 CAW
 *
 * 数据源：
 *   POST /api/wallet/caw/pairing-code   生成
 *   POST /api/wallet/caw/pairing-code/refresh  刷新
 *   POST /api/wallet/caw/connect        连接（绑定）
 */
export default function CawMobilePairing({ onAfterAction }: { onAfterAction?: () => void }) {
  const [pairing, setPairing] = useState<PairingSession | null>(null);
  const [cawStatus, setCawStatus] = useState<CawStatus | null>(null);
  const [busy, setBusy] = useState<'generate' | 'refresh' | 'connect' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // 初始拉一次 pairing + status
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [s, p] = await Promise.allSettled([
          fetch('/api/wallet/caw/status'),
          fetch('/api/wallet/caw/pairing-code', { method: 'POST' }).catch(() => null),
        ]);
        if (cancelled) return;
        if (s.status === 'fulfilled' && s.value.ok) {
          try {
            const data: CawStatus = await s.value.json();
            if (!cancelled) setCawStatus(data);
          } catch {
            // ignore
          }
        }
        // pairing 初始拉可能没生成过，所以允许失败
        if (p.status === 'fulfilled' && p.value && p.value.ok) {
          try {
            const data: PairingResp = await p.value.json();
            if (!cancelled && data.pairingSession) setPairing(data.pairingSession);
          } catch {
            // ignore
          }
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

  async function callApi(path: string, action: 'generate' | 'refresh' | 'connect') {
    setBusy(action);
    setError(null);
    try {
      const res = await fetch(path, { method: 'POST' });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}`);
      }
      const data = await res.json();
      if (data.pairingSession) setPairing(data.pairingSession);
      // 成功后如果是 connect/refresh，重新拉一次 status 刷新展示
      if (action !== 'generate') {
        const sres = await fetch('/api/wallet/caw/status');
        if (sres.ok) {
          const sd: CawStatus = await sres.json();
          setCawStatus(sd);
        }
      }
      onAfterAction?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : '请求失败');
    } finally {
      setBusy(null);
    }
  }

  const paired = cawStatus?.runtime?.walletPaired === true;
  const walletAddr = cawStatus?.runtime?.walletAddress ?? cawStatus?.app?.connectedWalletAddress;
  const statusLabel = pairing?.status === 'paired' ? '已配对' : pairing?.status === 'expired' ? '已过期' : '待配对';

  return (
    <SectionCard
      title="CAW 手机配对"
      subtitle="在 Cobo Agentic Wallet App 中输入配对码完成绑定"
    >
      {error && (
        <div className="mb-3 flex items-start gap-2 rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-xs text-red-700">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-col md:flex-row items-start md:items-center gap-4 mb-4">
        {/* 配对码大字 */}
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-500 mb-1">配对码</p>
          {pairing?.code ? (
            <div className="flex items-center gap-2">
              <code className="text-2xl font-mono font-bold text-gray-900 tracking-widest">
                {pairing.code}
              </code>
              <button
                onClick={async () => {
                  if (!pairing.code) return;
                  try {
                    await navigator.clipboard.writeText(pairing.code);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  } catch {
                    // ignore
                  }
                }}
                className="p-1.5 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                title="复制"
              >
                <Copy className="w-4 h-4" />
              </button>
              {copied && <span className="text-xs text-emerald-600">已复制</span>}
            </div>
          ) : (
            <p className="text-sm text-gray-400">未生成</p>
          )}
          {pairing?.expiresAt && (
            <p className="text-xs text-gray-500 mt-1">过期倒计时：{timeLeft(pairing.expiresAt)} · 状态：{statusLabel}</p>
          )}
        </div>

        {/* 配对状态环 */}
        <div className="flex-shrink-0">
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center ${
              paired
                ? 'bg-emerald-50 text-emerald-600'
                : 'bg-amber-50 text-amber-600'
            }`}
          >
            <Smartphone className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* 3 按钮 */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => callApi('/api/wallet/caw/pairing-code', 'generate')}
          disabled={busy !== null}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {busy === 'generate' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Smartphone className="w-4 h-4" />}
          生成配对码
        </button>
        <button
          onClick={() => callApi('/api/wallet/caw/pairing-code/refresh', 'refresh')}
          disabled={busy !== null || !pairing}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {busy === 'refresh' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          刷新配对状态
        </button>
        <button
          onClick={() => callApi('/api/wallet/caw/connect', 'connect')}
          disabled={busy !== null}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {busy === 'connect' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
          连接 CAW
        </button>
      </div>

      {walletAddr && (
        <p className="text-xs text-gray-500 mt-3">
          绑定钱包地址：<code className="font-mono text-gray-700">{walletAddr}</code>
        </p>
      )}
    </SectionCard>
  );
}
