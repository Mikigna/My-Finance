import Dexie, { type Table } from 'dexie';
import type { Transaction, Category, PaymentMethod, BudgetItem, BudgetReallocation } from '../types';

/**
 * ========================================================================================
 * ЛОКАЛЬНАЯ БАЗА ДАННЫХ (LOCAL-FIRST НА INDEXEDDB С ИСПОЛЬЗОВАНИЕМ DEXIE.JS)
 * ========================================================================================
 * 
 * ПОЧЕМУ ЭТО НАДЕЖНО ПРИ ДЕПЛОЕ НА VERCEL:
 * 1. IndexedDB привязана к домену (Origin) в браузере пользователя, а не к версии кода.
 * 2. При обновлении приложения на Vercel (новый деплой фронтенда) данные в IndexedDB
 *    остаются нетронутыми в браузере клиента.
 * 3. Версионирование Dexie (.version(N).stores({...})) автоматически и плавно накатывает
 *    изменения схемы без удаления существующих записей пользователей.
 * 4. Данные на 100% приватны и никогда не передаются на сторонние серверы.
 */

export interface BackupDataSchema {
  app: string;
  version: number;
  exportDate: string;
  expenses: Transaction[];
  categories: Category[];
  methods: PaymentMethod[];
  budgets: BudgetItem[];
  reallocations: BudgetReallocation[];
}

export class FinanceDatabase extends Dexie {
  expenses!: Table<Transaction, number>;
  categories!: Table<Category, number>;
  methods!: Table<PaymentMethod, number>;
  budgets!: Table<BudgetItem, number>;
  reallocations!: Table<BudgetReallocation, number>;

  constructor() {
    super('FinanceDB');

    // Версия 1 (базовая)
    this.version(1).stores({
      expenses: '++id, amount, category, method, date, type',
      categories: '++id, name, type',
      methods: '++id, name'
    });

    // Версия 2 (расширенные признаки расходов)
    this.version(2).stores({
      expenses: '++id, amount, category, method, date, type, necessity, frequency, planning, incomeFrequency',
      categories: '++id, name, type',
      methods: '++id, name'
    });

    // Версия 3 (модуль бюджетирования и перераспределения)
    this.version(3).stores({
      expenses: '++id, amount, category, method, date, type, necessity, frequency, planning, incomeFrequency',
      categories: '++id, name, type',
      methods: '++id, name',
      budgets: '++id, period, category, type, [period+category]',
      reallocations: '++id, period, date'
    }).upgrade(async (tx) => {
      // Миграция при переходе на v3: гарантируем корректные типы и поля
      const expensesTable = tx.table('expenses');
      await expensesTable.toCollection().modify((expense: Transaction) => {
        if (expense.type === 'expense') {
          if (!expense.necessity) expense.necessity = 'mandatory';
          if (!expense.frequency) expense.frequency = 'regular';
          if (!expense.planning) expense.planning = 'planned';
        } else if (expense.type === 'income') {
          if (!expense.incomeFrequency) expense.incomeFrequency = 'regular';
        }
      });
    });

    // Версия 4 (актуальная версия схемы)
    this.version(4).stores({
      expenses: '++id, amount, category, method, date, type, necessity, frequency, planning, incomeFrequency',
      categories: '++id, name, type',
      methods: '++id, name',
      budgets: '++id, period, category, type, [period+category]',
      reallocations: '++id, period, date'
    });
  }
}

// Экземпляр синглтона базы данных
export const db = new FinanceDatabase();

let seedPromise: Promise<void> | null = null;

/**
 * Первоначальное заполнение базовыми категориями с защитой от гонки потоков
 * и автоматической очисткой возможных дубликатов в существующих базах.
 */
export async function seedInitialData(): Promise<void> {
  if (seedPromise) return seedPromise;

  seedPromise = (async () => {
    try {
      const catCount = await db.categories.count();
      if (catCount === 0) {
        await db.categories.bulkAdd([
          { name: 'Продукты', type: 'expense', color: '#ef4444', icon: 'ShoppingCart' },
          { name: 'Транспорт', type: 'expense', color: '#3b82f6', icon: 'Car' },
          { name: 'Жилье и КУ', type: 'expense', color: '#10b981', icon: 'Home' },
          { name: 'Развлечения', type: 'expense', color: '#8b5cf6', icon: 'Film' },
          { name: 'Здоровье', type: 'expense', color: '#ec4899', icon: 'HeartPulse' },
          { name: 'Кафе и Рестораны', type: 'expense', color: '#f59e0b', icon: 'Utensils' },
          { name: 'Одежда', type: 'expense', color: '#06b6d4', icon: 'ShoppingBag' },
          { name: 'Зарплата', type: 'income', color: '#10b981', icon: 'Wallet' },
          { name: 'Фриланс', type: 'income', color: '#6366f1', icon: 'Laptop' },
          { name: 'Инвестиции', type: 'income', color: '#84cc16', icon: 'TrendingUp' },
        ]);
      } else {
        // Автоматическая очистка дубликатов категорий по названию и типу
        const allCats = await db.categories.toArray();
        const seenCatKeys = new Set<string>();
        const dupCatIds: number[] = [];
        for (const cat of allCats) {
          const key = `${cat.type || 'expense'}-${(cat.name || '').trim().toLowerCase()}`;
          if (seenCatKeys.has(key)) {
            if (cat.id) dupCatIds.push(cat.id);
          } else {
            seenCatKeys.add(key);
          }
        }
        if (dupCatIds.length > 0) {
          await db.categories.bulkDelete(dupCatIds);
        }
      }

      const methodCount = await db.methods.count();
      if (methodCount === 0) {
        await db.methods.bulkAdd([
          { name: 'Карта' },
          { name: 'Наличные' },
          { name: 'СБП / Перевод' },
          { name: 'Сберегательный счет' }
        ]);
      } else {
        // Автоматическая очистка дубликатов способов оплаты
        const allMethods = await db.methods.toArray();
        const seenMethodNames = new Set<string>();
        const dupMethodIds: number[] = [];
        for (const m of allMethods) {
          const key = (m.name || '').trim().toLowerCase();
          if (seenMethodNames.has(key)) {
            if (m.id) dupMethodIds.push(m.id);
          } else {
            seenMethodNames.add(key);
          }
        }
        if (dupMethodIds.length > 0) {
          await db.methods.bulkDelete(dupMethodIds);
        }
      }
    } finally {
      seedPromise = null;
    }
  })();

  return seedPromise;
}

/**
 * ЭКСПОРТ ДАННЫХ В ФОРМАТ JSON (Резервная копия)
 * Собирает все таблицы локальной IndexedDB и возвращает JSON-строку.
 */
export async function exportAllDataToJSON(): Promise<string> {
  const [expenses, categories, methods, budgets, reallocations] = await Promise.all([
    db.expenses.toArray(),
    db.categories.toArray(),
    db.methods.toArray(),
    db.budgets.toArray(),
    db.reallocations.toArray()
  ]);

  const backup: BackupDataSchema = {
    app: 'LocalFirstFinance',
    version: 4,
    exportDate: new Date().toISOString(),
    expenses,
    categories,
    methods,
    budgets,
    reallocations
  };

  return JSON.stringify(backup, null, 2);
}

/**
 * Скачивание файла резервной копии на устройство пользователя
 */
export async function downloadBackupFile(): Promise<void> {
  const jsonString = await exportAllDataToJSON();
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const today = new Date().toISOString().split('T')[0];
  const link = document.createElement('a');
  link.href = url;
  link.download = `finance_backup_${today}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * ИМПОРТ ДАННЫХ ИЗ JSON С АТОМАРНОЙ ТРАНЗАКЦИЕЙ И ПРОВЕРКОЙ ПОЛЕЙ
 * 
 * @param jsonString Содержимое загруженного .json файла
 * @returns Статистика по импортированным записям
 */
export async function importDataFromJSON(jsonString: string): Promise<{
  expensesCount: number;
  categoriesCount: number;
  methodsCount: number;
  budgetsCount: number;
  reallocationsCount: number;
}> {
  let parsed: any;
  try {
    parsed = JSON.parse(jsonString);
  } catch (e) {
    throw new Error('Файл поврежден или не является валидным JSON.');
  }

  // Базовая проверка структуры
  if (!parsed || (typeof parsed !== 'object')) {
    throw new Error('Некорректная структура файла резервной копии.');
  }

  // Безопасное извлечение и валидация массивов
  const rawExpenses: any[] = Array.isArray(parsed.expenses) ? parsed.expenses : [];
  const rawCategories: any[] = Array.isArray(parsed.categories) ? parsed.categories : [];
  const rawMethods: any[] = Array.isArray(parsed.methods) ? parsed.methods : [];
  const rawBudgets: any[] = Array.isArray(parsed.budgets) ? parsed.budgets : [];
  const rawReallocations: any[] = Array.isArray(parsed.reallocations) ? parsed.reallocations : [];

  // Нормализация и проверка записей транзакций (защита от сломанных полей)
  const cleanExpenses: Transaction[] = rawExpenses.map(item => ({
    id: typeof item.id === 'number' ? item.id : undefined,
    amount: Number(item.amount) || 0,
    category: String(item.category || 'Без категории'),
    method: String(item.method || 'Карта'),
    date: String(item.date || new Date().toISOString().split('T')[0]),
    type: item.type === 'income' ? 'income' : 'expense',
    note: item.note ? String(item.note) : undefined,
    createdAt: item.createdAt ? String(item.createdAt) : undefined,
    necessity: item.necessity === 'optional' ? 'optional' : 'mandatory',
    frequency: item.frequency === 'one_off' ? 'one_off' : 'regular',
    planning: item.planning === 'unplanned' ? 'unplanned' : 'planned',
    incomeFrequency: item.incomeFrequency === 'irregular' ? 'irregular' : 'regular',
    receiptImage: item.receiptImage ? String(item.receiptImage) : undefined
  }));

  // Нормализация категорий с дедупликацией
  const seenCategoryKeys = new Set<string>();
  const cleanCategories: Category[] = [];
  for (const item of rawCategories) {
    const name = String(item.name || 'Категория').trim();
    const type = item.type === 'income' ? 'income' : 'expense';
    const key = `${type}-${name.toLowerCase()}`;
    if (!seenCategoryKeys.has(key)) {
      seenCategoryKeys.add(key);
      cleanCategories.push({
        id: typeof item.id === 'number' ? item.id : undefined,
        name,
        type,
        color: item.color ? String(item.color) : undefined,
        icon: item.icon ? String(item.icon) : undefined
      });
    }
  }

  // Нормализация способов оплаты с дедупликацией
  const seenMethodNames = new Set<string>();
  const cleanMethods: PaymentMethod[] = [];
  for (const item of rawMethods) {
    const name = String(item.name || 'Оплата').trim();
    const key = name.toLowerCase();
    if (!seenMethodNames.has(key)) {
      seenMethodNames.add(key);
      cleanMethods.push({
        id: typeof item.id === 'number' ? item.id : undefined,
        name
      });
    }
  }

  // Нормализация бюджетов
  const cleanBudgets: BudgetItem[] = rawBudgets.map(item => ({
    id: typeof item.id === 'number' ? item.id : undefined,
    period: String(item.period),
    category: String(item.category),
    type: item.type === 'income' ? 'income' : 'expense',
    plannedAmount: Number(item.plannedAmount) || 0,
    carriedOverAmount: Number(item.carriedOverAmount) || 0,
    reallocatedAmount: Number(item.reallocatedAmount) || 0,
    note: item.note ? String(item.note) : undefined
  }));

  // Нормализация перераспределений
  const cleanReallocations: BudgetReallocation[] = rawReallocations.map(item => ({
    id: typeof item.id === 'number' ? item.id : undefined,
    period: String(item.period),
    fromCategory: String(item.fromCategory),
    toCategory: String(item.toCategory),
    amount: Number(item.amount) || 0,
    date: String(item.date),
    reason: item.reason ? String(item.reason) : undefined
  }));

  // АТОМАРНАЯ ТРАНЗАКЦИЯ: очищаем и перезаписываем все таблицы за один проход
  await db.transaction('rw', [db.expenses, db.categories, db.methods, db.budgets, db.reallocations], async () => {
    await db.expenses.clear();
    await db.categories.clear();
    await db.methods.clear();
    await db.budgets.clear();
    await db.reallocations.clear();

    if (cleanExpenses.length > 0) await db.expenses.bulkAdd(cleanExpenses);
    if (cleanCategories.length > 0) await db.categories.bulkAdd(cleanCategories);
    if (cleanMethods.length > 0) await db.methods.bulkAdd(cleanMethods);
    if (cleanBudgets.length > 0) await db.budgets.bulkAdd(cleanBudgets);
    if (cleanReallocations.length > 0) await db.reallocations.bulkAdd(cleanReallocations);
  });

  return {
    expensesCount: cleanExpenses.length,
    categoriesCount: cleanCategories.length,
    methodsCount: cleanMethods.length,
    budgetsCount: cleanBudgets.length,
    reallocationsCount: cleanReallocations.length
  };
}

/**
 * СБРОС БАЗЫ ДАННЫХ ДО НАЧАЛЬНОГО СОСТОЯНИЯ
 */
export async function resetDatabaseToDefault(): Promise<void> {
  await db.transaction('rw', [db.expenses, db.categories, db.methods, db.budgets, db.reallocations], async () => {
    await db.expenses.clear();
    await db.categories.clear();
    await db.methods.clear();
    await db.budgets.clear();
    await db.reallocations.clear();
  });

  // Заново наполняем базовыми справочниками
  await seedInitialData();
}
