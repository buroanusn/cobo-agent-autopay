'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import SectionCard from '@/components/dashboard/v2/SectionCard';

type CawStatus = {
  runtime?: {
    mode?: 'mock' | 'http';
    walletPaired?: boolean;
    walletAddress?: string;
  };
  app?: {
    authorizationStatus?: string;
    activeAuthorization?: boolean;
    connectedWalletAddress?: string;
  };
};

type PactsResp = { pacts?: unknown[]; records?: unknown[] };

function shortAddr(a?: string | null): string {
  if (!a) return '—';
  if (a.length < 12) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

/**
 * 区块 3：CAW 钱包信息
 * - 钱包地址
 * - 运行模式
 * - 配对状态
 * - 授权状态
 * - 活跃 Pact
 *
 * 数据源：/api/wallet/caw/status + /api/wallet/caw/pacts
 */
export default function CawWalletInfo() {
  const [cawStatus, setCawStatus] = useState<CawStatus | null>(null);
  const [pactCount, setPactCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [statusRes, pactsRes] = await Promise.allSettled([
          fetch('/api/wallet/caw/status'),
          fetch('/api/wallet/caw/pacts'),
        ]);

        if (statusRes.status === 'fulfilled' && statusRes.value.ok) {
          const data: CawStatus = await statusRes.value.json();
          if (!cancelled) setCawStatus(data);
        }

        if (pactsRes.status === 'fulfilled' && pactsRes.value.ok) {
          try {
            const data: PactsResp = await pactsRes.value.json();
            const list = data.pacts ?? data.records ?? [];
            if (!cancelled) setPactCount(list.length);
          } catch {
            // ignore
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const runtime = cawStatus?.runtime;
  const app = cawStatus?.app;
  const walletAddr = runtime?.walletAddress ?? app?.connectedWalletAddress;

  return (
    <SectionCard
      title="CAW 钱包信息"
      subtitle="CAW 钱包地址、模式、配对、授权与活跃 Pact"
      loading={loading}
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between py-2 border-b border-gray-100">
          <span className="text-sm text-gray-600">钱包地址</span>
          <span className="text-sm font-mono text-gray-900" title={walletAddr ?? ''}>
            {shortAddr(walletAddr)}
          </span>
        </div>
        <div className="flex items-center justify-between py-2 border-b border-gray-100">
          <span className="text-sm text-gray-600">运行模式</span>
          <span className="text-sm font-medium text-gray-900">
            {runtime?.mode === 'mock'
              ? 'Mock（演示）'
              : runtime?.mode === 'http'
                ? 'HTTP（真实）'
                : '—'}
          </span>
        </div>
        <div className="flex items-center justify-between py-2 border-b border-gray-100">
          <span className="text-sm text-gray-600">配对状态</span>
          <span className="text-sm font-medium">
            {runtime?.walletPaired === true ? (
              <span className="inline-flex items-center gap-1 text-emerald-700">
                <CheckCircle2 className="w-3.5 h-3.5" />
                已配对
              </span>
            ) : runtime?.walletPaired === false ? (
              <span className="inline-flex items-center gap-1 text-amber-700">
                <XCircle className="w-3.5 h-3.5" />
                未配对
              </span>
            ) : (
              <span className="text-gray-500">—</span>
            )}
          </span>
        </div>
        <div className="flex items-center justify-between py-2 border-b border-gray-100">
          <span className="text-sm text-gray-600">授权状态</span>
          <span className="text-sm font-medium">
            {app?.activeAuthorization ? (
              <span className="inline-flex items-center gap-1 text-emerald-700">
                <CheckCircle2 className="w-3.5 h-3.5" />
                已授权
              </span>
            ) : app?.authorizationStatus ? (
              <span className="text-gray-700">{app.authorizationStatus}</span>
            ) : (
              <span className="text-gray-500">—</span>
            )}
          </span>
        </div>
        <div className="flex items-center justify-between py-2">
          <span className="text-sm text-gray-600">活跃 Pact</span>
          <span className="text-sm font-medium text-gray-900">
            {pactCount === null ? '—' : pactCount > 0 ? `${pactCount} 个` : '0 个'}
          </span>
        </div>
      </div>
    </SectionCard>
  );
}
