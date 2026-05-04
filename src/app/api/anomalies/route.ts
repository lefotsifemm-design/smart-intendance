import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createClient } from '@supabase/supabase-js';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export interface SpendingAnomaly {
  category: string;
  currentMonthLabel: string;
  currentAmount: number;
  previousAvg: number;
  changePercent: number;
  severity: 'critical' | 'high' | 'medium';
  topTransactions: { date: string; amount: number; name: string }[];
}

export interface DuplicateGroup {
  name: string;
  category: string;
  amount: number;
  monthLabel: string;
  items: { date: string; description: string; counterparty: string }[];
  totalWasted: number;
}

export interface ZombieSubscription {
  name: string;
  category: string;
  amount: number;
  monthsActive: number;
  firstCharge: string;
  lastCharge: string;
  totalSpent: number;
}

function monthKey(date: string) {
  return date.slice(0, 7); // "YYYY-MM"
}

function monthLabel(key: string) {
  const [y, m] = key.split('-');
  return new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString('ru-RU', {
    month: 'long',
    year: 'numeric',
  });
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-zа-яё0-9\s]/gi, '')
    .trim()
    .slice(0, 20);
}

function detectAnomalies(
  transactions: { type: string; category: string; amount: number; date: string; description: string; counterparty: string }[]
): SpendingAnomaly[] {
  const expenses = transactions.filter((t) => t.type === 'expense');

  // Group by category → month → total
  const byCategory: Record<string, Record<string, { total: number; txs: typeof expenses }>> = {};
  for (const tx of expenses) {
    const cat = tx.category || 'Other';
    const mk = monthKey(tx.date);
    if (!byCategory[cat]) byCategory[cat] = {};
    if (!byCategory[cat][mk]) byCategory[cat][mk] = { total: 0, txs: [] };
    byCategory[cat][mk].total += tx.amount;
    byCategory[cat][mk].txs.push(tx);
  }

  const anomalies: SpendingAnomaly[] = [];

  // Get current and previous months sorted descending
  const allMonths = [
    ...new Set(expenses.map((t) => monthKey(t.date))),
  ].sort().reverse();

  if (allMonths.length < 2) return [];

  const currentMonth = allMonths[0];
  const prevMonths = allMonths.slice(1, 4); // up to 3 previous months for avg

  for (const [cat, monthData] of Object.entries(byCategory)) {
    const currentData = monthData[currentMonth];
    if (!currentData) continue;

    const prevAmounts = prevMonths
      .map((m) => monthData[m]?.total ?? 0)
      .filter((v) => v > 0);

    if (prevAmounts.length === 0) continue;

    const prevAvg = prevAmounts.reduce((a, b) => a + b, 0) / prevAmounts.length;
    if (prevAvg === 0) continue;

    const changePercent = ((currentData.total - prevAvg) / prevAvg) * 100;

    // Flag only meaningful spikes (>30% increase, minimum 5000 absolute difference)
    if (changePercent > 30 && currentData.total - prevAvg > 5000) {
      let severity: SpendingAnomaly['severity'] = 'medium';
      if (changePercent > 100) severity = 'critical';
      else if (changePercent > 50) severity = 'high';

      const topTransactions = currentData.txs
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 3)
        .map((t) => ({
          date: t.date,
          amount: t.amount,
          name: t.description || t.counterparty || cat,
        }));

      anomalies.push({
        category: cat,
        currentMonthLabel: monthLabel(currentMonth),
        currentAmount: Math.round(currentData.total),
        previousAvg: Math.round(prevAvg),
        changePercent: Math.round(changePercent),
        severity,
        topTransactions,
      });
    }
  }

  return anomalies.sort((a, b) => b.changePercent - a.changePercent);
}

function detectDuplicates(
  transactions: { type: string; category: string; amount: number; date: string; description: string; counterparty: string }[]
): DuplicateGroup[] {
  const expenses = transactions.filter((t) => t.type === 'expense');

  // Group by month + normalized name + rounded amount
  const groups: Record<string, typeof expenses> = {};

  for (const tx of expenses) {
    const name = normalize(tx.description || tx.counterparty || tx.category);
    if (!name || name.length < 3) continue;
    const roundedAmount = Math.round(tx.amount / 10) * 10; // round to nearest 10
    const key = `${monthKey(tx.date)}|${name}|${roundedAmount}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(tx);
  }

  const duplicates: DuplicateGroup[] = [];

  for (const [key, txs] of Object.entries(groups)) {
    if (txs.length < 2) continue;

    const [mk] = key.split('|');
    const totalWasted = txs.slice(1).reduce((sum, t) => sum + t.amount, 0); // all but the first are "extra"

    duplicates.push({
      name: txs[0].description || txs[0].counterparty || txs[0].category,
      category: txs[0].category,
      amount: txs[0].amount,
      monthLabel: monthLabel(mk),
      items: txs.map((t) => ({
        date: t.date,
        description: t.description,
        counterparty: t.counterparty,
      })),
      totalWasted: Math.round(totalWasted),
    });
  }

  return duplicates.sort((a, b) => b.totalWasted - a.totalWasted);
}

function detectZombies(
  transactions: { type: string; category: string; amount: number; date: string; description: string; counterparty: string }[]
): ZombieSubscription[] {
  const expenses = transactions.filter((t) => t.type === 'expense');

  // Group by normalized name
  const byName: Record<string, typeof expenses> = {};
  for (const tx of expenses) {
    const name = normalize(tx.description || tx.counterparty || tx.category);
    if (!name || name.length < 3) continue;
    if (!byName[name]) byName[name] = [];
    byName[name].push(tx);
  }

  const zombies: ZombieSubscription[] = [];

  for (const [, txs] of Object.entries(byName)) {
    if (txs.length < 3) continue;

    // Check if appears in 3+ different months
    const months = [...new Set(txs.map((t) => monthKey(t.date)))];
    if (months.length < 3) continue;

    // Check amount variance < 5%
    const amounts = txs.map((t) => t.amount);
    const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const maxDev = Math.max(...amounts.map((a) => Math.abs(a - avg) / avg));
    if (maxDev > 0.05) continue; // more than 5% variance → not a zombie subscription

    const sorted = txs.sort((a, b) => a.date.localeCompare(b.date));

    zombies.push({
      name: txs[0].description || txs[0].counterparty || txs[0].category,
      category: txs[0].category,
      amount: Math.round(avg),
      monthsActive: months.length,
      firstCharge: sorted[0].date,
      lastCharge: sorted[sorted.length - 1].date,
      totalSpent: Math.round(amounts.reduce((a, b) => a + b, 0)),
    });
  }

  return zombies.sort((a, b) => b.totalSpent - a.totalSpent);
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sb = adminClient();
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  const { data: transactions, error } = await sb
    .from('transactions')
    .select('type, category, amount, date, description, counterparty')
    .eq('user_id', session.user.id)
    .gte('date', twelveMonthsAgo.toISOString().slice(0, 10))
    .order('date', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (!transactions || transactions.length < 5) {
    return NextResponse.json({
      anomalies: [],
      duplicates: [],
      zombies: [],
      insufficient: true,
    });
  }

  const anomalies = detectAnomalies(transactions);
  const duplicates = detectDuplicates(transactions);
  const zombies = detectZombies(transactions);

  return NextResponse.json({ anomalies, duplicates, zombies, insufficient: false });
}
