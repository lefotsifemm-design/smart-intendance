import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── mocks ──────────────────────────────────────────────────────────────────
vi.mock('@/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}));

import { auth } from '@/auth';
import { createClient } from '@supabase/supabase-js';
import { GET, POST, DELETE } from '../route';

const mockAuth = vi.mocked(auth);
const mockCreateClient = vi.mocked(createClient);

function makeRequest(body?: unknown, method = 'POST'): Request {
  return new Request('http://localhost/api/budgets', {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

function makeSupabase(overrides: Record<string, unknown> = {}) {
  const chainable = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: [], error: null }),
    upsert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { id: 1 }, error: null }),
    ...overrides,
  };
  return { from: vi.fn().mockReturnValue(chainable), _chain: chainable };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
});

// ── GET ────────────────────────────────────────────────────────────────────
describe('GET /api/budgets', () => {
  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue(null as never);
    const res = await GET();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns budgets for authenticated user', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } } as never);
    const { _chain, ...sb } = makeSupabase();
    _chain.order.mockResolvedValue({ data: [{ id: 1, category: 'Food', amount: 5000 }], error: null });
    mockCreateClient.mockReturnValue(sb as never);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  it('returns 500 on supabase error', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } } as never);
    const { _chain, ...sb } = makeSupabase();
    _chain.order.mockResolvedValue({ data: null, error: { message: 'db error' } });
    mockCreateClient.mockReturnValue(sb as never);

    const res = await GET();
    expect(res.status).toBe(500);
  });
});

// ── POST ───────────────────────────────────────────────────────────────────
describe('POST /api/budgets', () => {
  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue(null as never);
    const res = await POST(makeRequest({ category: 'Food', amount: 5000 }) as never);
    expect(res.status).toBe(401);
  });

  it('returns 400 when category is missing', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } } as never);
    const res = await POST(makeRequest({ amount: 5000 }) as never);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid input');
  });

  it('returns 400 when amount is not a number', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } } as never);
    const res = await POST(makeRequest({ category: 'Food', amount: 'five thousand' }) as never);
    expect(res.status).toBe(400);
  });

  it('returns 400 when amount is zero', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } } as never);
    const res = await POST(makeRequest({ category: 'Food', amount: 0 }) as never);
    expect(res.status).toBe(400);
  });

  it('returns 400 when amount is negative', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } } as never);
    const res = await POST(makeRequest({ category: 'Food', amount: -100 }) as never);
    expect(res.status).toBe(400);
  });

  it('creates budget for valid input', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } } as never);
    const { _chain, ...sb } = makeSupabase();
    mockCreateClient.mockReturnValue(sb as never);

    const res = await POST(makeRequest({ category: 'Food', amount: 5000 }) as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('id');
  });

  it('defaults period to "monthly" when not provided', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } } as never);
    const { _chain, ...sb } = makeSupabase();
    mockCreateClient.mockReturnValue(sb as never);

    await POST(makeRequest({ category: 'Food', amount: 5000 }) as never);
    expect(_chain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ period: 'monthly' }),
      expect.any(Object),
    );
  });
});

// ── DELETE ─────────────────────────────────────────────────────────────────
describe('DELETE /api/budgets', () => {
  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue(null as never);
    const res = await DELETE(makeRequest({ id: 1 }, 'DELETE') as never);
    expect(res.status).toBe(401);
  });

  it('returns 400 when id is missing', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } } as never);
    const res = await DELETE(makeRequest({}, 'DELETE') as never);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('ID required');
  });

  it('deletes budget for valid id', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } } as never);
    const { _chain, ...sb } = makeSupabase();
    _chain.eq.mockReturnThis();
    _chain.delete.mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }) });
    mockCreateClient.mockReturnValue(sb as never);

    const res = await DELETE(makeRequest({ id: 42 }, 'DELETE') as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deleted).toBe(true);
  });
});
