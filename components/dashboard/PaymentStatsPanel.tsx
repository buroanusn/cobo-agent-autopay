'use client';

import { useState } from 'react';
import { BarChart3, ShieldCheck, Clock, AlertTriangle, ExternalLink } from 'lucide-react';

type DashboardSnapshot = {
  paymentStats: {
    spent24hUsdcMinor: number;
    spent30dUsdcMinor: number;
    txCount24h: number;
    txCount30d: number;
    automaticPayments: number;
    manualApprovalPayments: number;
  };
  pactDetails?: {
    reviewIfAmountUsdcMinor: number;
    denyIfAmountUsdcMinor: number;
    remainingUsdcMinor: number;
    completionTimeElapsedDays: number;
  };
  pendingApprovals: Array<{
    id: string;
    amountUsdcMinor: number;
    walletAddress: string;
    createdAt: string;
  }>;
};

function fmtUsdc(minor: number) {
  return `$${(minor / 1_000_000).toFixed(2)}`;
}

export default function PaymentStatsPanel({ snapshot }: { snapshot: DashboardSnapshot | null }) {
  if (!snapshot) return null;

  const { paymentStats: s, pactDetails: pd, pendingApprovals } = snapshot;

  return (
    <div className="space-y-6">
      {/* Payment Stats */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-4">
          <BarChart3 className="w-4 h-4 text-blue-600" />
          支付统计
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500">24h 支出</p>
            <p className="text-sm font-bold text-gray-900 mt-1">{fmtUsdc(s.spent24hUsdcMinor)}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500">30d 支出</p>
            <p className="text-sm font-bold text-gray-900 mt-1">{fmtUsdc(s.spent30dUsdcMinor)}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500">24h / 30d 笔数</p>
            <p className="text-sm font-bold text-gray-900 mt-1">{s.txCount24h} / {s.txCount30d}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500">自动 / 人工</p>
            <p className="text-sm font-bold text-gray-900 mt-1">{s.automaticPayments} / {s.manualApprovalPayments}</p>
          </div>
        </div>
      </div>

      {/* Pact Management */}
      {pd && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            Pact 管理
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">超过需审批</p>
              <p className="text-sm font-bold text-gray-900 mt-1">{fmtUsdc(pd.reviewIfAmountUsdcMinor)}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">超过直接拒绝</p>
              <p className="text-sm font-bold text-gray-900 mt-1">{fmtUsdc(pd.denyIfAmountUsdcMinor)}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">剩余额度</p>
              <p className="text-sm font-bold text-gray-900 mt-1">{fmtUsdc(pd.remainingUsdcMinor)}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">剩余天数</p>
              <p className="text-sm font-bold text-gray-900 mt-1">{pd.completionTimeElapsedDays} 天</p>
            </div>
          </div>
        </div>
      )}

      {/* Pending Approvals */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-4">
          <Clock className="w-4 h-4 text-amber-600" />
          待审批
          {pendingApprovals.length > 0 && (
            <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-medium">{pendingApprovals.length}</span>
          )}
        </h3>
        {pendingApprovals.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4">暂无待审批</p>
        ) : (
          <div className="space-y-2">
            {pendingApprovals.map((item) => (
              <div key={item.id} className="flex items-center justify-between py-2 px-3 bg-amber-50/50 rounded-lg text-xs">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-3 h-3 text-amber-600" />
                  <span className="font-medium">{fmtUsdc(item.amountUsdcMinor)} USDC</span>
                  <span className="text-gray-400 font-mono">{item.walletAddress.slice(0, 6)}...{item.walletAddress.slice(-4)}</span>
                </div>
                <span className="text-gray-400">
                  {new Date(item.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-gray-400 mt-3">大额支付会显示在这里；审批动作在 Cobo App 内完成。</p>
      </div>
    </div>
  );
}
