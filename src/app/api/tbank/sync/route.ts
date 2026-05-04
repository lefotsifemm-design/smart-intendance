import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createClient } from '@supabase/supabase-js';
import { getBankAccounts, getStatement, TBankTransaction } from '@/lib/tbank';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const adminClient = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

interface CategorisedTx {
  operationId: string;
  category: string;
}

async function categorise(txs: TBankTransaction[]): Promise<CategorisedTx[]> {
  if (txs.length === 0) return [];

  const list = txs.map((t) => ({
    id: t.operationId ?? t.id,
    type: t.type === 'Credit' ? 'income' : 'expense',
    description: t.description,
    counterParty: t.counterParty?.name ?? '',
    amount: Math.abs(t.amount.value),
  }));

  const prompt = `Classify each transaction into ONE business category and return ONLY a JSON array.

INCOME categories: Revenue, Payroll In, Refunds Received, Transfers In, Cashback, Other Income
EXPENSE categories: Payroll, Rent, Utilities, Marketing, IT & Software, Logistics, Taxes, Insurance, Legal, Bank Fees, Office Supplies, Travel, Meals, Groceries, Transfer Out, Other Expense

Transactions:
${JSON.stringify(list, null, 2)}

Return format (JSON array, no markdown):
[{"operationId":"...","category":"..."}]`;

  const res = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0,
    max_tokens: list.length * 30 + 200,
  });

  const raw = (res.choices[0].message.content ?? '[]')
    .replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.TBANK_API_TOKEN) {
    return NextResponse.json({ error: 'TBANK_API_TOKEN not configured' }, { status: 500 });
  }

  const supabase = adminClient();

  // Get or resolve account number
  const { data: conn } = await supabase
    .from('tbank_connections')
    .select('account_number, last_sync_at')
    .eq('user_id', session.user.id)
    .single();

  let accountNumber: string | null = conn?.account_number ?? null;

  // Auto-discover account number if not stored
  if (!accountNumber) {
    try {
      const accounts = await getBankAccounts();
      if (accounts.length === 0) {
        return NextResponse.json({ error: 'No bank accounts found' }, { status: 400 });
      }
      accountNumber = accounts[0].accountNumber;
      await supabase
        .from('tbank_connections')
        .upsert({
          user_id: session.user.id,
          account_number: accountNumber,
          company_name: accounts[0].name ?? null,
          connected_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'failed to fetch accounts';
      return NextResponse.json({ error: msg }, { status: 502 });
    }
  }

  // Determine date range
  const body = await request.json().catch(() => ({}));
  const till = new Date();
  let from: Date;

  if (body.from) {
    from = new Date(body.from);
  } else if (conn?.last_sync_at) {
    from = new Date(conn.last_sync_at);
    from.setDate(from.getDate() - 1);
  } else {
    from = new Date();
    from.setDate(from.getDate() - 90);
  }

  // Fetch from T-Bank
  let rawTxs: TBankTransaction[];
  try {
    rawTxs = await getStatement(accountNumber, from, till);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'statement fetch failed';
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  if (rawTxs.length === 0) {
    await supabase
      .from('tbank_connections')
      .update({ last_sync_at: till.toISOString() })
      .eq('user_id', session.user.id);
    return NextResponse.json({ synced: 0, skipped: 0, message: 'No new transactions' });
  }

  // Deduplicate
  const { data: existingIds } = await supabase
    .from('transactions')
    .select('description, date, amount')
    .eq('user_id', session.user.id)
    .eq('source', 'tbank');

  const existingSet = new Set(
    (existingIds ?? []).map((r: { description: string; date: string; amount: number }) =>
      `${r.description}|${r.date}|${r.amount}`
    )
  );

  const newTxs = rawTxs.filter((t) => {
    const dateStr = t.date.slice(0, 10);
    const amount = Math.abs(t.amount.value);
    return !existingSet.has(`${t.description}|${dateStr}|${amount}`);
  });

  if (newTxs.length === 0) {
    await supabase
      .from('tbank_connections')
      .update({ last_sync_at: till.toISOString() })
      .eq('user_id', session.user.id);
    return NextResponse.json({ synced: 0, skipped: rawTxs.length, message: 'All transactions already saved' });
  }

  // AI categorisation
  const categories = await categorise(newTxs);
  const categoryMap = new Map(categories.map((c) => [c.operationId, c.category]));

  const rows = newTxs.map((t) => {
    const opId = t.operationId ?? t.id;
    const isIncome = t.type === 'Credit';
    return {
      user_id: session.user!.id,
      type: isIncome ? 'income' : 'expense',
      category: categoryMap.get(opId) ?? (isIncome ? 'Other Income' : 'Other Expense'),
      amount: Math.abs(t.amount.value),
      date: t.date.slice(0, 10),
      description: t.description,
      counterparty: t.counterParty?.name ?? null,
      source: 'tbank',
    };
  });

  const { error: insertErr } = await supabase.from('transactions').insert(rows);
  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  await supabase
    .from('tbank_connections')
    .update({ last_sync_at: till.toISOString() })
    .eq('user_id', session.user.id);

  return NextResponse.json({
    synced: rows.length,
    skipped: rawTxs.length - newTxs.length,
    from: from.toISOString().slice(0, 10),
    till: till.toISOString().slice(0, 10),
  });
}
