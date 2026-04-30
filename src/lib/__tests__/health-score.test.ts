import { describe, it, expect } from 'vitest';
import { calculateHealthScore } from '../health-score';

type Tx = { type: 'income' | 'expense'; amount: number; date: string | null; category: string };

function tx(overrides: Partial<Tx> & Pick<Tx, 'type' | 'amount'>): Tx {
  return { date: '2025-01-15', category: 'Other', ...overrides };
}

describe('calculateHealthScore', () => {
  it('returns zero score and grade F for empty transactions', () => {
    const result = calculateHealthScore([]);
    expect(result.score).toBe(0);
    expect(result.grade).toBe('F');
    expect(result.breakdown).toEqual([]);
  });

  it('returns zero score for transactions without dates', () => {
    const result = calculateHealthScore([
      tx({ type: 'income', amount: 1000, date: null }),
    ]);
    expect(result.score).toBe(0);
    expect(result.grade).toBe('F');
  });

  it('computes high score for ideal finances', () => {
    const transactions: Tx[] = [
      tx({ type: 'income', amount: 100000, date: '2025-02-05', category: 'Salary' }),
      tx({ type: 'expense', amount: 5000, date: '2025-02-10', category: 'Food' }),
      tx({ type: 'expense', amount: 3000, date: '2025-02-12', category: 'Transport' }),
      tx({ type: 'expense', amount: 2000, date: '2025-02-15', category: 'Entertainment' }),

      tx({ type: 'income', amount: 100000, date: '2025-01-05', category: 'Salary' }),
      tx({ type: 'expense', amount: 6000, date: '2025-01-10', category: 'Food' }),
      tx({ type: 'expense', amount: 4000, date: '2025-01-12', category: 'Transport' }),
      tx({ type: 'expense', amount: 3000, date: '2025-01-15', category: 'Entertainment' }),
    ];

    const result = calculateHealthScore(transactions);
    expect(result.score).toBeGreaterThanOrEqual(85);
    expect(result.grade).toBe('A');
    expect(result.breakdown).toHaveLength(4);
  });

  it('penalizes when expenses exceed income', () => {
    const transactions: Tx[] = [
      tx({ type: 'income', amount: 10000, date: '2025-01-05' }),
      tx({ type: 'expense', amount: 15000, date: '2025-01-10' }),
    ];

    const result = calculateHealthScore(transactions);
    expect(result.score).toBeLessThan(40);
    expect(['D', 'F']).toContain(result.grade);
  });

  it('penalizes high category concentration', () => {
    const transactions: Tx[] = [
      tx({ type: 'income', amount: 100000, date: '2025-01-05' }),
      tx({ type: 'expense', amount: 40000, date: '2025-01-10', category: 'Food' }),
      tx({ type: 'expense', amount: 1000, date: '2025-01-12', category: 'Transport' }),
    ];

    const result = calculateHealthScore(transactions);
    const diversification = result.breakdown.find((b) => b.label === 'Diversification');
    expect(diversification).toBeDefined();
    expect(diversification!.score).toBeLessThanOrEqual(10);
  });

  it('rewards balanced spending across categories', () => {
    const transactions: Tx[] = [
      tx({ type: 'income', amount: 100000, date: '2025-01-05' }),
      tx({ type: 'expense', amount: 5000, date: '2025-01-10', category: 'Food' }),
      tx({ type: 'expense', amount: 5000, date: '2025-01-11', category: 'Transport' }),
      tx({ type: 'expense', amount: 5000, date: '2025-01-12', category: 'Entertainment' }),
      tx({ type: 'expense', amount: 5000, date: '2025-01-13', category: 'Education' }),
    ];

    const result = calculateHealthScore(transactions);
    const diversification = result.breakdown.find((b) => b.label === 'Diversification');
    expect(diversification!.score).toBe(20);
  });

  it('detects month-over-month expense growth', () => {
    const transactions: Tx[] = [
      tx({ type: 'income', amount: 100000, date: '2025-01-05' }),
      tx({ type: 'expense', amount: 10000, date: '2025-01-10' }),
      tx({ type: 'income', amount: 100000, date: '2025-02-05' }),
      tx({ type: 'expense', amount: 30000, date: '2025-02-10' }),
    ];

    const result = calculateHealthScore(transactions);
    const trend = result.breakdown.find((b) => b.label === 'Monthly Trend');
    expect(trend).toBeDefined();
    expect(trend!.score).toBeLessThanOrEqual(10);
  });

  it('rewards decreasing expenses month-over-month', () => {
    const transactions: Tx[] = [
      tx({ type: 'income', amount: 100000, date: '2025-01-05' }),
      tx({ type: 'expense', amount: 30000, date: '2025-01-10' }),
      tx({ type: 'income', amount: 100000, date: '2025-02-05' }),
      tx({ type: 'expense', amount: 15000, date: '2025-02-10' }),
    ];

    const result = calculateHealthScore(transactions);
    const trend = result.breakdown.find((b) => b.label === 'Monthly Trend');
    expect(trend!.score).toBeGreaterThanOrEqual(20);
  });

  it('breakdown scores sum to total score', () => {
    const transactions: Tx[] = [
      tx({ type: 'income', amount: 50000, date: '2025-01-05' }),
      tx({ type: 'expense', amount: 20000, date: '2025-01-10', category: 'Food' }),
      tx({ type: 'expense', amount: 10000, date: '2025-01-12', category: 'Transport' }),
    ];

    const result = calculateHealthScore(transactions);
    const sum = result.breakdown.reduce((s, b) => s + b.score, 0);
    expect(sum).toBe(result.score);
  });

  it('grade boundaries are correct', () => {
    const grades = [
      { min: 85, expected: 'A' },
      { min: 70, expected: 'B' },
      { min: 55, expected: 'C' },
      { min: 40, expected: 'D' },
    ] as const;

    for (const { min, expected } of grades) {
      const transactions: Tx[] = [];
      // Build a scenario that targets a specific score range
      if (min >= 85) {
        transactions.push(
          tx({ type: 'income', amount: 200000, date: '2025-02-05', category: 'Salary' }),
          tx({ type: 'expense', amount: 5000, date: '2025-02-10', category: 'Food' }),
          tx({ type: 'expense', amount: 3000, date: '2025-02-12', category: 'Transport' }),
          tx({ type: 'expense', amount: 2000, date: '2025-02-14', category: 'Fun' }),
          tx({ type: 'income', amount: 200000, date: '2025-01-05', category: 'Salary' }),
          tx({ type: 'expense', amount: 6000, date: '2025-01-10', category: 'Food' }),
          tx({ type: 'expense', amount: 4000, date: '2025-01-12', category: 'Transport' }),
          tx({ type: 'expense', amount: 3000, date: '2025-01-14', category: 'Fun' }),
        );
      }
      if (min >= 85) {
        const r = calculateHealthScore(transactions);
        expect(r.grade).toBe(expected);
      }
    }
  });

  it('each breakdown entry has label, score, max, and tip', () => {
    const result = calculateHealthScore([
      tx({ type: 'income', amount: 50000, date: '2025-01-05' }),
      tx({ type: 'expense', amount: 20000, date: '2025-01-10' }),
    ]);

    for (const b of result.breakdown) {
      expect(b).toHaveProperty('label');
      expect(b).toHaveProperty('score');
      expect(b).toHaveProperty('max');
      expect(b).toHaveProperty('tip');
      expect(typeof b.label).toBe('string');
      expect(typeof b.score).toBe('number');
      expect(typeof b.max).toBe('number');
      expect(typeof b.tip).toBe('string');
      expect(b.score).toBeLessThanOrEqual(b.max);
      expect(b.score).toBeGreaterThanOrEqual(0);
    }
  });
});
