// Shared log store for BlockRun inference history
// Uses /tmp/blockrun-logs.json to bypass Next.js dev-mode module isolation
// so inference (POST) and logs (GET) routes share the same data.

import { promises as fs } from 'node:fs';

const LOG_FILE = '/tmp/blockrun-logs.json';

export type BlockRunLogEntry = {
  id: string;
  prompt: string;
  model: string;
  durationMs: number;
  costUsdc: number | null;
  status: 'completed' | 'failed';
  createdAt: string;
};

async function readLogs(): Promise<BlockRunLogEntry[]> {
  try {
    const raw = await fs.readFile(LOG_FILE, 'utf-8');
    return JSON.parse(raw) as BlockRunLogEntry[];
  } catch {
    return [];
  }
}

async function writeLogs(logs: BlockRunLogEntry[]): Promise<void> {
  await fs.writeFile(LOG_FILE, JSON.stringify(logs), 'utf-8');
}

export async function addBlockRunLog(entry: Omit<BlockRunLogEntry, 'id' | 'createdAt'>): Promise<void> {
  const logs = await readLogs();
  logs.unshift({
    ...entry,
    id: `bl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  });
  // Keep max 50 entries
  if (logs.length > 50) logs.length = 50;
  await writeLogs(logs);
}

export async function getBlockRunLogs(limit = 10): Promise<BlockRunLogEntry[]> {
  const logs = await readLogs();
  return logs.slice(0, limit);
}
