import { NextResponse } from 'next/server';

// T-Bank uses a static API token — no OAuth callback needed.
export async function GET() {
  return NextResponse.json({ error: 'Not applicable — T-Bank uses a static token' }, { status: 410 });
}
