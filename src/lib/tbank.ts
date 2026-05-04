const _rawBase = (process.env.TBANK_API_BASE_URL ?? 'https://business.tinkoff.ru/openapi').trim();
try { new URL(_rawBase); } catch {
  throw new Error(`TBANK_API_BASE_URL is not a valid URL: "${_rawBase}"`);
}
export const TBANK_API_BASE = _rawBase;

function token(): string {
  const t = process.env.TBANK_API_TOKEN;
  if (!t) throw new Error('TBANK_API_TOKEN is not configured');
  return t;
}

function authHeaders() {
  return { Authorization: `Bearer ${token()}` };
}

export interface TBankAccount {
  accountNumber: string;
  name: string;
  status: string;
  balance?: number;
  currency?: string;
}

export async function getBankAccounts(): Promise<TBankAccount[]> {
  const res = await fetch(`${TBANK_API_BASE}/api/v1/bank-accounts`, {
    headers: authHeaders(),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Get accounts failed: ${res.status} ${body}`);
  }
  const data = await res.json();
  return Array.isArray(data) ? data : (data.payload ?? []);
}

export interface TBankTransaction {
  id: string;
  date: string;
  description: string;
  amount: { value: number; currency: { name: string } };
  type: 'Credit' | 'Debit';
  counterParty?: { inn?: string; name?: string; kpp?: string };
  category?: { id?: string; name?: string };
  operationId?: string;
}

export async function getStatement(
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
    headers: authHeaders(),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Statement fetch failed: ${res.status} ${body}`);
  }
  const data = await res.json();
  return Array.isArray(data) ? data : (data.payload ?? []);
}
