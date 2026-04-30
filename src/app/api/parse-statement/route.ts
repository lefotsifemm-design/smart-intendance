import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Split large text into chunks at natural line boundaries
function splitIntoChunks(content: string, maxChars = 30000): string[] {
  if (content.length <= maxChars) return [content];
  const chunks: string[] = [];
  let start = 0;
  while (start < content.length) {
    let end = Math.min(start + maxChars, content.length);
    if (end < content.length) {
      const nl = content.lastIndexOf('\n', end);
      if (nl > start) end = nl + 1;
    }
    chunks.push(content.slice(start, end));
    start = end;
  }
  return chunks;
}

function buildPrompt(chunk: string, chunkInfo: string): string {
  return `You are a financial analyst AI. Analyze this bank statement excerpt (${chunkInfo}) and extract EVERY transaction — both income and expenses.

STATEMENT DATA:
${chunk}

PARSING RULES:
1. Auto-detect date, description/merchant, and amount columns regardless of language or format.
2. type "income" = money came IN (positive, deposits, incoming transfers, refunds, cashback, salary).
   type "expense" = money went OUT (negative, payments, outgoing transfers).
3. Always output POSITIVE amounts (strip the sign, use "type" to indicate direction).
4. Include ALL transactions — do not skip or summarize anything.
5. date must be YYYY-MM-DD. Russian dates DD.MM.YYYY → convert.

CRITICAL — RUSSIAN NUMBER FORMAT:
- Space is the thousands separator: "10 500" means 10500, NOT 10 or 500
- Comma is the decimal separator: "1 234,56 ₽" means 1234.56
- Examples: "−10 500,00 ₽" → amount: 10500.00 | "265 798,00 ₽" → amount: 265798.00
- NEVER output an amount without the full digits including thousands

RUSSIAN BANK HINTS (Т-Банк, Сбербанк, ВТБ):
- Positive (+) row = income; Negative (−) row = expense
- "Оплата в ..." → expense (Groceries / Other Expense)
- "Пополнение" → income (Transfers In)
- "Внутрибанковский перевод с договора ..." → income (Transfers In)
- "Внешний перевод по номеру телефона ..." → expense (Transfer Out)
- "Внутренний перевод на договор ..." → expense (Transfer Out)
- "Перевод для пополнения счета Инвесткопилка" → expense (Transfer Out)
- "Кэшбэк" → income (Cashback)
- "Возврат средств" → income (Refunds Received)
- "Оплата услуг mBank.MTS / mBank.beeline" → expense (Utilities)
- Use "Дата списания" as the date if two date columns exist
- IGNORE summary/balance rows — only extract individual transaction lines

CATEGORIES:
- Income: Revenue, Payroll In, Refunds Received, Transfers In, Cashback, Other Income
- Expense: Payroll, Rent, Utilities, Marketing, IT & Software, Logistics, Taxes, Insurance, Legal, Bank Fees, Office Supplies, Travel, Meals, Groceries, Transfer Out, Other Expense

OUTPUT: valid JSON array only, no markdown:
[{"type":"expense","category":"Groceries","amount":1234.56,"date":"2024-03-15","description":"Оплата в Пятёрочка","counterparty":"PYATEROCHKA"}]

Return [] only if truly no transactions found.`;
}

function parseJSON(raw: string): unknown[] {
  const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  try {
    return JSON.parse(clean);
  } catch {
    const lastBrace = clean.lastIndexOf('}');
    if (lastBrace > 0) {
      return JSON.parse(clean.substring(0, lastBrace + 1) + ']');
    }
    throw new Error('Cannot parse AI response');
  }
}

export async function POST(request: NextRequest) {
  try {
    const { csvContent } = await request.json();

    if (!csvContent || csvContent.trim().length < 20) {
      return NextResponse.json({ error: 'CSV content is required' }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    const chunks = splitIntoChunks(csvContent.trim(), 30000);
    const allTransactions: unknown[] = [];
    let totalTokens = 0;

    for (let i = 0; i < chunks.length; i++) {
      const chunkInfo = chunks.length > 1 ? `part ${i + 1} of ${chunks.length}` : 'full statement';
      const prompt = buildPrompt(chunks[i], chunkInfo);

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a financial analyst AI. Return ONLY valid JSON arrays, no markdown. Pay close attention to Russian number formats: space = thousands separator, comma = decimal.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 16384,
      });

      totalTokens += response.usage?.total_tokens ?? 0;
      const content = response.choices[0].message.content || '[]';

      let parsed: unknown[];
      try {
        parsed = parseJSON(content);
      } catch {
        if (chunks.length === 1) {
          return NextResponse.json(
            { error: 'Failed to parse AI response. Try splitting the statement into smaller date ranges.' },
            { status: 500 }
          );
        }
        // Skip failed chunk rather than aborting all
        continue;
      }

      if (Array.isArray(parsed)) {
        allTransactions.push(...parsed);
      }
    }

    return NextResponse.json({
      transactions: allTransactions,
      count: allTransactions.length,
      tokens: totalTokens,
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
