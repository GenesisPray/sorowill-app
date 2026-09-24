import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { dispatchDueReminders } from '@/lib/reminders/dispatch';

export const dynamic = 'force-dynamic';

/**
 * Constant-time comparison of two strings.
 *
 * V8's `===`/`!==` short-circuits on the first mismatched byte, which leaks
 * how many leading characters of a guessed secret are correct. We hash both
 * sides to a fixed-length digest first so that inputs of differing lengths
 * can still be compared with `crypto.timingSafeEqual` without throwing.
 */
function constantTimeEqual(a: string, b: string): boolean {
  const aHash = createHash('sha256').update(a).digest();
  const bHash = createHash('sha256').update(b).digest();
  return timingSafeEqual(aHash, bHash);
}

export async function GET(request: Request) {
  const expectedToken = process.env.CRON_SECRET;

  if (!expectedToken) {
    return NextResponse.json(
      { error: 'CRON_SECRET is not configured' },
      { status: 500 },
    );
  }

  const authHeader = request.headers.get('authorization') ?? '';
  const expectedHeader = `Bearer ${expectedToken}`;

  if (!constantTimeEqual(authHeader, expectedHeader)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await dispatchDueReminders();

  return NextResponse.json(result);
}
