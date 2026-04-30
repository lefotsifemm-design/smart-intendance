const store = new Map<string, number[]>();

const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_REQUESTS = 10;

export function checkRateLimit(userId: string): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const timestamps = store.get(userId) ?? [];

  const valid = timestamps.filter((t) => now - t < WINDOW_MS);
  store.set(userId, valid);

  if (valid.length >= MAX_REQUESTS) {
    const oldest = valid[0]!;
    return { allowed: false, remaining: 0, resetIn: Math.ceil((oldest + WINDOW_MS - now) / 1000) };
  }

  valid.push(now);
  store.set(userId, valid);
  return { allowed: true, remaining: MAX_REQUESTS - valid.length, resetIn: 0 };
}
