'use client';

import { useState } from 'react';
import { Play, Terminal } from 'lucide-react';

export default function AgentPanel() {
  const [prompt, setPrompt] = useState('Analyze the user\'s portfolio and continue the agent task.');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRun() {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch('/api/agent/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt, taskName: 'wallet-aware-agent' }),
      });
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error ?? 'Agent 执行失败');
        return;
      }
      if (data.topup?.status === 'pending') {
        setMessage(`Agent 已执行；已有充值订单待处理 (${data.topup.order?.orderId ?? ''})`);
      } else if (data.topup?.status === 'blocked') {
        setMessage(`Agent 已执行；自动充值被拦截：${data.topup.reason ?? data.topup.order?.status ?? ''}`);
      } else if (data.usageEvent) {
        setMessage(`Agent 已执行（预估 ${data.usageEvent.estimatedCredits ?? '?'}，实扣 ${data.usageEvent.creditsCharged ?? 0} 积分）`);
      } else {
        setMessage('Agent 已执行；如果余额低于阈值，系统会尝试自动充值。');
      }
    } catch (err) {
      setError('请求失败，请重试');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-4">
        <Terminal className="w-4 h-4 text-blue-600" />
        Agent 执行
      </h3>

      <label className="block text-xs text-gray-500 font-medium mb-2">Agent 任务说明</label>
      <input
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent mb-4"
      />

      <button
        onClick={handleRun}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#1D4ED8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {busy ? (
          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <Play className="w-4 h-4" />
        )}
        {busy ? '运行中...' : '运行 Agent'}
      </button>

      {message && (
        <p className="mt-3 text-xs text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">{message}</p>
      )}
      {error && (
        <p className="mt-3 text-xs text-red-700 bg-red-50 rounded-lg px-3 py-2">⚠ {error}</p>
      )}
    </div>
  );
}
