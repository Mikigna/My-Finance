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

