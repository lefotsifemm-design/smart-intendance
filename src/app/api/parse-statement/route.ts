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
You are a business financial analyst AI. Analyze this bank statement CSV and classify EVERY transaction — both income and expenses.

CSV DATA:
${csvContent}

CLASSIFICATION RULES:
1. Detect date, description/merchant, and amount columns automatically.
2. Assign type: "income" if money came IN (salary, payments received, transfers in, refunds), "expense" if money went OUT.
3. Assign one business category from the list below.
4. Always use positive amounts regardless of sign in the CSV.
5. Include ALL transactions — do not skip anything.

BUSINESS CATEGORIES:
- Income categories: Revenue, Payroll In, Refunds Received, Transfers In, Other Income
- Expense categories: Payroll, Rent, Utilities, Marketing, IT & Software, Logistics, Taxes, Insurance, Legal, Bank Fees, Office Supplies, Travel, Meals, Other Expense

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
      max_tokens: 4000,
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
