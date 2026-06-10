'use client';

import { Loader2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type StatCardProps = {
  label: string;
  value: string;
  icon: LucideIcon;
  iconClass: string; // e.g. 'text-emerald-600'
  iconBg: string;    // e.g. 'bg-emerald-50'
  loading?: boolean;
  hint?: string;
};

/**
 * 单个统计卡片。loading 时只 spinner，不显示"—"假数据。
 */
export default function StatCard({ label, value, icon: Icon, iconClass, iconBg, loading, hint }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`${iconBg} p-2.5 rounded-lg flex-shrink-0`}>
          <Icon className={`w-5 h-5 ${iconClass}`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-gray-500 font-medium">{label}</p>
          {loading ? (
            <Loader2 className="w-4 h-4 text-gray-300 animate-spin mt-1" />
          ) : (
            <p className={`text-sm font-semibold mt-0.5 truncate ${iconClass}`} title={value}>
              {value}
            </p>
          )}
          {hint && !loading && (
            <p className="text-[11px] text-gray-400 mt-0.5 truncate">{hint}</p>
          )}
        </div>
      </div>
    </div>
  );
}
