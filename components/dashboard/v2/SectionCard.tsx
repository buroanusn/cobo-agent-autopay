'use client';

import { Loader2 } from 'lucide-react';

type SectionCardProps = {
  title: React.ReactNode;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  loading?: boolean;
};

/**
 * 通用区块卡片：白底、圆角、细边、阴影 + 标题行（支持右上角 action）。
 */
export default function SectionCard({ title, subtitle, action, children, loading }: SectionCardProps) {
  return (
    <section className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <header className="flex items-center justify-between gap-3 px-6 py-4 border-b border-gray-100">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </header>
      <div className="px-6 py-5">
        {loading ? (
          <div className="flex items-center justify-center h-24">
            <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
          </div>
        ) : (
          children
        )}
      </div>
    </section>
  );
}
