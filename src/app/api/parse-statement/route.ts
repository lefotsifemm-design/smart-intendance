import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request: NextRequest) {
  try {
    const { csvContent } = await request.json();

    if (!csvContent || csvContent.trim().length < 20) {
      return NextResponse.json({ error: 'CSV content is required' }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    const prompt = `
You are a financial analyst AI. Analyze this bank statement (CSV, Excel export, or PDF extracted text) and classify EVERY transaction — both income and expenses.

STATEMENT DATA:
${csvContent}

PARSING RULES:
1. Auto-detect date, description/merchant, and amount columns regardless of language or format.
2. type "income" = money came IN (positive amounts, deposits, incoming transfers, refunds, cashback, salary).
   type "expense" = money went OUT (negative amounts, payments, outgoing transfers).
3. Always output positive amounts (strip the sign, use "type" to indicate direction).
4. Include ALL transactions — do not skip anything.
5. date must be in YYYY-MM-DD format. Russian dates are DD.MM.YYYY — convert them.

RUSSIAN BANK STATEMENT HINTS (Т-Банк, Сбербанк, ВТБ, etc.):
- Amounts use space as thousands separator and ₽ symbol: "-1 000.00 ₽" or "+2 500,00 ₽"
- Positive (+) amounts = income; Negative (−) amounts = expense
- "Оплата в ..." = store/merchant payment → expense
- "Пополнение. ..." = incoming deposit → income
- "Внутрибанковский перевод с договора ..." = incoming internal transfer → income
- "Внешний перевод по номеру телефона ..." = outgoing phone transfer → expense
- "Внутренний перевод на договор ..." = outgoing internal transfer → expense
- "Перевод для пополнения счета Инвесткопилка" = investment savings transfer → expense
- "Кэшбэк за обычные покупки" = cashback → income
- "Возврат средств по операции ..." = refund → income
- "Оплата услуг mBank.MTS / mBank.beeline" = mobile operator payment → expense
- "Операция в других кредитных организациях" = other bank payment → expense
- Use "Дата списания" (debit date) as the transaction date if two date columns exist

BUSINESS CATEGORIES:
- Income: Revenue, Payroll In, Refunds Received, Transfers In, Cashback, Other Income
- Expense: Payroll, Rent, Utilities, Marketing, IT & Software, Logistics, Taxes, Insurance, Legal, Bank Fees, Office Supplies, Travel, Meals, Groceries, Transfer Out, Other Expense

OUTPUT FORMAT (valid JSON only, no markdown):
[
  {
    "type": "expense",
    "category": "IT & Software",
    "amount": 50.00,
    "date": "2024-03-15",
    "description": "GitHub Teams subscription",
    "counterparty": "GITHUB.COM"
  },
  {
    "type": "income",
    "category": "Revenue",
    "amount": 5000.00,
    "date": "2024-03-01",
    "description": "Client payment",
    "counterparty": "ACME CORP"
  }
]

IMPORTANT: Return empty array [] only if the file has no parseable transactions. Include every line item.
`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a business financial analyst AI. Return ONLY valid JSON, no markdown blocks.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.1,
      max_tokens: 8000,
    });

    const content = response.choices[0].message.content || '[]';
    let transactions;
    try {
      const clean = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      transactions = JSON.parse(clean);
    } catch {
      return NextResponse.json(
        { error: 'Failed to parse AI response', details: content },
        { status: 500 }
      );
    }

    if (!Array.isArray(transactions)) {
      return NextResponse.json({ error: 'Invalid response format from AI' }, { status: 500 });
    }

    return NextResponse.json({
      transactions,
      count: transactions.length,
      tokens: response.usage?.total_tokens || 0,
    });
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    if (err.code === 'insufficient_quota') {
      return NextResponse.json({ error: 'OpenAI quota exceeded' }, { status: 402 });
    }
    if (err.code === 'rate_limit_exceeded') {
      return NextResponse.json({ error: 'Rate limit exceeded, try again' }, { status: 429 });
    }
    return NextResponse.json(
      { error: 'Failed to process statement', details: err.message },
      { status: 500 }
    );
  }
}
