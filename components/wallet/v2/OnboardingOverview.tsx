'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Circle, Loader2, Smartphone, Coins, ShieldCheck, Send } from 'lucide-react';
import SectionCard from '@/components/dashboard/v2/SectionCard';

type CawStatus = {
  runtime?: {
    walletPaired?: boolean;
    walletAddress?: string;
  };
  app?: {
    activeAuthorization?: boolean;
  };
};

type PactsResp = {
  ok?: boolean;
  pacts?: Array<{ id: string; status: string }>;
  hasBaseUsdcPact?: boolean;
  error?: string;
};

type SpendReadiness = {
  requiredUsdcMinor?: number;
  remainingUsdcMinor?: number;
  allowanceUsdcMinor?: number;
  walletUsdcMinor?: number;
  gasEth?: string;
  error?: string;
};

type StatusResp = {
  runtime?: CawStatus['runtime'];
  app?: CawStatus['app'];
  spendReadiness?: SpendReadiness;
  readyForRealPayment?: boolean;
  cawConfigured?: boolean;
  missing?: string[];
};

type Step = {
  id: 'pair' | 'faucet' | 'pact' | 'payment';
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  done: boolean;
  current: boolean;
};

/**
 * 区块 1：演示流程总览（4 步进度条）
 * 推断规则：
 *  - CAW 钱包配对：runtime.walletPaired === true
 *  - 测试币准备：allowanceUsdcMinor > 0 或 walletUsdcMinor > 0（弱信号，因为 spender 可能没部署）
 *  - Pact 授权：app.activeAuthorization === true
 *  - 真实链上支付：readyForRealPayment === true
 *
 * 数据源：/api/wallet/caw/status + /api/wallet/caw/pacts
 */
export default function OnboardingOverview({ reloadKey = 0 }: { reloadKey?: number }) {
  const [cawStatus, setCawStatus] = useState<StatusResp | null>(null);
  const [pacts, setPacts] = useState<PactsResp | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [s, p] = await Promise.allSettled([
        fetch('/api/wallet/caw/status'),
        fetch('/api/wallet/caw/pacts'),
      ]);
      if (cancelled) return;
      if (s.status === 'fulfilled' && s.value.ok) {
        try {
          const data: StatusResp = await s.value.json();
          if (!cancelled) setCawStatus(data);
        } catch {
          // ignore
        }
      }
      if (p.status === 'fulfilled' && p.value.ok) {
        try {
          const data: PactsResp = await p.value.json();
          if (!cancelled) setPacts(data);
        } catch {
          // ignore
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const paired = cawStatus?.runtime?.walletPaired === true;
  const allowance = cawStatus?.spendReadiness?.allowanceUsdcMinor ?? 0;
  const walletUsdc = cawStatus?.spendReadiness?.walletUsdcMinor ?? 0;
  const faucetReady = allowance > 0 || walletUsdc > 0;
  const pactActive = cawStatus?.app?.activeAuthorization === true;
  const readyForPay = cawStatus?.readyForRealPayment === true;

  const steps: Step[] = [
    {
      id: 'pair',
      label: 'CAW 钱包配对',
      description: '手机 CAW App 输入配对码',
      icon: Smartphone,
      done: paired,
      current: !paired,
    },
    {
      id: 'faucet',
      label: '测试币准备',
      description: 'CAW Faucet 申请测试 ETH/USDC',
      icon: Coins,
      done: faucetReady,
      current: paired && !faucetReady,
    },
    {
      id: 'pact',
      label: 'Pact 授权',
      description: 'App 内批准 CAW Pact + USDC allowance',
      icon: ShieldCheck,
      done: pactActive,
      current: faucetReady && !pactActive,
    },
    {
      id: 'payment',
      label: '真实链上支付',
      description: '可执行 CreditsPayment 真实链上调用',
      icon: Send,
      done: readyForPay,
      current: pactActive && !readyForPay,
    },
  ];

  const completedCount = steps.filter((s) => s.done).length;

  return (
    <SectionCard
      title="演示流程总览"
      subtitle={`已完成 ${completedCount} / 4 步（基于当前 CAW 状态自动推断）`}
    >
      <div className="space-y-3">
        {steps.map((step, idx) => {
          const Icon = step.icon;
          return (
            <div key={step.id} className="flex items-center gap-3">
              {/* 状态圆点 */}
              <div className="flex-shrink-0">
                {step.done ? (
                  <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  </div>
                ) : step.current ? (
                  <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center ring-2 ring-blue-200">
                    <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                    <Circle className="w-5 h-5 text-gray-400" />
                  </div>
                )}
              </div>

              {/* 文字 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 text-gray-500" />
                  <p className="text-sm font-medium text-gray-900">
                    {idx + 1}. {step.label}
                  </p>
                  <span
                    className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${
                      step.done
                        ? 'bg-emerald-50 text-emerald-700'
                        : step.current
                          ? 'bg-blue-50 text-blue-700'
                          : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {step.done ? '已完成' : step.current ? '进行中' : '待完成'}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{step.description}</p>
              </div>
            </div>
          );
        })}

        {/* 补充信号：活跃 Pact 数 / hasBaseUsdcPact */}
        {pacts && pacts.ok && (
          <div className="pt-3 mt-2 border-t border-gray-100 text-xs text-gray-500 flex items-center gap-4 flex-wrap">
            <span>活跃 Pact：{pacts.pacts?.filter((p) => p.status === 'active').length ?? 0} 个</span>
            <span>Base USDC Pact：{pacts.hasBaseUsdcPact ? '✓ 就绪' : '✗ 缺少（Venice 充值会失败）'}</span>
          </div>
        )}
      </div>
    </SectionCard>
  );
}
