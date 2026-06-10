'use client';

import { ChevronDown } from 'lucide-react';

/**
 * 静态只读 Agent 选择器 — 多 Agent 预留 UI，现在只显示默认 Agent。
 * 按需求文档 §七 约束："现在显示" → "默认Agent"。
 * 没有 onChange、没有 store、不连数据源。
 */
export default function AgentSelector() {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500 font-medium">当前 Agent</span>
      <button
        type="button"
        disabled
        aria-disabled="true"
        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 cursor-not-allowed opacity-90"
        title="多 Agent 扩展即将推出"
      >
        <span>默认 Agent</span>
        <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
      </button>
    </div>
  );
}
