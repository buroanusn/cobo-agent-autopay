'use client';

import { useEffect, useState } from 'react';
import { Activity, CheckCircle, XCircle, HelpCircle, ChevronDown } from 'lucide-react';

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
  configurationMissing?: string[];
  paymentMissing?: string[];
};

type DashboardSnapshot = {
  account: { autoTopupCredits: number };
};

function fmtUsdc(minor: number) {
  return `$${(minor / 1_000_000).toFixed(2)}`;
}

function formatEth(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return value;
  return parsed.toLocaleString('en-US', { maximumFractionDigits: 8 });
}

function formatMode(mode: string) {
  if (mode === 'http') return '真实 CAW';
  if (mode === 'mock') return '模拟模式';
  return mode;
}

function translateMissing(item: string): string {
  const map: Record<string, string> = {
    'CAW API URL/API key': 'CAW 接口配置',
    'CAW wallet id': 'CAW 钱包 ID',
    'CAW App pairing': '手机 App 配对',
    'payment contract address': '支付合约地址',
    'treasury address': '收款地址',
    'connected CAW wallet address': '连接 CAW 钱包地址',
    'active Pact authorization': '有效 Pact 授权',
    'connected wallet does not match CAW runtime wallet': '页面连接的钱包和 CAW 钱包不一致',
    'real CAW Pact authorization': '真实 CAW Pact 授权',
    'Pact authorization expired': 'Pact 已过期',
    'Pact remaining spend below next payment': 'Pact 剩余额度不足',
    'USDC allowance below next payment': 'USDC 授权不足',
    'USDC balance below next payment': 'USDC 余额不足',
    'Base Sepolia ETH gas balance missing': 'Base Sepolia ETH gas 不足',
    'on-chain readiness check unavailable': '链上就绪检查失败',
  };
  return map[item] ?? item;
}

function getNextStep(missing: string[]): string {
  if (missing.some(m => m.includes('手机 App 配对'))) return '先在手机 CAW App 完成钱包配对。';
  if (missing.some(m => m.includes('Pact'))) return '先给 CAW 钱包领取测试币，然后创建真实 Pact 并在手机 App 里批准。';
  if (missing.some(m => m.includes('Pact 剩余额度不足'))) return '当前 Pact 额度已不足，创建新的最小额度 Pact 后再继续真实支付测试。';
  if (missing.some(m => m.includes('USDC 授权不足'))) return '先给支付合约执行最小 USDC approve，再继续真实支付。';
  if (missing.some(m => m.includes('USDC 余额不足') || m.includes('ETH gas 不足'))) return '先补足 CAW 钱包的 USDC 和 ETH gas。';
  if (missing.length > 0) return `还缺：${missing.map(translateMissing).join('，')}。`;
  return '可以开始真实链上支付测试。';
}

export default function DiagnosticsPanel({
  cawStatus,
  snapshot,
}: {
  cawStatus: CawStatusResult | null;
  snapshot: DashboardSnapshot | null;
}) {
  if (!cawStatus) return null;

  const { runtime, app, spendReadiness, readyForRealPayment, missing } = cawStatus;
  const missingTranslated = missing.map(translateMissing);
  const nextStep = getNextStep(missing);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <Activity className="w-4 h-4 text-blue-600" />
          真实 CAW 接入状态
        </h3>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
          readyForRealPayment ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
        }`}>
          {readyForRealPayment ? '可真实支付' : '未就绪'}
        </span>
      </div>

      {/* Status grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
        <StatusCard label="环境" value={runtime.environment} />
        <StatusCard label="模式" value={formatMode(runtime.mode)} />
        <StatusCard label="接口配置" value={runtime.apiConfigured ? '已配置' : '缺少'} ok={runtime.apiConfigured} />
        <StatusCard label="钱包状态" value={runtime.walletStatus ?? '-'} ok={runtime.walletStatus === 'active' || runtime.mode === 'mock'} />
        <StatusCard label="配对" value={runtime.walletPaired ? '已配对' : '未配对'} ok={runtime.walletPaired} />
        <StatusCard label="Pact 授权" value={!missing.some(m => m.includes('Pact')) ? '就绪' : '缺真实 Pact'} ok={!missing.some(m => m.includes('Pact'))} />
      </div>

      {/* Detail rows */}
      <div className="space-y-2 text-xs border-t border-gray-100 pt-4">
        <Row label="钱包 ID" value={runtime.walletId ?? '-'} />
        <Row label="钱包地址" value={runtime.walletAddress ? `${runtime.walletAddress.slice(0, 10)}...${runtime.walletAddress.slice(-6)}` : '-'} />
        <Row label="App 钱包" value={app.connectedWalletAddress ? `${app.connectedWalletAddress.slice(0, 6)}...${app.connectedWalletAddress.slice(-4)}` : '-'} />
        <Row label="链" value={runtime.chainName ? `${runtime.chainName} · ${runtime.chainId}` : '-'} />

        {spendReadiness && (
          <>
            <Row label="下一笔需要" value={fmtUsdc(spendReadiness.requiredUsdcMinor)} />
            <Row label="Pact 剩余额度" value={fmtUsdc(spendReadiness.remainingUsdcMinor)} />
            {spendReadiness.allowanceUsdcMinor !== undefined && (
              <Row label="USDC 授权" value={fmtUsdc(spendReadiness.allowanceUsdcMinor)} />
            )}
            {spendReadiness.gasEth && (
              <Row label="Gas 余额" value={`${formatEth(spendReadiness.gasEth)} ETH`} />
            )}
            {spendReadiness.pactExpiresAt && (
              <Row label="Pact 过期" value={new Date(spendReadiness.pactExpiresAt).toLocaleString('zh-CN')} />
            )}
            {spendReadiness.error && (
              <Row label="就绪检查" value={`⚠ ${spendReadiness.error}`} />
            )}
          </>
        )}

        <Row label="缺少配置" value={missingTranslated.length ? missingTranslated.join('，') : '关键配置已齐'} />
      </div>

      {/* Next step */}
      <div className="mt-4 p-3 bg-blue-50/50 rounded-lg border border-blue-100">
        <p className="text-xs text-blue-800">
          <strong>下一步：</strong>{nextStep}
        </p>
      </div>

      <p className="text-xs text-gray-400 mt-3">这里只展示脱敏状态，API key 和私钥不会返回到浏览器。</p>
      <p className="text-xs text-gray-400 mt-1">真实支付就绪需要 CAW 配置、有效 Pact、剩余额度、USDC 授权、USDC 余额和 gas 都满足。</p>
    </div>
  );
}

function StatusCard({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-sm font-semibold mt-1 flex items-center gap-1 ${ok === undefined ? 'text-gray-900' : ok ? 'text-emerald-700' : 'text-red-600'}`}>
        {ok === true && <CheckCircle className="w-3 h-3" />}
        {ok === false && <XCircle className="w-3 h-3" />}
        {value}
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-b-0">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-900 font-mono text-right max-w-[60%] truncate">{value}</span>
    </div>
  );
}
