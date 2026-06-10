'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import SectionCard from '@/components/dashboard/v2/SectionCard';

type CawStatus = {
  runtime?: { apiConfigured?: boolean };
  app?: { connectedWalletAddress?: string };
};

type BalanceResp = { ok?: boolean; balance?: number; snapshot?: { usdBalance?: number } };

function shortAddr(a?: string | null): string {
  if (!a) return '—';
  if (a.length < 12) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

/**
 * 区块 2：Venice 配置
 * - API Key 状态：runtime.apiConfigured（caw status 里查 VENICE_API_KEY 是否有配）
 *   实际更准：process.env.VENICE_API_KEY — 但前端拿不到，用 caw.status 的 apiConfigured 替代
 *   （按项目现状，runtime.apiConfigured 通常也指代 Venice key 是否配齐，文档原意如此）
 * - x402 余额：/api/venice/balance
 * - 充值地址：app.connectedWalletAddress（CAW 钱包地址 = x402 充值目标）
 *
 * 数据源：/api/wallet/caw/status + /api/venice/balance
 */
export default function VeniceConfig() {
  const [cawStatus, setCawStatus] = useState<CawStatus | null>(null);
  const [veniceBalance, setVeniceBalance] = useState<number | null>(null);
  const [veniceLoading, setVeniceLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function loadCaw() {
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
    async function loadVenice() {
      try {
        const res = await fetch('/api/venice/balance');
        if (res.ok) {
          const data: BalanceResp = await res.json();
          if (!cancelled) {
            setVeniceBalance(data.balance ?? data.snapshot?.usdBalance ?? null);
          }
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setVeniceLoading(false);
      }
    }
    loadCaw();
    loadVenice();
    return () => {
      cancelled = true;
    };
  }, []);

  // 字段含义：runtime.apiConfigured 在 caw status 里表示 CAW API 是否配置
  // Venice API Key 是否配置需要看 process.env.VENICE_API_KEY — 前端不可见
  // 按文档原意"已配置 / 未配置 API Key"指的是 Venice 自己的 key
  // 兜底：尝试用 balance API 响应状态推断（200 成功 = 已配，401/402 = 未配或无效）
  const veniceKeyConfigured = veniceBalance !== null;
  const walletAddress = cawStatus?.app?.connectedWalletAddress;

  return (
    <SectionCard
      title="Venice 配置"
      subtitle="Venice AI API Key、x402 余额与充值地址"
    >
      <div className="space-y-3">
        {/* API Key 状态 */}
        <div className="flex items-center justify-between py-2 border-b border-gray-100">
          <span className="text-sm text-gray-600">API Key</span>
          <span className="text-sm font-medium">
            {veniceKeyConfigured ? (
              <span className="inline-flex items-center gap-1 text-emerald-700">
                <CheckCircle2 className="w-3.5 h-3.5" />
                已配置
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-amber-700">
                <XCircle className="w-3.5 h-3.5" />
                未配置
              </span>
            )}
          </span>
        </div>

        {/* x402 余额 */}
        <div className="flex items-center justify-between py-2 border-b border-gray-100">
          <span className="text-sm text-gray-600">x402 余额</span>
          <span className="text-sm font-semibold text-gray-900">
            {veniceLoading ? '—' : veniceBalance !== null ? `$${veniceBalance.toFixed(2)}` : '—'}
          </span>
        </div>

        {/* 充值地址 */}
        <div className="flex items-center justify-between py-2">
          <span className="text-sm text-gray-600">充值地址</span>
          <span className="text-sm font-mono text-gray-600" title={walletAddress ?? ''}>
            {shortAddr(walletAddress)}
          </span>
        </div>
      </div>
    </SectionCard>
  );
}
