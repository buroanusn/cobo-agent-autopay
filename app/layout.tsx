import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agent Credits Wallet",
  description: "CAW-controlled auto top-up flow for agent credits."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
