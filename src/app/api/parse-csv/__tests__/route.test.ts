import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.mock is hoisted — declare shared mock refs with vi.hoisted so they're
// available inside the factory before any imports are evaluated.
const mockCreate = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    choices: [{ message: { content: '[]' } }],
    usage: { total_tokens: 100 },
  }),
);

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: vi.fn() }));
vi.mock('openai', () => ({
  default: class OpenAI {
    chat = { completions: { create: mockCreate } };
  },
}));

import { auth } from '@/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { POST } from '../route';

const mockAuth = vi.mocked(auth);
const mockRateLimit = vi.mocked(checkRateLimit);

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/parse-csv', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.OPENAI_API_KEY = 'test-key';
  mockRateLimit.mockReturnValue({ allowed: true, remaining: 9, resetIn: 0 });
  mockCreate.mockResolvedValue({
    choices: [{ message: { content: '[]' } }],
    usage: { total_tokens: 100 },
  });
});

describe('POST /api/parse-csv', () => {
  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue(null as never);
    const res = await POST(makeRequest({ csvContent: 'date,amount\n2024-01-01,100' }) as never);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 429 when rate limit exceeded', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } } as never);
    mockRateLimit.mockReturnValue({ allowed: false, remaining: 0, resetIn: 3540 });

    const res = await POST(makeRequest({ csvContent: 'date,amount\n2024-01-01,100' }) as never);
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toContain('Rate limit');
  });

  it('returns 400 when csvContent is missing', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } } as never);

    const res = await POST(makeRequest({}) as never);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('CSV content');
  });

  it('returns 400 when csvContent is too short', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } } as never);

    const res = await POST(makeRequest({ csvContent: 'tiny' }) as never);
    expect(res.status).toBe(400);
  });

  it('returns 500 when OPENAI_API_KEY is missing', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } } as never);
    delete process.env.OPENAI_API_KEY;

    const csv = 'date,description,amount\n2024-01-01,Netflix,12.99\n2024-02-01,Netflix,12.99';
    const res = await POST(makeRequest({ csvContent: csv }) as never);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain('OpenAI API key');
  });

  it('returns subscriptions from AI for valid request', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } } as never);
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: '[{"name":"Netflix","amount":12.99,"frequency":"monthly","category":"Entertainment","confidence":98}]' } }],
      usage: { total_tokens: 200 },
    });

    const csv = 'date,description,amount\n2024-01-01,Netflix,12.99\n2024-02-01,Netflix,12.99';
    const res = await POST(makeRequest({ csvContent: csv }) as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('subscriptions');
    expect(body).toHaveProperty('count');
    expect(body).toHaveProperty('tokens');
  });

  it('rate-limit response includes correct headers', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } } as never);
    mockRateLimit.mockReturnValue({ allowed: false, remaining: 0, resetIn: 1800 });

    const res = await POST(makeRequest({ csvContent: 'date,amount\n2024-01-01,100' }) as never);
    expect(res.status).toBe(429);
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('0');
    expect(res.headers.get('X-RateLimit-Reset')).toBe('1800');
  });
});
