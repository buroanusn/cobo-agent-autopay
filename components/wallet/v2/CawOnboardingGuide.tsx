'use client';

import { BookOpen } from 'lucide-react';
import SectionCard from '@/components/dashboard/v2/SectionCard';

const STEPS = [
  {
    title: '在服务器或本机用 CAW CLI 创建新的 Agent Wallet',
    desc: '当前版本是单钱包部署模式：一份部署只读取一个后端 CAW Agent Wallet。',
  },
  {
    title: '把新钱包的 API URL / API Key / Wallet ID / 钱包地址写入该部署的环境变量',
    desc: '通常是 AGENT_WALLET_API_URL / AGENT_WALLET_API_KEY / AGENT_WALLET_WALLET_ID。',
  },
  {
    title: '重启网站',
    desc: '页面会变成「未配对」状态。',
  },
  {
    title: '在 Web 端生成配对码，让新用户在手机 CAW App 输入',
    desc: '配对成功后点击「连接 CAW」，再让用户在手机里批准 Pact 和 USDC 授权。',
  },
];

/**
 * 区块 2：新用户接入 CAW 指南（静态说明）
 * 文档原话：当前版本是单钱包部署模式；给另一个人使用时...
 */
export default function CawOnboardingGuide() {
  return (
    <SectionCard
      title="新用户接入 CAW 指南"
      subtitle="单钱包部署模式下，把 CAW 钱包换给新用户的步骤"
    >
      <ol className="space-y-3">
        {STEPS.map((s, i) => (
          <li key={i} className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold flex items-center justify-center">
              {i + 1}
            </span>
            <div>
              <p className="text-sm font-medium text-gray-900">{s.title}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.desc}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-4 pt-3 border-t border-gray-100 flex items-start gap-2 text-xs text-gray-500">
        <BookOpen className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
        <span>
          详细文档：<code className="text-gray-700">docs/new-user-caw-pairing.md</code>
        </span>
      </div>
    </SectionCard>
  );
}
