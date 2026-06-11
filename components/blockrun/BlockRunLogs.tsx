'use client';

import { useEffect, useState } from 'react';
import { Loader2, History, CheckCircle2, XCircle } from 'lucide-react';
import SectionCard from '@/components/dashboard/v2/SectionCard';

type LogEntry = {
  id: string;
  prompt: string;
  model: string;
  durationMs: number;
  costUsdc: number | null;
  status: 'completed' | 'failed';
  createdAt: string;
};

type LogsResp = { ok?: boolean; logs?: LogEntry[]; error?: string };

/**
 * BlockRun Inference History Logs
 * - Table: time / model / duration / cost(USDC) / status
 * - Empty state: '暂无推理记录'
 * - Max 10 entries
 *
 * API: GET /api/blockrun/logs
 */
export default function BlockRunLogs() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/blockrun/logs');
        if (!res.ok) {
          if (!cancelled) setError(`HTTP ${res.status}`);
          return;
        }
        const data: LogsResp = await res.json();
        if (!cancelled) setLogs(data.logs ?? []);
      } catch {
        if (!cancelled) setError('加载失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  return (
    <SectionCard title={`Inference 历史（${logs.length} 条）`}>
      {loading ? (
        <div className="flex items-center justify-center h-24">
          <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
        </div>
      ) : error ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : logs.length === 0 ? (
        <p className="text-xs text-gray-500 text-center py-4">暂无推理记录</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left font-medium text-gray-500 pb-2 pr-3">时间</th>
                <th className="text-left font-medium text-gray-500 pb-2 pr-3">模型</th>
                <th className="text-left font-medium text-gray-500 pb-2 pr-3">耗时</th>
                <th className="text-right font-medium text-gray-500 pb-2 pr-3">费用 (USDC)</th>
                <th className="text-right font-medium text-gray-500 pb-2">状态</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="py-2 pr-3 text-gray-600 font-mono whitespace-nowrap">
                    {new Date(l.createdAt).toLocaleString('zh-CN', {
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="py-2 pr-3 text-gray-700 font-mono">{l.model}</td>
                  <td className="py-2 pr-3 text-gray-500">{l.durationMs}ms</td>
                  <td className="py-2 pr-3 text-right text-gray-700 font-mono">
                    {l.costUsdc !== null ? `$${l.costUsdc.toFixed(6)}` : '—'}
                  </td>
                  <td className="py-2 text-right">
                    {l.status === 'completed' ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700">
                        <CheckCircle2 className="w-3 h-3" />
                        完成
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-red-700">
                        <XCircle className="w-3 h-3" />
                        失败
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}
