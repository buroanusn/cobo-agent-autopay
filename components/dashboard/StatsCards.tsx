'use client';

import { useEffect, useState } from 'react';
import { Wallet, Activity, DollarSign, RefreshCw } from 'lucide-react';

type StatsData = {
  veniceBalance: number | null;
  cawAddress: string | null;
  paymentLockStatus: string | null;
  monthlyTopups: number | null;
};

export default function StatsCards({ data }: { data: StatsData }) {
  const cards = [
    {
      label: 'Venice 余额',
      value: data.veniceBalance !== null ? `$${data.veniceBalance.toFixed(2)} USD` : '—',
      icon: DollarSign,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      label: 'CAW 钱包地址',
      value: data.cawAddress
        ? `${data.cawAddress.slice(0, 6)}...${data.cawAddress.slice(-4)}`
        : '—',
      icon: Wallet,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: '支付锁状态',
      value: statusLabel(data.paymentLockStatus),
      icon: Activity,
      color: statusColor(data.paymentLockStatus),
      bg: statusBg(data.paymentLockStatus),
    },
    {
      label: '本月充值次数',
      value: data.monthlyTopups !== null ? String(data.monthlyTopups) : '—',
      icon: RefreshCw,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className={`${card.bg} p-2.5 rounded-lg`}>
                <Icon className={`w-5 h-5 ${card.color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-gray-500 font-medium">{card.label}</p>
                <p className={`text-sm font-semibold mt-0.5 ${card.color}`}>
                  {card.value}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function statusLabel(status: string | null): string {
  switch (status) {
    case 'idle': return '运行中';
    case 'processing': return '支付中';
    case 'cooldown': return '冷却中';
    default: return '—';
  }
}

function statusColor(status: string | null): string {
  switch (status) {
    case 'idle': return 'text-emerald-600';
    case 'processing': return 'text-blue-600';
    case 'cooldown': return 'text-amber-600';
    default: return 'text-gray-400';
  }
}

function statusBg(status: string | null): string {
  switch (status) {
    case 'idle': return 'bg-emerald-50';
    case 'processing': return 'bg-blue-50';
    case 'cooldown': return 'bg-amber-50';
    default: return 'bg-gray-50';
  }
}
