'use client';

import { useEffect, useState, useCallback } from 'react';
import { Smartphone, Key, Wallet, ShieldCheck, Zap, RefreshCw, CheckCircle, XCircle, Loader2, ExternalLink, ChevronDown } from 'lucide-react';

type CawStatusResult = {
  runtime: {
    mode: 'mock' | 'http';
    environment: 'dev' | 'prod' | 'unknown';
    apiConfigured: boolean;
    walletConfigured: boolean;
    walletId?: string;
    walletName?: string;
    walletStatus?: string;
    walletAddress?: string;
    walletPaired: boolean;
    chainId: string;
    chainName: string;
  };
  app: {
    connectedWalletAddress?: string;
    authorizationStatus: string;
    pactId?: string;
    activeAuthorization: boolean;
    cawOnboardingStatus?: string;
  };
  spendReadiness?: {
    requiredUsdcMinor: number;
    remainingUsdcMinor: number;
    allowanceUsdcMinor?: number;
    walletUsdcMinor?: number;
    gasEth?: string;
    pactExpiresAt?: string;
    error?: string;
  };
  readyForRealPayment: boolean;
  missing: string[];
  configurationMissing?: string[];
  paymentMissing?: string[];
  cawConfigured?: boolean;
};

type CawPactSummary = {
  id: string;
  name: string;
  status: string;
  expiresAt: string;
  remaining?: { timeRemainingSeconds?: number; txCountRemaining?: number };
};

type CawPactPreview = {
  intent: string;
  originalIntent: string;
  executionPlan: string;
  policies: unknown[];
  completionConditions: unknown[];
  draftedBy: 'agent_llm' | 'agent_deterministic';
  warnings: string[];
  limits: {
    singleLimitUsdcMinor: number;
    dailyLimitUsdcMinor: number;
    monthlyLimitUsdcMinor: number;
    validDays: number;
  };
};

function fmtUsdc(minor: number) {
  return `$${(minor / 1_000_000).toFixed(2)}`;
}

function shortHash(value: string) {
  if (value.length <= 18) return value;
  return `${value.slice(0, 10)}...${value.slice(-6)}`;
}

export default function CawPanel() {
  const [cawStatus, setCawStatus] = useState<CawStatusResult | null>(null);
  const [cawPacts, setCawPacts] = useState<CawPactSummary[]>([]);
  const [cawHasBaseUsdcPact, setCawHasBaseUsdcPact] = useState(false);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [pairingExpires, setPairingExpires] = useState<string | null>(null);
  const [pairingSessionStatus, setPairingSessionStatus] = useState<string | null>(null);
  const [walletPaired, setWalletPaired] = useState(false);
  const [pactPreview, setPactPreview] = useState<CawPactPreview | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // CAW wallet bind form
  const [cawManualUuid, setCawManualUuid] = useState('');
  const [cawManualName, setCawManualName] = useState('');
  const [cawManualEnv, setCawManualEnv] = useState<'prod' | 'dev'>('prod');

  // Pact creation form
  const [pactIntent, setPactIntent] = useState('允许这个 Agent 在我的站内 credits 余额不足时，使用 Base Sepolia USDC 自动充值；每次最多 1 USDC，每天最多 5 USDC，有效期 7 天。');
  const [singleLimitStr, setSingleLimitStr] = useState('1');
  const [dailyLimitStr, setDailyLimitStr] = useState('5');
  const [monthlyLimitStr, setMonthlyLimitStr] = useState('20');
  const [validDaysStr, setValidDaysStr] = useState('7');

  const realPactReady = cawStatus
    ? !cawStatus.missing.some(m => m.includes('Pact'))
    : false;
  const walletConnected = Boolean(cawStatus?.app.connectedWalletAddress);

  const loadAll = useCallback(async () => {
    // Load CAW status
    try {
      const res = await fetch('/api/wallet/caw/status', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setCawStatus(data);
        setWalletPaired(data.runtime?.walletPaired ?? false);
      }
    } catch { /* ignore */ }

    // Load Pacts
    try {
      const res = await fetch('/api/wallet/caw/pacts', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setCawPacts(data.pacts ?? []);
        setCawHasBaseUsdcPact(Boolean(data.hasBaseUsdcPact));
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function callAction(action: string, path: string, body?: Record<string, unknown>) {
    setBusyAction(action);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (res.status === 401) { window.location.href = '/login'; return; }
      const data = await res.json();

      // Handle pairing
      if (action === 'pair' && data.code) {
        setPairingCode(data.code);
        setPairingExpires(data.expiresAt ?? null);
        setPairingSessionStatus(data.status ?? null);
        setMessage('配对码已生成。请在 Cobo Agentic Wallet App 内完成绑定。');
      }
      if (action === 'refresh-pair') {
        if (data.status === 'paired' || data.paired) {
          setWalletPaired(true);
          setMessage('配对状态已更新：已配对。');
        } else {
          setMessage('配对状态已更新：仍未配对。如果已在 App 中确认，请等待几秒后再试。');
        }
      }
      if (action === 'connect') {
        setMessage('CAW 钱包已连接。');
      }
      if (action === 'faucet') {
        setMessage('测试币请求已提交，会调用 CAW Faucet。');
      }
      if (action === 'approve-usdc') {
        setMessage(data.txHash ? `USDC 授权已提交到真实 CAW。Tx: ${shortHash(data.txHash)}` : 'USDC 授权已提交到真实 CAW。');
      }

      // Handle pact preview
      if (action === 'pact-preview' && data.preview) {
        setPactPreview(data.preview);
        setMessage('Pact 计划已生成，请确认内容后提交到 Cobo App 审批。');
      }
      if (action === 'authorize') {
        setPactPreview(null);
        setMessage('Pact 已提交。请在 Cobo Agentic Wallet App 内审批，审批后点击刷新 Pact。');
      }
      if (action === 'refresh-pact') {
        setMessage('Pact 状态已刷新。如果用户已在 Cobo App 审批，系统会保存 pact-scoped API key。');
      }
      if (action === 'refresh-authorization') {
        setMessage('Authorization 已刷新。');
      }

      // Re-fresh everything after action
      loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : '请求失败');
    } finally {
      setBusyAction(null);
    }
  }

  async function callBind(path: string, body: Record<string, unknown>) {
    setBusyAction('bind');
    setMessage(null);
    setError(null);
    try {
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.status === 401) { window.location.href = '/login'; return; }
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? 'Bind failed');
        return;
      }
      setMessage(`Wallet bound: ${data.current?.walletName ?? body.walletName ?? ''}`);
      loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bind failed');
    } finally {
      setBusyAction(null);
    }
  }

  const formBtnCls = 'inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors';
  const primaryBtnCls = 'inline-flex items-center gap-1.5 rounded-lg bg-[#2563EB] px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-[#1D4ED8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors';

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <Wallet className="w-4 h-4 text-blue-600" />
          CAW 钱包管理
        </h3>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
          cawStatus?.readyForRealPayment ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
        }`}>
          {cawStatus?.readyForRealPayment ? '真实支付已就绪' : '真实支付未就绪'}
        </span>
      </div>

      {/* Guide steps */}
      <div className="mb-5 bg-gray-50 rounded-lg p-4">
        <p className="text-xs font-semibold text-gray-600 mb-3">演示流程总览</p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {[
            { step: '1', title: 'CAW 钱包配对', done: cawStatus?.runtime.walletPaired ?? false },
            { step: '2', title: '测试币准备', done: false },
            { step: '3', title: 'Pact 授权', done: realPactReady },
            { step: '4', title: '真实链上支付', done: cawStatus?.readyForRealPayment ?? false },
          ].map((g) => (
            <div key={g.step} className={`flex items-center gap-2 p-2 rounded-lg text-xs ${g.done ? 'bg-emerald-50 text-emerald-800' : 'bg-white text-gray-500 border border-gray-200'}`}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${g.done ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                {g.done ? '✓' : g.step}
              </div>
              <div>
                <p className="font-medium">{g.title}</p>
                <p className="text-[10px] opacity-70">{g.done ? '已完成' : '待完成'}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* New user guide */}
      <details className="mb-4 text-xs text-gray-500">
        <summary className="cursor-pointer font-medium text-gray-600 flex items-center gap-1">
          <ChevronDown className="w-3 h-3" />
          新用户接入 CAW 指南
        </summary>
        <div className="mt-2 p-3 bg-gray-50 rounded-lg space-y-1">
          <p>1. 当前版本是单钱包部署模式：一份部署只读取一个后端 CAW Agent Wallet。</p>
          <p>2. 给另一个人使用时，先在服务器或本机用 CAW CLI 创建新的 Agent Wallet。</p>
          <p>3. 把新钱包的 API URL、API Key、Wallet ID、钱包地址写入该部署的环境变量。</p>
          <p>4. 重启网站后，页面会变成"未配对"，再生成配对码给新用户手机 CAW App 输入。</p>
          <p>5. 配对成功后点击"连接 CAW"，再让用户在手机里批准 Pact 和 USDC 授权。</p>
        </div>
      </details>

      {/* Pairing Section */}
      <div className="border border-gray-200 rounded-lg p-4 mb-5">
        <div className="flex items-center gap-3 mb-3">
          <Smartphone className="w-4 h-4 text-gray-500" />
          <span className="text-xs font-semibold text-gray-700">
            {walletPaired ? 'CAW 钱包已配对' : 'CAW 手机配对码'}
          </span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
            walletPaired ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
          }`}>
            {walletPaired ? '已完成' : pairingCode ? pairingSessionStatus : '未生成'}
          </span>
        </div>

        <div className="bg-gray-50 rounded-lg p-3 mb-3 font-mono text-sm text-center">
          {walletPaired
            ? (cawStatus?.runtime.walletAddress ?? '已配对')
            : (pairingCode ?? '点击下方按钮生成配对码')
          }
        </div>

        {!walletPaired && pairingExpires && (
          <p className="text-[10px] text-gray-400 mb-3">过期时间：{new Date(pairingExpires).toLocaleString('zh-CN')}</p>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            className={primaryBtnCls}
            onClick={() => callAction('pair', '/api/wallet/caw/pairing-code')}
            disabled={busyAction === 'pair' || walletPaired}
          >
            {walletPaired ? '已配对' : '生成配对码'}
          </button>
          <button
            className={formBtnCls}
            onClick={() => callAction('refresh-pair', '/api/wallet/caw/pairing-code/refresh')}
            disabled={busyAction === 'refresh-pair' || walletPaired}
          >
            刷新配对状态
          </button>
          <button
            className={formBtnCls}
            onClick={() => callAction('connect', '/api/wallet/caw/connect')}
            disabled={busyAction === 'connect' || walletConnected}
          >
            连接 CAW
          </button>
        </div>
      </div>

      {/* Wallet Binding */}
      <div className="border border-gray-200 rounded-lg p-4 mb-5">
        <h4 className="text-xs font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
          <Key className="w-3.5 h-3.5 text-gray-500" />
          CAW 钱包绑定
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
            cawStatus?.runtime.walletConfigured ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
          }`}>
            {cawStatus?.runtime.walletConfigured ? cawStatus.runtime.walletName ?? '已配置' : '缺少'}
          </span>
        </h4>
        <p className="text-[10px] text-gray-400 mb-3">从 caw skill 安装记录发现钱包，或手动输入 UUID。绑定后所有 API 会自动用此钱包。</p>

        <div className="flex flex-wrap gap-2 mb-3">
          <button
            className={formBtnCls}
            onClick={async () => {
              setBusyAction('discover');
              try {
                const res = await fetch('/api/wallet/caw/discover', { cache: 'no-store' });
                if (res.ok) {
                  const data = await res.json();
                  if (data.wallets?.length > 0) {
                    // Auto-bind first discovered
                    const w = data.wallets[0];
                    await callBind('/api/wallet/caw/runtime-config', {
                      walletUuid: w.walletUuid,
                      walletName: w.walletName,
                      apiUrl: w.apiUrl,
                      agentId: w.agentId ?? '',
                    });
                  } else {
                    setError('未发现本地钱包。请手动输入 UUID。');
                  }
                }
              } catch { setError('发现钱包失败'); }
              setBusyAction(null);
            }}
            disabled={busyAction === 'discover'}
          >
            检测本机钱包
          </button>
          <button
            className={formBtnCls}
            onClick={async () => {
              setBusyAction('autobind');
              try {
                const res = await fetch('/api/wallet/caw/runtime-config?autobind=1', { cache: 'no-store' });
                if (!res.ok) { setError('Autobind failed'); return; }
                const data = await res.json();
                if (data.ok) {
                  setMessage(`Auto-bound: ${data.profile?.walletName ?? ''}`);
                  loadAll();
                } else setError(data.error ?? 'Autobind failed');
              } catch { setError('Autobind failed'); }
              setBusyAction(null);
            }}
            disabled={busyAction === 'autobind'}
          >
            自动绑定默认钱包
          </button>
        </div>

        {/* Manual bind */}
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-[10px] font-medium text-gray-600 mb-2">手动绑定</p>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-500 w-16 flex-shrink-0">钱包 UUID</span>
              <input
                value={cawManualUuid}
                onChange={(e) => setCawManualUuid(e.target.value)}
                placeholder="例如：6b39ed06-1af9-4067-82b8-67ea09c7b1ec"
                className="flex-1 rounded border border-gray-300 px-2 py-1.5 text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-[#2563EB] focus:border-transparent"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-500 w-16 flex-shrink-0">钱包名称</span>
              <input
                value={cawManualName}
                onChange={(e) => setCawManualName(e.target.value)}
                placeholder="例如：EthanTestProd"
                className="flex-1 rounded border border-gray-300 px-2 py-1.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-[#2563EB] focus:border-transparent"
              />
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1 text-[10px] cursor-pointer">
                <input type="radio" name="caw-env" checked={cawManualEnv === 'prod'} onChange={() => setCawManualEnv('prod')} className="w-3 h-3" />
                主网 (Base mainnet)
              </label>
              <label className="flex items-center gap-1 text-[10px] cursor-pointer">
                <input type="radio" name="caw-env" checked={cawManualEnv === 'dev'} onChange={() => setCawManualEnv('dev')} className="w-3 h-3" />
                测试网 (Base Sepolia)
              </label>
            </div>
            <button
              className={primaryBtnCls}
              onClick={() => callBind('/api/wallet/caw/runtime-config', {
                walletUuid: cawManualUuid.trim(),
                walletName: cawManualName.trim() || 'manual',
                apiUrl: cawManualEnv === 'prod' ? 'https://api.agenticwallet.cobo.com' : 'https://api-core.agenticwallet.dev.cobo.com',
              })}
              disabled={busyAction === 'bind' || !/^[0-9a-f-]{36}$/i.test(cawManualUuid.trim())}
            >
              绑定
            </button>
          </div>
        </div>
      </div>

      {/* Pact Status */}
      <div className="border border-gray-200 rounded-lg p-4 mb-5">
        <h4 className="text-xs font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-gray-500" />
          Pact 授权状态
        </h4>
        <div className="space-y-2 text-xs mb-3">
          <div className="flex items-center justify-between py-1 border-b border-gray-50">
            <span className="text-gray-500">活跃 Pact</span>
            <span className="font-medium">{cawPacts.length}</span>
          </div>
          <div className="flex items-center justify-between py-1 border-b border-gray-50">
            <span className="text-gray-500">Base USDC Pact</span>
            <span className={`font-medium ${cawHasBaseUsdcPact ? 'text-emerald-700' : 'text-amber-700'}`}>
              {cawHasBaseUsdcPact ? '就绪' : '缺少（Venice 充值会失败）'}
            </span>
          </div>
        </div>

        {cawPacts.length > 0 && (
          <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
            {cawPacts.slice(0, 5).map((p) => (
              <div key={p.id} className="bg-gray-50 rounded-lg p-2">
                <code className="text-[10px] font-mono text-gray-500">{p.id.slice(0, 8)}…</code>
                <p className="text-xs mt-1 text-gray-700">{p.name.length > 80 ? p.name.slice(0, 80) + '…' : p.name}</p>
                <div className="flex items-center gap-3 text-[10px] text-gray-400 mt-1">
                  <span>status: {p.status}</span>
                  {p.remaining?.txCountRemaining != null && (
                    <span>· {p.remaining.txCountRemaining} tx 剩余</span>
                  )}
                  {p.expiresAt && (
                    <span>· 过期 {p.expiresAt.slice(0, 10)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pact action buttons */}
        <div className="flex flex-wrap gap-2 mb-3">
          <button className={primaryBtnCls} onClick={() => callAction('faucet', '/api/wallet/caw/faucet')} disabled={busyAction === 'faucet'}>
            领取测试币
          </button>
          <button className={primaryBtnCls} onClick={() => {
            const body = {
              intent: pactIntent,
              singleLimitUsdcMinor: Math.round(Number(singleLimitStr) * 1_000_000),
              dailyLimitUsdcMinor: Math.round(Number(dailyLimitStr) * 1_000_000),
              monthlyLimitUsdcMinor: Math.round(Number(monthlyLimitStr) * 1_000_000),
              validDays: Math.floor(Number(validDaysStr)) || 1,
              previewOnly: true,
            };
            callAction('pact-preview', '/api/wallet/caw/authorization', body);
          }} disabled={busyAction === 'pact-preview'}>
            生成 Pact 计划
          </button>
          <button className={primaryBtnCls} onClick={() => {
            const body = {
              intent: pactIntent,
              singleLimitUsdcMinor: Math.round(Number(singleLimitStr) * 1_000_000),
              dailyLimitUsdcMinor: Math.round(Number(dailyLimitStr) * 1_000_000),
              monthlyLimitUsdcMinor: Math.round(Number(monthlyLimitStr) * 1_000_000),
              validDays: Math.floor(Number(validDaysStr)) || 1,
            };
            callAction('authorize', '/api/wallet/caw/authorization', body);
          }} disabled={busyAction === 'authorize' || !pactPreview}>
            提交 Pact
          </button>
          <button className={formBtnCls} onClick={() => callAction('refresh-pact', '/api/wallet/caw/authorization/refresh')} disabled={busyAction === 'refresh-pact'}>
            刷新 Pact
          </button>
          <button className={formBtnCls} onClick={() => callAction('refresh-authorization', '/api/wallet/caw/authorization/refresh')} disabled={busyAction === 'refresh-authorization'}>
            刷新 Authorization
          </button>
          <button className={formBtnCls} onClick={() => callAction('approve-usdc', '/api/wallet/caw/approve')} disabled={busyAction === 'approve-usdc' || !realPactReady}>
            授权 USDC
          </button>
        </div>

        {/* Pact preview */}
        {pactPreview && (
          <div className="bg-blue-50/50 rounded-lg p-3 border border-blue-100">
            <p className="text-xs font-semibold text-gray-700 mb-2">Pact 预览</p>
            <div className="space-y-2 text-[11px]">
              <div><strong className="text-gray-600">Intent:</strong> <span className="text-gray-700">{pactPreview.intent}</span></div>
              <div><strong className="text-gray-600">起草来源:</strong> <span className="text-gray-700">{pactPreview.draftedBy}</span></div>
              <div><strong className="text-gray-600">原始意图:</strong> <span className="text-gray-700">{pactPreview.originalIntent}</span></div>
              <div><strong className="text-gray-600">执行计划:</strong> <pre className="text-gray-700 bg-white rounded p-2 mt-1 overflow-x-auto text-[10px]">{pactPreview.executionPlan}</pre></div>
              {pactPreview.warnings.length > 0 && (
                <div><strong className="text-amber-600">校验提示:</strong> <pre className="text-amber-700 mt-1">{pactPreview.warnings.join('\n')}</pre></div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Spend Readiness */}
      {cawStatus?.spendReadiness && (
        <div className="border border-gray-200 rounded-lg p-4 mb-5">
          <h4 className="text-xs font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-gray-500" />
            支付就绪
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="bg-gray-50 rounded p-2">
              <p className="text-[10px] text-gray-500">下一笔需要</p>
              <p className="text-xs font-bold">{fmtUsdc(cawStatus.spendReadiness.requiredUsdcMinor)}</p>
            </div>
            <div className="bg-gray-50 rounded p-2">
              <p className="text-[10px] text-gray-500">Pact 剩余</p>
              <p className="text-xs font-bold">{fmtUsdc(cawStatus.spendReadiness.remainingUsdcMinor)}</p>
            </div>
            {cawStatus.spendReadiness.allowanceUsdcMinor !== undefined && (
              <div className="bg-gray-50 rounded p-2">
                <p className="text-[10px] text-gray-500">USDC 授权</p>
                <p className="text-xs font-bold">{fmtUsdc(cawStatus.spendReadiness.allowanceUsdcMinor)}</p>
              </div>
            )}
            {cawStatus.spendReadiness.gasEth && (
              <div className="bg-gray-50 rounded p-2">
                <p className="text-[10px] text-gray-500">Gas</p>
                <p className="text-xs font-bold">{Number(cawStatus.spendReadiness.gasEth).toFixed(6)} ETH</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Missing items */}
      {cawStatus && cawStatus.missing.length > 0 && (
        <div className="bg-amber-50/50 rounded-lg p-3 border border-amber-100 mb-5">
          <p className="text-xs font-medium text-amber-800 mb-1">缺少配置：</p>
          <p className="text-[11px] text-amber-700">{cawStatus.missing.join('，')}</p>
        </div>
      )}

      {/* Flash display / new user guide table content */}
      <div className="border border-gray-200 rounded-lg p-4">
        <h4 className="text-xs font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
          <Wallet className="w-3.5 h-3.5 text-gray-500" />
          钱包信息
        </h4>
        <div className="space-y-2 text-xs">
          <InfoRow label="钱包 ID" value={cawStatus?.runtime.walletId ?? '-'} />
          <InfoRow label="钱包名称" value={cawStatus?.runtime.walletName ?? '-'} />
          <InfoRow label="状态" value={cawStatus?.runtime.walletStatus ?? '-'} />
          <InfoRow label="链" value={cawStatus?.runtime.chainName ? `${cawStatus.runtime.chainName} · ${cawStatus.runtime.chainId}` : '-'} />
          <InfoRow label="钱包地址" value={cawStatus?.runtime.walletAddress ? `${cawStatus.runtime.walletAddress.slice(0, 10)}...${cawStatus.runtime.walletAddress.slice(-6)}` : '-'} />
          <InfoRow label="App 钱包" value={cawStatus?.app.connectedWalletAddress ? `${cawStatus.app.connectedWalletAddress.slice(0, 6)}...${cawStatus.app.connectedWalletAddress.slice(-4)}` : '-'} />
        </div>
      </div>

      {/* Pact creation form */}
      <details className="mt-4">
        <summary className="cursor-pointer text-xs font-medium text-gray-600 flex items-center gap-1">
          <ChevronDown className="w-3 h-3" />
          Pact 参数配置
        </summary>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-gray-500 block mb-1">单笔 USDC</label>
            <input value={singleLimitStr} onChange={e => setSingleLimitStr(e.target.value)} className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#2563EB]" />
          </div>
          <div>
            <label className="text-[10px] text-gray-500 block mb-1">每日 USDC</label>
            <input value={dailyLimitStr} onChange={e => setDailyLimitStr(e.target.value)} className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#2563EB]" />
          </div>
          <div>
            <label className="text-[10px] text-gray-500 block mb-1">每月 USDC</label>
            <input value={monthlyLimitStr} onChange={e => setMonthlyLimitStr(e.target.value)} className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#2563EB]" />
          </div>
          <div>
            <label className="text-[10px] text-gray-500 block mb-1">有效天数</label>
            <input value={validDaysStr} onChange={e => setValidDaysStr(e.target.value)} className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#2563EB]" />
          </div>
        </div>
        <textarea
          value={pactIntent}
          onChange={(e) => { setPactIntent(e.target.value); setPactPreview(null); }}
          rows={2}
          className="mt-3 w-full rounded border border-gray-300 px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
          placeholder="授权意图描述"
        />
      </details>

      {/* Messages */}
      {message && <p className="mt-4 text-xs text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">✅ {message}</p>}
      {error && <p className="mt-4 text-xs text-red-700 bg-red-50 rounded-lg px-3 py-2">⚠ {error}</p>}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-gray-50 last:border-b-0">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-900 font-mono text-right max-w-[55%] truncate">{value}</span>
    </div>
  );
}
