'use client';

import { useEffect, useState } from 'react';
import Sidebar from './Sidebar';
import TopNav from './TopNav';

type AppLayoutProps = {
  title: string;
  children: React.ReactNode;
};

export default function AppLayout({ title, children }: AppLayoutProps) {
  const [email, setEmail] = useState<string | undefined>(undefined);

  useEffect(() => {
    // Try to get user email from a lightweight API
    fetch('/api/wallet/caw/status')
      .then(() => {
        // For now, just set a placeholder or read from cookie
        const userMeta = document.cookie
          .split('; ')
          .find((row) => row.startsWith('user_email='))
          ?.split('=')[1];
        if (userMeta) setEmail(decodeURIComponent(userMeta));
      })
      .catch(() => {});
  }, []);

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      <Sidebar userEmail={email} />
      <div className="flex-1 flex flex-col min-h-screen">
        <TopNav title={title} />
        <main className="flex-1 p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
