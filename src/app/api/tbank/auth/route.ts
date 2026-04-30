import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { buildAuthUrl } from '@/lib/tbank';
import { cookies } from 'next/headers';
import { randomBytes } from 'crypto';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.TBANK_CLIENT_ID || !process.env.TBANK_REDIRECT_URI) {
    return NextResponse.json(
      { error: 'T-Bank API credentials not configured. Add TBANK_CLIENT_ID and TBANK_REDIRECT_URI to .env.local' },
      { status: 500 }
    );
  }

  // CSRF protection via state cookie
  const state = randomBytes(16).toString('hex');
  const cookieStore = await cookies();
  cookieStore.set('tbank_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 600, // 10 min
    path: '/',
  });

  const url = buildAuthUrl(state);
  return NextResponse.redirect(url);
}
