/**
 * T-Bank (Tinkoff) Business OpenAPI client
 * Docs: https://business.tinkoff.ru/openapi/docs/
 */

export const TBANK_OAUTH_URL   = 'https://id.tinkoff.ru/auth/authorize';
export const TBANK_TOKEN_URL   = 'https://id.tinkoff.ru/auth/token';
export const TBANK_API_BASE    = 'https://business.tinkoff.ru/openapi';

// OAuth scopes required for reading statements
export const TBANK_SCOPE = 'opensme/inn/*/bank-accounts/*/transactions.readonly';

// ── Token management ────────────────────────────────────────────────────────

export interface TBankTokens {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;   // seconds
  token_type?: string;
}

export function buildAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id:     process.env.TBANK_CLIENT_ID!,
    redirect_uri:  process.env.TBANK_REDIRECT_URI!,
    response_type: 'code',
    scope:         TBANK_SCOPE,
    state,
  });
  return `${TBANK_OAUTH_URL}?${params}`;
}

export async function exchangeCode(code: string): Promise<TBankTokens> {
  const body = new URLSearchParams({
    grant_type:   'authorization_code',
    code,
    redirect_uri: process.env.TBANK_REDIRECT_URI!,
    client_id:    process.env.TBANK_CLIENT_ID!,
    client_secret: process.env.TBANK_CLIENT_SECRET!,
  });

  const res = await fetch(TBANK_TOKEN_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${text}`);
  }
  return res.json();
}

export async function refreshAccessToken(refreshToken: string): Promise<TBankTokens> {
  const body = new URLSearchParams({
    grant_type:    'refresh_token',
    refresh_token: refreshToken,
    client_id:     process.env.TBANK_CLIENT_ID!,
    client_secret: process.env.TBANK_CLIENT_SECRET!,
  });

  const res = await fetch(TBANK_TOKEN_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    body.toString(),
  });

  if (!res.ok) throw new Error(`Token refresh failed: ${res.status}`);
  return res.json();
}

// ── API calls ───────────────────────────────────────────────────────────────

export interface TBankAccount {
  accountNumber: string;
  name:          string;
  status:        string;
  balance?:      number;
  currency?:     string;
}

export async function getBankAccounts(accessToken: string): Promise<TBankAccount[]> {
  const res = await fetch(`${TBANK_API_BASE}/api/v1/bank-accounts`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Get accounts failed: ${res.status}`);
  const data = await res.json();
  // API returns { payload: [...] } or array directly
  return Array.isArray(data) ? data : (data.payload ?? []);
}

export interface TBankTransaction {
  id:          string;
  date:        string;   // ISO 8601
  description: string;
  amount:      { value: number; currency: { name: string } };
  type:        'Credit' | 'Debit';
  counterParty?: { inn?: string; name?: string; kpp?: string };
  category?:   { id?: string; name?: string };
  operationId?: string;
}

export async function getStatement(
  accessToken: string,
  accountNumber: string,
  from: Date,
  till: Date
): Promise<TBankTransaction[]> {
  const params = new URLSearchParams({
    accountNumber,
    from: from.toISOString(),
    till: till.toISOString(),
  });

  const res = await fetch(`${TBANK_API_BASE}/api/v1/statement?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) throw new Error(`Statement fetch failed: ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : (data.payload ?? []);
}
