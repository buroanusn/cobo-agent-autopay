import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'cobo-agent-autopay',
  description: '为 AI Agent 提供自动小额免密支付基础设施',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
