import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createClient } from '@supabase/supabase-js';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export interface AlertRecord {
  alert_type: string;
  alert_key: string;
  status: 'dismissed' | 'snoozed';
  snooze_until: string | null;
}

// GET — returns active (non-expired) dismissals for the current user
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await adminClient()
    .from('alert_history')
    .select('alert_type, alert_key, status, snooze_until')
    .eq('user_id', session.user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const now = Date.now();
  const active = (data ?? []).filter((r: AlertRecord) => {
    if (r.status === 'dismissed') return true;
    if (r.status === 'snoozed' && r.snooze_until && new Date(r.snooze_until).getTime() > now) return true;
    return false;
  });

  return NextResponse.json(active as AlertRecord[]);
}

// POST — dismiss or snooze an alert
// Body: { alertType, alertKey, action: 'dismiss' | 'snooze', snoozeDays?: number }
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

  const { alertType, alertKey, action, snoozeDays = 3 } = body as {
    alertType: string;
    alertKey: string;
    action: 'dismiss' | 'snooze';
    snoozeDays?: number;
  };

  if (!alertType || !alertKey || !['dismiss', 'snooze'].includes(action)) {
    return NextResponse.json({ error: 'Missing or invalid fields' }, { status: 400 });
  }

  const snoozeUntil = action === 'snooze'
    ? new Date(Date.now() + snoozeDays * 86_400_000).toISOString()
    : null;

  const { error } = await adminClient()
    .from('alert_history')
    .upsert(
      {
        user_id: session.user.id,
        alert_type: alertType,
        alert_key: alertKey,
        status: action === 'snooze' ? 'snoozed' : 'dismissed',
        snooze_until: snoozeUntil,
      },
      { onConflict: 'user_id,alert_type,alert_key' }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

// DELETE — restore (un-dismiss) an alert
// Body: { alertType, alertKey }
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

  const { alertType, alertKey } = body as { alertType: string; alertKey: string };

  const { error } = await adminClient()
    .from('alert_history')
    .delete()
    .eq('user_id', session.user.id)
    .eq('alert_type', alertType)
    .eq('alert_key', alertKey);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
