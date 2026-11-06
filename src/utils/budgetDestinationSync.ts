import { db } from '../db/database';
import type { BudgetDestination } from '../types';

/**
 * Функция добавления внесенной статьи расхода в планы расходов будущих периодов:
 * 
 * 1) 'none' -> не добавлять в планы будущих периодов
 * 2) 'monthly' -> внести в ежемесячный бюджет как регулярный плановый расход на будущие месяцы (начиная со следующего месяца на 12 месяцев вперед)
 * 3) 'next_month' -> внести в бюджет следующего месяца (+1 месяц от даты расхода)
 * 4) 'next_year' -> внести в бюджет того же месяца в следующем году (+1 год от даты расхода)
 * 5) 'reserve' -> создать резерв: сумма расхода делится на 12 частей и вносится в статью бюджета каждого из 12 месяцев как "Резерв: <Категория>"
 */
export async function syncExpenseToBudget(params: {
  amount: number;
  category: string;
  date: string; // YYYY-MM-DD
  destination: BudgetDestination;
}): Promise<void> {
  const { amount, category, date, destination } = params;
  if (!amount || amount <= 0 || !category || !date || destination === 'none') return;

  const [yearStr, monthStr] = date.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10); // 1-12

  // Гарантируем, что для резерва есть категория расхода в справочнике
  const reserveCategoryName = `Резерв: ${category}`;
  if (destination === 'reserve') {
    const existingCat = await db.categories.where({ name: reserveCategoryName }).first();
    if (!existingCat) {
      await db.categories.add({
        name: reserveCategoryName,
        type: 'expense',
        color: '#6366f1',
        icon: 'PiggyBank'
      });
    }
  }

  const helperAddOrIncreasePlan = async (period: string, catName: string, addAmount: number) => {
    const existing = await db.budgets.where({ period, category: catName }).first();
    if (existing && existing.id) {
      await db.budgets.update(existing.id, {
        plannedAmount: (existing.plannedAmount || 0) + addAmount,
        updatedAt: new Date().toISOString()
      });
    } else {
      await db.budgets.add({
        period,
        category: catName,
        type: 'expense',
        plannedAmount: addAmount,
        carriedOverAmount: 0,
        reallocatedAmount: 0,
        updatedAt: new Date().toISOString()
      });
    }
  };

  switch (destination) {
    case 'monthly': {
      // Пользователь выбрал "ежемесячный бюджет": эта цифра должна отразиться в бюджете будущих периодов как план
      // Вносим плановую статью на будущие месяцы (на 12 месяцев вперед начиная со следующего)
      let curY = year;
      let curM = month;

      for (let i = 0; i < 12; i++) {
        curM++;
        if (curM > 12) {
          curM = 1;
          curY++;
        }
        const period = `${curY}-${String(curM).padStart(2, '0')}`;
        await helperAddOrIncreasePlan(period, category, amount);
      }
      break;
    }

    case 'next_month': {
      // Следующий месяц
      let targetMonth = month + 1;
      let targetYear = year;
      if (targetMonth > 12) {
        targetMonth = 1;
        targetYear += 1;
      }
      const period = `${targetYear}-${String(targetMonth).padStart(2, '0')}`;
      await helperAddOrIncreasePlan(period, category, amount);
      break;
    }

    case 'next_year': {
      // Тот же месяц в следующем году (+1 год)
      const period = `${year + 1}-${String(month).padStart(2, '0')}`;
      await helperAddOrIncreasePlan(period, category, amount);
      break;
    }

    case 'reserve': {
      // Сумма делится на 12 частей и вносится в статью бюджета каждого месяца как "Резерв: <Категория>"
      const monthlyPart = Math.round((amount / 12) * 100) / 100;
      let curY = year;
      let curM = month;

      for (let i = 0; i < 12; i++) {
        const period = `${curY}-${String(curM).padStart(2, '0')}`;
        await helperAddOrIncreasePlan(period, reserveCategoryName, monthlyPart);

        curM++;
        if (curM > 12) {
          curM = 1;
          curY++;
        }
      }
      break;
    }
  }
}
