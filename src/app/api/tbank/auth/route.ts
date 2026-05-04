import { NextResponse } from 'next/server';

// T-Bank uses a static API token — no OAuth flow needed.
// Token is configured via TBANK_API_TOKEN env var.
export async function GET() {
  return NextResponse.json({ error: 'Not applicable — T-Bank uses a static token' }, { status: 410 });
}
