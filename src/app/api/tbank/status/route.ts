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

  const supabase = adminClient();
  const { data } = await supabase
    .from('tbank_connections')
    .select('account_number, company_name, inn, connected_at, last_sync_at, expires_at')
    .eq('user_id', session.user.id)
    .single();

  if (!data) return NextResponse.json({ connected: false });

  const isExpired = data.expires_at ? new Date(data.expires_at) < new Date() : false;

  return NextResponse.json({
    connected:      true,
    expired:        isExpired,
    accountNumber:  data.account_number,
    companyName:    data.company_name,
    inn:            data.inn,
    connectedAt:    data.connected_at,
    lastSyncAt:     data.last_sync_at,
  });
}
