import React, { useState, useEffect } from 'react';
import { db } from '../db/database';
import type { 
  Transaction, 
  Category, 
  PaymentMethod, 
  ExpenseRole, 
  BudgetDestination, 
  IncomeFrequency 
} from '../types';
import { 
  X, 
  Save, 
  Calendar, 
  CreditCard, 
  Tag, 
  FileText, 
  Target, 
  Sparkles, 
  Repeat, 
  Zap, 
  CheckCircle2, 
  AlertCircle,
  Pencil,
  ShieldCheck,
  Rocket,
  Flame,
  PiggyBank,
  CalendarRange,
  Clock
} from 'lucide-react';
import { ReceiptUpload } from './ReceiptUpload';
import { ReceiptViewerModal } from './ReceiptViewerModal';
import { syncExpenseToBudget } from '../utils/budgetDestinationSync';

interface EditTransactionModalProps {
  transaction: Transaction | null;
  categories: Category[];
  methods: PaymentMethod[];
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const EditTransactionModal: React.FC<EditTransactionModalProps> = ({
  transaction,
  categories,
  methods,
  isOpen,
  onClose,
  onSaved
}) => {
  if (!isOpen || !transaction) return null;

  const [type, setType] = useState<'expense' | 'income'>(transaction.type || 'expense');
  const [amount, setAmount] = useState<string>(transaction.amount.toString());
  const [category, setCategory] = useState<string>(transaction.category);
  const [method, setMethod] = useState<string>(transaction.method);
  const [date, setDate] = useState<string>(transaction.date);
  const [note, setNote] = useState<string>(transaction.note || '');

  // Категория расхода: базовые / рост / утечки
  const [expenseRole, setExpenseRole] = useState<ExpenseRole>(transaction.expenseRole || 'basic');
  const [budgetDestination, setBudgetDestination] = useState<BudgetDestination>(transaction.budgetDestination || 'none');

  // Income attribute
  const [incomeFrequency, setIncomeFrequency] = useState<IncomeFrequency>(transaction.incomeFrequency || 'regular');

  // Receipt / Photo attachment
  const [receiptImage, setReceiptImage] = useState<string | undefined>(transaction.receiptImage);
  const [previewReceiptTx, setPreviewReceiptTx] = useState<Transaction | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Sync state when transaction changes
  useEffect(() => {
    if (transaction) {
      setType(transaction.type || 'expense');
      setAmount(transaction.amount.toString());
      setCategory(transaction.category);
      setMethod(transaction.method);
      setDate(transaction.date);
      setNote(transaction.note || '');
      setExpenseRole(transaction.expenseRole || 'basic');
      setBudgetDestination(transaction.budgetDestination || 'none');
      setIncomeFrequency(transaction.incomeFrequency || 'regular');
      setReceiptImage(transaction.receiptImage);
      setError(null);
    }
  }, [transaction]);

  // If user switches type, make sure category is valid for new type
  const handleTypeChange = (newType: 'expense' | 'income') => {
    setType(newType);
    const available = categories.filter(c => c.type === newType);
    if (available.length > 0 && !available.some(c => c.name === category)) {
      setCategory(available[0].name);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Пожалуйста, введите корректную положительную сумму');
      return;
    }

    if (!category.trim()) {
      setError('Пожалуйста, выберите категорию');
      return;
    }

    if (!method.trim()) {
      setError('Пожалуйста, выберите способ оплаты');
      return;
    }

    if (!transaction.id) {
      setError('Ошибка: ID транзакции не найден');
      return;
    }

    try {
      setIsSaving(true);

      const updatedData: Partial<Transaction> = {
        type,
        amount: numAmount,
        category: category.trim(),
        method: method.trim(),
        date,
        note: note.trim() ? note.trim() : undefined,
        receiptImage: receiptImage || undefined,
        ...(type === 'expense'
          ? {
              expenseRole,
              budgetDestination,
              incomeFrequency: undefined
            }
          : {
              incomeFrequency,
              expenseRole: undefined,
              budgetDestination: undefined
            })
      };

      await db.expenses.update(transaction.id, updatedData);

      // Если выбрано добавление в планы будущих периодов
      if (type === 'expense' && budgetDestination && budgetDestination !== 'none' && budgetDestination !== transaction.budgetDestination) {
        try {
          await syncExpenseToBudget({
            amount: numAmount,
            category: category.trim(),
            date,
            destination: budgetDestination
          });
        } catch (syncErr) {
          console.error('Ошибка синхронизации с бюджетом:', syncErr);
        }
      }

      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Не удалось сохранить изменения');
    } finally {
      setIsSaving(false);
    }
  };

  const availableCategories = React.useMemo(() => {
    const seen = new Set<string>();
    return categories
      .filter(c => c.type === type)
      .filter(c => {
        const name = (c.name || '').trim();
        if (!name || seen.has(name)) return false;
        seen.add(name);
        return true;
      });
  }, [categories, type]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
              <Pencil className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">Редактирование операции</h3>
              <p className="text-xs text-gray-500">ID #{transaction.id}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-200/60 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSave} className="overflow-y-auto p-5 space-y-4 text-left">
          {error && (
            <div className="p-3 bg-rose-50 text-rose-700 text-xs font-semibold rounded-xl border border-rose-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Type Switcher */}
          <div className="flex bg-gray-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => handleTypeChange('expense')}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                type === 'expense'
                  ? 'bg-white text-rose-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Расход
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange('income')}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                type === 'income'
                  ? 'bg-white text-emerald-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Доход
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Amount */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Сумма (₸) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm font-bold text-gray-900 focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {/* Date */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                Дата <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Category */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-gray-400" />
                Категория <span className="text-rose-500">*</span>
              </label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500"
                required
              >
                {availableCategories.map((c, idx) => (
                  <option key={c.id || `edit-cat-${c.name}-${idx}`} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Payment Method */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1">
                <CreditCard className="w-3.5 h-3.5 text-gray-400" />
                Способ оплаты <span className="text-rose-500">*</span>
              </label>
              <select
                value={method}
                onChange={e => setMethod(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500"
                required
              >
                {methods.map((m, idx) => (
                  <option key={m.id || `edit-meth-${m.name}-${idx}`} value={m.name}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Note / Comment */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-gray-400" />
              Примечание / Комментарий
            </label>
            <input
              type="text"
              placeholder="Дополнительные детали..."
              value={note}
              onChange={e => setNote(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* EXPENSE CATEGORY & FUTURE BUDGET PLAN */}
          {type === 'expense' ? (
            <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-3">
              {/* 1. Три категории расхода */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Категория расхода:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setExpenseRole('basic')}
                    className={`py-2 px-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 border ${
                      expenseRole === 'basic'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300'
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Базовые обязательства
                  </button>

                  <button
                    type="button"
                    onClick={() => setExpenseRole('growth')}
                    className={`py-2 px-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 border ${
                      expenseRole === 'growth'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-300'
                    }`}
                  >
                    <Rocket className="w-3.5 h-3.5" />
                    Инвестиции в рост
                  </button>

                  <button
                    type="button"
                    onClick={() => setExpenseRole('leak')}
                    className={`py-2 px-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 border ${
                      expenseRole === 'leak'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-rose-300'
                    }`}
                  >
                    <Flame className="w-3.5 h-3.5" />
                    Утечки (лишнее/спонтанное)
                  </button>
                </div>
              </div>

              {/* 2. Добавление статьи в планы будущих периодов */}
              <div className="pt-2 border-t border-slate-200/60">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Добавить статью расхода в план будущих периодов:
                  </label>
                  {budgetDestination !== 'none' && (
                    <button
                      type="button"
                      onClick={() => setBudgetDestination('none')}
                      className="text-[11px] text-gray-500 hover:text-rose-600 underline"
                    >
                      Не добавлять в планы
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setBudgetDestination(budgetDestination === 'monthly' ? 'none' : 'monthly')}
                    className={`p-2.5 rounded-xl text-left border transition-all flex items-center gap-2 ${
                      budgetDestination === 'monthly'
                        ? 'bg-blue-50 text-blue-900 border-blue-400 font-bold ring-1 ring-blue-400'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-blue-200'
                    }`}
                  >
                    <Calendar className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <div>
                      <div className="font-bold">Ежемесячный бюджет</div>
                      <div className="text-[10px] text-gray-500 font-normal">В план каждого будущего месяца</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBudgetDestination(budgetDestination === 'next_month' ? 'none' : 'next_month')}
                    className={`p-2.5 rounded-xl text-left border transition-all flex items-center gap-2 ${
                      budgetDestination === 'next_month'
                        ? 'bg-indigo-50 text-indigo-900 border-indigo-400 font-bold ring-1 ring-indigo-400'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-200'
                    }`}
                  >
                    <Clock className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                    <div>
                      <div className="font-bold">Бюджет след. месяца</div>
                      <div className="text-[10px] text-gray-500 font-normal">В план на +1 месяц</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBudgetDestination(budgetDestination === 'next_year' ? 'none' : 'next_year')}
                    className={`p-2.5 rounded-xl text-left border transition-all flex items-center gap-2 ${
                      budgetDestination === 'next_year'
                        ? 'bg-purple-50 text-purple-900 border-purple-400 font-bold ring-1 ring-purple-400'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-purple-200'
                    }`}
                  >
                    <CalendarRange className="w-4 h-4 text-purple-600 flex-shrink-0" />
                    <div>
                      <div className="font-bold">Бюджет месяца в след. году</div>
                      <div className="text-[10px] text-gray-500 font-normal">В план на этот месяц +1 год</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBudgetDestination(budgetDestination === 'reserve' ? 'none' : 'reserve')}
                    className={`p-2.5 rounded-xl text-left border transition-all flex items-center gap-2 ${
                      budgetDestination === 'reserve'
                        ? 'bg-amber-50 text-amber-900 border-amber-400 font-bold ring-1 ring-amber-400'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-amber-200'
                    }`}
                  >
                    <PiggyBank className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <div>
                      <div className="font-bold">Создать резерв</div>
                      <div className="text-[10px] text-gray-500 font-normal">Сумма делится на 12 частей</div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* INCOME */
            <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2">
              <label className="block text-xs font-semibold text-slate-700">
                Регулярность дохода
              </label>
              <div className="flex bg-white p-1 rounded-xl border border-slate-200 text-xs">
                <button
                  type="button"
                  onClick={() => setIncomeFrequency('regular')}
                  className={`flex-1 py-2 font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    incomeFrequency === 'regular'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Repeat className="w-3.5 h-3.5" /> Регулярный (оклад, аренда)
                </button>
                <button
                  type="button"
                  onClick={() => setIncomeFrequency('irregular')}
                  className={`flex-1 py-2 font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    incomeFrequency === 'irregular'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5" /> Нерегулярный (бонус, премия)
                </button>
              </div>
            </div>
          )}

          {/* Receipt / Photo upload */}
          <div className="pt-1">
            <ReceiptUpload
              receiptImage={receiptImage}
              onChange={setReceiptImage}
              onPreview={(img) => setPreviewReceiptTx({ ...transaction, receiptImage: img })}
              label={type === 'expense' ? 'Чек или фото расхода' : 'Квитанция или фото дохода'}
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white text-xs font-semibold rounded-xl transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              {isSaving ? 'Сохранение...' : 'Сохранить изменения'}
            </button>
          </div>
        </form>
      </div>

      {/* Full-size Receipt Viewer Modal */}
      {previewReceiptTx && (
        <ReceiptViewerModal
          transaction={previewReceiptTx}
          isOpen={!!previewReceiptTx}
          onClose={() => setPreviewReceiptTx(null)}
        />
      )}
    </div>
  );
};
