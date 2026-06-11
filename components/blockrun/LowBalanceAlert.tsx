'use client';

import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Loader2, X, CheckCircle, XCircle } from 'lucide-react';

type BalanceStatus = {
  balanceUsdc: number;
  minBalance: number;
  isBelowThreshold: boolean;
  updatedAt: string;
};

type HeartbeatStatus = {
  blockrunBalanceUsd: number;
  blockrunMinBalance: number;
  blockrunAutoTopupEnabled: boolean;
  blockrunLastAutoTopupAt?: string;
  blockrunLastAutoTopupResult?: string;
};

export default function BlockRunLowBalanceAlert() {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [balance, setBalance] = useState<BalanceStatus | null>(null);
  const [heartbeat, setHeartbeat] = useState<HeartbeatStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const checkBalance = useCallback(async () => {
    try {
      // 查 BlockRun 余额
      const balRes = await fetch('/api/blockrun/balance');
      if (balRes.ok) {
        const balData: BalanceStatus = await balRes.json();
        setBalance(balData);

        // 余额低于阈值且未关闭弹窗
        if (balData.isBelowThreshold && !dismissed) {
          setVisible(true);
        } else if (!balData.isBelowThreshold) {
          setVisible(false);
          setDismissed(false); // 余额恢复后重置关闭状态
        }
      }

      // 查 heartbeat 状态（自动充值结果）
      const hbRes = await fetch('/api/credits/topup/sweep-status');
      if (hbRes.ok) {
        const hbData = await hbRes.json();
        setHeartbeat(hbData);
      }
    } catch {} finally {
      setLoading(false);
    }
  }, [dismissed]);

  // 启动时检查 + 每 60 秒轮询
  useEffect(() => {
    checkBalance();
    const timer = setInterval(() => {
      setDismissed(false); // 重置关闭状态，允许重新弹出
      checkBalance();
    }, 60_000);
    return () => clearInterval(timer);
  }, [checkBalance]);

  if (loading || !visible || !balance) return null;

  const isAutoTopupRunning = heartbeat?.blockrunLastAutoTopupResult === undefined;
  const lastResult = heartbeat?.blockrunLastAutoTopupResult;
  const isSuccess = lastResult === 'success';
  const isFailed = lastResult && lastResult !== 'success';

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm animate-in slide-in-from-bottom-2">
      <div className="rounded-xl border border-amber-200 bg-amber-50 shadow-lg px-4 py-3">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-800">
              BlockRun 余额不足
            </p>
            <p className="text-xs text-amber-600 mt-0.5">
              当前 ${balance.balanceUsdc.toFixed(2)}，阈值 ${balance.minBalance.toFixed(2)}
            </p>

            {/* 自动充值状态 */}
            <div className="mt-2 flex items-center gap-1.5 text-xs">
              {isAutoTopupRunning ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
                  <span className="text-blue-600">正在自动充值...</span>
                </>
              ) : isSuccess ? (
                <>
                  <CheckCircle className="w-3 h-3 text-emerald-500" />
                  <span className="text-emerald-600">充值成功</span>
                </>
              ) : isFailed ? (
                <>
                  <XCircle className="w-3 h-3 text-red-500" />
                  <span className="text-red-600">充值失败: {lastResult}</span>
                </>
              ) : (
                <>
                  <Loader2 className="w-3 h-3 animate-spin text-gray-400" />
                  <span className="text-gray-500">等待触发...</span>
                </>
              )}
            </div>
          </div>
          <button
            onClick={() => { setVisible(false); setDismissed(true); }}
            className="text-amber-400 hover:text-amber-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
