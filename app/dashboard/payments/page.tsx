"use client";

import { useEffect, useState } from "react";

type PaymentRecord = {
  id: string;
  time: string;
  amount: string;
  token: string;
  chain: string;
  to: string;
  from: string;
  status: string;
  subStatus: string;
  reason: string;
  txHash: string | null;
  description: string;
  requestId: string;
  fee: string | null;
  pactId: string;
};

const reasonLabel: Record<string, { text: string; color: string }> = {
  x402_auto: { text: "自动支付", color: "#1d8a5f" },
  manual: { text: "手动转账", color: "#3a7caa" },
  policy_denied: { text: "策略拒绝", color: "#ad2f2f" },
  pending: { text: "处理中", color: "#9a6a13" },
  expired: { text: "已过期", color: "#888" },
};

const statusLabel: Record<string, { text: string; color: string; bg: string }> = {
  Success: { text: "成功", color: "#116a47", bg: "#d4f5e4" },
  Rejected: { text: "失败", color: "#ad2f2f", bg: "#fde2e2" },
  Pending: { text: "处理中", color: "#9a6a13", bg: "#fff3d6" },
  Expired: { text: "已过期", color: "#666", bg: "#eee" },
};

function shortAddr(addr: string) {
  if (!addr) return "—";
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

function shortHash(hash: string | null) {
  if (!hash) return "—";
  return hash.slice(0, 8) + "…" + hash.slice(-6);
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export default function PaymentsPage() {
  const [records, setRecords] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchRecords() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/wallet/caw/transactions");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setRecords(data.records || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchRecords();
  }, []);

  // Summary stats
  const totalTx = records.length;
  const successTx = records.filter((r) => r.status === "Success").length;
  const totalAmount = records
    .filter((r) => r.status === "Success")
    .reduce((sum, r) => sum + parseFloat(r.amount || "0"), 0);
  const autoTx = records.filter((r) => r.reason === "x402_auto" && r.status === "Success").length;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 20px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>
            💰 支付记录
          </h1>
          <p style={{ fontSize: 13, color: "var(--muted)", margin: "4px 0 0" }}>
            所有 CAW 钱包的 x402 自动支付和手动转账记录
          </p>
        </div>
        <button
          onClick={fetchRecords}
          disabled={loading}
          style={{
            padding: "8px 18px",
            background: "var(--primary)",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? "加载中…" : "刷新"}
        </button>
      </div>

      {/* Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { label: "总交易数", value: totalTx, suffix: "笔" },
          { label: "成功交易", value: successTx, suffix: "笔" },
          { label: "总支出", value: totalAmount.toFixed(4), suffix: " SETH" },
          { label: "x402 自动支付", value: autoTx, suffix: "笔" },
        ].map((card) => (
          <div
            key={card.label}
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: 12,
              padding: "14px 16px",
            }}
          >
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>{card.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text)" }}>
              {card.value}
              <span style={{ fontSize: 13, fontWeight: 400, color: "var(--muted)" }}>{card.suffix}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            background: "#fde2e2",
            color: "#ad2f2f",
            padding: "10px 14px",
            borderRadius: 8,
            fontSize: 13,
            marginBottom: 16,
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {/* Table */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: 14,
          overflow: "hidden",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "var(--surface-soft)" }}>
              {["支付时间", "金额", "付款地址", "收款地址", "状态", "原因", "交易哈希"].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: "10px 12px",
                    textAlign: "left",
                    fontWeight: 600,
                    color: "var(--muted)",
                    borderBottom: "1px solid var(--line)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && records.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>
                  加载中…
                </td>
              </tr>
            ) : records.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>
                  暂无支付记录
                </td>
              </tr>
            ) : (
              records.map((r) => {
                const st = statusLabel[r.status] || statusLabel.Pending;
                const re = reasonLabel[r.reason] || reasonLabel.manual;
                return (
                  <tr
                    key={r.id}
                    style={{ borderBottom: "1px solid var(--line)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-soft)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    {/* 时间 */}
                    <td style={{ padding: "10px 12px", whiteSpace: "nowrap", color: "var(--text)" }}>
                      {formatTime(r.time)}
                    </td>
                    {/* 金额 */}
                    <td style={{ padding: "10px 12px", fontWeight: 600, color: "var(--text)" }}>
                      {r.amount} {r.token}
                    </td>
                    {/* 付款地址 */}
                    <td style={{ padding: "10px 12px", fontFamily: "monospace", fontSize: 12, color: "var(--muted)" }}>
                      <span title={r.from}>{shortAddr(r.from)}</span>
                    </td>
                    {/* 收款地址 */}
                    <td style={{ padding: "10px 12px", fontFamily: "monospace", fontSize: 12, color: "var(--muted)" }}>
                      <span title={r.to}>{shortAddr(r.to)}</span>
                    </td>
                    {/* 状态 */}
                    <td style={{ padding: "10px 12px" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "2px 10px",
                          borderRadius: 12,
                          fontSize: 12,
                          fontWeight: 600,
                          color: st.color,
                          background: st.bg,
                        }}
                      >
                        {st.text}
                      </span>
                    </td>
                    {/* 原因 */}
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{ color: re.color, fontWeight: 500, fontSize: 12 }}>{re.text}</span>
                    </td>
                    {/* 交易哈希 */}
                    <td style={{ padding: "10px 12px", fontFamily: "monospace", fontSize: 12 }}>
                      {r.txHash ? (
                        <a
                          href={`https://sepolia.etherscan.io/tx/${r.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: "var(--primary)", textDecoration: "none" }}
                          title={r.txHash}
                        >
                          {shortHash(r.txHash)} ↗
                        </a>
                      ) : (
                        <span style={{ color: "var(--muted)" }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 12, textAlign: "right" }}>
        数据来源：CAW 钱包服务端 · 刷新页面不会丢失记录
      </div>
    </div>
  );
}
