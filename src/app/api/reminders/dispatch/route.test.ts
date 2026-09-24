import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const dispatchDueReminders = vi.fn();

vi.mock('@/lib/reminders/dispatch', () => ({
  dispatchDueReminders: (...args: unknown[]) => dispatchDueReminders(...args),
}));

import { GET } from './route';

function makeRequest(authorization?: string): Request {
  const headers = new Headers();
  if (authorization !== undefined) {
    headers.set('authorization', authorization);
  }
  return new Request('http://localhost/api/reminders/dispatch', { headers });
}

describe('GET /api/reminders/dispatch', () => {
  const originalSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    dispatchDueReminders.mockReset();
    dispatchDueReminders.mockResolvedValue({ dispatched: 0 });
    process.env.CRON_SECRET = 'super-secret-token';
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = originalSecret;
    }
  });

  it('rejects requests with a missing or incorrect bearer token', async () => {
    const missing = await GET(makeRequest());
    expect(missing.status).toBe(401);

    const wrong = await GET(makeRequest('Bearer not-the-secret'));
    expect(wrong.status).toBe(401);

    expect(dispatchDueReminders).not.toHaveBeenCalled();
  });

  it('accepts requests with the correct bearer token', async () => {
    const response = await GET(makeRequest('Bearer super-secret-token'));
    expect(response.status).toBe(200);
    expect(dispatchDueReminders).toHaveBeenCalledTimes(1);
  });

  it('does not authenticate via naive string equality', async () => {
    // A token that shares a long prefix with the real secret must still be
    // rejected. If the route used `!==`, a prefix-matching guess would be
    // indistinguishable from a full match in the comparison path.
    const prefixGuess = 'Bearer super-secret-toke';
    const response = await GET(makeRequest(prefixGuess));
    expect(response.status).toBe(401);
    expect(dispatchDueReminders).not.toHaveBeenCalled();
  });

  it('compares the authorization header through a constant-time helper', async () => {
    const crypto = await import('crypto');
    const timingSafeEqualSpy = vi.spyOn(crypto, 'timingSafeEqual');

    await GET(makeRequest('Bearer super-secret-token'));

    expect(timingSafeEqualSpy).toHaveBeenCalled();
    timingSafeEqualSpy.mockRestore();
  });
});
