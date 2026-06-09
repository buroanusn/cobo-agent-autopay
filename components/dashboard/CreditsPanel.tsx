'use client';

import { useEffect, useState } from 'react';
import { Coins, ArrowUpDown, Zap, TrendingUp } from 'lucide-react';

type LedgerEntry = {
  id: string;
  type: 'opening_grant' | 'agent_usage' | 'auto_topup';
  creditsDelta: number;
  balanceAfterCredits: number;
  createdAt: string;
  txHash?: string;
};

type DashboardSnapshot = {
  account: { balanceCredits: number; lowBalanceThresholdCredits: number; autoTopupCredits: number };
  ledgerEntries: LedgerEntry[];
};

export default function CreditsPanel({ snapshot, onTopup }: { snapshot: DashboardSnapshot | null; onTopup: () => void; topupLoading?: boolean }) {
  if (!snapshot) return null;

  const { account, ledgerEntries } = snapshot;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <Coins className="w-4 h-4 text-blue-600" />
          积分账户
        </h3>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
          account.balanceCredits >= account.lowBalanceThresholdCredits
            ? 'bg-emerald-50 text-emerald-700'
            : 'bg-amber-50 text-amber-700'
        }`}>
          {account.balanceCredits >= account.lowBalanceThresholdCredits ? '余额充足' : '低于阈值'}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-5">
        <div className="bg-blue-50 rounded-lg p-3">
          <p className="text-xs text-blue-600 font-medium mb-1">余额</p>
          <p className="text-lg font-bold text-gray-900">{account.balanceCredits.toLocaleString()}</p>
        </div>
        <div className="bg-amber-50 rounded-lg p-3">
          <p className="text-xs text-amber-600 font-medium mb-1">阈值</p>
          <p className="text-lg font-bold text-gray-900">{account.lowBalanceThresholdCredits.toLocaleString()}</p>
        </div>
        <div className="bg-purple-50 rounded-lg p-3">
          <p className="text-xs text-purple-600 font-medium mb-1">自动充值</p>
          <p className="text-lg font-bold text-gray-900">{account.autoTopupCredits.toLocaleString()}</p>
        </div>
      </div>

      {/* Ledger */}
      <div className="border-t border-gray-100 pt-4">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <ArrowUpDown className="w-3 h-3" />
          最近账本（最多 12 条）
        </h4>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {ledgerEntries.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">暂无账本记录</p>
          ) : (
            ledgerEntries.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between py-2 px-3 bg-gray-50/50 rounded-lg text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-medium text-gray-700 whitespace-nowrap">
                    {entry.type === 'auto_topup' ? '充值到账' : entry.type === 'agent_usage' ? 'Agent 消耗' : '初始赠送'}
                  </span>
                  {entry.txHash && (
                    <span className="text-gray-400 font-mono truncate max-w-[80px]">
                      {entry.txHash.slice(0, 8)}...
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className={entry.creditsDelta >= 0 ? 'text-emerald-600 font-semibold' : 'text-red-600 font-semibold'}>
                    {entry.creditsDelta > 0 ? '+' : ''}{entry.creditsDelta.toLocaleString()}
                  </span>
                  <span className="text-gray-400">→ {entry.balanceAfterCredits.toLocaleString()}</span>
                  <span className="text-gray-400">{new Date(entry.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
