'use client';

import { useEffect, useState } from 'react';
import { Loader2, Send, Key, Wallet, AlertCircle, CheckCircle2, XCircle, Inbox } from 'lucide-react';
import SectionCard from '@/components/dashboard/v2/SectionCard';

type AuthMode = 'bearer' | 'siwe';

type SignResp = {
  ok: boolean;
  walletAddress?: string;
  chainId?: string;
  uri?: string;
  headerName?: string;
  headerValue?: string;
  decoded?: { message?: string; signature?: string; txId?: string };
  error?: string;
};

type InferenceResp = {
  ok?: boolean;
  result?: {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    model?: string;
  };
  error?: string;
};

type InferenceLog = {
  id: string;
  prompt: string;
  model: string;
  createdAt: string;
  status: 'completed' | 'failed_insufficient_balance';
  creditsCharged: number;
  inputTokens?: number;
  outputTokens?: number;
};

type LogsResp = { ok?: boolean; logs?: InferenceLog[]; error?: string };

/**
 * 区块 5：跑一次 Venice Inference
 * - 认证模式切换：API Key (Bearer) / X-Sign-In-With-X（钱包签）
 * - 提示词输入
 * - 2 按钮：生成 X-Sign-In-With-X 签名 / 运行 inference
 * - Inference 历史 N 条
 * - 余额历史（N 条）— 文档要求；通过 ledgerEntries 复用
 *
 * 数据源：
 *   POST /api/venice/sign-message   EIP-712 SIWE-X 签名
 *   POST /api/venice/inference      实际调用 Venice
 *   GET  /api/venice/logs           推理历史
 */
export default function VeniceInference() {
  const [mode, setMode] = useState<AuthMode>('bearer');
  const [prompt, setPrompt] = useState('Hello, Venice!');
  const [signData, setSignData] = useState<SignResp | null>(null);
  const [signBusy, setSignBusy] = useState(false);
  const [signError, setSignError] = useState<string | null>(null);
  const [inferenceBusy, setInferenceBusy] = useState(false);
  const [inferenceResult, setInferenceResult] = useState<InferenceResp | null>(null);
  const [inferenceError, setInferenceError] = useState<string | null>(null);
  const [logs, setLogs] = useState<InferenceLog[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/venice/logs');
        if (res.ok) {
          const data: LogsResp = await res.json();
          if (!cancelled) setLogs(data.logs ?? []);
        }
      } catch {
        // ignore
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSign() {
    setSignBusy(true);
    setSignError(null);
    try {
      const res = await fetch('/api/venice/sign-message', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      const data: SignResp = await res.json();
      if (!res.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : `HTTP ${res.status}`);
      }
      setSignData(data);
    } catch (e) {
      setSignError(e instanceof Error ? e.message : 'sign failed');
    } finally {
      setSignBusy(false);
    }
  }

  async function handleInference() {
    if (!prompt.trim()) {
      setInferenceError('请输入提示词');
      return;
    }
    setInferenceBusy(true);
    setInferenceError(null);
    setInferenceResult(null);
    try {
      // 如果是 SIWE 模式，附带 X-Sign-In-With-X 头
      const headers: Record<string, string> = { 'content-type': 'application/json' };
      if (mode === 'siwe') {
        if (!signData?.headerValue) {
          setInferenceError('请先生成 X-Sign-In-With-X 签名');
          setInferenceBusy(false);
          return;
        }
        headers['X-Sign-In-With-X'] = signData.headerValue;
      }
      const res = await fetch('/api/venice/inference', {
        method: 'POST',
        headers,
        body: JSON.stringify({ prompt }),
      });
      const data: InferenceResp = await res.json();
      if (!res.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : `HTTP ${res.status}`);
      }
      setInferenceResult(data);
      // 刷新历史
      const lres = await fetch('/api/venice/logs');
      if (lres.ok) {
        const ld: LogsResp = await lres.json();
        setLogs(ld.logs ?? []);
      }
    } catch (e) {
      setInferenceError(e instanceof Error ? e.message : 'inference failed');
    } finally {
      setInferenceBusy(false);
    }
  }

  const content = inferenceResult?.result?.choices?.[0]?.message?.content;
  const usage = inferenceResult?.result?.usage;

  return (
    <SectionCard
      title="跑一次 Venice Inference"
      subtitle="用 API Key 或钱包签名调用 Venice chat completions"
    >
      <div className="space-y-4">
        {/* 认证模式切换 */}
        <div>
          <p className="text-xs font-medium text-gray-600 mb-2">认证模式</p>
          <div className="inline-flex rounded-lg border border-gray-300 bg-white p-0.5">
            <button
              onClick={() => setMode('bearer')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                mode === 'bearer'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Key className="w-3.5 h-3.5" />
              API Key (Bearer)
            </button>
            <button
              onClick={() => setMode('siwe')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                mode === 'siwe'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Wallet className="w-3.5 h-3.5" />
              X-Sign-In-With-X（钱包签）
            </button>
          </div>
        </div>

        {/* 提示词输入 */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">提示词</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            placeholder="输入要发给 Venice 的提示词"
          />
        </div>

        {/* 2 按钮（SIWE 模式多一个签名按钮） */}
        <div className="flex flex-wrap items-center gap-2">
          {mode === 'siwe' && (
            <button
              onClick={handleSign}
              disabled={signBusy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {signBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
              生成 X-Sign-In-With-X 签名
            </button>
          )}
          <button
            onClick={handleInference}
            disabled={inferenceBusy || (mode === 'siwe' && !signData)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {inferenceBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {inferenceBusy ? '运行中…' : '运行 inference'}
          </button>
          {mode === 'siwe' && signData && (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              已签
            </span>
          )}
        </div>

        {/* SIWE 签名结果详情（折叠） */}
        {signData && (
          <details className="rounded-lg bg-gray-50 px-3 py-2">
            <summary className="text-xs text-gray-600 cursor-pointer">
              签名详情（{signData.headerName}）
            </summary>
            <div className="mt-2 space-y-1 text-[11px] text-gray-600">
              <p>钱包地址：<code className="font-mono">{signData.walletAddress}</code></p>
              <p>链 ID：<code className="font-mono">{signData.chainId}</code></p>
              <p>URI：<code className="font-mono">{signData.uri}</code></p>
              {signData.decoded?.txId && (
                <p>txId：<code className="font-mono">{signData.decoded.txId}</code></p>
              )}
            </div>
          </details>
        )}

        {/* 错误提示 */}
        {signError && (
          <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-xs text-red-700">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>签名失败：{signError}</span>
          </div>
        )}
        {inferenceError && (
          <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-xs text-red-700">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>推理失败：{inferenceError}</span>
          </div>
        )}

        {/* 推理结果 */}
        {content && (
          <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-4 py-3 text-sm text-emerald-900">
            <p className="whitespace-pre-wrap">{content}</p>
            {usage && (
              <p className="text-[11px] text-emerald-700 mt-2">
                tokens: prompt {usage.prompt_tokens ?? '—'} / completion {usage.completion_tokens ?? '—'} / total {usage.total_tokens ?? '—'}
                {inferenceResult?.result?.model && ` · model ${inferenceResult.result.model}`}
              </p>
            )}
          </div>
        )}

        {/* 历史 */}
        <div className="pt-3 border-t border-gray-100">
          <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600 mb-2">
            <Inbox className="w-3.5 h-3.5" />
            Inference 历史（{logs.length} 条）
          </div>
          {logs.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-3">暂无历史</p>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {logs.slice(0, 20).map((l) => (
                <div
                  key={l.id}
                  className="flex items-start gap-2 px-3 py-2 rounded-lg border border-gray-100 bg-white"
                >
                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0 ${
                    l.status === 'completed'
                      ? 'text-emerald-700 bg-emerald-50'
                      : 'text-red-700 bg-red-50'
                  }`}>
                    {l.status === 'completed' ? <CheckCircle2 className="w-2.5 h-2.5" /> : <XCircle className="w-2.5 h-2.5" />}
                    {l.status === 'completed' ? '完成' : '失败'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-gray-700 truncate">{l.prompt}</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      {l.model} · 扣 {l.creditsCharged} 积分
                      {(l.inputTokens || l.outputTokens) && (
                        <> · in/out {l.inputTokens ?? 0}/{l.outputTokens ?? 0}</>
                      )}
                    </p>
                  </div>
                  <span className="text-[11px] text-gray-400 font-mono flex-shrink-0">
                    {new Date(l.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </SectionCard>
  );
}
