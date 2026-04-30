import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createClient } from '@supabase/supabase-js';
import { generateDemoTransactions } from '@/lib/demo-data';

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const demo = generateDemoTransactions();

  const rows = demo.map((tx) => ({
    user_id: session.user!.id,
    type: tx.type,
    category: tx.category,
    amount: tx.amount,
    date: tx.date,
    description: tx.description,
    counterparty: tx.counterparty,
    source: 'demo',
  }));

  const { error } = await supabaseAdmin.from('transactions').insert(rows);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ loaded: rows.length });
}
