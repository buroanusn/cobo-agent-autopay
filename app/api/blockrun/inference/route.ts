import { NextRequest, NextResponse } from 'next/server';
import { addBlockRunLog } from '@/app/api/blockrun/logs-store';

export async function POST(req: NextRequest) {
  const start = Date.now();

  try {
    const body = await req.json();
    const { prompt, model } = body;

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Missing prompt' }, { status: 400 });
    }

    const modelToUse = model || process.env.BLOCKRUN_MODEL || 'openai/gpt-oss-20b';

    const messages = [{ role: 'user', content: prompt }];

    try {
      // Import dynamically to avoid server-side issues
      const { runBlockRunX402Inference } = await import('@/lib/blockrun/topup');

      // We need a pactId - use a reasonable default or read from env
      const pactId = process.env.CAW_PACT_ID || 'default';

      const result = await runBlockRunX402Inference({
        userId: 'api',
        walletAddress: process.env.CAW_WALLET_ADDRESS || '0x0000000000000000000000000000000000000000',
        pactId,
        model: modelToUse,
        messages: messages as any,
        usdAmount: 0.01,
      });

      const durationMs = Date.now() - start;

      if (result.status === 'completed' && result.responseStatus >= 200 && result.responseStatus < 300) {
        // Try to extract the actual response content
        let resultText = result.responseBody;
        try {
          const parsed = JSON.parse(result.responseBody);
          if (parsed.choices?.[0]?.message?.content) {
            resultText = parsed.choices[0].message.content;
          }
        } catch {
          // Use raw response
        }

        await addBlockRunLog({
          prompt,
          model: modelToUse,
          durationMs,
          costUsdc: 0.001, // Fixed cost for x402 inference
          status: 'completed',
        });

        return NextResponse.json({
          ok: true,
          result: resultText,
          costUsdc: 0.001,
          duration: durationMs,
        });
      } else {
        await addBlockRunLog({
          prompt,
          model: modelToUse,
          durationMs,
          costUsdc: null,
          status: 'failed',
        });

        return NextResponse.json({
          ok: false,
          error: result.error || `x402 returned HTTP ${result.responseStatus}`,
          duration: durationMs,
        }, { status: 502 });
      }
    } catch (e) {
      const durationMs = Date.now() - start;
      await addBlockRunLog({
        prompt,
        model: modelToUse,
        durationMs,
        costUsdc: null,
        status: 'failed',
      });

      return NextResponse.json({
        ok: false,
        error: e instanceof Error ? e.message : 'Inference failed',
        duration: durationMs,
      }, { status: 500 });
    }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
}
