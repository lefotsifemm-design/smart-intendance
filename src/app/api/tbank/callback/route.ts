import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { exchangeCode, getBankAccounts } from '@/lib/tbank';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const adminClient = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL('/dashboard/settings?tbank=error&reason=auth', request.url));
  }

  const { searchParams } = request.nextUrl;
  const code  = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.redirect(
      new URL(`/dashboard/settings?tbank=error&reason=${encodeURIComponent(error)}`, request.url)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL('/dashboard/settings?tbank=error&reason=missing_params', request.url));
  }

  // Validate CSRF state
  const cookieStore = await cookies();
  const savedState = cookieStore.get('tbank_oauth_state')?.value;
  cookieStore.delete('tbank_oauth_state');

  if (!savedState || savedState !== state) {
    return NextResponse.redirect(new URL('/dashboard/settings?tbank=error&reason=invalid_state', request.url));
  }

  try {
    // Exchange code for tokens
    const tokens = await exchangeCode(code);
    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : null;

    // Fetch accounts to get account number and company name
    let accountNumber: string | null = null;
    let companyName:   string | null = null;
    let inn:           string | null = null;

    try {
      const accounts = await getBankAccounts(tokens.access_token);
      if (accounts.length > 0) {
        accountNumber = accounts[0].accountNumber;
        companyName   = accounts[0].name ?? null;
      }
    } catch {
      // Non-fatal: account info can be fetched later
    }

    // Upsert connection
    const supabase = adminClient();
    const { error: dbError } = await supabase
      .from('tbank_connections')
      .upsert({
        user_id:        session.user.id,
        access_token:   tokens.access_token,
        refresh_token:  tokens.refresh_token ?? null,
        expires_at:     expiresAt,
        account_number: accountNumber,
        company_name:   companyName,
        inn,
        connected_at:   new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (dbError) throw dbError;

    return NextResponse.redirect(new URL('/dashboard/settings?tbank=connected', request.url));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown';
    console.error('[tbank/callback]', msg);
    return NextResponse.redirect(
      new URL(`/dashboard/settings?tbank=error&reason=${encodeURIComponent(msg)}`, request.url)
    );
  }
}
