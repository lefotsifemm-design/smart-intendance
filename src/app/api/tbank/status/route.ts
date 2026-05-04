import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createClient } from '@supabase/supabase-js';

const adminClient = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ connected: false }, { status: 401 });
  }

  const configured = !!process.env.TBANK_API_TOKEN;
  if (!configured) {
    return NextResponse.json({ connected: false, reason: 'token_not_configured' });
  }

  const supabase = adminClient();
  const { data } = await supabase
    .from('tbank_connections')
    .select('account_number, company_name, inn, connected_at, last_sync_at')
    .eq('user_id', session.user.id)
    .single();

  return NextResponse.json({
    connected: true,
    accountNumber: data?.account_number ?? null,
    companyName: data?.company_name ?? null,
    inn: data?.inn ?? null,
    connectedAt: data?.connected_at ?? null,
    lastSyncAt: data?.last_sync_at ?? null,
  });
}
