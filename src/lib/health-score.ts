interface Transaction {
  type: 'income' | 'expense';
  amount: number;
  date: string | null;
  category: string;
}

interface HealthResult {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  breakdown: { label: string; score: number; max: number; tip: string }[];
}

function monthKey(d: string | null): string {
  if (!d) return '';
  return d.slice(0, 7);
}

export function calculateHealthScore(transactions: Transaction[]): HealthResult {
  const dated = transactions.filter((t) => t.date);
  if (dated.length === 0) {
    return { score: 0, grade: 'F', breakdown: [] };
  }

  const months = new Map<string, { income: number; expense: number }>();
  for (const t of dated) {
    const mk = monthKey(t.date);
    if (!mk) continue;
    const m = months.get(mk) ?? { income: 0, expense: 0 };
    if (t.type === 'income') m.income += t.amount;
    else m.expense += t.amount;
    months.set(mk, m);
  }

  const sortedMonths = [...months.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const totalIncome = dated.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpense = dated.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  // 1. Savings rate (0–30 points)
  const savingsRate = totalIncome > 0 ? (totalIncome - totalExpense) / totalIncome : 0;
  let savingsScore: number;
  if (savingsRate >= 0.3) savingsScore = 30;
  else if (savingsRate >= 0.2) savingsScore = 25;
  else if (savingsRate >= 0.1) savingsScore = 20;
  else if (savingsRate >= 0) savingsScore = 10;
  else savingsScore = 0;
  const savingsTip = savingsRate < 0.1
    ? 'Try to save at least 10% of income'
    : savingsRate < 0.2
      ? 'Good start — aim for 20%+ savings rate'
      : 'Great savings discipline';

  // 2. Income/expense ratio (0–25 points)
  const ratio = totalExpense > 0 ? totalIncome / totalExpense : 0;
  let ratioScore: number;
  if (ratio >= 2) ratioScore = 25;
  else if (ratio >= 1.5) ratioScore = 20;
  else if (ratio >= 1.1) ratioScore = 15;
  else if (ratio >= 1) ratioScore = 10;
  else ratioScore = 0;
  const ratioTip = ratio < 1
    ? 'Expenses exceed income — review spending'
    : ratio < 1.5
      ? 'Healthy ratio — keep growing income'
      : 'Strong income-to-expense ratio';

  // 3. Category concentration (0–20 points) — penalize if one category > 50% of spend
  const catSpend = new Map<string, number>();
  for (const t of dated.filter((t) => t.type === 'expense')) {
    catSpend.set(t.category, (catSpend.get(t.category) ?? 0) + t.amount);
  }
  const topCatShare = totalExpense > 0
    ? Math.max(...catSpend.values()) / totalExpense
    : 0;
  let concScore: number;
  if (topCatShare <= 0.3) concScore = 20;
  else if (topCatShare <= 0.4) concScore = 15;
  else if (topCatShare <= 0.5) concScore = 10;
  else concScore = 5;
  const topCat = [...catSpend.entries()].sort((a, b) => b[1] - a[1])[0];
  const concTip = topCatShare > 0.4
    ? `${topCat?.[0] ?? 'Top category'} is ${Math.round(topCatShare * 100)}% of spending — diversify`
    : 'Well-balanced spending across categories';

  // 4. Month-over-month trend (0–25 points)
  let momScore = 15;
  if (sortedMonths.length >= 2) {
    const last = sortedMonths[sortedMonths.length - 1][1];
    const prev = sortedMonths[sortedMonths.length - 2][1];
    const expGrowth = prev.expense > 0 ? (last.expense - prev.expense) / prev.expense : 0;
    const incGrowth = prev.income > 0 ? (last.income - prev.income) / prev.income : 0;

    if (expGrowth <= -0.1) momScore = 25;
    else if (expGrowth <= 0) momScore = 20;
    else if (expGrowth <= 0.1) momScore = 15;
    else if (expGrowth <= 0.2) momScore = 10;
    else momScore = 5;

    if (incGrowth > 0.1) momScore = Math.min(25, momScore + 5);
  }
  const momTip = momScore >= 20
    ? 'Positive trend — expenses stable or decreasing'
    : 'Expenses growing — review recent spending';

  const breakdown = [
    { label: 'Savings Rate', score: savingsScore, max: 30, tip: savingsTip },
    { label: 'Income / Expense', score: ratioScore, max: 25, tip: ratioTip },
    { label: 'Diversification', score: concScore, max: 20, tip: concTip },
    { label: 'Monthly Trend', score: momScore, max: 25, tip: momTip },
  ];

  const score = breakdown.reduce((s, b) => s + b.score, 0);
  const grade: HealthResult['grade'] =
    score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 55 ? 'C' : score >= 40 ? 'D' : 'F';

  return { score, grade, breakdown };
}
