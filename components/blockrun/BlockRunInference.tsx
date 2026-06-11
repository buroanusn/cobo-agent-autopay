'use client';

import { useState } from 'react';
import { Loader2, Send, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import SectionCard from '@/components/dashboard/v2/SectionCard';

type InferenceResp = {
  ok?: boolean;
  result?: string;
  costUsdc?: number;
  duration?: number;
  error?: string;
};

/**
 * BlockRun Inference Test
 * - Prompt input
 * - Execute inference button
 * - Cost hint: ~$0.001 USDC per request
 * - Result display area
 * - Execution status
 *
 * API: POST /api/blockrun/inference
 */
export default function BlockRunInference() {
  const [prompt, setPrompt] = useState('用一句话介绍 BlockRun 的 x402 协议');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<InferenceResp | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleInference() {
    if (!prompt.trim()) {
      setError('请输入提示词');
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/blockrun/inference', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });
      const data: InferenceResp = await res.json();
      if (!res.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : `HTTP ${res.status}`);
      }
      setResult(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'inference failed';
      console.error('[BlockRunInference] error:', msg);
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SectionCard
      title="跑一次 BlockRun Inference"
      subtitle="x402 按次付费推理测试"
    >
      <div className="space-y-4">
        {/* 错误提示 — 放在最顶部 */}
        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-xs text-red-700">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 执行结果 */}
        {result?.ok && result?.result && (
          <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-4 py-3 text-sm text-emerald-900">
            <p className="whitespace-pre-wrap">{result.result}</p>
            <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-emerald-700">
              {result.costUsdc !== undefined && (
                <span>费用：${result.costUsdc.toFixed(6)} USDC</span>
              )}
              {result.duration !== undefined && (
                <span>耗时：{result.duration}ms</span>
              )}
            </div>
          </div>
        )}

        {/* 提示词输入 */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">提示词</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            placeholder="输入要发给 BlockRun 的提示词"
          />
        </div>

        {/* 费用提示 */}
        <p className="text-[11px] text-gray-400 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          每次请求约 $0.001 USDC（通过 x402 按次付费）
        </p>

        {/* 执行按钮 + 状态 */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleInference}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {busy ? '运行中…' : '执行推理'}
          </button>
          {busy && (
            <span className="inline-flex items-center gap-1 text-xs text-blue-600 font-medium">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              推理进行中...
            </span>
          )}
          {result?.ok && !busy && (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              完成
            </span>
          )}
          {error && !busy && (
            <span className="inline-flex items-center gap-1 text-xs text-red-600 font-medium">
              <XCircle className="w-3.5 h-3.5" />
              失败
            </span>
          )}
        </div>
      </div>
    </SectionCard>
  );
}
