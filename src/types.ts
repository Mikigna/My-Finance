export type TransactionType = 'expense' | 'income';

// Категории расходов: Базовые обязательства / Инвестиции в рост / Утечки (лишнее/спонтанное)
export type ExpenseRole = 'basic' | 'growth' | 'leak';

// Функция добавления внесенной статьи расхода в планы будущих периодов
export type BudgetDestination = 
  | 'none'          // Не добавлять в планы будущих периодов
  | 'monthly'       // Внести в ежемесячный бюджет (план на каждый месяц будущих периодов)
  | 'next_month'     // Внести в бюджет следующего месяца (+1 месяц)
  | 'next_year'      // Внести в бюджет месяца в следующем году (+1 год)
  | 'reserve';       // Создать резерв (сумма расхода делится на 12 частей и вносится на 12 месяцев как "Резерв: <Категория>")

export type IncomeFrequency = 'regular' | 'irregular'; // Регулярный / Нерегулярный

export interface Transaction {
  id?: number;
  amount: number;
  category: string;
  method: string;
  date: string; // YYYY-MM-DD
  type: TransactionType;
  note?: string;
  createdAt?: string;
  // Категория расхода: базовые / рост / утечки
  expenseRole?: ExpenseRole;
  // Добавление в планы будущих периодов
  budgetDestination?: BudgetDestination;
  // Income attributes
  incomeFrequency?: IncomeFrequency;
  // Receipt / Photo attachment (base64 Data URL)
  receiptImage?: string;
}

export interface Category {
  id?: number;
  name: string;
  type: TransactionType;
  color?: string;
  icon?: string;
}

export interface PaymentMethod {
  id?: number;
  name: string;
  icon?: string;
}

export interface DateRange {
  startDate: string;
  endDate: string;
}

export interface BudgetItem {
  id?: number;
  period: string; // e.g. '2026-08' or 'custom_YYYY-MM-DD_YYYY-MM-DD'
  category: string;
  type: TransactionType;
  plannedAmount: number;
  carriedOverAmount?: number; // перенесенный остаток с прошлого периода
  reallocatedAmount?: number; // сумма перераспределений (+ или -)
  note?: string;
  updatedAt?: string;
}

export interface BudgetReallocation {
  id?: number;
  period: string;
  fromCategory: string;
  toCategory: string;
  amount: number;
  date: string;
  reason?: string;
}

export type IncomeYieldType = 'PERCENT' | 'ABSOLUTE';

export interface PassiveIncomeSource {
  id?: number;
  name: string;
  currency: string; // 'KZT', 'USD', 'EUR', 'RUB', etc.
  marketValue: number; // in asset's currency
  incomeType: IncomeYieldType; // 'PERCENT' | 'ABSOLUTE'
  incomePercent?: number; // annual % if PERCENT
  incomeAbsolute?: number; // monthly income in asset currency if ABSOLUTE
  expectedReturn?: number; // optional legacy field
  createdAt?: string;
  updatedAt?: string;
}

export interface CurrencyRate {
  id?: number;
  code: string; // 'USD', 'EUR', 'RUB', 'CNY', etc.
  name?: string;
  rate: number; // rate to KZT
  updatedAt?: string;
}

export interface FreedomSettings {
  id?: number;
  inflation: number; // e.g. 8.5 (%)
  expensePeriod: number; // 1, 3, 6, 12 months
  useInflation: boolean;
  excludeIncomplete: boolean;
  expectedPortfolioReturn?: number; // e.g. 10 (%) - Ожидаемая доходность портфеля для расчёта капитала
  trinitySWR?: number; // e.g. 4.0 (%) - Safe Withdrawal Rate по Trinity Study (правило 4%)
  calculationMethod?: 'PORTFOLIO_YIELD' | 'TRINITY_4PCT'; // Метод расчёта в виджете
}

