import { describe, it, expect } from 'vitest';
import { generateDemoTransactions, DemoTransaction } from '../demo-data';

describe('generateDemoTransactions', () => {
  let transactions: DemoTransaction[];

  beforeAll(() => {
    transactions = generateDemoTransactions();
  });

  it('returns a non-empty array', () => {
    expect(transactions.length).toBeGreaterThan(0);
  });

  it('contains both income and expense transactions', () => {
    const incomes = transactions.filter((t) => t.type === 'income');
    const expenses = transactions.filter((t) => t.type === 'expense');
    expect(incomes.length).toBeGreaterThan(0);
    expect(expenses.length).toBeGreaterThan(0);
  });

  it('all transactions have valid structure', () => {
    for (const t of transactions) {
      expect(['income', 'expense']).toContain(t.type);
      expect(typeof t.category).toBe('string');
      expect(t.category.length).toBeGreaterThan(0);
      expect(typeof t.amount).toBe('number');
      expect(t.amount).toBeGreaterThan(0);
      expect(t.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(typeof t.description).toBe('string');
      expect(typeof t.counterparty).toBe('string');
    }
  });

  it('all dates are valid ISO date strings', () => {
    for (const t of transactions) {
      const parsed = new Date(t.date);
      expect(parsed.toString()).not.toBe('Invalid Date');
    }
  });

  it('spans at least 2 different months', () => {
    const months = new Set(transactions.map((t) => t.date.slice(0, 7)));
    expect(months.size).toBeGreaterThanOrEqual(2);
  });

  it('total income exceeds total expenses (healthy demo)', () => {
    const totalIncome = transactions
      .filter((t) => t.type === 'income')
      .reduce((s, t) => s + t.amount, 0);
    const totalExpense = transactions
      .filter((t) => t.type === 'expense')
      .reduce((s, t) => s + t.amount, 0);
    expect(totalIncome).toBeGreaterThan(totalExpense);
  });

  it('has diverse expense categories', () => {
    const cats = new Set(
      transactions.filter((t) => t.type === 'expense').map((t) => t.category),
    );
    expect(cats.size).toBeGreaterThanOrEqual(5);
  });
});
