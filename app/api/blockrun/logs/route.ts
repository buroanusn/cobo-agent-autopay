import { NextResponse } from 'next/server';
import { getBlockRunLogs } from '@/app/api/blockrun/logs-store';

export async function GET() {
  const logs = await getBlockRunLogs(10);
  return NextResponse.json({
    ok: true,
    logs,
  });
}
