'use client';

import { useEffect, useState, useCallback } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import StatsCards from '@/components/dashboard/StatsCards';
import RecentPayments from '@/components/dashboard/RecentPayments';
import { Loader2 } from 'lucide-react';

type Toast = { type: 'success' | 'error'; message: string } | null;

export default function DashboardPage() {
  const [veniceBalance, setVeniceBalance] = useState<number | null>(null);
  const [cawAddress, setCawAddress] = useState<string | null>(null);
  const [paymentLockStatus, setPaymentLockStatus] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [monthlyTopups, setMonthlyTopups] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [topupLoading, setTopupLoading] = useState(false);
  const [toast, setToast] = useState<Toast>(null);

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const [balanceRes, statusRes, sweepRes, txRes] = await Promise.allSettled([
          fetch('/api/venice/balance'),
          fetch('/api/wallet/caw/status'),
          fetch('/api/credits/topup/sweep-status'),
          fetch('/api/wallet/caw/transactions?limit=10'),
        ]);

        // Venice balance
        if (balanceRes.status === 'fulfilled') {
          const data = await balanceRes.value.json();
          setVeniceBalance(data.balance ?? null);
        }

        // CAW status — get wallet address
        if (statusRes.status === 'fulfilled') {
          const data = await statusRes.value.json();
          setCawAddress(data?.app?.connectedWalletAddress ?? data?.runtime?.walletAddress ?? null);
        }

        // Sweep status — get payment lock
        if (sweepRes.status === 'fulfilled') {
          const data = await sweepRes.value.json();
          // The status return structure — look for anything indicating lock state
          setPaymentLockStatus(data?.lastError ? 'cooldown' : 'idle');
        }

        // Transactions
        if (txRes.status === 'fulfilled') {
          const data = await txRes.value.json();
          const records = data?.records ?? [];
          setTransactions(records);
          setMonthlyTopups(records.filter((r: any) => r.type === 'topup' || r.description?.includes('topup')).length);
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
        const balanceData = await balanceRes.json();
        if (balanceData.balance !== undefined) setVeniceBalance(balanceData.balance);
      } else {
        showToast('error', data.error || data?.topup?.reason || '充值失败');
      }
    } catch (err) {
      showToast('error', '充值请求失败');
    } finally {
      setTopupLoading(false);
    }
  }

  const statsData = { veniceBalance, cawAddress, paymentLockStatus, monthlyTopups };

  if (loading) {
    return (
      <AppLayout title="Dashboard">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Dashboard">
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

      {/* Recent payments */}
      <div className="mb-8">
        <RecentPayments entries={transactions} />
      </div>

      {/* Manual topup button */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">手动充值</h3>
        <p className="text-xs text-gray-500 mb-4">
          手动触发一次 Venice x402 充值，向 CAW 钱包充值 1 USDC。
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
