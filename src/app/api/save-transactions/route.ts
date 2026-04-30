import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { transactions } = await request.json();
  if (!Array.isArray(transactions) || transactions.length === 0) {
    return NextResponse.json({ error: 'No transactions provided' }, { status: 400 });
  }

  // Service role key bypasses RLS; falls back to anon key if not configured
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const rows = transactions.map((tx: {
    type: string; category?: string; amount: number;
    date?: string; description: string; counterparty?: string;
  }) => ({
    user_id: session.user!.id,
    type: tx.type,
    category: tx.category || null,
    amount: tx.amount,
    date: tx.date || null,
    description: tx.description,
    counterparty: tx.counterparty || null,
    source: 'pdf',
  }));

  const { error } = await supabaseAdmin.from('transactions').insert(rows);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ saved: rows.length });
}
