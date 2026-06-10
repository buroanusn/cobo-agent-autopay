'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Wallet, Sparkles, CreditCard, Settings, LogOut, Zap } from 'lucide-react';

const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, ready: true },
  { label: 'Wallet', href: '/dashboard/wallet', icon: Wallet, ready: true },
  { label: 'Venice', href: '/dashboard/venice', icon: Sparkles, ready: true },
  { label: 'BlockRun', href: '/dashboard/blockrun', icon: Zap, ready: true },
  { label: 'Payments', href: '/dashboard/payments', icon: CreditCard, ready: true },
  { label: 'Settings', href: '/dashboard/settings', icon: Settings, ready: true },
];

type SidebarProps = {
  userEmail?: string;
};

export default function Sidebar({ userEmail }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="w-[240px] min-h-screen bg-[#0A1628] flex flex-col flex-shrink-0">
      {/* Brand */}
      <div className="px-6 pt-8 pb-6 border-b border-white/10">
        <h1 className="text-white text-lg font-bold tracking-tight">cobo-agent-autopay</h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-6 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          const className = `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            !item.ready
              ? 'text-gray-600 cursor-not-allowed'
              : isActive
                ? 'bg-[#2563EB] text-white'
                : 'text-gray-400 hover:text-white hover:bg-[#1A2940]'
          }`;

          if (!item.ready) {
            return (
              <div
                key={item.href}
                className={className}
                title="该页面正在重写中"
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span className="flex-1">{item.label}</span>
                <span className="text-[10px] uppercase tracking-wider text-gray-500 bg-white/5 px-1.5 py-0.5 rounded">
                  soon
                </span>
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={className}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User info */}
      <div className="px-4 py-4 border-t border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#2563EB] flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
            {(userEmail?.[0] || 'U').toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-medium truncate">
              {userEmail || 'User'}
            </p>
          </div>
          <form action="/api/auth/logout" method="POST">
            <button
              type="submit"
              className="text-gray-400 hover:text-white transition-colors"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
