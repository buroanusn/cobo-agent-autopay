'use client';

import { useState } from 'react';
import { Play, Loader2 } from 'lucide-react';
import SectionCard from './SectionCard';

type RunResponse = {
  ok?: boolean;
  error?: string;
  topup?: {
    status?: string;
    reason?: string;
    order?: { orderId?: string; status?: string; reason?: string };
  };
  usageEvent?: {
    estimatedCredits?: number;
    creditsCharged?: number;
    status?: string;
  };
};

type RunState =
  | { kind: 'idle' }
  | { kind: 'busy' }
  | { kind: 'ok'; message: string }
  | { kind: 'err'; message: string };

/**
 * 区块 3：Agent 执行
 * POST /api/agent/run → { taskName, prompt }
 * - 成功：显示 usageEvent.estimatedCredits / creditsCharged
 * - topup pending：显示已创建订单
 * - topup blocked：显示拦截原因
 * - 错误：显示 error 字段
 */
export default function AgentSection() {
  const [taskName, setTaskName] = useState('wallet-aware-agent');
  const [prompt, setPrompt] = useState("Analyze the user's portfolio and continue the agent task.");
  const [state, setState] = useState<RunState>({ kind: 'idle' });

  async function handleRun() {
    setState({ kind: 'busy' });
    try {
      const res = await fetch('/api/agent/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ taskName, prompt }),
      });
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      const data: RunResponse = await res.json();
      if (!res.ok || data.error) {
        setState({ kind: 'err', message: data.error ?? `HTTP ${res.status}` });
        return;
      }
      if (data.topup?.status === 'pending') {
        setState({
          kind: 'ok',
          message: `Agent 已执行；已创建充值订单 ${data.topup.order?.orderId ?? ''}，等待链上确认`,
        });
      } else if (data.topup?.status === 'blocked') {
        setState({
          kind: 'err',
          message: `Agent 已执行；自动充值被拦截：${data.topup.reason ?? data.topup.order?.reason ?? ''}`,
        });
      } else if (data.usageEvent) {
        setState({
          kind: 'ok',
          message: `Agent 已执行（预估 ${data.usageEvent.estimatedCredits ?? '?'} 积分，实扣 ${data.usageEvent.creditsCharged ?? 0} 积分）`,
        });
      } else {
        setState({
          kind: 'ok',
          message: 'Agent 已执行；如余额低于阈值，系统会尝试自动充值。',
        });
      }
    } catch (e) {
      setState({ kind: 'err', message: e instanceof Error ? e.message : '请求失败' });
    }
  }

  return (
    <SectionCard
      title="Agent 执行"
      subtitle="运行一次 Agent 任务；低于阈值时会触发自动充值"
    >
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">任务名</label>
          <input
            value={taskName}
            onChange={(e) => setTaskName(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="wallet-aware-agent"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">任务说明 / 提示词</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            placeholder="描述 Agent 这次要执行的任务"
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRun}
            disabled={state.kind === 'busy' || !prompt.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {state.kind === 'busy' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            {state.kind === 'busy' ? '运行中...' : '运行 Agent'}
          </button>
        </div>

        {/* 执行结果 */}
        {state.kind === 'ok' && (
          <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-4 py-3 text-sm text-emerald-800">
            {state.message}
          </div>
        )}
        {state.kind === 'err' && (
          <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-800">
            ⚠ {state.message}
          </div>
        )}
      </div>
    </SectionCard>
  );
}
