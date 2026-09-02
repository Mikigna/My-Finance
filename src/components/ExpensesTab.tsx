import React, { useState, useEffect } from 'react';
import { db } from '../db/database';
import type { 
  Transaction, 
  Category, 
  PaymentMethod, 
  ExpenseNecessity, 
  ExpenseFrequency, 
  ExpensePlanning, 
  IncomeFrequency 
} from '../types';
import { EditTransactionModal } from './EditTransactionModal';
import { 
  PlusCircle, 
  Trash2, 
  Search, 
  TrendingDown, 
  TrendingUp, 
  Wallet, 
  Calendar, 
  CreditCard, 
  Tag, 
  FileText,
  SlidersHorizontal,
  CheckCircle2,
  Sparkles,
  Repeat,
  Zap,
  Target,
  AlertCircle,
  Pencil,
  Receipt,
  Camera,
  Image as ImageIcon
} from 'lucide-react';
import { ReceiptUpload } from './ReceiptUpload';
import { ReceiptViewerModal } from './ReceiptViewerModal';

export const ExpensesTab: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);

  // Editing Modal State
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [previewViewerTx, setPreviewViewerTx] = useState<Transaction | null>(null);

  // Form State
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [amount, setAmount] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const [method, setMethod] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState<string>('');
  const [receiptImage, setReceiptImage] = useState<string | undefined>(undefined);

  // Expense Attribute States
  const [necessity, setNecessity] = useState<ExpenseNecessity>('mandatory');
  const [frequency, setFrequency] = useState<ExpenseFrequency>('one_off');
  const [planning, setPlanning] = useState<ExpensePlanning>('planned');

  // Income Attribute State
  const [incomeFrequency, setIncomeFrequency] = useState<IncomeFrequency>('regular');

  // Search & Filter State
  const [search, setSearch] = useState<string>('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('all');
  const [selectedNecessityFilter, setSelectedNecessityFilter] = useState<string>('all');
  const [selectedFrequencyFilter, setSelectedFrequencyFilter] = useState<string>('all');
  const [selectedPlanningFilter, setSelectedPlanningFilter] = useState<string>('all');
  const [selectedReceiptFilter, setSelectedReceiptFilter] = useState<string>('all');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(false);

  const loadData = async () => {
    const cats = await db.categories.toArray();
    const meths = await db.methods.toArray();
    const txs = await db.expenses.orderBy('date').reverse().toArray();

    setCategories(cats);
    setMethods(meths);
    setTransactions(txs);

    // Set default category and method for form if available
    if (cats.length > 0 && !category) {
      const filteredCat = cats.find(c => c.type === type) || cats[0];
      setCategory(filteredCat.name);
    }
    if (meths.length > 0 && !method) {
      setMethod(meths[0].name);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Update selected category and attribute defaults when type toggles
  useEffect(() => {
    const available = categories.filter(c => c.type === type);
    if (available.length > 0) {
      setCategory(available[0].name);
    }
  }, [type, categories]);

  // Suggest intelligent defaults based on chosen category
  const handleCategoryChange = (catName: string) => {
    setCategory(catName);
    if (type === 'expense') {
      if (['Жилье и КУ', 'Продукты', 'Здоровье', 'Транспорт'].includes(catName)) {
        setNecessity('mandatory');
      } else if (['Развлечения', 'Кафе и Рестораны', 'Одежда'].includes(catName)) {
        setNecessity('optional');
      }

      if (['Жилье и КУ'].includes(catName)) {
        setFrequency('regular');
      }
    } else {
      if (['Зарплата'].includes(catName)) {
        setIncomeFrequency('regular');
      } else if (['Фриланс', 'Инвестиции'].includes(catName)) {
        setIncomeFrequency('irregular');
      }
    }
  };

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      alert('Пожалуйста, введите корректную сумму');
      return;
    }
    if (!category) {
      alert('Пожалуйста, выберите категорию');
      return;
    }
    if (!method) {
      alert('Пожалуйста, выберите способ оплаты');
      return;
    }

    const newTx: Transaction = {
      amount: numAmount,
      category,
      method,
      date,
      type,
      note: note.trim() || undefined,
      receiptImage: receiptImage || undefined,
      createdAt: new Date().toISOString(),
      ...(type === 'expense'
        ? { necessity, frequency, planning }
        : { incomeFrequency })
    };

    await db.expenses.add(newTx);

    setAmount('');
    setNote('');
    setReceiptImage(undefined);
    loadData();
  };

  const handleDelete = async (id?: number) => {
    if (!id) return;
    if (confirm('Вы уверены, что хотите удалить эту запись?')) {
      await db.expenses.delete(id);
      loadData();
    }
  };

  // Filtered transactions
  const filteredTransactions = transactions.filter(t => {
    const matchesSearch = search === '' || 
      t.category.toLowerCase().includes(search.toLowerCase()) ||
      t.method.toLowerCase().includes(search.toLowerCase()) ||
      (t.note && t.note.toLowerCase().includes(search.toLowerCase()));

    const matchesCategory = selectedCategoryFilter === 'all' || t.category === selectedCategoryFilter;
    const matchesType = selectedTypeFilter === 'all' || t.type === selectedTypeFilter;

    // Attribute filters
    const matchesNecessity = selectedNecessityFilter === 'all' || 
      (t.type === 'expense' && (t.necessity || 'mandatory') === selectedNecessityFilter);

    const matchesFrequency = selectedFrequencyFilter === 'all' || 
      (t.type === 'expense' && (t.frequency || 'one_off') === selectedFrequencyFilter) ||
      (t.type === 'income' && (t.incomeFrequency || 'regular') === selectedFrequencyFilter);

    const matchesPlanning = selectedPlanningFilter === 'all' || 
      (t.type === 'expense' && (t.planning || 'planned') === selectedPlanningFilter);

    const matchesReceipt = selectedReceiptFilter === 'all' ||
      (selectedReceiptFilter === 'with_receipt' && !!t.receiptImage) ||
      (selectedReceiptFilter === 'without_receipt' && !t.receiptImage);

    return matchesSearch && matchesCategory && matchesType && matchesNecessity && matchesFrequency && matchesPlanning && matchesReceipt;
  });

  // Calculate Totals
  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpense = transactions
    .filter(t => t.type === 'expense' || !t.type)
    .reduce((sum, t) => sum + t.amount, 0);

  const netBalance = totalIncome - totalExpense;

  return (
    <div className="space-y-6">
      {/* Overview Balance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Баланс</p>
            <p className={`text-2xl font-bold mt-1 ${netBalance >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
              {netBalance.toLocaleString('ru-RU')} ₸
            </p>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Wallet className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Доходы</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">
              +{totalIncome.toLocaleString('ru-RU')} ₸
            </p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Расходы</p>
            <p className="text-2xl font-bold text-rose-600 mt-1">
              -{totalExpense.toLocaleString('ru-RU')} ₸
            </p>
          </div>
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
            <TrendingDown className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Add Transaction Form */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <PlusCircle className="w-5 h-5 text-blue-600" />
          Добавить транзакцию
        </h2>

        <form onSubmit={handleAddTransaction} className="space-y-4">
          {/* Type Switcher */}
          <div className="flex bg-gray-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setType('expense')}
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
              onClick={() => setType('income')}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                type === 'income'
                  ? 'bg-white text-emerald-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Доход
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Amount */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Сумма (₸)</label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 font-semibold"
                required
              />
            </div>

            {/* Date */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                Дата
              </label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                required
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-gray-400" />
                Категория
              </label>
              <select
                value={category}
                onChange={e => handleCategoryChange(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                required
              >
                {categories
                  .filter(c => c.type === type)
                  .map((c, idx) => (
                    <option key={c.id || `cat-${c.name}-${idx}`} value={c.name}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </div>

            {/* Payment Method */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1">
                <CreditCard className="w-3.5 h-3.5 text-gray-400" />
                Способ оплаты
              </label>
              <select
                value={method}
                onChange={e => setMethod(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                required
              >
                {methods.map((m, idx) => (
                  <option key={m.id || `meth-${m.name}-${idx}`} value={m.name}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* ATTRIBUTES SECTION */}
          {type === 'expense' ? (
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/70 space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
                <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
                Признаки расхода
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* 1. Обязательное / Необязательное */}
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1.5">
                    Обязательность
                  </label>
                  <div className="grid grid-cols-2 gap-1 bg-white p-1 rounded-lg border border-slate-200 text-xs">
                    <button
                      type="button"
                      onClick={() => setNecessity('mandatory')}
                      className={`py-1.5 px-2 rounded-md font-medium text-center transition-all ${
                        necessity === 'mandatory'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Обязательное
                    </button>
                    <button
                      type="button"
                      onClick={() => setNecessity('optional')}
                      className={`py-1.5 px-2 rounded-md font-medium text-center transition-all ${
                        necessity === 'optional'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Необязательное
                    </button>
                  </div>
                </div>

                {/* 2. Регулярное / Разовое */}
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1.5">
                    Регулярность
                  </label>
                  <div className="grid grid-cols-2 gap-1 bg-white p-1 rounded-lg border border-slate-200 text-xs">
                    <button
                      type="button"
                      onClick={() => setFrequency('regular')}
                      className={`py-1.5 px-2 rounded-md font-medium text-center transition-all flex items-center justify-center gap-1 ${
                        frequency === 'regular'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Repeat className="w-3 h-3" /> Регулярное
                    </button>
                    <button
                      type="button"
                      onClick={() => setFrequency('one_off')}
                      className={`py-1.5 px-2 rounded-md font-medium text-center transition-all flex items-center justify-center gap-1 ${
                        frequency === 'one_off'
                          ? 'bg-slate-700 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Zap className="w-3 h-3" /> Разовое
                    </button>
                  </div>
                </div>

                {/* 3. Плановое / Внеплановое */}
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1.5">
                    Плановость
                  </label>
                  <div className="grid grid-cols-2 gap-1 bg-white p-1 rounded-lg border border-slate-200 text-xs">
                    <button
                      type="button"
                      onClick={() => setPlanning('planned')}
                      className={`py-1.5 px-2 rounded-md font-medium text-center transition-all flex items-center justify-center gap-1 ${
                        planning === 'planned'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Target className="w-3 h-3" /> Плановое
                    </button>
                    <button
                      type="button"
                      onClick={() => setPlanning('unplanned')}
                      className={`py-1.5 px-2 rounded-md font-medium text-center transition-all flex items-center justify-center gap-1 ${
                        planning === 'unplanned'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <AlertCircle className="w-3 h-3" /> Внеплановое
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/70 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
                <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-600" />
                Признак дохода
              </div>

              <div className="max-w-xs">
                <label className="block text-[11px] font-medium text-slate-600 mb-1.5">
                  Регулярность дохода
                </label>
                <div className="grid grid-cols-2 gap-1 bg-white p-1 rounded-lg border border-slate-200 text-xs">
                  <button
                    type="button"
                    onClick={() => setIncomeFrequency('regular')}
                    className={`py-1.5 px-2 rounded-md font-medium text-center transition-all flex items-center justify-center gap-1 ${
                      incomeFrequency === 'regular'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Repeat className="w-3 h-3" /> Регулярный
                  </button>
                  <button
                    type="button"
                    onClick={() => setIncomeFrequency('irregular')}
                    className={`py-1.5 px-2 rounded-md font-medium text-center transition-all flex items-center justify-center gap-1 ${
                      incomeFrequency === 'irregular'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Zap className="w-3 h-3" /> Нерегулярный
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Note / Comment */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-gray-400" />
              Заметка (необязательно)
            </label>
            <input
              type="text"
              placeholder="Комментарий или описание..."
              value={note}
              onChange={e => setNote(e.target.value)}
              className="w-full px-3.5 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm text-gray-900"
            />
          </div>

          {/* Receipt / Photo upload */}
          <ReceiptUpload
            receiptImage={receiptImage}
            onChange={setReceiptImage}
            onPreview={(img) => setPreviewViewerTx({ 
              amount: parseFloat(amount) || 0,
              category: category || 'Расход',
              method: method || 'Оплата',
              date,
              type,
              note,
              receiptImage: img
            })}
            label={type === 'expense' ? 'Прикрепить чек или фото расхода' : 'Прикрепить квитанцию или фото'}
          />

          <button
            type="submit"
            className={`w-full py-3 rounded-xl font-bold text-white transition-all shadow-md active:scale-[0.99] ${
              type === 'expense'
                ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-100'
                : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100'
            }`}
          >
            {type === 'expense' ? 'Сохранить расход' : 'Сохранить доход'}
          </button>
        </form>
      </div>

      {/* Transactions List */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">История транзакций ({filteredTransactions.length})</h2>
            <p className="text-xs text-gray-500">Все операции с классификацией по признакам</p>
          </div>

          {/* Main Search & Filters */}
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[150px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Поиск..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <select
              value={selectedTypeFilter}
              onChange={e => setSelectedTypeFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg bg-white text-gray-700"
            >
              <option value="all">Все типы</option>
              <option value="expense">Расходы</option>
              <option value="income">Доходы</option>
            </select>

            <select
              value={selectedCategoryFilter}
              onChange={e => setSelectedCategoryFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg bg-white text-gray-700"
            >
              <option value="all">Все категории</option>
              {categories.map((c, idx) => (
                <option key={c.id || `filter-cat-${c.name}-${idx}`} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-colors flex items-center gap-1 ${
                showAdvancedFilters || selectedNecessityFilter !== 'all' || selectedFrequencyFilter !== 'all' || selectedPlanningFilter !== 'all'
                  ? 'bg-blue-50 text-blue-600 border-blue-200'
                  : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Фильтр признаков
            </button>
          </div>
        </div>

        {/* Secondary attribute filter row */}
        {showAdvancedFilters && (
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs animate-fade-in">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Обязательность:</label>
              <select
                value={selectedNecessityFilter}
                onChange={e => setSelectedNecessityFilter(e.target.value)}
                className="w-full p-1.5 border border-slate-200 rounded-lg bg-white text-slate-800"
              >
                <option value="all">Все (Обяз. + Необяз.)</option>
                <option value="mandatory">Только обязательные</option>
                <option value="optional">Только необязательные</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Регулярность:</label>
              <select
                value={selectedFrequencyFilter}
                onChange={e => setSelectedFrequencyFilter(e.target.value)}
                className="w-full p-1.5 border border-slate-200 rounded-lg bg-white text-slate-800"
              >
                <option value="all">Все (Регулярные + Разовые)</option>
                <option value="regular">Только регулярные</option>
                <option value="one_off">Только разовые (расходы)</option>
                <option value="irregular">Только нерегулярные (доходы)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Плановость:</label>
              <select
                value={selectedPlanningFilter}
                onChange={e => setSelectedPlanningFilter(e.target.value)}
                className="w-full p-1.5 border border-slate-200 rounded-lg bg-white text-slate-800"
              >
                <option value="all">Все (Плановые + Внеплановые)</option>
                <option value="planned">Только плановые</option>
                <option value="unplanned">Только внеплановые</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Наличие чека / фото:</label>
              <select
                value={selectedReceiptFilter}
                onChange={e => setSelectedReceiptFilter(e.target.value)}
                className="w-full p-1.5 border border-slate-200 rounded-lg bg-white text-slate-800"
              >
                <option value="all">Все операции</option>
                <option value="with_receipt">С фото / чеком</option>
                <option value="without_receipt">Без фото / чека</option>
              </select>
            </div>
          </div>
        )}

        {/* List items */}
        {filteredTransactions.length === 0 ? (
          <div className="text-center py-10 border-2 border-dashed border-gray-100 rounded-xl">
            <p className="text-gray-400 text-sm">Транзакций не найдено</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredTransactions.map(item => {
              const isIncome = item.type === 'income';
              const isMandatory = (item.necessity || 'mandatory') === 'mandatory';
              const isRegular = item.frequency === 'regular' || item.incomeFrequency === 'regular';
              const isPlanned = (item.planning || 'planned') === 'planned';

              return (
                <div
                  key={item.id}
                  className="p-3.5 rounded-xl border border-gray-100 hover:border-gray-200 bg-white transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                >
                  <div className="flex items-start sm:items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center text-sm font-bold ${
                        isIncome ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                      }`}
                    >
                      {isIncome ? '+' : '-'}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-semibold text-gray-900 text-sm">{item.category}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">
                          {item.method}
                        </span>

                        {/* Attribute Badges */}
                        {!isIncome ? (
                          <>
                            {/* Necessity badge */}
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-md font-semibold border ${
                                isMandatory
                                  ? 'bg-blue-50 text-blue-700 border-blue-200/60'
                                  : 'bg-indigo-50 text-indigo-700 border-indigo-200/60'
                              }`}
                            >
                              {isMandatory ? 'Обязательное' : 'Необязательное'}
                            </span>

                            {/* Frequency badge */}
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-md font-medium border ${
                                item.frequency === 'regular'
                                  ? 'bg-slate-100 text-slate-700 border-slate-200'
                                  : 'bg-zinc-50 text-zinc-600 border-zinc-200'
                              }`}
                            >
                              {item.frequency === 'regular' ? 'Регулярное' : 'Разовое'}
                            </span>

                            {/* Planning badge */}
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-md font-semibold border ${
                                isPlanned
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60'
                                  : 'bg-amber-50 text-amber-800 border-amber-200'
                              }`}
                            >
                              {isPlanned ? 'Плановое' : 'Внеплановое'}
                            </span>
                          </>
                        ) : (
                          <>
                            {/* Income frequency badge */}
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-md font-semibold border ${
                                item.incomeFrequency === 'regular' || !item.incomeFrequency
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60'
                                  : 'bg-purple-50 text-purple-700 border-purple-200/60'
                              }`}
                            >
                              {item.incomeFrequency === 'regular' || !item.incomeFrequency
                                ? 'Регулярный'
                                : 'Нерегулярный'}
                            </span>
                          </>
                        )}

                        {/* Receipt / Photo Badge */}
                        {item.receiptImage && (
                          <button
                            type="button"
                            onClick={() => setPreviewViewerTx(item)}
                            className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200/80 transition-all shadow-2xs hover:scale-105 active:scale-95"
                            title="Посмотреть прикрепленный чек"
                          >
                            <Receipt className="w-3 h-3 text-blue-600" />
                            Чек
                          </button>
                        )}
                      </div>

                      <div className="text-xs text-gray-400 mt-1 flex flex-wrap items-center gap-2">
                        <span>{item.date}</span>
                        {item.note && <span className="text-gray-500 italic">• {item.note}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-50">
                    {/* Thumbnail if receipt attached */}
                    {item.receiptImage && (
                      <div
                        onClick={() => setPreviewViewerTx(item)}
                        className="relative w-8 h-8 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 flex-shrink-0 cursor-pointer hover:opacity-85 transition-opacity"
                        title="Нажмите для просмотра чека"
                      >
                        <img
                          src={item.receiptImage}
                          alt="Чек"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}

                    <span
                      className={`font-bold text-sm sm:text-base ${
                        isIncome ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {isIncome ? '+' : '-'}{item.amount.toLocaleString('ru-RU')} ₸
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setEditingTransaction(item)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Редактировать операцию"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Удалить"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit Transaction Modal */}
      <EditTransactionModal
        transaction={editingTransaction}
        categories={categories}
        methods={methods}
        isOpen={!!editingTransaction}
        onClose={() => setEditingTransaction(null)}
        onSaved={loadData}
      />

      {/* Full-screen / Modal Receipt Viewer */}
      {previewViewerTx && (
        <ReceiptViewerModal
          transaction={previewViewerTx}
          isOpen={!!previewViewerTx}
          onClose={() => setPreviewViewerTx(null)}
        />
      )}
    </div>
  );
};
