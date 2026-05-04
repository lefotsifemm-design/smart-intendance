import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { TBANK_API_BASE } from '@/lib/tbank';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const token = process.env.TBANK_API_TOKEN;
  if (!token) return NextResponse.json({ error: 'No token' }, { status: 500 });

  const headers = { Authorization: `Bearer ${token}` };

  const accountsRes = await fetch(`${TBANK_API_BASE}/api/v1/bank-accounts`, { headers });
  const accountsRaw = await accountsRes.json();

  const from = new Date();
  from.setDate(from.getDate() - 30);
  const to = new Date();

  // Try first account if available
  const accounts = Array.isArray(accountsRaw) ? accountsRaw : (accountsRaw.payload ?? []);
  const accountNumber = accounts[0]?.accountNumber ?? 'NO_ACCOUNT';

  const params = new URLSearchParams({
    accountNumber,
    from: from.toISOString(),
    to: to.toISOString(),
  });

  const stmtRes = await fetch(`${TBANK_API_BASE}/api/v1/statement?${params}`, { headers });
  const stmtRaw = await stmtRes.json();

  return NextResponse.json({
    accountsStatus: accountsRes.status,
    accountsRaw,
    accountNumber,
    statementStatus: stmtRes.status,
    statementRaw: stmtRaw,
  });
}
