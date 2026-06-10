'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, XCircle, AlertTriangle, ArrowRight, CircleDashed } from 'lucide-react';
import SectionCard from './SectionCard';

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
  cawConfigured?: boolean;
  readyForRealPayment?: boolean;
  missing?: string[];
};

const STATUS_PILL: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  ready: { label: '可真实支付', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  mock: { label: '模拟模式', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: AlertTriangle },
  notReady: { label: '未就绪', color: 'bg-red-50 text-red-700 border-red-200', icon: XCircle },
};

const CHECK_LABEL: Record<string, string> = {
  mode: '模式',
  wallet: '钱包',
  paired: '配对',
  pact: 'Pact 授权',
};

function Pill({ ok, label, hint }: { ok: boolean | 'pending'; label: string; hint?: string }) {
  if (ok === 'pending') {
    return (
      <div className="flex items-center gap-1.5 text-xs text-gray-400">
        <CircleDashed className="w-3.5 h-3.5" />
        <span>{label}：加载中</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 text-xs">
      {ok ? (
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
      ) : (
        <XCircle className="w-3.5 h-3.5 text-red-500" />
      )}
      <span className={ok ? 'text-gray-700' : 'text-gray-700'}>
        {label}：<span className="font-medium">{ok ? hint || '就绪' : hint || '缺少'}</span>
      </span>
    </div>
  );
}

/**
 * 区块 2：真实 CAW 接入状态条
 * 数据源：/api/wallet/caw/status
 * 字段：cawConfigured / readyForRealPayment / runtime.mode / runtime.walletPaired / app.activeAuthorization / missing[]
 */
export default function ReadinessSection() {
  const [status, setStatus] = useState<CawStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/wallet/caw/status');
        if (!res.ok) {
          if (!cancelled) setError(`HTTP ${res.status}`);
          return;
        }
        const data: CawStatus = await res.json();
        if (!cancelled) setStatus(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'fetch failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const mode = status?.runtime?.mode;
  const ready = status?.readyForRealPayment === true;
  const pillKey = ready ? 'ready' : mode === 'mock' ? 'mock' : 'notReady';
  const pill = STATUS_PILL[pillKey];
  const PillIcon = pill.icon;

  const walletOk = !!status?.app?.connectedWalletAddress;
  const pairedOk = status?.runtime?.walletPaired === true;
  const pactOk = status?.app?.activeAuthorization === true;
  const missing = status?.missing ?? [];

  return (
    <SectionCard
      title="真实 CAW 接入状态"
      subtitle="自检系统是否已就绪执行真实支付"
      loading={loading}
    >
      {error ? (
        <p className="text-xs text-red-600">加载失败：{error}</p>
      ) : (
        <>
          {/* 主状态徽章 */}
          <div className="flex items-center gap-3 mb-4">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold border ${pill.color}`}>
              <PillIcon className="w-4 h-4" />
              {pill.label}
            </span>
            <span className="text-xs text-gray-500">
              {mode === 'http' ? '真实 CAW' : mode === 'mock' ? 'Mock 模式' : '—'}
            </span>
          </div>

          {/* 4 项子检查 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2 mb-4">
            <Pill
              ok={status ? (mode === 'http' ? true : mode === 'mock' ? 'pending' : false) : 'pending'}
              label={CHECK_LABEL.mode}
              hint={mode === 'http' ? '真实 CAW' : mode === 'mock' ? 'Mock' : '未配置'}
            />
            <Pill
              ok={status ? walletOk : 'pending'}
              label={CHECK_LABEL.wallet}
              hint={walletOk ? '已配置' : '缺少'}
            />
            <Pill
              ok={status ? pairedOk : 'pending'}
              label={CHECK_LABEL.paired}
              hint={pairedOk ? '已配对' : '未配对'}
            />
            <Pill
              ok={status ? pactOk : 'pending'}
              label={CHECK_LABEL.pact}
              hint={pactOk ? '就绪' : '需 Pact'}
            />
          </div>

          {/* 缺少配置列表 */}
          {missing.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mb-4">
              <span className="text-xs text-red-600 font-medium mr-1">缺少：</span>
              {missing.map((m, i) => (
                <span
                  key={i}
                  className="text-[11px] px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-100"
                >
                  {m}
                </span>
              ))}
            </div>
          )}

          {/* 跳转 Wallet */}
          <Link
            href="/dashboard/wallet"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
            title="Wallet 页面正在重写中"
          >
            下一步：前往 Wallet 修复
            <ArrowRight className="w-4 h-4" />
          </Link>
        </>
      )}
    </SectionCard>
  );
}
