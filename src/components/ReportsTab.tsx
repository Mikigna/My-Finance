import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../db/database';
import type { Transaction, Category } from '../types';
import { 
  Download, 
  Calendar, 
  PieChart as PieIcon, 
  BarChart3, 
  TrendingUp, 
  TrendingDown,
  SlidersHorizontal,
  ShieldCheck,
  Zap,
  Target,
  Sparkles,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Filter
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  LineChart,
  Line,
  ComposedChart,
  Area
} from 'recharts';
import { Rocket, Flame, PiggyBank, CalendarRange, Clock } from 'lucide-react';

const COLOR_PALETTE = [
  '#ef4444', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899', 
  '#f59e0b', '#06b6d4', '#64748b', '#84cc16', '#6366f1'
];

export const ReportsTab: React.FC = () => {
  const [expenses, setExpenses] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  
  // Date filters
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

  const [startDate, setStartDate] = useState<string>(firstDayOfMonth);
  const [endDate, setEndDate] = useState<string>(lastDayOfMonth);

  // Category dynamics state
  const [dynamicsType, setDynamicsType] = useState<'expense' | 'income'>('expense');
  const [dynamicsCategory, setDynamicsCategory] = useState<string>('Продукты');

  const loadData = async () => {
    const txs = await db.expenses.orderBy('date').toArray();
    const cats = await db.categories.toArray();
    setExpenses(txs);
    setCategories(cats);

    // Set default category if available
    const initialCat = cats.find(c => c.type === 'expense');
    if (initialCat) {
      setDynamicsCategory(initialCat.name);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Update selected category when dynamics type changes
  useEffect(() => {
    const matching = categories.filter(c => c.type === dynamicsType);
    if (matching.length > 0 && !matching.some(c => c.name === dynamicsCategory)) {
      setDynamicsCategory(matching[0].name);
    }
  }, [dynamicsType, categories]);

  // Quick Preset Handlers
  const handlePresetMonth = () => {
    setStartDate(firstDayOfMonth);
    setEndDate(lastDayOfMonth);
  };

  const handlePresetAll = () => {
    setStartDate('');
    setEndDate('');
  };

  const handlePresetLast30 = () => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 30);
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  // Filtered dataset for primary report
  const filteredTxs = expenses.filter(e => {
    if (startDate && e.date < startDate) return false;
    if (endDate && e.date > endDate) return false;
    return true;
  });

  const expenseTxs = filteredTxs.filter(t => t.type === 'expense' || !t.type);
  const incomeTxs = filteredTxs.filter(t => t.type === 'income');

  // Calculate totals for selected period
  const totalExpense = expenseTxs.reduce((sum, t) => sum + t.amount, 0);
  const totalIncome = incomeTxs.reduce((sum, t) => sum + t.amount, 0);
  const netBalancePeriod = totalIncome - totalExpense;

  // 1. Категории расходов: Базовые обязательства / Инвестиции в рост / Утечки (лишнее/спонтанное)
  const basicExpense = expenseTxs
    .filter(t => (t.expenseRole || 'basic') === 'basic')
    .reduce((sum, t) => sum + t.amount, 0);
  const growthExpense = expenseTxs
    .filter(t => t.expenseRole === 'growth')
    .reduce((sum, t) => sum + t.amount, 0);
  const leakExpense = expenseTxs
    .filter(t => t.expenseRole === 'leak')
    .reduce((sum, t) => sum + t.amount, 0);

  const basicPercent = totalExpense > 0 ? ((basicExpense / totalExpense) * 100).toFixed(1) : '0';
  const growthPercent = totalExpense > 0 ? ((growthExpense / totalExpense) * 100).toFixed(1) : '0';
  const leakPercent = totalExpense > 0 ? ((leakExpense / totalExpense) * 100).toFixed(1) : '0';

  // 2. Добавление статьи расхода в планы будущих периодов
  const monthlyDestExpense = expenseTxs
    .filter(t => t.budgetDestination === 'monthly')
    .reduce((sum, t) => sum + t.amount, 0);
  const nextMonthDestExpense = expenseTxs
    .filter(t => t.budgetDestination === 'next_month')
    .reduce((sum, t) => sum + t.amount, 0);
  const nextYearDestExpense = expenseTxs
    .filter(t => t.budgetDestination === 'next_year')
    .reduce((sum, t) => sum + t.amount, 0);
  const reserveDestExpense = expenseTxs
    .filter(t => t.budgetDestination === 'reserve')
    .reduce((sum, t) => sum + t.amount, 0);

  // 3. Regular vs Irregular Incomes
  const regularIncome = incomeTxs
    .filter(t => (t.incomeFrequency || 'regular') === 'regular')
    .reduce((sum, t) => sum + t.amount, 0);
  const irregularIncome = incomeTxs
    .filter(t => t.incomeFrequency === 'irregular')
    .reduce((sum, t) => sum + t.amount, 0);

  const regularIncomePercent = totalIncome > 0 ? ((regularIncome / totalIncome) * 100).toFixed(1) : '0';
  const irregularIncomePercent = totalIncome > 0 ? ((irregularIncome / totalIncome) * 100).toFixed(1) : '0';

  // Group by Category for Expenses Pie Chart
  const categoryMap: { [key: string]: number } = {};
  expenseTxs.forEach(t => {
    categoryMap[t.category] = (categoryMap[t.category] || 0) + t.amount;
  });

  const categoryChartData = Object.keys(categoryMap).map(catName => ({
    name: catName,
    value: categoryMap[catName]
  })).sort((a, b) => b.value - a.value);

  // -------------------------------------------------------------
  // ДИНАМИКА БАЛАНСА, ДОХОДОВ И РАСХОДОВ ПО МЕСЯЦАМ (Пункт 4 ТЗ)
  // -------------------------------------------------------------
  const monthlyFinancialDynamics = useMemo(() => {
    const allMonthsSet = new Set<string>();
    expenses.forEach(t => {
      if (t.date) allMonthsSet.add(t.date.substring(0, 7));
    });

    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    allMonthsSet.add(currentMonthKey);

    const sortedMonths = Array.from(allMonthsSet).sort();

    return sortedMonths.map(mKey => {
      const monthTxs = expenses.filter(t => t.date && t.date.startsWith(mKey));
      const inc = monthTxs.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
      const exp = monthTxs.filter(t => t.type === 'expense' || !t.type).reduce((sum, t) => sum + t.amount, 0);
      const bal = inc - exp;

      const [y, m] = mKey.split('-');
      const d = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
      const monthLabel = d.toLocaleDateString('ru-RU', { month: 'short', year: 'numeric' });

      return {
        monthKey: mKey,
        monthLabel,
        income: inc,
        expense: exp,
        balance: bal
      };
    });
  }, [expenses, now]);

  // Group by Date/Month for Bar Chart within selected period
  const monthMap: { [key: string]: { month: string; income: number; expense: number } } = {};
  filteredTxs.forEach(t => {
    const monthKey = t.date.substring(0, 7); // YYYY-MM
    if (!monthMap[monthKey]) {
      monthMap[monthKey] = { month: monthKey, income: 0, expense: 0 };
    }
    if (t.type === 'income') {
      monthMap[monthKey].income += t.amount;
    } else {
      monthMap[monthKey].expense += t.amount;
    }
  });

  const monthlyChartData = Object.values(monthMap).sort((a, b) => a.month.localeCompare(b.month));

  // --- DYNAMICS ACROSS ALL MONTHS FOR CHOSEN CATEGORY ---
  const { categoryMonthlyData, categoryStats } = useMemo(() => {
    // Collect all months present in entire database
    const allMonthsSet = new Set<string>();
    expenses.forEach(t => {
      if (t.date) allMonthsSet.add(t.date.substring(0, 7));
    });

    // If fewer than 4 months, include some surrounding months for rich visualization
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    allMonthsSet.add(currentMonthKey);

    const sortedMonths = Array.from(allMonthsSet).sort();

    // Calculate sum per month for the selected category
    let totalCatAmount = 0;
    let maxAmount = 0;
    let minAmount = Infinity;
    let activeMonthsCount = 0;

    const data = sortedMonths.map((mKey, idx) => {
      const monthTxs = expenses.filter(t => 
        t.date.startsWith(mKey) && 
        t.type === dynamicsType && 
        (dynamicsCategory === 'all' || t.category === dynamicsCategory)
      );

      const amount = monthTxs.reduce((sum, t) => sum + t.amount, 0);
      const totalTypeMonth = expenses
        .filter(t => t.date.startsWith(mKey) && t.type === dynamicsType)
        .reduce((sum, t) => sum + t.amount, 0);

      const sharePercent = totalTypeMonth > 0 ? ((amount / totalTypeMonth) * 100).toFixed(1) : '0';

      if (amount > 0) {
        totalCatAmount += amount;
        activeMonthsCount += 1;
        if (amount > maxAmount) maxAmount = amount;
        if (amount < minAmount) minAmount = amount;
      }

      // Format Month Name in Russian (e.g., Авг 2026)
      const [yStr, mStr] = mKey.split('-');
      const d = new Date(parseInt(yStr, 10), parseInt(mStr, 10) - 1, 1);
      const monthLabel = d.toLocaleDateString('ru-RU', { month: 'short', year: 'numeric' });

      return {
        monthKey: mKey,
        monthLabel: monthLabel,
        amount: amount,
        sharePercent: parseFloat(sharePercent)
      };
    });

    const avgAmount = activeMonthsCount > 0 ? Math.round(totalCatAmount / activeMonthsCount) : 0;
    if (minAmount === Infinity) minAmount = 0;

    // Previous vs Last month change
    const lastTwo = data.filter(d => d.amount > 0);
    let changeDiff = 0;
    let changePercent = 0;
    if (lastTwo.length >= 2) {
      const currentVal = lastTwo[lastTwo.length - 1].amount;
      const prevVal = lastTwo[lastTwo.length - 2].amount;
      changeDiff = currentVal - prevVal;
      changePercent = prevVal > 0 ? Math.round(((currentVal - prevVal) / prevVal) * 100) : 0;
    }

    return {
      categoryMonthlyData: data,
      categoryStats: {
        total: totalCatAmount,
        average: avgAmount,
        max: maxAmount,
        min: minAmount,
        changeDiff,
        changePercent
      }
    };
  }, [expenses, dynamicsType, dynamicsCategory, now]);

  // CSV Export logic with all updated categories and plans included
  const exportCSV = () => {
    let csv = "\uFEFFДата;Тип;Категория;Способ оплаты;Сумма;Категория расхода;План будущих периодов;Регулярность дохода;Заметка\n";
    filteredTxs.forEach(e => {
      const isInc = e.type === 'income';
      const typeLabel = isInc ? 'Доход' : 'Расход';
      
      let roleLabel = '';
      let destLabel = '';
      let incomeFreqLabel = '';

      if (!isInc) {
        const role = e.expenseRole || 'basic';
        roleLabel = role === 'basic' ? 'Базовые обязательства' : role === 'growth' ? 'Инвестиции в рост' : 'Утечки (лишнее/спонтанное)';
        
        const dest = e.budgetDestination || 'none';
        destLabel = dest === 'monthly' ? 'Ежемесячный бюджет' : dest === 'next_month' ? 'Бюджет след. месяца' : dest === 'next_year' ? 'Бюджет след. года' : dest === 'reserve' ? 'Резерв (12 долей)' : 'Не добавлялся';
      } else {
        incomeFreqLabel = (e.incomeFrequency || 'regular') === 'regular' ? 'Регулярный' : 'Нерегулярный';
      }

      const noteClean = e.note ? e.note.replace(/;/g, ',') : '';
      csv += `${e.date};${typeLabel};${e.category};${e.method};${e.amount};${roleLabel};${destLabel};${incomeFreqLabel};${noteClean}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Отчет_Финансы_${new Date().toLocaleDateString('ru-RU')}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Date Range Selector Bar */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            Период отчета
          </h2>

          {/* Preset Buttons */}
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={handlePresetMonth}
              className="px-3 py-1.5 text-xs font-semibold bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
            >
              Текущий месяц
            </button>
            <button
              onClick={handlePresetLast30}
              className="px-3 py-1.5 text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
            >
              За 30 дней
            </button>
            <button
              onClick={handlePresetAll}
              className="px-3 py-1.5 text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Все время
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">С даты</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">По дату</label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-sm"
            />
          </div>
        </div>
      </div>

      {/* 4. НОВЫЙ БЛОК: ПОКАЗАТЕЛИ БАЛАНСА, ДОХОДОВ И РАСХОДОВ В ДИНАМИКЕ ПО МЕСЯЦАМ */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-600" />
              Финансовые показатели в динамике по месяцам
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Сравнение доходов, расходов и чистого баланса помесячно с трендами и дельтой
            </p>
          </div>

          <div className="text-xs text-gray-500 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
            Охват: <strong>{monthlyFinancialDynamics.length} мес.</strong>
          </div>
        </div>

        {/* Dynamic Monthly Bar & Line Composed Chart */}
        <div className="h-72 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={monthlyFinancialDynamics}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="monthLabel" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(val) => `${Math.round(val / 1000)}k`} />
              <Tooltip
                formatter={(val: number, name: string) => [`${val.toLocaleString('ru-RU')} ₸`, name]}
                labelFormatter={(label) => `Месяц: ${label}`}
              />
              <Legend verticalAlign="top" height={34} wrapperStyle={{ fontSize: '12px' }} />
              <Bar dataKey="income" name="Доходы" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expense" name="Расходы" fill="#ef4444" radius={[4, 4, 0, 0]} />
              <Line
                type="monotone"
                dataKey="balance"
                name="Чистый баланс (Сальдо)"
                stroke="#3b82f6"
                strokeWidth={3}
                dot={{ r: 4, fill: '#3b82f6' }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Monthly Summary Cards Grid (помесячная раскладка) */}
        <div className="pt-2">
          <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2.5">
            Показатели по каждому месяцу:
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {monthlyFinancialDynamics.map((m, idx) => {
              const prev = idx > 0 ? monthlyFinancialDynamics[idx - 1] : null;
              const balanceDiff = prev ? m.balance - prev.balance : 0;

              return (
                <div
                  key={m.monthKey}
                  className="p-3.5 bg-slate-50/70 hover:bg-slate-50 rounded-xl border border-slate-200/90 transition-all space-y-2"
                >
                  <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                    <span className="font-bold text-gray-900 text-sm capitalize">{m.monthLabel}</span>
                    <span
                      className={`text-xs font-extrabold px-2 py-0.5 rounded-lg border ${
                        m.balance >= 0
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}
                    >
                      {m.balance >= 0 ? `+${m.balance.toLocaleString('ru-RU')}` : m.balance.toLocaleString('ru-RU')} ₸
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-[11px] text-gray-500">Доходы</p>
                      <p className="font-bold text-emerald-600 mt-0.5">+{m.income.toLocaleString('ru-RU')} ₸</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-gray-500">Расходы</p>
                      <p className="font-bold text-rose-600 mt-0.5">-{m.expense.toLocaleString('ru-RU')} ₸</p>
                    </div>
                  </div>

                  {prev && (
                    <div className="text-[10px] text-gray-500 pt-1 border-t border-slate-200/50 flex items-center justify-between">
                      <span>Динамика к пред. мес.:</span>
                      <span className={`font-semibold ${balanceDiff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {balanceDiff >= 0 ? `+${balanceDiff.toLocaleString('ru-RU')}` : balanceDiff.toLocaleString('ru-RU')} ₸
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 5. NEW: DYNAMICS OF INCOMES & EXPENSES BY CATEGORY OVER MONTHS */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-600" />
              Динамика доходов и расходов по категориям по месяцам
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Помесячный тренд, сезонность и сравнение трат (например, «Продукты», «Транспорт» по месяцам)
            </p>
          </div>

          {/* Filter Controls for Category Dynamics */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Type selector */}
            <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setDynamicsType('expense')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  dynamicsType === 'expense'
                    ? 'bg-white text-rose-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Расходы
              </button>
              <button
                type="button"
                onClick={() => setDynamicsType('income')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  dynamicsType === 'income'
                    ? 'bg-white text-emerald-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Доходы
              </button>
            </div>

            {/* Category Dropdown */}
            <select
              value={dynamicsCategory}
              onChange={e => setDynamicsCategory(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-xl bg-white text-xs font-bold text-gray-800 focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Все категории суммарно</option>
              {categories
                .filter(c => c.type === dynamicsType)
                .map((c, idx) => (
                  <option key={c.id || `${c.name}-${idx}`} value={c.name}>
                    {c.name}
                  </option>
                ))}
            </select>
          </div>
        </div>

        {/* Dynamics KPI Summary Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
              Всего за все месяцы
            </span>
            <p className="text-base font-bold text-gray-900 mt-0.5">
              {categoryStats.total.toLocaleString('ru-RU')} ₸
            </p>
          </div>

          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
              Среднемесячный уровень
            </span>
            <p className="text-base font-bold text-blue-700 mt-0.5">
              {categoryStats.average.toLocaleString('ru-RU')} ₸ / мес
            </p>
          </div>

          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
              Пиковый месяц (максимум)
            </span>
            <p className="text-base font-bold text-rose-600 mt-0.5">
              {categoryStats.max.toLocaleString('ru-RU')} ₸
            </p>
          </div>

          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
              Динамика к пред. месяцу
            </span>
            <div className="flex items-center gap-1 mt-0.5">
              {categoryStats.changeDiff > 0 ? (
                <span className="text-xs font-bold text-rose-600 flex items-center">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  +{categoryStats.changePercent}% (+{categoryStats.changeDiff.toLocaleString('ru-RU')} ₸)
                </span>
              ) : categoryStats.changeDiff < 0 ? (
                <span className="text-xs font-bold text-emerald-600 flex items-center">
                  <ArrowDownRight className="w-3.5 h-3.5" />
                  {categoryStats.changePercent}% ({categoryStats.changeDiff.toLocaleString('ru-RU')} ₸)
                </span>
              ) : (
                <span className="text-xs font-bold text-gray-500">Без изменений</span>
              )}
            </div>
          </div>
        </div>

        {/* Monthly Dynamics Chart */}
        <div className="h-72 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={categoryMonthlyData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="monthLabel" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(val: number) => [`${val.toLocaleString('ru-RU')} ₸`, 'Сумма']}
                labelFormatter={(label) => `Период: ${label}`}
              />
              <Legend verticalAlign="top" height={32} wrapperStyle={{ fontSize: '12px' }} />
              <Bar
                dataKey="amount"
                name={`Сумма (${dynamicsCategory})`}
                fill={dynamicsType === 'expense' ? '#ef4444' : '#10b981'}
                radius={[6, 6, 0, 0]}
              />
              <Line
                type="monotone"
                dataKey="amount"
                name="Линия тренда"
                stroke={dynamicsType === 'expense' ? '#b91c1c' : '#047857'}
                strokeWidth={2.5}
                dot={{ r: 3 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Monthly Breakdown Data Table */}
        <div className="pt-2">
          <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
            Таблица динамики по месяцам: {dynamicsCategory}
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500 font-semibold bg-gray-50/50">
                  <th className="py-2.5 px-3">Месяц</th>
                  <th className="py-2.5 px-3">Сумма за месяц</th>
                  <th className="py-2.5 px-3">Доля от всех {dynamicsType === 'expense' ? 'расходов' : 'доходов'}</th>
                  <th className="py-2.5 px-3 text-right">Отклонение от среднего</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {categoryMonthlyData.map(row => {
                  const diffFromAvg = row.amount - categoryStats.average;
                  return (
                    <tr key={row.monthKey} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-3 font-semibold text-gray-900">{row.monthLabel}</td>
                      <td className="py-2.5 px-3 font-bold text-gray-800">{row.amount.toLocaleString('ru-RU')} ₸</td>
                      <td className="py-2.5 px-3 font-medium text-gray-600">{row.sharePercent}%</td>
                      <td className="py-2.5 px-3 text-right">
                        {row.amount > 0 ? (
                          <span className={`font-semibold ${diffFromAvg > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {diffFromAvg > 0 ? `+${diffFromAvg.toLocaleString('ru-RU')}` : diffFromAvg.toLocaleString('ru-RU')} ₸
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* DETAILED CATEGORIES & FUTURE PLANS ANALYTICS SECTION */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-blue-600" />
            Структура расходов и планы будущих периодов
          </h3>
          <span className="text-xs text-gray-400 font-medium hidden sm:inline">За выбранный период отчета</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 1. Категории расходов: Базовые / Рост / Утечки */}
          <div className="p-4 rounded-xl border border-blue-100 bg-blue-50/30 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                Категории расходов
              </span>
              <span className="text-xs font-semibold text-blue-700">{basicPercent}% базовые</span>
            </div>

            {/* Tri-color progress bar */}
            <div className="h-2.5 w-full bg-slate-200 rounded-full overflow-hidden flex">
              <div 
                className="bg-blue-600 h-full transition-all duration-500" 
                style={{ width: `${basicPercent}%` }}
                title={`Базовые: ${basicPercent}%`}
              />
              <div 
                className="bg-emerald-500 h-full transition-all duration-500" 
                style={{ width: `${growthPercent}%` }}
                title={`Рост: ${growthPercent}%`}
              />
              <div 
                className="bg-rose-500 h-full transition-all duration-500" 
                style={{ width: `${leakPercent}%` }}
                title={`Утечки: ${leakPercent}%`}
              />
            </div>

            <div className="space-y-1.5 text-xs pt-1">
              <div className="bg-white p-2 rounded-lg border border-blue-100 flex items-center justify-between">
                <span className="text-slate-600 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-600" /> Базовые обязательства
                </span>
                <span className="font-bold text-gray-900">{basicExpense.toLocaleString('ru-RU')} ₸ ({basicPercent}%)</span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-emerald-100 flex items-center justify-between">
                <span className="text-slate-600 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" /> Инвестиции в рост
                </span>
                <span className="font-bold text-emerald-800">{growthExpense.toLocaleString('ru-RU')} ₸ ({growthPercent}%)</span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-rose-100 flex items-center justify-between">
                <span className="text-slate-600 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-rose-500" /> Утечки (лишнее/спонтанное)
                </span>
                <span className="font-bold text-rose-800">{leakExpense.toLocaleString('ru-RU')} ₸ ({leakPercent}%)</span>
              </div>
            </div>
          </div>

          {/* 2. Добавление статей расхода в планы будущих периодов */}
          <div className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/30 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                <PiggyBank className="w-4 h-4 text-indigo-600" />
                Планы будущих периодов
              </span>
              <span className="text-xs font-semibold text-indigo-700">Статьи</span>
            </div>

            <div className="space-y-1.5 text-xs pt-1">
              <div className="bg-white p-2 rounded-lg border border-slate-200 flex items-center justify-between">
                <span className="text-slate-600">Ежемесячный бюджет:</span>
                <span className="font-bold text-gray-900">{monthlyDestExpense.toLocaleString('ru-RU')} ₸</span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-slate-200 flex items-center justify-between">
                <span className="text-slate-600">Бюджет след. месяца:</span>
                <span className="font-bold text-indigo-700">{nextMonthDestExpense.toLocaleString('ru-RU')} ₸</span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-slate-200 flex items-center justify-between">
                <span className="text-slate-600">Бюджет след. года:</span>
                <span className="font-bold text-purple-700">{nextYearDestExpense.toLocaleString('ru-RU')} ₸</span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-slate-200 flex items-center justify-between">
                <span className="text-slate-600">Резервы (12 долей):</span>
                <span className="font-bold text-amber-700">{reserveDestExpense.toLocaleString('ru-RU')} ₸</span>
              </div>
            </div>
          </div>

          {/* 3. Регулярность доходов */}
          <div className="p-4 rounded-xl border border-emerald-100 bg-emerald-50/30 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                Регулярность доходов
              </span>
              <span className="text-xs font-semibold text-emerald-700">{regularIncomePercent}% регулярные</span>
            </div>

            <div className="h-2.5 w-full bg-emerald-100 rounded-full overflow-hidden flex">
              <div 
                className="bg-emerald-600 h-full transition-all duration-500" 
                style={{ width: `${regularIncomePercent}%` }}
              />
              <div 
                className="bg-purple-400 h-full transition-all duration-500" 
                style={{ width: `${irregularIncomePercent}%` }}
              />
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs pt-1">
              <div className="bg-white p-2.5 rounded-lg border border-emerald-100">
                <p className="text-gray-500 text-[11px]">Регулярный доход</p>
                <p className="font-bold text-emerald-900 mt-0.5">{regularIncome.toLocaleString('ru-RU')} ₸</p>
                <p className="text-[10px] text-emerald-600 mt-0.5">{regularIncomePercent}%</p>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-purple-100">
                <p className="text-gray-500 text-[11px]">Нерегулярный доход</p>
                <p className="font-bold text-purple-900 mt-0.5">{irregularIncome.toLocaleString('ru-RU')} ₸</p>
                <p className="text-[10px] text-purple-600 mt-0.5">{irregularIncomePercent}%</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Breakdown Pie Chart */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4">
          <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <PieIcon className="w-5 h-5 text-blue-600" />
            Структура расходов по категориям
          </h3>

          {categoryChartData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-gray-400 text-sm border-2 border-dashed border-gray-100 rounded-xl">
              За выбранный период расходов нет
            </div>
          ) : (
            <div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {categoryChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLOR_PALETTE[index % COLOR_PALETTE.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: number) => [`${val.toLocaleString('ru-RU')} ₸`, 'Сумма']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Legend List */}
              <div className="space-y-1.5 mt-2 max-h-44 overflow-y-auto pr-1">
                {categoryChartData.map((item, idx) => {
                  const percentage = totalExpense > 0 ? ((item.value / totalExpense) * 100).toFixed(1) : 0;
                  return (
                    <div key={`legend-${item.name}-${idx}`} className="flex items-center justify-between text-xs py-1 border-b border-gray-50">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: COLOR_PALETTE[idx % COLOR_PALETTE.length] }}
                        />
                        <span className="font-medium text-gray-800">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-gray-400 font-mono">{percentage}%</span>
                        <span className="font-bold text-gray-900">{item.value.toLocaleString('ru-RU')} ₸</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Monthly Bar Chart */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4">
          <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            Динамика по месяцам (Доходы / Расходы)
          </h3>

          {monthlyChartData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-gray-400 text-sm border-2 border-dashed border-gray-100 rounded-xl">
              Нет данных для отображения графика
            </div>
          ) : (
            <div className="h-72 pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(val: number) => [`${val.toLocaleString('ru-RU')} ₸`]} />
                  <Legend />
                  <Bar dataKey="income" name="Доходы" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expense" name="Расходы" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Export Button Section */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 text-center space-y-3">
        <h3 className="font-bold text-gray-900">Выгрузка отчета</h3>
        <p className="text-xs text-gray-500 max-w-md mx-auto">
          Скачайте выбранные транзакции с категориями расходов, планами будущих периодов и регулярностью доходов в формате CSV для сохранения на диске или открытия в Excel и Google Таблицах.
        </p>
        <button
          onClick={exportCSV}
          className="w-full sm:w-auto px-8 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-100 transition-all flex items-center justify-center gap-2 mx-auto active:scale-95"
        >
          <Download className="w-5 h-5" />
          Скачать подробный отчет (CSV)
        </button>
      </div>
    </div>
  );
};

