import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getDashboardSnapshot } from "@/lib/domain/services";
import { formatUsdc } from "@/lib/domain/money";
import type { TopupOrder, TopupOrderStatus } from "@/lib/domain/types";

export const dynamic = "force-dynamic";

export default async function PaymentsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const snapshot = await getDashboardSnapshot(user.id);
  const orders = snapshot.topupOrders;
  const creditedOrders = orders.filter((order) => order.status === "credited");
  const totalPaidUsdcMinor = creditedOrders.reduce(
    (total, order) => total + order.amountUsdcMinor,
    0
  );

  return (
    <main className="page">
      <header className="topbar">
        <div>
          <h1 className="title">支付记录</h1>
          <p className="subtitle">
            当前登录账户的 CAW 自动支付、x402 支付和手动充值记录。
          </p>
        </div>
        <div className="top-actions">
          <a className="button-link secondary compact" href="/dashboard">
            返回控制台
          </a>
        </div>
      </header>

      <section className="grid">
        <div className="panel span-4">
          <div className="panel-title">
            <h2>成功支付</h2>
            <span className="status active">{creditedOrders.length}</span>
          </div>
          <div className="metric">{formatUsdc(totalPaidUsdcMinor)}</div>
          <div className="metric-label">USDC 已到账</div>
        </div>

        <div className="panel span-4">
          <div className="panel-title">
            <h2>处理中</h2>
            <span className="status blocked">{orders.filter(isProcessing).length}</span>
          </div>
          <div className="metric">{orders.filter(isProcessing).length}</div>
          <div className="metric-label">等待 CAW 或链上确认</div>
        </div>

        <div className="panel span-4">
          <div className="panel-title">
            <h2>失败</h2>
            <span className="status failed">{orders.filter(isFailed).length}</span>
          </div>
          <div className="metric">{orders.filter(isFailed).length}</div>
          <div className="metric-label">策略拒绝或执行失败</div>
        </div>

        <div className="panel span-12">
          <div className="panel-title">
            <h2>账单明细</h2>
            <span className="status active">最近 {orders.length} 条</span>
          </div>

          {orders.length === 0 ? (
            <div className="notice">暂无支付记录。</div>
          ) : (
            <div className="payment-table-wrap">
              <table className="payment-table">
                <thead>
                  <tr>
                    <th>时间</th>
                    <th>类型</th>
                    <th>金额</th>
                    <th>积分</th>
                    <th>状态</th>
                    <th>交易</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id}>
                      <td>{formatDateTime(order.creditedAt ?? order.updatedAt)}</td>
                      <td>{paymentTitle(order)}</td>
                      <td>{formatUsdc(order.amountUsdcMinor)} USDC</td>
                      <td>{order.credits.toLocaleString("zh-CN")}</td>
                      <td>
                        <span className={`status ${paymentStatusClass(order.status)}`}>
                          {paymentStatusText(order.status)}
                        </span>
                      </td>
                      <td>
                        {order.txHash ? (
                          <a
                            href={`${snapshot.network.name === "Base" ? "https://basescan.org" : "https://sepolia.basescan.org"}/tx/${order.txHash}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {shortHash(order.txHash)}
                          </a>
                        ) : (
                          <span className="muted-text">{order.failureReason ?? order.orderId}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function paymentTitle(order: TopupOrder) {
  if (order.reason === "x402_resource") {
    return "x402 资源支付";
  }
  if (order.reason === "low_balance") {
    return "低余额自动充值";
  }
  if (order.reason === "insufficient_balance") {
    return "余额不足补足";
  }
  if (order.reason === "manual") {
    return "手动充值";
  }
  return "CAW 支付";
}

function paymentStatusText(status: TopupOrderStatus) {
  if (status === "credited") {
    return "成功";
  }
  if (status === "failed" || status === "approval_expired") {
    return "失败";
  }
  return "处理中";
}

function paymentStatusClass(status: TopupOrderStatus) {
  if (status === "credited") {
    return "active";
  }
  if (status === "failed" || status === "approval_expired") {
    return "failed";
  }
  return "blocked";
}

function isProcessing(order: TopupOrder) {
  return ["pending_policy", "caw_submitted", "chain_pending", "pending_approval"].includes(order.status);
}

function isFailed(order: TopupOrder) {
  return order.status === "failed" || order.status === "approval_expired";
}

function shortHash(value: string) {
  if (value.length <= 18) {
    return value;
  }
  return `${value.slice(0, 10)}...${value.slice(-6)}`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(new Date(value));
}
