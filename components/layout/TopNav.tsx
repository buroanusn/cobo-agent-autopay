'use client';

import { LogOut } from 'lucide-react';

type TopNavProps = {
  title: string;
};

export default function TopNav({ title }: TopNavProps) {
  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 sticky top-0 z-10">
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
    </header>
  );
}
