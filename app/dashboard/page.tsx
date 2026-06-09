'use client';

import { useEffect, useState, useCallback } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import StatsCards from '@/components/dashboard/StatsCards';
import RecentPayments from '@/components/dashboard/RecentPayments';
import CreditsPanel from '@/components/dashboard/CreditsPanel';
import AgentPanel from '@/components/dashboard/AgentPanel';
import CawPanel from '@/components/dashboard/CawPanel';
import VenicePanel from '@/components/dashboard/VenicePanel';
import DiagnosticsPanel from '@/components/dashboard/DiagnosticsPanel';
import PaymentStatsPanel from '@/components/dashboard/PaymentStatsPanel';
import GuardrailsPanel from '@/components/dashboard/GuardrailsPanel';
import { Loader2 } from 'lucide-react';

type Toast = { type: 'success' | 'error'; message: string } | null;

type CawStatusResult = {
  runtime: {
    mode: 'mock' | 'http';
    environment: 'dev' | 'prod' | 'unknown';
    apiConfigured: boolean;
    walletConfigured: boolean;
    walletId?: string;
    walletName?: string;
    walletStatus?: string;
    walletAddress?: string;
    walletPaired: boolean;
    chainId: string;
    chainName: string;
  };
  app: {
    connectedWalletAddress?: string;
    authorizationStatus: string;
    pactId?: string;
    activeAuthorization: boolean;
  };
  spendReadiness?: {
    requiredUsdcMinor: number;
    remainingUsdcMinor: number;
    allowanceUsdcMinor?: number;
    walletUsdcMinor?: number;
    gasEth?: string;
    pactExpiresAt?: string;
    error?: string;
  };
  readyForRealPayment: boolean;
  missing: string[];
  cawConfigured?: boolean;
};

type DashboardSnapshot = {
  user: { email: string; cawWalletAddress?: string };
  account: { balanceCredits: number; lowBalanceThresholdCredits: number; autoTopupCredits: number };
  authorization?: { status: string; pactId: string; singleLimitUsdcMinor: number; spentTodayUsdcMinor: number; dailyLimitUsdcMinor: number; expiresAt?: string };
  guardrails: { singleLimitUsdcMinor: number; dailyLimitUsdcMinor: number; reviewThresholdUsdcMinor: number; allowedChains: string[]; generatedBy: string };
  paymentStats: { spent24hUsdcMinor: number; spent30dUsdcMinor: number; txCount24h: number; txCount30d: number; automaticPayments: number; manualApprovalPayments: number };
  pendingApprovals: Array<{ id: string; amountUsdcMinor: number; walletAddress: string; createdAt: string }>;
  pactDetails?: { reviewIfAmountUsdcMinor: number; denyIfAmountUsdcMinor: number; remainingUsdcMinor: number; completionTimeElapsedDays: number };
  topupOrders: any[];
  ledgerEntries: Array<{ id: string; type: string; creditsDelta: number; balanceAfterCredits: number; createdAt: string; txHash?: string }>;
  network: { chainId: number; name: string; usdcAddress: string };
  pricing: { creditsPerUsdc: number };
};

export default function DashboardPage() {
  const [veniceBalance, setVeniceBalance] = useState<number | null>(null);
  const [cawAddress, setCawAddress] = useState<string | null>(null);
  const [paymentLockStatus, setPaymentLockStatus] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [monthlyTopups, setMonthlyTopups] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [topupLoading, setTopupLoading] = useState(false);
  const [toast, setToast] = useState<Toast>(null);

  // NEW: CAW status + dashboard snapshot
  const [cawStatus, setCawStatus] = useState<CawStatusResult | null>(null);
  const [dashboardSnapshot, setDashboardSnapshot] = useState<DashboardSnapshot | null>(null);

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const [balanceRes, statusRes, sweepRes, txRes, creditsRes] = await Promise.allSettled([
          fetch('/api/venice/balance'),
          fetch('/api/wallet/caw/status'),
          fetch('/api/credits/topup/sweep-status'),
          fetch('/api/wallet/caw/transactions?limit=10'),
          fetch('/api/credits/balance'),
        ]);

        // Venice balance
        if (balanceRes.status === 'fulfilled') {
          try {
            const data = await balanceRes.value.json();
            setVeniceBalance(data.balance ?? data.snapshot?.usdBalance ?? null);
          } catch { /* ignore */ }
        }

        // CAW status
        if (statusRes.status === 'fulfilled') {
          try {
            const data = await statusRes.value.json();
            setCawStatus(data);
            setCawAddress(data?.app?.connectedWalletAddress ?? data?.runtime?.walletAddress ?? null);
          } catch { /* ignore */ }
        }

        // Sweep status — payment lock
        if (sweepRes.status === 'fulfilled') {
          try {
            const data = await sweepRes.value.json();
            setPaymentLockStatus(data?.lastError ? 'cooldown' : 'idle');
          } catch { /* ignore */ }
        }

        // Transactions
        if (txRes.status === 'fulfilled') {
          try {
            const data = await txRes.value.json();
            const records = data?.records ?? [];
            setTransactions(records);
            setMonthlyTopups(records.filter((r: any) => r.type === 'topup' || r.description?.includes('topup')).length);
          } catch { /* ignore */ }
        }

        // NEW: Dashboard snapshot (credits balance + ledger + stats + pactDetails + pendingApprovals + more)
        if (creditsRes.status === 'fulfilled') {
          try {
            const data = await creditsRes.value.json();
            setDashboardSnapshot(data);
          } catch { /* ignore */ }
        }
      } catch (err) {
        console.error('Failed to load dashboard data', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleManualTopup() {
    setTopupLoading(true);
    try {
      const res = await fetch('/api/venice/x402-topup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ confirmed: true }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        showToast('success', '充值请求已提交');
        // Refresh balance
        const balanceRes = await fetch('/api/venice/balance');
        try {
          const balanceData = await balanceRes.json();
          if (balanceData.balance !== undefined) setVeniceBalance(balanceData.balance);
          else if (balanceData.snapshot?.usdBalance !== undefined) setVeniceBalance(balanceData.snapshot.usdBalance);
        } catch { /* ignore */ }
      } else {
        showToast('error', data.error || data?.topup?.reason || '充值失败');
      }
    } catch (err) {
      showToast('error', '充值请求失败');
    } finally {
      setTopupLoading(false);
    }
  }

  const statsData = { veniceBalance, cawAddress, paymentLockStatus, monthlyTopups, creditBalance: dashboardSnapshot?.account?.balanceCredits ?? null };

  if (loading) {
    return (
      <AppLayout title="Dashboard" companyName={dashboardSnapshot?.network?.name} creditsPerUsdc={dashboardSnapshot?.pricing?.creditsPerUsdc}>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
        </div>
      </AppLayout>
    );
  }

  const hasActivePact = cawStatus
    ? !cawStatus.missing.some((m: string) => m.includes('Pact'))
    : false;

  return (
    <AppLayout title="Dashboard" companyName={dashboardSnapshot?.network?.name} creditsPerUsdc={dashboardSnapshot?.pricing?.creditsPerUsdc}>
      {/* Toast notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all ${
          toast.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {toast.message}
        </div>
      )}

      {/* Stats cards */}
      <StatsCards data={statsData} />

      {/* Row 1: Agent + Credits */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <AgentPanel />
        <CreditsPanel snapshot={dashboardSnapshot} onTopup={handleManualTopup} topupLoading={topupLoading} />
      </div>

      {/* Row 2: CAW Panel (full width) */}
      <div className="mb-8">
        <CawPanel />
      </div>

      {/* Row 3: Venice Panel (full width) */}
      <div className="mb-8">
        <VenicePanel
          cawWalletAddress={cawStatus?.runtime.walletAddress ?? dashboardSnapshot?.user?.cawWalletAddress}
          hasActivePact={hasActivePact}
          cawMode={cawStatus?.runtime.mode ?? 'mock'}
        />
      </div>

      {/* Row 4: Diagnostics + PaymentStats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <DiagnosticsPanel cawStatus={cawStatus} snapshot={dashboardSnapshot} />
        <PaymentStatsPanel snapshot={dashboardSnapshot} />
      </div>

      {/* Row 5: Guardrails + Recent Payments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <GuardrailsPanel snapshot={dashboardSnapshot} />
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">最近支付记录</h3>
          <RecentPayments entries={transactions} />
        </div>
      </div>

      {/* Manual topup button — kept for backward compatibility */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm mb-8">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">手动充值 (x402)</h3>
        <p className="text-xs text-gray-500 mb-4">
          手动触发一次 Venice x402 充值。
        </p>
        <button
          onClick={handleManualTopup}
          disabled={topupLoading}
          className="inline-flex items-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#1D4ED8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {topupLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              充值中...
            </>
          ) : (
            '手动触发充值'
          )}
        </button>
      </div>
    </AppLayout>
  );
}
