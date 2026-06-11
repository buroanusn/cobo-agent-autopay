'use client';

import { useState, useEffect } from 'react';
import { Loader2, RefreshCw, DollarSign, ShieldCheck, AlertCircle, Smartphone, PenLine, Search, CheckCircle } from 'lucide-react';
import SectionCard from '@/components/dashboard/v2/SectionCard';

export default function VeniceBalance() {
  // 步骤: 1=生成Pact, 2=等待Pact审批, 3=签名, 4=等待签名审批, 5=查询余额, 6=完成
  const [step, setStep] = useState(1);
  const [pactId, setPactId] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [siweMessage, setSiweMessage] = useState<string | null>(null);
  const [timestampMs, setTimestampMs] = useState<number | null>(null);
  const [balanceUsd, setBalanceUsd] = useState<number | null>(null);
  const [canConsume, setCanConsume] = useState<boolean | null>(null);
  const [minimumTopUpUsd, setMinimumTopUpUsd] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 页面加载时检查 pact 状态
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/venice/pact-status');
        if (!res.ok) return;
        const data = await res.json();
        if (data.hasPact && data.status === 'active') {
          setPactId(data.pactId);
          setStep(3); // 直接跳到签名步骤
        }
      } catch {}
    })();
  }, []);

  // ① 生成 Pact (message_sign 类型)
  const handleCreatePact = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/venice/siwe-pact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setPactId(data.pactId || null);
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建 Pact 失败');
    } finally {
      setLoading(false);
    }
  };

  // 刷新 Pact 状态
  const handleRefreshPact = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/venice/pact-status');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.hasPact && data.status === 'active') {
        setPactId(data.pactId);
        setStep(3);
      } else {
        setError(`Pact 状态: ${data.status || '未找到'}，请在手机上审批`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '刷新失败');
    } finally {
      setLoading(false);
    }
  };

  // 跳过创建，直接用现有 Pact
  const handleUseExistingPact = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/venice/pact-status');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.hasPact && data.status === 'active') {
        setPactId(data.pactId);
        setStep(3);
      } else if (data.hasPact) {
        setPactId(data.pactId);
        setStep(2);
        setError(`现有 Pact 状态: ${data.status}，需要先审批`);
      } else {
        setError('未找到现有 Pact，请先生成');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '查询失败');
    } finally {
      setLoading(false);
    }
  };

  // ② 签名
  const handleSign = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/venice/x402-balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sign' }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      if (data.status === 'signing' && data.requestId) {
        setRequestId(data.requestId);
        setSiweMessage(data.siweMessage);
        setTimestampMs(data.timestampMs);
        setStep(4);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '签名请求失败');
    } finally {
      setLoading(false);
    }
  };

  // ③ 查询余额
  const handleQuery = async () => {
    if (!requestId || !siweMessage || !timestampMs) {
      setError('缺少签名上下文，请重新签名');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/venice/x402-balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'query', requestId, siweMessage, timestampMs }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      if (data.status === 'completed' && data.balance?.data) {
        setBalanceUsd(data.balance.data.balanceUsd ?? 0);
        setCanConsume(data.balance.data.canConsume ?? false);
        setMinimumTopUpUsd(data.balance.data.minimumTopUpUsd ?? null);
        setStep(6);
      } else if (data.status === 'pending') {
        setError('签名尚未完成，请在手机上审批后重试');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '查询失败');
    } finally {
      setLoading(false);
    }
  };

  const btnClass = "w-full inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors";

  return (
    <SectionCard title="Venice x402 余额" subtitle="通过 CAW 钱包签名查询">
      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-100 px-3 py-2 mb-3">
          <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-red-600">{error}</p>
        </div>
      )}

      {/* 步骤 1: 生成 Pact */}
      {step === 1 && (
        <div className="space-y-2">
          <button onClick={handleCreatePact} disabled={loading}
            className={`${btnClass} bg-emerald-600 text-white hover:bg-emerald-700`}>
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
            {loading ? '提交中…' : '① 生成 Pact'}
          </button>
          <button onClick={handleUseExistingPact} disabled={loading}
            className={`${btnClass} border border-gray-300 bg-white text-gray-700 hover:bg-gray-50`}>
            <RefreshCw className="w-3.5 h-3.5" />
            使用现有 Pact
          </button>
        </div>
      )}

      {/* 步骤 2: 等待 Pact 审批 */}
      {step === 2 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-100 px-3 py-2">
            <Smartphone className="w-4 h-4 text-blue-500 animate-pulse" />
            <p className="text-xs text-blue-700">Pact 已提交{pactId ? ` (${pactId.slice(0, 8)}…)` : ''}，请在手机上审批</p>
          </div>
          <button onClick={handleRefreshPact} disabled={loading}
            className={`${btnClass} border border-gray-300 bg-white text-gray-700 hover:bg-gray-50`}>
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            刷新 Pact 状态
          </button>
        </div>
      )}

      {/* 步骤 3: 签名 */}
      {step === 3 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs text-emerald-600">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Pact 已激活{pactId ? `: ${pactId.slice(0, 8)}…` : ''}</span>
          </div>
          <button onClick={handleSign} disabled={loading}
            className={`${btnClass} bg-emerald-600 text-white hover:bg-emerald-700`}>
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PenLine className="w-3.5 h-3.5" />}
            {loading ? '提交中…' : '② 签名'}
          </button>
        </div>
      )}

      {/* 步骤 4: 等待签名审批 */}
      {step === 4 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-100 px-3 py-2">
            <Smartphone className="w-4 h-4 text-blue-500 animate-pulse" />
            <p className="text-xs text-blue-700">签名请求已提交，请在手机上审批</p>
          </div>
          <button onClick={handleQuery} disabled={loading}
            className={`${btnClass} bg-emerald-600 text-white hover:bg-emerald-700`}>
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            {loading ? '查询中…' : '③ 查询余额'}
          </button>
        </div>
      )}

      {/* 步骤 6: 显示余额 */}
      {step === 6 && balanceUsd !== null && (
        <div className="space-y-3">
          <div className="rounded-xl bg-emerald-50 px-4 py-3">
            <div className="flex items-center gap-2 mb-1.5">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-medium text-gray-700">x402 余额</span>
            </div>
            <p className="text-xl font-semibold text-emerald-600">${balanceUsd.toFixed(2)}</p>
            {canConsume === false && minimumTopUpUsd && (
              <p className="text-xs text-amber-600 mt-1">余额不足，最低充值 ${minimumTopUpUsd}</p>
            )}
          </div>
          <button onClick={() => { setStep(1); setBalanceUsd(null); setRequestId(null); setError(null); }}
            className={`${btnClass} border border-gray-300 bg-white text-gray-700 hover:bg-gray-50`}>
            <RefreshCw className="w-3.5 h-3.5" />
            重新查询
          </button>
        </div>
      )}
    </SectionCard>
  );
}
