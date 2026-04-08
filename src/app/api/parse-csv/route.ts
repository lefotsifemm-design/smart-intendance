import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { csvContent } = await request.json();

    if (!csvContent) {
      return NextResponse.json(
        { error: 'CSV content is required' },
        { status: 400 }
      );
    }

    // Check if CSV is empty or too short
    if (csvContent.trim().length < 20) {
      return NextResponse.json(
        { error: 'CSV file appears to be empty or too short' },
        { status: 400 }
      );
    }

    // Check OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    // GPT-4 промпт для определения подписок
    const prompt = `
You are an expert financial analyst AI with deep knowledge of subscription services worldwide.

Analyze this bank statement CSV and identify ALL subscription services, even if they appear only once.

CSV DATA:
${csvContent}

ANALYSIS STRATEGY:
1. **Flexible CSV parsing**: Automatically detect column names (Date/Description/Amount may have different names)
2. **Merchant recognition**: Use your knowledge of subscription services (SaaS, streaming, cloud, etc.)
3. **Single transaction is enough**: If merchant is a known subscription service, include it even if it appears once
4. **Smart confidence scoring**:
   - 95-100: Well-known subscription services (Netflix, Spotify, Adobe, AWS, etc.)
   - 85-94: Recognized but less common services
   - 70-84: Likely subscription based on naming patterns (*-subscription, *premium, *pro, etc.)
   - 50-69: Uncertain, needs confirmation

KNOWN SUBSCRIPTION PATTERNS:
- Streaming: Netflix, Hulu, Disney+, HBO, Prime Video, YouTube Premium
- Music: Spotify, Apple Music, Tidal, Deezer
- Software: Adobe, Microsoft 365, Slack, Notion, Figma, GitHub
- Cloud: AWS, Google Cloud, Azure, Dropbox, iCloud
- Productivity: Asana, Monday, ClickUp, Evernote
- Design: Canva, InVision, Sketch
- Education: Coursera, Udemy, MasterClass
- News: NYT, WSJ, Medium
- Fitness: Peloton, ClassPass, Strava
- Food: HelloFresh, DoorDash Pass, Uber Eats Pass
- Other: Any service ending in "subscription", "premium", "pro", "plus"

FREQUENCY DETECTION:
- If same merchant appears multiple times ~30 days apart → "monthly"
- If same merchant appears ~365 days apart → "annual"  
- If appears only once → guess based on typical pricing (e.g., $9.99-19.99 usually monthly, $99+ often annual)

CATEGORY GUESSING:
Based on merchant name, assign one of: Entertainment, Software, Music, Cloud Storage, Productivity, Design, Education, News, Fitness, Food & Delivery, Transportation, Gaming, Other

OUTPUT FORMAT (valid JSON only, no markdown):
[
  {
    "name": "Netflix",
    "amount": 12.99,
    "frequency": "monthly",
    "category": "Entertainment",
    "merchant": "NETFLIX.COM",
    "confidence": 98,
    "last_charge": "2024-03-15",
    "reasoning": "Well-known streaming service, typical monthly price"
  }
]

IMPORTANT:
- Return empty array [] if truly NO subscriptions found
- Include ALL potential subscriptions, even uncertain ones (let user decide)
- DO NOT include one-time purchases, grocery stores, gas stations, restaurants (unless they're delivery subscriptions)
`;

    // Вызов GPT-4
    const response = await openai.chat.completions.create({
      model: 'gpt-4o', // Используем GPT-4o (дешевле и быстрее чем gpt-4)
      messages: [
        {
          role: 'system',
          content: 'You are a financial analysis AI expert in subscription services. Return ONLY valid JSON, no markdown blocks.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.2, // Очень низкая температура для консистентности
      max_tokens: 3000, // Больше токенов для детального анализа
    });

    const content = response.choices[0].message.content || '[]';

    // Парсим JSON ответ
    let subscriptions;
    try {
      // Убираем markdown блоки если GPT их добавил
      const cleanContent = content
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      
      subscriptions = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('Failed to parse GPT response:', content);
      return NextResponse.json(
        { error: 'Failed to parse AI response', details: content },
        { status: 500 }
      );
    }

    // Валидация результата
    if (!Array.isArray(subscriptions)) {
      return NextResponse.json(
        { error: 'Invalid response format from AI' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      subscriptions,
      count: subscriptions.length,
      tokens: response.usage?.total_tokens || 0,
    });

  } catch (error: any) {
    console.error('OpenAI API error:', error);
    
    // Handle specific OpenAI errors
    if (error.code === 'insufficient_quota') {
      return NextResponse.json(
        { 
          error: 'OpenAI API quota exceeded', 
          details: 'Please check your OpenAI account billing' 
        },
        { status: 402 }
      );
    }

    if (error.code === 'invalid_api_key') {
      return NextResponse.json(
        { 
          error: 'Invalid OpenAI API key', 
          details: 'Please check your API key configuration' 
        },
        { status: 401 }
      );
    }

    if (error.code === 'rate_limit_exceeded') {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded', 
          details: 'Please wait a moment and try again' 
        },
        { status: 429 }
      );
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to process CSV', 
        details: error.message || 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}