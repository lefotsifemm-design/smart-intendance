import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// In-memory server cache: key = userId:balanceBucket, TTL 1h
const _cache = new Map<string, { data: CashGapResult; expires: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000;

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// ─── Public types (used by the page) ─────────────────────────────────────────

export type ObligationType = 'payroll' | 'tax' | 'rent' | 'loan' | 'supplier' | 'other';
export type Urgency = 'critical' | 'high' | 'medium';

export interface Obligation {
  name: string;
  type: ObligationType;
  amount: number;
  dayOfMonth: number;        // 1–28
  recurrence: 'monthly' | 'quarterly';
  priority: Urgency;         // how bad it is if missed
}

export interface CollectionPattern {
  avgMonthlyIncome: number;
  typicalPaymentDays: number[];  // days of month when income usually arrives
  peakDay: number;               // single highest-probability day
  varianceNote: string;          // short human-readable note
}

export interface GapAlert {
  date: string;               // ISO date when the gap occurs
  obligationName: string;
  obligationAmount: number;
  projectedBalance: number;   // balance on that day (can be negative)
  deficit: number;            // abs amount needed = max(0, obligationAmount - balance_before)
  daysUntil: number;
  urgency: Urgency;
  recommendation: string;     // short action the user can take
}

export interface ForecastDay {
  date: string;
  balance: number;
  inflow: number;
  outflow: number;
  events: string[];
  isRiskDay: boolean;
}

export interface CashGapResult {
  obligations: Obligation[];
  collection: CollectionPattern;
  alerts: GapAlert[];
  forecast: ForecastDay[];
  insufficient: boolean;
}

// ─── Local helpers ────────────────────────────────────────────────────────────

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function buildForecast(
  startingBalance: number,
  obligations: Obligation[],
  collection: CollectionPattern,
  days = 30
): ForecastDay[] {
  const today = new Date();
  let balance = startingBalance;
  const forecast: ForecastDay[] = [];

  for (let i = 0; i < days; i++) {
    const d = addDays(today, i);
    const dom = d.getDate();
    const mk = isoDate(d);

    let inflow = 0;
    let outflow = 0;
    const events: string[] = [];

    // Income: fires on typical payment days
    if (collection.typicalPaymentDays.includes(dom)) {
      // Distribute monthly income across payment days
      const share = collection.avgMonthlyIncome / collection.typicalPaymentDays.length;
      inflow += share;
      events.push(`Поступления ~${Math.round(share).toLocaleString('ru-RU')}`);
    }

    // Obligations
    for (const ob of obligations) {
      let fires = false;
      if (ob.recurrence === 'monthly' && ob.dayOfMonth === dom) {
        fires = true;
      } else if (ob.recurrence === 'quarterly') {
        const monthOffset = (d.getMonth() - today.getMonth() + 12) % 12;
        if (ob.dayOfMonth === dom && monthOffset % 3 === 0 && i > 0) fires = true;
      }
      if (fires) {
        outflow += ob.amount;
        events.push(ob.name);
      }
    }

    balance += inflow - outflow;
    forecast.push({
      date: mk,
      balance: Math.round(balance),
      inflow: Math.round(inflow),
      outflow: Math.round(outflow),
      events,
      isRiskDay: balance < 0,
    });
  }

  return forecast;
}

function buildAlerts(
  obligations: Obligation[],
  forecast: ForecastDay[]
): GapAlert[] {
  const today = new Date();
  const alerts: GapAlert[] = [];

  for (const day of forecast) {
    if (!day.isRiskDay && day.balance >= 0) continue;
    // Find obligations on this day
    const dom = new Date(day.date).getDate();
    const matchedObs = obligations.filter((ob) => {
      if (ob.recurrence === 'monthly') return ob.dayOfMonth === dom;
      return false;
    });

    // Even if no obligation matched but balance went negative, surface it
    if (day.outflow > 0 || day.balance < 0) {
      const daysUntil = Math.round(
        (new Date(day.date).getTime() - today.getTime()) / 86_400_000
      );
      const deficit = Math.abs(Math.min(0, day.balance));

      if (deficit === 0 && day.balance >= 0) continue;

      for (const ob of matchedObs.length > 0 ? matchedObs : [{ name: 'Расходы', amount: day.outflow, priority: 'medium' as Urgency }]) {
        let urgency: Urgency = ob.priority ?? 'medium';
        if (daysUntil <= 5) urgency = 'critical';
        else if (daysUntil <= 10) urgency = urgency === 'critical' ? 'critical' : 'high';

        alerts.push({
          date: day.date,
          obligationName: ob.name,
          obligationAmount: ob.amount,
          projectedBalance: day.balance,
          deficit,
          daysUntil,
          urgency,
          recommendation: '',
        });
      }
    }
  }

  return alerts.sort((a, b) => a.daysUntil - b.daysUntil).slice(0, 10);
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const startingBalance = parseFloat(searchParams.get('balance') ?? '0');

  // Round to nearest 1000 so small input changes don't bust cache
  const balanceBucket = Math.round(startingBalance / 1000) * 1000;
  const cacheKey = `${session.user.id}:${balanceBucket}`;
  const cached = _cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return NextResponse.json(cached.data);
  }

  const sb = adminClient();
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  const { data: transactions, error } = await sb
    .from('transactions')
    .select('type, category, amount, date, description, counterparty')
    .eq('user_id', session.user.id)
    .gte('date', twelveMonthsAgo.toISOString().slice(0, 10))
    .order('date', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (!transactions || transactions.length < 10) {
    const emptyCollection: CollectionPattern = {
      avgMonthlyIncome: 0,
      typicalPaymentDays: [],
      peakDay: 1,
      varianceNote: 'Недостаточно данных',
    };
    const emptyForecast = buildForecast(startingBalance, [], emptyCollection);
    const result: CashGapResult = {
      obligations: [],
      collection: emptyCollection,
      alerts: [],
      forecast: emptyForecast,
      insufficient: true,
    };
    _cache.set(cacheKey, { data: result, expires: Date.now() + CACHE_TTL_MS });
    return NextResponse.json(result);
  }

  // Condense for AI — send only what's needed
  const condensed = transactions.map((t) => ({
    date: t.date,
    type: t.type,
    category: t.category,
    amount: t.amount,
    name: t.description || t.counterparty || t.category,
  }));

  const prompt = `You are a cash flow risk analyst for a Russian SMB. Your job is to identify obligations (fixed outflows) and income collection patterns, then flag specific cash gap risks.

Transaction history (last 12 months):
${JSON.stringify(condensed)}

Analyze and return ONLY valid JSON (no markdown) with this exact structure:
{
  "obligations": [
    {
      "name": "Short name max 40 chars (e.g. ФОТ, НДС, Аренда, Кредит)",
      "type": "payroll" | "tax" | "rent" | "loan" | "supplier" | "other",
      "amount": number,
      "dayOfMonth": number (1-28, the day this payment is due),
      "recurrence": "monthly" | "quarterly",
      "priority": "critical" | "high" | "medium"
    }
  ],
  "collection": {
    "avgMonthlyIncome": number,
    "typicalPaymentDays": [array of 1-5 day numbers when income typically arrives],
    "peakDay": number,
    "varianceNote": "One sentence about collection predictability in Russian"
  },
  "alertRecommendations": {
    "general": "One actionable sentence for the business owner in Russian",
    "perObligation": {
      "ФОТ": "What to do if payroll is at risk",
      "НДС": "What to do if tax is at risk",
      "Аренда": "What to do if rent is at risk"
    }
  }
}

Rules:
- obligations: only recurring items that appear 2+ times, payroll/tax priority = critical
- dayOfMonth: most common day this category was paid (max 28)
- typicalPaymentDays: top 1-5 days when income/revenue arrives each month
- If no clear income pattern, use [10, 20, 28]
- Do NOT invent obligations not present in transactions`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0,
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = completion.choices[0].message.content ?? '{}';
    const cleaned = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned) as {
      obligations: Obligation[];
      collection: CollectionPattern;
      alertRecommendations: {
        general: string;
        perObligation: Record<string, string>;
      };
    };

    const obligations = parsed.obligations ?? [];
    const collection = parsed.collection ?? {
      avgMonthlyIncome: 0,
      typicalPaymentDays: [10, 20, 28],
      peakDay: 20,
      varianceNote: '',
    };
    const recs = parsed.alertRecommendations ?? { general: '', perObligation: {} };

    const forecast = buildForecast(startingBalance, obligations, collection);
    const alerts = buildAlerts(obligations, forecast);

    // Inject recommendations into alerts
    for (const alert of alerts) {
      const specific = recs.perObligation?.[alert.obligationName];
      alert.recommendation = specific || recs.general || 'Ускорьте получение дебиторской задолженности или рассмотрите кредитную линию.';
    }

    const result: CashGapResult = {
      obligations,
      collection,
      alerts,
      forecast,
      insufficient: false,
    };

    _cache.set(cacheKey, { data: result, expires: Date.now() + CACHE_TTL_MS });
    return NextResponse.json(result);
  } catch (err) {
    console.error('CashGap AI error:', err);
    return NextResponse.json({ error: 'AI analysis failed' }, { status: 500 });
  }
}
