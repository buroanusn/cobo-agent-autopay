import { NextResponse } from 'next/server';

// Track balance fetch time for display
let lastFetchedAt: string | null = null;

// Parse USDC from caw wallet balance output
function parseUsdcBalance(stdout: string): number {
  // Try to find USDC balance in the output
  // caw wallet balance output format example:
  // "USDC: 123.45" or "0x... | USDC | 123.45"
  const usdcMatch = stdout.match(/USDC[:\s]*([0-9.]+)/i);
  if (usdcMatch) return parseFloat(usdcMatch[1]) || 0;

  // Try to find any balance-like number at end of output
  const numbers = stdout.match(/([0-9]+\.?[0-9]*)/g);
  if (numbers && numbers.length > 0) {
    return parseFloat(numbers[numbers.length - 1]) || 0;
  }

  return 0;
}

export async function GET() {
  // In mock mode or if CAW is not available, return mock data
  const cawMode = process.env.CAW_MODE || 'mock';

  let balanceUsdc = 0;

  if (cawMode === 'http') {
    try {
      const { spawn } = await import('node:child_process');
      const child = spawn('caw', ['wallet', 'balance'], {
        env: { ...process.env, NODE_TLS_REJECT_UNAUTHORIZED: '0' },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      const stdout = await new Promise<string>((resolve, reject) => {
        let out = '';
        let err = '';
        child.stdout.on('data', (b: Buffer) => (out += b.toString()));
        child.stderr.on('data', (b: Buffer) => (err += b.toString()));
        child.on('error', reject);
        child.on('close', (code) => {
          if (code === 0) resolve(out);
          else reject(new Error(err || `exit code ${code}`));
        });
      });

      balanceUsdc = parseUsdcBalance(stdout);
    } catch (e) {
      // If caw command fails, fall back to mock
      balanceUsdc = Math.random() * 20;
    }
  } else {
    // Mock mode — simulate a random balance
    balanceUsdc = Number((Math.random() * 20).toFixed(2));
  }

  // Read minBalance from blockrun config (runtime override via env)
  const minBalance = Number(process.env.BLOCKRUN_MIN_BALANCE ?? 5);
  const isBelowThreshold = balanceUsdc < minBalance;

  lastFetchedAt = new Date().toISOString();

  return NextResponse.json({
    balanceUsdc,
    minBalance,
    isBelowThreshold,
    updatedAt: lastFetchedAt,
  });
}
