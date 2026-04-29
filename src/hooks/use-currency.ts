'use client';

import { useState, useEffect } from 'react';

export const CURRENCIES = [
  { code: 'USD', symbol: '$', label: 'US Dollar' },
  { code: 'EUR', symbol: '€', label: 'Euro' },
  { code: 'GBP', symbol: '£', label: 'British Pound' },
  { code: 'RUB', symbol: '₽', label: 'Russian Ruble' },
  { code: 'JPY', symbol: '¥', label: 'Japanese Yen' },
  { code: 'CAD', symbol: 'CA$', label: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', label: 'Australian Dollar' },
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number]['code'];

const STORAGE_KEY = 'si_currency';

export function useCurrency() {
  const [currency, setCurrencyState] = useState<CurrencyCode>('USD');

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as CurrencyCode | null;
    if (saved && CURRENCIES.some((c) => c.code === saved)) {
      setCurrencyState(saved);
    }
  }, []);

  const setCurrency = (code: CurrencyCode) => {
    localStorage.setItem(STORAGE_KEY, code);
    setCurrencyState(code);
  };

  const symbol = CURRENCIES.find((c) => c.code === currency)?.symbol ?? '$';

  return { currency, setCurrency, symbol };
}
