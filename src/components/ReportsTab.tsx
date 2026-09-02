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

  // Calculate totals
  const totalExpense = expenseTxs.reduce((sum, t) => sum + t.amount, 0);
  const totalIncome = incomeTxs.reduce((sum, t) => sum + t.amount, 0);

  // 1. Mandatory vs Optional Expenses
  const mandatoryExpense = expenseTxs
    .filter(t => (t.necessity || 'mandatory') === 'mandatory')
    .reduce((sum, t) => sum + t.amount, 0);
  const optionalExpense = expenseTxs
    .filter(t => t.necessity === 'optional')
    .reduce((sum, t) => sum + t.amount, 0);

  const mandatoryPercent = totalExpense > 0 ? ((mandatoryExpense / totalExpense) * 100).toFixed(1) : '0';
  const optionalPercent = totalExpense > 0 ? ((optionalExpense / totalExpense) * 100).toFixed(1) : '0';

  // 2. Regular vs One-off Expenses
  const regularExpense = expenseTxs
    .filter(t => t.frequency === 'regular')
    .reduce((sum, t) => sum + t.amount, 0);
  const oneOffExpense = expenseTxs
    .filter(t => (t.frequency || 'one_off') === 'one_off')
    .reduce((sum, t) => sum + t.amount, 0);

  const regularExpensePercent = totalExpense > 0 ? ((regularExpense / totalExpense) * 100).toFixed(1) : '0';
  const oneOffExpensePercent = totalExpense > 0 ? ((oneOffExpense / totalExpense) * 100).toFixed(1) : '0';

  // 3. Planned vs Unplanned Expenses
  const plannedExpense = expenseTxs
    .filter(t => (t.planning || 'planned') === 'planned')
    .reduce((sum, t) => sum + t.amount, 0);
  const unplannedExpense = expenseTxs
    .filter(t => t.planning === 'unplanned')
    .reduce((sum, t) => sum + t.amount, 0);

  const plannedPercent = totalExpense > 0 ? ((plannedExpense / totalExpense) * 100).toFixed(1) : '0';
  const unplannedPercent = totalExpense > 0 ? ((unplannedExpense / totalExpense) * 100).toFixed(1) : '0';

  // 4. Regular vs Irregular Incomes
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

  // Group by Date/Month for Bar Chart
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

  // CSV Export logic with all attributes included
  const exportCSV = () => {
    let csv = "\uFEFFДата;Тип;Категория;Способ оплаты;Сумма;Обязательность;Регулярность;Плановость;Заметка\n";
    filteredTxs.forEach(e => {
      const isInc = e.type === 'income';
      const typeLabel = isInc ? 'Доход' : 'Расход';
      
      let necessityLabel = '';
      let frequencyLabel = '';
      let planningLabel = '';

      if (!isInc) {
        necessityLabel = (e.necessity || 'mandatory') === 'mandatory' ? 'Обязательное' : 'Необязательное';
        frequencyLabel = (e.frequency || 'one_off') === 'regular' ? 'Регулярное' : 'Разовое';
        planningLabel = (e.planning || 'planned') === 'planned' ? 'Плановое' : 'Внеплановое';
      } else {
        frequencyLabel = (e.incomeFrequency || 'regular') === 'regular' ? 'Регулярный' : 'Нерегулярный';
      }

      const noteClean = e.note ? e.note.replace(/;/g, ',') : '';
      csv += `${e.date};${typeLabel};${e.category};${e.method};${e.amount};${necessityLabel};${frequencyLabel};${planningLabel};${noteClean}\n`;
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 uppercase font-medium">Расходы за период</p>
            <p className="text-xl font-bold text-rose-600 mt-1">-{totalExpense.toLocaleString('ru-RU')} ₸</p>
          </div>
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
            <TrendingDown className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 uppercase font-medium">Доходы за период</p>
            <p className="text-xl font-bold text-emerald-600 mt-1">+{totalIncome.toLocaleString('ru-RU')} ₸</p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <TrendingUp className="w-5 h-5" />
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

      {/* DETAILED ATTRIBUTES ANALYTICS SECTION */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-blue-600" />
            Анализ по признакам и структуре бюджета
          </h3>
          <span className="text-xs text-gray-400 font-medium hidden sm:inline">Глубокая аналитика трат</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 1. Обязательные vs Необязательные */}
          <div className="p-4 rounded-xl border border-blue-100 bg-blue-50/40 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                Обязательность расходов
              </span>
              <span className="text-xs font-semibold text-blue-700">{mandatoryPercent}% обяз.</span>
            </div>

            {/* Progress Bar */}
            <div className="h-2.5 w-full bg-blue-100 rounded-full overflow-hidden flex">
              <div 
                className="bg-blue-600 h-full transition-all duration-500" 
                style={{ width: `${mandatoryPercent}%` }}
                title={`Обязательные: ${mandatoryPercent}%`}
              />
              <div 
                className="bg-indigo-400 h-full transition-all duration-500" 
                style={{ width: `${optionalPercent}%` }}
                title={`Необязательные: ${optionalPercent}%`}
              />
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs pt-1">
              <div className="bg-white p-2.5 rounded-lg border border-blue-100">
                <p className="text-gray-500 text-[11px]">Обязательные</p>
                <p className="font-bold text-blue-900 mt-0.5">{mandatoryExpense.toLocaleString('ru-RU')} ₸</p>
                <p className="text-[10px] text-blue-600 mt-0.5">{mandatoryPercent}% от расходов</p>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-blue-100">
                <p className="text-gray-500 text-[11px]">Необязательные</p>
                <p className="font-bold text-indigo-900 mt-0.5">{optionalExpense.toLocaleString('ru-RU')} ₸</p>
                <p className="text-[10px] text-indigo-600 mt-0.5">{optionalPercent}% от расходов</p>
              </div>
            </div>
          </div>

          {/* 2. Плановые vs Внеплановые */}
          <div className="p-4 rounded-xl border border-emerald-100 bg-emerald-50/40 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                <Target className="w-4 h-4 text-emerald-600" />
                Плановость расходов
              </span>
              <span className="text-xs font-semibold text-emerald-700">{plannedPercent}% план</span>
            </div>

            {/* Progress Bar */}
            <div className="h-2.5 w-full bg-emerald-100 rounded-full overflow-hidden flex">
              <div 
                className="bg-emerald-600 h-full transition-all duration-500" 
                style={{ width: `${plannedPercent}%` }}
              />
              <div 
                className="bg-amber-500 h-full transition-all duration-500" 
                style={{ width: `${unplannedPercent}%` }}
              />
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs pt-1">
              <div className="bg-white p-2.5 rounded-lg border border-emerald-100">
                <p className="text-gray-500 text-[11px]">Плановые</p>
                <p className="font-bold text-emerald-900 mt-0.5">{plannedExpense.toLocaleString('ru-RU')} ₸</p>
                <p className="text-[10px] text-emerald-600 mt-0.5">{plannedPercent}%</p>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-amber-200">
                <p className="text-gray-500 text-[11px]">Внеплановые (спонтанные)</p>
                <p className="font-bold text-amber-900 mt-0.5">{unplannedExpense.toLocaleString('ru-RU')} ₸</p>
                <p className="text-[10px] text-amber-600 mt-0.5">{unplannedPercent}%</p>
              </div>
            </div>
          </div>

          {/* 3. Регулярные vs Разовые расходы */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-blue-600" />
                Регулярность расходов
              </span>
              <span className="text-xs font-semibold text-slate-600">{regularExpensePercent}% регулярные</span>
            </div>

            <div className="h-2.5 w-full bg-slate-200 rounded-full overflow-hidden flex">
              <div 
                className="bg-blue-600 h-full transition-all duration-500" 
                style={{ width: `${regularExpensePercent}%` }}
              />
              <div 
                className="bg-slate-400 h-full transition-all duration-500" 
                style={{ width: `${oneOffExpensePercent}%` }}
              />
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs pt-1">
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <p className="text-gray-500 text-[11px]">Регулярные</p>
                <p className="font-bold text-slate-900 mt-0.5">{regularExpense.toLocaleString('ru-RU')} ₸</p>
                <p className="text-[10px] text-blue-600 mt-0.5">{regularExpensePercent}%</p>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <p className="text-gray-500 text-[11px]">Разовые</p>
                <p className="font-bold text-slate-900 mt-0.5">{oneOffExpense.toLocaleString('ru-RU')} ₸</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{oneOffExpensePercent}%</p>
              </div>
            </div>
          </div>

          {/* 4. Регулярные vs Нерегулярные доходы */}
          <div className="p-4 rounded-xl border border-emerald-100 bg-emerald-50/30 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                Регулярность доходов
              </span>
              <span className="text-xs font-semibold text-emerald-700">{regularIncomePercent}% регулярный</span>
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
          Скачайте выбранные транзакции со всеми признаками (обязательность, регулярность, плановость) в формате CSV для сохранения на диске или открытия в Excel и Google Таблицах.
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

