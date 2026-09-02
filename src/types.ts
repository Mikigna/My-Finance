export type TransactionType = 'expense' | 'income';

export type ExpenseNecessity = 'mandatory' | 'optional'; // Обязательное / Необязательное
export type ExpenseFrequency = 'regular' | 'one_off'; // Регулярное / Разовое
export type ExpensePlanning = 'planned' | 'unplanned'; // Плановое / Внеплановое

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
  // Expense attributes
  necessity?: ExpenseNecessity;
  frequency?: ExpenseFrequency;
  planning?: ExpensePlanning;
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
  expectedReturn: number; // % for target capital calculation (e.g. 10%)
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
}

