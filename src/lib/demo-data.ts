export interface DemoTransaction {
  type: 'income' | 'expense';
  category: string;
  amount: number;
  date: string;
  description: string;
  counterparty: string;
}

function date(monthsAgo: number, day: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - monthsAgo);
  d.setDate(day);
  return d.toISOString().slice(0, 10);
}

export function generateDemoTransactions(): DemoTransaction[] {
  return [
    // === MONTH 1 (this month) ===
    // Income
    { type: 'income', category: 'Salary', amount: 180000, date: date(0, 5), description: 'Зарплата за месяц', counterparty: 'ООО Технологии' },
    { type: 'income', category: 'Freelance', amount: 35000, date: date(0, 12), description: 'Разработка лендинга', counterparty: 'ИП Козлов' },
    { type: 'income', category: 'Other', amount: 5000, date: date(0, 18), description: 'Возврат переплаты', counterparty: 'Мегафон' },

    // Subscriptions & Software
    { type: 'expense', category: 'Software', amount: 1190, date: date(0, 1), description: 'Подписка Figma Professional', counterparty: 'Figma Inc' },
    { type: 'expense', category: 'Software', amount: 999, date: date(0, 1), description: 'Notion Plus', counterparty: 'Notion Labs' },
    { type: 'expense', category: 'Cloud Storage', amount: 269, date: date(0, 2), description: 'Яндекс Диск Про', counterparty: 'Яндекс' },
    { type: 'expense', category: 'Entertainment', amount: 199, date: date(0, 3), description: 'Яндекс Плюс', counterparty: 'Яндекс' },
    { type: 'expense', category: 'Music', amount: 169, date: date(0, 3), description: 'Spotify Premium', counterparty: 'Spotify' },

    // Food & daily
    { type: 'expense', category: 'Food & Delivery', amount: 2450, date: date(0, 2), description: 'Продукты на неделю', counterparty: 'Перекрёсток' },
    { type: 'expense', category: 'Food & Delivery', amount: 890, date: date(0, 5), description: 'Доставка Яндекс Еда', counterparty: 'Яндекс Еда' },
    { type: 'expense', category: 'Food & Delivery', amount: 1780, date: date(0, 9), description: 'Продукты', counterparty: 'ВкусВилл' },
    { type: 'expense', category: 'Food & Delivery', amount: 650, date: date(0, 14), description: 'Обед в кафе', counterparty: 'Кофемания' },
    { type: 'expense', category: 'Food & Delivery', amount: 3200, date: date(0, 16), description: 'Продукты на неделю', counterparty: 'Перекрёсток' },
    { type: 'expense', category: 'Food & Delivery', amount: 1100, date: date(0, 20), description: 'Доставка ужина', counterparty: 'Delivery Club' },

    // Transport
    { type: 'expense', category: 'Transportation', amount: 3000, date: date(0, 1), description: 'Тройка пополнение', counterparty: 'Мосметро' },
    { type: 'expense', category: 'Transportation', amount: 450, date: date(0, 8), description: 'Яндекс Такси', counterparty: 'Яндекс Go' },
    { type: 'expense', category: 'Transportation', amount: 380, date: date(0, 15), description: 'Яндекс Такси', counterparty: 'Яндекс Go' },

    // Education
    { type: 'expense', category: 'Education', amount: 4990, date: date(0, 10), description: 'Курс по TypeScript', counterparty: 'Udemy' },

    // Other
    { type: 'expense', category: 'Fitness', amount: 3500, date: date(0, 1), description: 'Абонемент в зал', counterparty: 'World Class' },
    { type: 'expense', category: 'Other', amount: 1500, date: date(0, 7), description: 'Стрижка', counterparty: 'Барбершоп' },
    { type: 'expense', category: 'Productivity', amount: 590, date: date(0, 4), description: 'Todoist Pro', counterparty: 'Doist' },
    { type: 'expense', category: 'Other', amount: 2990, date: date(0, 11), description: 'Книги', counterparty: 'Литрес' },
    { type: 'expense', category: 'Gaming', amount: 1499, date: date(0, 13), description: 'Steam покупка', counterparty: 'Valve' },

    // === MONTH 2 (last month) ===
    // Income
    { type: 'income', category: 'Salary', amount: 180000, date: date(1, 5), description: 'Зарплата за месяц', counterparty: 'ООО Технологии' },
    { type: 'income', category: 'Freelance', amount: 25000, date: date(1, 20), description: 'Доработка API', counterparty: 'ИП Сидоров' },
    { type: 'income', category: 'Other', amount: 12000, date: date(1, 15), description: 'Кэшбэк за квартал', counterparty: 'Т-Банк' },

    // Subscriptions
    { type: 'expense', category: 'Software', amount: 1190, date: date(1, 1), description: 'Подписка Figma Professional', counterparty: 'Figma Inc' },
    { type: 'expense', category: 'Software', amount: 999, date: date(1, 1), description: 'Notion Plus', counterparty: 'Notion Labs' },
    { type: 'expense', category: 'Cloud Storage', amount: 269, date: date(1, 2), description: 'Яндекс Диск Про', counterparty: 'Яндекс' },
    { type: 'expense', category: 'Entertainment', amount: 199, date: date(1, 3), description: 'Яндекс Плюс', counterparty: 'Яндекс' },
    { type: 'expense', category: 'Music', amount: 169, date: date(1, 3), description: 'Spotify Premium', counterparty: 'Spotify' },

    // Food
    { type: 'expense', category: 'Food & Delivery', amount: 2800, date: date(1, 3), description: 'Продукты на неделю', counterparty: 'Перекрёсток' },
    { type: 'expense', category: 'Food & Delivery', amount: 1200, date: date(1, 7), description: 'Доставка Яндекс Еда', counterparty: 'Яндекс Еда' },
    { type: 'expense', category: 'Food & Delivery', amount: 1950, date: date(1, 12), description: 'Продукты', counterparty: 'ВкусВилл' },
    { type: 'expense', category: 'Food & Delivery', amount: 750, date: date(1, 17), description: 'Бизнес-ланч', counterparty: 'Кофемания' },
    { type: 'expense', category: 'Food & Delivery', amount: 2600, date: date(1, 22), description: 'Продукты на неделю', counterparty: 'Перекрёсток' },

    // Transport
    { type: 'expense', category: 'Transportation', amount: 3000, date: date(1, 1), description: 'Тройка пополнение', counterparty: 'Мосметро' },
    { type: 'expense', category: 'Transportation', amount: 520, date: date(1, 10), description: 'Яндекс Такси', counterparty: 'Яндекс Go' },
    { type: 'expense', category: 'Transportation', amount: 290, date: date(1, 19), description: 'Яндекс Такси', counterparty: 'Яндекс Go' },

    // Other
    { type: 'expense', category: 'Fitness', amount: 3500, date: date(1, 1), description: 'Абонемент в зал', counterparty: 'World Class' },
    { type: 'expense', category: 'Other', amount: 8900, date: date(1, 8), description: 'Одежда', counterparty: 'Uniqlo' },
    { type: 'expense', category: 'Education', amount: 2490, date: date(1, 14), description: 'Книга по архитектуре ПО', counterparty: 'МИФ' },
    { type: 'expense', category: 'Productivity', amount: 590, date: date(1, 4), description: 'Todoist Pro', counterparty: 'Doist' },
    { type: 'expense', category: 'Design', amount: 2900, date: date(1, 6), description: 'Иконки и ассеты', counterparty: 'Icons8' },
    { type: 'expense', category: 'Other', amount: 4500, date: date(1, 25), description: 'Подарок', counterparty: 'Золотое Яблоко' },
    { type: 'expense', category: 'News', amount: 399, date: date(1, 2), description: 'Подписка The Bell', counterparty: 'The Bell' },
    { type: 'expense', category: 'Other', amount: 1200, date: date(1, 11), description: 'Аптека', counterparty: 'Горздрав' },
    { type: 'expense', category: 'Gaming', amount: 2199, date: date(1, 16), description: 'Steam покупка', counterparty: 'Valve' },
  ];
}
