import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../db/database';
import type { 
  Transaction, 
  Category, 
  PaymentMethod, 
  ExpenseRole, 
  BudgetDestination, 
  IncomeFrequency 
} from '../types';
import { EditTransactionModal } from './EditTransactionModal';
import { syncExpenseToBudget } from '../utils/budgetDestinationSync';
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
  Image as ImageIcon,
  ShieldCheck,
  Rocket,
  Flame,
  PiggyBank,
  CalendarRange,
  Clock,
  Layers,
  BarChart3
} from 'lucide-react';
import { ReceiptUpload } from './ReceiptUpload';
import { ReceiptViewerModal } from './ReceiptViewerModal';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';

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

  // Категория расхода (3 категории)
  const [expenseRole, setExpenseRole] = useState<ExpenseRole>('basic');
  const [budgetDestination, setBudgetDestination] = useState<BudgetDestination>('none');

  // Income Attribute State
  const [incomeFrequency, setIncomeFrequency] = useState<IncomeFrequency>('regular');

  // Search & Filter State
  const [search, setSearch] = useState<string>('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('all');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('all');
  const [selectedDestinationFilter, setSelectedDestinationFilter] = useState<string>('all');
  const [selectedReceiptFilter, setSelectedReceiptFilter] = useState<string>('all');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(false);

  // Переключатель масштаба динамики на главной странице затрат (по дням / по месяцам)
  const [dynamicsGranularity, setDynamicsGranularity] = useState<'days' | 'months'>('months');

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
        setExpenseRole('basic');
      } else if (['Инвестиции', 'Обучение', 'Книги', 'Спорт'].includes(catName)) {
        setExpenseRole('growth');
      } else if (['Развлечения', 'Кафе и Рестораны', 'Одежда', 'Спонтанные покупки'].includes(catName)) {
        setExpenseRole('leak');
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
        ? { expenseRole, budgetDestination }
        : { incomeFrequency })
    };

    await db.expenses.add(newTx);

    // Автоматическое внесение статьи расхода в соответствующий бюджет (Пункт 2 ТЗ)
    if (type === 'expense') {
      try {
        await syncExpenseToBudget({
          amount: numAmount,
          category,
          date,
          destination: budgetDestination
        });
      } catch (err) {
        console.error('Ошибка синхронизации с бюджетом:', err);
      }
    }

    setAmount('');
    setNote('');
    setReceiptImage(undefined);
    setBudgetDestination('none');
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

    // Фильтры по категориям расхода и планам будущих периодов
    const matchesRole = selectedRoleFilter === 'all' || 
      (t.type === 'expense' && (t.expenseRole || 'basic') === selectedRoleFilter);

    const matchesDestination = selectedDestinationFilter === 'all' || 
      (t.type === 'expense' && (t.budgetDestination || 'none') === selectedDestinationFilter);

    const matchesReceipt = selectedReceiptFilter === 'all' ||
      (selectedReceiptFilter === 'with_receipt' && !!t.receiptImage) ||
      (selectedReceiptFilter === 'without_receipt' && !t.receiptImage);

    return matchesSearch && matchesCategory && matchesType && matchesRole && matchesDestination && matchesReceipt;
  });

  // Calculate Totals for top cards
  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpense = transactions
    .filter(t => t.type === 'expense' || !t.type)
    .reduce((sum, t) => sum + t.amount, 0);

  const netBalance = totalIncome - totalExpense;

  // -------------------------------------------------------------
  // ДИНАМИКА ДОЛИ БАЗОВЫХ ОБЯЗАТЕЛЬСТВ И ИНВЕСТИЦИЙ В РОСТ (Пункт 3 ТЗ)
  // -------------------------------------------------------------
  const dynamicsData = useMemo(() => {
    const expenseOnly = transactions.filter(t => t.type === 'expense' || !t.type);
    if (expenseOnly.length === 0) return { chartPoints: [], overallStats: { basicShare: 0, growthShare: 0, leakShare: 0, totalBasic: 0, totalGrowth: 0, totalLeak: 0, totalExp: 0 } };

    // Собираем суммы по категориям роли
    let totalBasic = 0;
    let totalGrowth = 0;
    let totalLeak = 0;

    // Группировка по ключу периода (День: YYYY-MM-DD или Месяц: YYYY-MM)
    const grouped: {
      [key: string]: {
        label: string;
        dateSort: string;
        basic: number;
        growth: number;
        leak: number;
        total: number;
      };
    } = {};

    expenseOnly.forEach(t => {
      const role = t.expenseRole || 'basic';
      const amt = t.amount || 0;

      if (role === 'basic') totalBasic += amt;
      else if (role === 'growth') totalGrowth += amt;
      else if (role === 'leak') totalLeak += amt;

      const dateStr = t.date || new Date().toISOString().split('T')[0];
      const key = dynamicsGranularity === 'days' ? dateStr : dateStr.substring(0, 7);

      if (!grouped[key]) {
        let label = key;
        if (dynamicsGranularity === 'days') {
          const parts = dateStr.split('-');
          label = `${parts[2]}.${parts[1]}`;
        } else {
          const [y, m] = key.split('-');
          const d = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
          label = d.toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' });
        }
        grouped[key] = { label, dateSort: key, basic: 0, growth: 0, leak: 0, total: 0 };
      }

      if (role === 'basic') grouped[key].basic += amt;
      else if (role === 'growth') grouped[key].growth += amt;
      else if (role === 'leak') grouped[key].leak += amt;
      grouped[key].total += amt;
    });

    const totalExp = totalBasic + totalGrowth + totalLeak;
    const overallBasicShare = totalExp > 0 ? Math.round((totalBasic / totalExp) * 1000) / 10 : 0;
    const overallGrowthShare = totalExp > 0 ? Math.round((totalGrowth / totalExp) * 1000) / 10 : 0;
    const overallLeakShare = totalExp > 0 ? Math.round((totalLeak / totalExp) * 1000) / 10 : 0;

    const chartPoints = Object.values(grouped)
      .sort((a, b) => a.dateSort.localeCompare(b.dateSort))
      .map(item => {
        const basicPercent = item.total > 0 ? Math.round((item.basic / item.total) * 1000) / 10 : 0;
        const growthPercent = item.total > 0 ? Math.round((item.growth / item.total) * 1000) / 10 : 0;
        const leakPercent = item.total > 0 ? Math.round((item.leak / item.total) * 1000) / 10 : 0;

        return {
          label: item.label,
          fullDate: item.dateSort,
          basic: item.basic,
          growth: item.growth,
          leak: item.leak,
          total: item.total,
          basicPercent,
          growthPercent,
          leakPercent
        };
      });

    return {
      chartPoints,
      overallStats: {
        basicShare: overallBasicShare,
        growthShare: overallGrowthShare,
        leakShare: overallLeakShare,
        totalBasic,
        totalGrowth,
        totalLeak,
        totalExp
      }
    };
  }, [transactions, dynamicsGranularity]);

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

      {/* 3. НОВЫЙ БЛОК: Динамика доли базовых обязательств и инвестиций в рост (за весь период) */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <BarChart3 className="w-5 h-5" />
              </div>
              <h2 className="text-base sm:text-lg font-bold text-gray-900">
                Динамика структуры расходов: Базовые обязательства и Рост
              </h2>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Отслеживание доли обязательных трат, инвестиций в будущее и утечек за весь период
            </p>
          </div>

          {/* Granularity switch: Дни / Месяцы */}
          <div className="flex items-center bg-gray-100 p-1 rounded-xl text-xs font-semibold self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setDynamicsGranularity('days')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                dynamicsGranularity === 'days'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              По дням
            </button>
            <button
              type="button"
              onClick={() => setDynamicsGranularity('months')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                dynamicsGranularity === 'months'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              По месяцам
            </button>
          </div>
        </div>

        {/* Aggregate KPI cards for the whole period */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Базовые обязательства */}
          <div className="p-3.5 rounded-xl border border-blue-200/80 bg-blue-50/40">
            <div className="flex items-center justify-between text-xs text-blue-900 font-bold mb-1">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                Базовые обязательства
              </span>
              <span className="text-blue-700 font-extrabold text-sm">
                {dynamicsData.overallStats.basicShare}%
              </span>
            </div>
            <p className="text-base sm:text-lg font-bold text-gray-900">
              {dynamicsData.overallStats.totalBasic.toLocaleString('ru-RU')} ₸
            </p>
            <div className="h-1.5 w-full bg-blue-100 rounded-full mt-2 overflow-hidden">
              <div 
                className="bg-blue-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${dynamicsData.overallStats.basicShare}%` }}
              />
            </div>
          </div>

          {/* Инвестиции в рост */}
          <div className="p-3.5 rounded-xl border border-emerald-200/80 bg-emerald-50/40">
            <div className="flex items-center justify-between text-xs text-emerald-900 font-bold mb-1">
              <span className="flex items-center gap-1.5">
                <Rocket className="w-4 h-4 text-emerald-600" />
                Инвестиции в рост
              </span>
              <span className="text-emerald-700 font-extrabold text-sm">
                {dynamicsData.overallStats.growthShare}%
              </span>
            </div>
            <p className="text-base sm:text-lg font-bold text-gray-900">
              {dynamicsData.overallStats.totalGrowth.toLocaleString('ru-RU')} ₸
            </p>
            <div className="h-1.5 w-full bg-emerald-100 rounded-full mt-2 overflow-hidden">
              <div 
                className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${dynamicsData.overallStats.growthShare}%` }}
              />
            </div>
          </div>

          {/* Утечки */}
          <div className="p-3.5 rounded-xl border border-rose-200/80 bg-rose-50/40">
            <div className="flex items-center justify-between text-xs text-rose-900 font-bold mb-1">
              <span className="flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-rose-600" />
                Утечки (спонтанные/лишние)
              </span>
              <span className="text-rose-700 font-extrabold text-sm">
                {dynamicsData.overallStats.leakShare}%
              </span>
            </div>
            <p className="text-base sm:text-lg font-bold text-gray-900">
              {dynamicsData.overallStats.totalLeak.toLocaleString('ru-RU')} ₸
            </p>
            <div className="h-1.5 w-full bg-rose-100 rounded-full mt-2 overflow-hidden">
              <div 
                className="bg-rose-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${dynamicsData.overallStats.leakShare}%` }}
              />
            </div>
          </div>
        </div>

        {/* Dynamics Area / Composed Chart */}
        {dynamicsData.chartPoints.length > 0 ? (
          <div className="pt-2">
            <div className="h-64 sm:h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={dynamicsData.chartPoints}>
                  <defs>
                    <linearGradient id="growthGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="basicGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis 
                    yAxisId="share" 
                    orientation="left" 
                    unit="%" 
                    domain={[0, 100]} 
                    tick={{ fontSize: 11 }} 
                  />
                  <YAxis 
                    yAxisId="amount" 
                    orientation="right" 
                    tick={{ fontSize: 11 }} 
                    tickFormatter={(v) => `${Math.round(v / 1000)}k`} 
                  />
                  <Tooltip
                    formatter={(val: any, name: string) => {
                      if (name.includes('Доля')) return [`${val}%`, name];
                      return [`${Number(val).toLocaleString('ru-RU')} ₸`, name];
                    }}
                    labelFormatter={(label) => `Период: ${label}`}
                  />
                  <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '11px' }} />
                  <Area
                    yAxisId="share"
                    type="monotone"
                    dataKey="basicPercent"
                    name="Доля базовых обязательств (%)"
                    stroke="#2563eb"
                    strokeWidth={2}
                    fill="url(#basicGrad)"
                  />
                  <Area
                    yAxisId="share"
                    type="monotone"
                    dataKey="growthPercent"
                    name="Доля инвестиций в рост (%)"
                    stroke="#059669"
                    strokeWidth={2.5}
                    fill="url(#growthGrad)"
                  />
                  <Line
                    yAxisId="share"
                    type="monotone"
                    dataKey="leakPercent"
                    name="Доля утечек (%)"
                    stroke="#e11d48"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={{ r: 3 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[11px] text-gray-500 text-center mt-1">
              💡 Здоровая финансовая модель: снижать долю утечек, стабильно держать базовые обязательства и максимизировать долю инвестиций в рост.
            </p>
          </div>
        ) : (
          <div className="py-8 text-center text-gray-400 text-xs border border-dashed border-gray-200 rounded-xl">
            Данные по расходам отсутствуют для построения динамики
          </div>
        )}
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

          {/* КАТЕГОРИИ РАСХОДА (Базовые обязательства / Инвестиции в рост / Утечки) */}
          {type === 'expense' ? (
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/70 space-y-4">
              {/* 1. Три категории расхода */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Категория расхода:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setExpenseRole('basic')}
                    className={`py-2 px-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 border ${
                      expenseRole === 'basic'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300'
                    }`}
                  >
                    <ShieldCheck className="w-4 h-4" />
                    Базовые обязательства
                  </button>

                  <button
                    type="button"
                    onClick={() => setExpenseRole('growth')}
                    className={`py-2 px-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 border ${
                      expenseRole === 'growth'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-300'
                    }`}
                  >
                    <Rocket className="w-4 h-4" />
                    Инвестиции в рост
                  </button>

                  <button
                    type="button"
                    onClick={() => setExpenseRole('leak')}
                    className={`py-2 px-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 border ${
                      expenseRole === 'leak'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-rose-300'
                    }`}
                  >
                    <Flame className="w-4 h-4" />
                    Утечки (лишнее/спонтанное)
                  </button>
                </div>
              </div>

              {/* 2. Добавление внесенной статьи в планы расходов будущих периодов */}
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

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setBudgetDestination(budgetDestination === 'monthly' ? 'none' : 'monthly')}
                    className={`p-2.5 rounded-xl font-medium text-left border transition-all flex flex-col gap-1 ${
                      budgetDestination === 'monthly'
                        ? 'bg-blue-50 text-blue-900 border-blue-400 ring-2 ring-blue-500/20 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-blue-200'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold">
                      <Calendar className="w-3.5 h-3.5 text-blue-600" />
                      <span>Ежемесячный бюджет</span>
                    </div>
                    <span className="text-[10px] text-gray-500">В план каждого будущего месяца</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBudgetDestination(budgetDestination === 'next_month' ? 'none' : 'next_month')}
                    className={`p-2.5 rounded-xl font-medium text-left border transition-all flex flex-col gap-1 ${
                      budgetDestination === 'next_month'
                        ? 'bg-indigo-50 text-indigo-900 border-indigo-400 ring-2 ring-indigo-500/20 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-200'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold">
                      <Clock className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Бюджет следующего месяца</span>
                    </div>
                    <span className="text-[10px] text-gray-500">В план на +1 месяц</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBudgetDestination(budgetDestination === 'next_year' ? 'none' : 'next_year')}
                    className={`p-2.5 rounded-xl font-medium text-left border transition-all flex flex-col gap-1 ${
                      budgetDestination === 'next_year'
                        ? 'bg-purple-50 text-purple-900 border-purple-400 ring-2 ring-purple-500/20 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-purple-200'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold">
                      <CalendarRange className="w-3.5 h-3.5 text-purple-600" />
                      <span>Бюджет месяца в след. году</span>
                    </div>
                    <span className="text-[10px] text-gray-500">В план на этот месяц +1 год</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBudgetDestination(budgetDestination === 'reserve' ? 'none' : 'reserve')}
                    className={`p-2.5 rounded-xl font-medium text-left border transition-all flex flex-col gap-1 ${
                      budgetDestination === 'reserve'
                        ? 'bg-amber-50 text-amber-900 border-amber-400 ring-2 ring-amber-500/20 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-amber-200'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold">
                      <PiggyBank className="w-3.5 h-3.5 text-amber-600" />
                      <span>Создать резерв</span>
                    </div>
                    <span className="text-[10px] text-gray-500">Сумма делится на 12 частей</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/70 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
                <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-600" />
                Регулярность дохода
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
            <p className="text-xs text-gray-500">Все операции с распределением по категориям</p>
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
                showAdvancedFilters || selectedRoleFilter !== 'all' || selectedDestinationFilter !== 'all'
                  ? 'bg-blue-50 text-blue-600 border-blue-200'
                  : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Фильтры
            </button>
          </div>
        </div>

        {/* Secondary attribute filter row */}
        {showAdvancedFilters && (
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs animate-fade-in">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Категория расхода:</label>
              <select
                value={selectedRoleFilter}
                onChange={e => setSelectedRoleFilter(e.target.value)}
                className="w-full p-1.5 border border-slate-200 rounded-lg bg-white text-slate-800"
              >
                <option value="all">Все (Базовые + Рост + Утечки)</option>
                <option value="basic">Базовые обязательства</option>
                <option value="growth">Инвестиции в рост</option>
                <option value="leak">Утечки (лишнее/спонтанное)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Планы будущих периодов:</label>
              <select
                value={selectedDestinationFilter}
                onChange={e => setSelectedDestinationFilter(e.target.value)}
                className="w-full p-1.5 border border-slate-200 rounded-lg bg-white text-slate-800"
              >
                <option value="all">Все записи</option>
                <option value="none">Без добавления в планы</option>
                <option value="monthly">В ежемесячный бюджет</option>
                <option value="next_month">В бюджет след. месяца</option>
                <option value="next_year">В бюджет месяца след. года</option>
                <option value="reserve">Создан резерв (12 долей)</option>
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
              const role = item.expenseRole || 'basic';
              const destination = item.budgetDestination || 'none';

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

                        {/* Категории расхода */}
                        {!isIncome ? (
                          <>
                            {role === 'basic' && (
                              <span className="text-[10px] px-2 py-0.5 rounded-md font-semibold border bg-blue-50 text-blue-700 border-blue-200 flex items-center gap-1">
                                <ShieldCheck className="w-3 h-3 text-blue-600" />
                                Базовые обязательства
                              </span>
                            )}
                            {role === 'growth' && (
                              <span className="text-[10px] px-2 py-0.5 rounded-md font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200 flex items-center gap-1">
                                <Rocket className="w-3 h-3 text-emerald-600" />
                                Инвестиции в рост
                              </span>
                            )}
                            {role === 'leak' && (
                              <span className="text-[10px] px-2 py-0.5 rounded-md font-semibold border bg-rose-50 text-rose-700 border-rose-200 flex items-center gap-1">
                                <Flame className="w-3 h-3 text-rose-600" />
                                Утечки (лишнее/спонтанное)
                              </span>
                            )}

                            {/* Бюджетное назначение badge */}
                            {destination === 'monthly' && (
                              <span className="text-[10px] px-2 py-0.5 rounded-md font-medium border bg-slate-100 text-slate-700 border-slate-200">
                                В ежемесячный бюджет
                              </span>
                            )}
                            {destination === 'next_month' && (
                              <span className="text-[10px] px-2 py-0.5 rounded-md font-medium border bg-indigo-50 text-indigo-700 border-indigo-200">
                                В бюджет след. месяца
                              </span>
                            )}
                            {destination === 'next_year' && (
                              <span className="text-[10px] px-2 py-0.5 rounded-md font-medium border bg-purple-50 text-purple-700 border-purple-200">
                                В бюджет года (+1 год)
                              </span>
                            )}
                            {destination === 'reserve' && (
                              <span className="text-[10px] px-2 py-0.5 rounded-md font-semibold border bg-amber-50 text-amber-800 border-amber-200 flex items-center gap-1">
                                <PiggyBank className="w-3 h-3 text-amber-600" />
                                Резерв (12 долей)
                              </span>
                            )}
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
