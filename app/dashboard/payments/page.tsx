'use client';

import { useEffect, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import TransactionTable from '@/components/payments/TransactionTable';
import { Loader2 } from 'lucide-react';

export default function PaymentsPage() {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/wallet/caw/transactions?limit=100');
        if (res.ok) {
          const data = await res.json();
          setRecords(data?.records ?? []);
        }
      } catch (err) {
        console.error('Failed to load transactions', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Compute stats
  const credited = records.filter((r) => r.status === 'completed' || r.status === 'credited');
  const failed = records.filter((r) => r.status === 'failed');
  const processing = records.filter(
    (r) => r.status === 'pending' || r.status === 'chain_pending' || r.status === 'caw_submitted'
  );
  const totalUsdc = credited.reduce(
    (sum: number, r: any) => sum + (r.usdcMinor || 0),
    0
  );

  if (loading) {
    return (
      <AppLayout title="Payments">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Payments">
      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <p className="text-xs text-gray-500 font-medium">成功支付</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">
            ${(totalUsdc / 1_000_000).toFixed(2)}
          </p>
          <p className="text-xs text-gray-400 mt-1">{credited.length} 笔 USDC 已到账</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <p className="text-xs text-gray-500 font-medium">处理中</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{processing.length}</p>
          <p className="text-xs text-gray-400 mt-1">等待 CAW 或链上确认</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <p className="text-xs text-gray-500 font-medium">失败</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{failed.length}</p>
          <p className="text-xs text-gray-400 mt-1">策略拒绝或执行失败</p>
        </div>
      </div>

      {/* Transaction table */}
      <TransactionTable records={records} />
    </AppLayout>
  );
}
