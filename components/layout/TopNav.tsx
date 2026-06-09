'use client';

import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';

type TopNavProps = {
  title: string;
  companyName?: string;
  creditsPerUsdc?: number;
};

export default function TopNav({ title, companyName, creditsPerUsdc }: TopNavProps) {
  const router = useRouter();

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch {
      window.location.href = '/login';
    }
  }

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 sticky top-0 z-10">
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      <div className="flex items-center gap-3">
        {companyName && (
          <span className="text-xs bg-gray-100 text-gray-500 font-medium px-2.5 py-1 rounded-full">
            {companyName} · {creditsPerUsdc ?? '?'} 积分/USDC
          </span>
        )}
        <button
          onClick={handleLogout}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          title="Logout"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">退出</span>
        </button>
      </div>
    </header>
  );
}
