import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export interface RecurringItem {
  name: string;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  dayOfMonth: number;
  frequency: 'monthly' | 'quarterly' | 'weekly';
  weekInterval: number | null;
  confidence: number;
  reasoning: string;
}

export interface ForecastTransaction {
  name: string;
  category: string;
  type: 'income' | 'expense';
  amount: number;
}

export interface DayForecast {
  date: string;
  balance: number;
  transactions: ForecastTransaction[];
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function generateForecast(
  startingBalance: number,
  recurring: RecurringItem[],
  days = 30
): DayForecast[] {
  const today = new Date();
  const forecast: DayForecast[] = [];
  let balance = startingBalance;

  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayOfMonth = d.getDate();
    const dayOfWeek = d.getDay(); // 0=Sun

    const transactions: ForecastTransaction[] = [];

    for (const item of recurring) {
      let fires = false;

      if (item.frequency === 'monthly' && item.dayOfMonth === dayOfMonth) {
        fires = true;
      } else if (item.frequency === 'weekly' && item.weekInterval) {
        // Fire on every N weeks from today
        if (i % (item.weekInterval * 7) === 0 && dayOfWeek === 1) fires = true;
      } else if (item.frequency === 'quarterly') {
        // Fire on dayOfMonth in months that are multiples of 3 from current month
        const monthOffset = (d.getMonth() - today.getMonth() + 12) % 12;
        if (item.dayOfMonth === dayOfMonth && monthOffset % 3 === 0 && i > 0) fires = true;
      }

      if (fires) {
        const delta = item.type === 'income' ? item.amount : -item.amount;
        balance += delta;
        transactions.push({
          name: item.name,
          category: item.category,
          type: item.type,
          amount: item.amount,
        });
      }
    }

    forecast.push({ date: dateStr, balance: Math.round(balance), transactions });
  }

  return forecast;
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const startingBalance = parseFloat(searchParams.get('balance') ?? '0');

  const sb = adminClient();

  // Fetch last 6 months of transactions
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const { data: transactions, error } = await sb
    .from('transactions')
    .select('type, category, amount, date, description, counterparty')
    .eq('user_id', session.user.id)
    .gte('date', sixMonthsAgo.toISOString().slice(0, 10))
    .order('date', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (!transactions || transactions.length < 5) {
    return NextResponse.json({
      recurring: [],
      forecast: generateForecast(startingBalance, [], 30),
      insufficient: true,
    });
  }

  // Condense for OpenAI — only fields needed for pattern detection
  const condensed = transactions.map((t) => ({
    date: t.date,
    type: t.type,
    category: t.category,
    amount: t.amount,
    name: t.description || t.counterparty || t.category,
  }));

  const prompt = `You are a financial analyst specializing in cash flow forecasting for small and medium businesses.

Analyze the following transaction history (last 6 months) and identify recurring financial patterns.

Transactions (JSON):
${JSON.stringify(condensed)}

Return ONLY valid JSON (no markdown, no explanation) with this exact structure:
{
  "recurring": [
    {
      "name": "Short descriptive name (max 40 chars)",
      "type": "income" or "expense",
      "category": "category name",
      "amount": number (always positive, use median amount if varying),
      "dayOfMonth": number (1-28, most common day this occurs),
      "weekInterval": null (or 1 for weekly, 2 for biweekly — only if frequency is weekly),
      "frequency": "monthly" or "quarterly" or "weekly",
      "confidence": number from 0.0 to 1.0,
      "reasoning": "one sentence why this is recurring"
    }
  ]
}

Rules:
- Include ONLY items appearing at least 2 times with consistent timing
- For expenses: payroll, rent, utilities, taxes, loan payments, regular supplier payments, subscriptions
- For income: salary, recurring client payments, regular revenue
- confidence 0.9+ if same day each month; 0.5-0.8 if day varies ±3 days
- dayOfMonth max 28 (safe for all months)
- Do NOT include one-time transactions
- Return empty recurring array if no clear patterns found`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0,
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = completion.choices[0].message.content ?? '{"recurring":[]}';
    const cleaned = raw.replace(/```json|```/g, '').trim();
    const { recurring } = JSON.parse(cleaned) as { recurring: RecurringItem[] };

    const forecast = generateForecast(startingBalance, recurring ?? [], 30);

    return NextResponse.json({ recurring: recurring ?? [], forecast });
  } catch (err) {
    console.error('OpenAI cashflow error:', err);
    return NextResponse.json({ error: 'AI analysis failed' }, { status: 500 });
  }
}
