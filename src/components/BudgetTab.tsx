import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../db/database';
import type { 
  Transaction, 
  Category, 
  BudgetItem, 
  BudgetReallocation,
  TransactionType 
} from '../types';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  ArrowRightLeft,
  RefreshCw,
  Copy,
  Plus,
  Edit2,
  Check,
  X,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  PiggyBank,
  History,
  Layers
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';

interface RolloverItem {
  amount: number;
  selected: boolean;
}

export const BudgetTab: React.FC = () => {
  // Navigation / Period
  const [periodType, setPeriodType] = useState<'month' | 'custom'>('month');
  
  const currentDate = new Date();
  const currentMonthStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
  
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [customStartDate, setCustomStartDate] = useState<string>(
    new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString().split('T')[0]
  );
  const [customEndDate, setCustomEndDate] = useState<string>(
    new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).toISOString().split('T')[0]
  );

  // Active sub-tab in Budget: Expense Budget or Income Budget
  const [budgetType, setBudgetType] = useState<TransactionType>('expense');

  // DB Data
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [reallocations, setReallocations] = useState<BudgetReallocation[]>([]);

  // Selected Category for Cumulative Chart
  const [chartCategory, setChartCategory] = useState<string>('all');

  // Modals & Forms
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [editingCategory, setEditingCategory] = useState<string>('');
  const [editingPlanAmount, setEditingPlanAmount] = useState<string>('');
  const [editingCarriedOver, setEditingCarriedOver] = useState<string>('');

  const [isReallocateModalOpen, setIsReallocateModalOpen] = useState<boolean>(false);
  const [reallocateFrom, setReallocateFrom] = useState<string>('');
  const [reallocateTo, setReallocateTo] = useState<string>('');
  const [reallocateAmount, setReallocateAmount] = useState<string>('');
  const [reallocateReason, setReallocateReason] = useState<string>('');

  const [isRolloverModalOpen, setIsRolloverModalOpen] = useState<boolean>(false);
  const [rolloverOptions, setRolloverOptions] = useState<Record<string, RolloverItem>>({});


  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState<boolean>(false);

  // Compute Active Period Strings & Bounds
  const activePeriodKey = periodType === 'month' ? selectedMonth : `custom_${customStartDate}_${customEndDate}`;

  const { periodStartDate, periodEndDate, daysInPeriod } = useMemo(() => {
    if (periodType === 'month') {
      const [yearStr, monthStr] = selectedMonth.split('-');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0);
      return {
        periodStartDate: start.toISOString().split('T')[0],
        periodEndDate: end.toISOString().split('T')[0],
        daysInPeriod: end.getDate()
      };
    } else {
      const start = new Date(customStartDate);
      const end = new Date(customEndDate);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      return {
        periodStartDate: customStartDate,
        periodEndDate: customEndDate,
        daysInPeriod: diffDays > 0 ? diffDays : 30
      };
    }
  }, [periodType, selectedMonth, customStartDate, customEndDate]);

  // Load Data from Database
  const loadData = async () => {
    const cats = await db.categories.toArray();
    const txs = await db.expenses.toArray();
    const budgets = await db.budgets.where('period').equals(activePeriodKey).toArray();
    const reallocs = await db.reallocations.where('period').equals(activePeriodKey).toArray();

    setCategories(cats);
    setTransactions(txs);
    setBudgetItems(budgets);
    setReallocations(reallocs);
  };

  useEffect(() => {
    loadData();
  }, [activePeriodKey]);

  // Month navigation helpers
  const handlePrevMonth = () => {
    const [yearStr, monthStr] = selectedMonth.split('-');
    let year = parseInt(yearStr, 10);
    let month = parseInt(monthStr, 10) - 1;
    if (month < 1) {
      month = 12;
      year -= 1;
    }
    setSelectedMonth(`${year}-${String(month).padStart(2, '0')}`);
  };

  const handleNextMonth = () => {
    const [yearStr, monthStr] = selectedMonth.split('-');
    let year = parseInt(yearStr, 10);
    let month = parseInt(monthStr, 10) + 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
    setSelectedMonth(`${year}-${String(month).padStart(2, '0')}`);
  };

  const monthFormattedTitle = useMemo(() => {
    if (periodType === 'custom') {
      return `${customStartDate} — ${customEndDate}`;
    }
    const [yearStr, monthStr] = selectedMonth.split('-');
    const date = new Date(parseInt(yearStr, 10), parseInt(monthStr, 10) - 1, 1);
    return date.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
  }, [periodType, selectedMonth, customStartDate, customEndDate]);

  // Filter transactions belonging to current period
  const periodTransactions = useMemo(() => {
    return transactions.filter(t => t.date >= periodStartDate && t.date <= periodEndDate);
  }, [transactions, periodStartDate, periodEndDate]);

  // Filter categories by active budget type (expense/income) and include categories from budgetItems or transactions
  const currentCategories = useMemo(() => {
    const seen = new Set<string>();
    const result: { id?: number; name: string; type: TransactionType; color?: string }[] = [];

    // 1. Categories from database table
    categories
      .filter(c => c.type === budgetType)
      .forEach(c => {
        const name = (c.name || '').trim();
        if (name && !seen.has(name)) {
          seen.add(name);
          result.push({ id: c.id, name, type: c.type, color: c.color });
        }
      });

    // 2. Categories that have planned budget items in this period (e.g., auto-created "Резерв: <Категория>")
    budgetItems
      .filter(b => b.type === budgetType)
      .forEach(b => {
        const name = (b.category || '').trim();
        if (name && !seen.has(name)) {
          seen.add(name);
          result.push({ name, type: b.type, color: name.startsWith('Резерв:') ? '#f59e0b' : '#6366f1' });
        }
      });

    // 3. Categories that have actual transactions in this period
    periodTransactions
      .filter(t => t.type === budgetType)
      .forEach(t => {
        const name = (t.category || '').trim();
        if (name && !seen.has(name)) {
          seen.add(name);
          result.push({ name, type: t.type, color: '#64748b' });
        }
      });

    return result;
  }, [categories, budgetType, budgetItems, periodTransactions]);

  // Calculate Plan, Fact, Rollover, Reallocation, Saldo & % per Category
  const categoryBudgetStats = useMemo(() => {
    return currentCategories.map(cat => {
      const budgetItem = budgetItems.find(b => b.category === cat.name && b.type === budgetType);
      const planned = budgetItem?.plannedAmount || 0;
      const carriedOver = budgetItem?.carriedOverAmount || 0;
      const reallocated = budgetItem?.reallocatedAmount || 0;
      const totalBudget = planned + carriedOver + reallocated;

      // Actual spent / received in period
      const fact = periodTransactions
        .filter(t => t.category === cat.name && t.type === budgetType)
        .reduce((sum, t) => sum + t.amount, 0);

      // Saldo (Остаток / Разница)
      // For expense: positive saldo means money is left, negative means overspent
      // For income: positive saldo means extra earned, negative means underperformed
      const saldo = budgetType === 'expense' ? totalBudget - fact : fact - totalBudget;

      // Completion %
      const percent = totalBudget > 0 ? (fact / totalBudget) * 100 : (fact > 0 ? 100 : 0);

      // Traffic Light State
      // For Expense: Green (< 80%), Yellow (80% - 100%), Red (> 100%)
      // For Income: Red (< 70%), Yellow (70% - 99.9%), Green (>= 100%)
      let trafficColor: 'green' | 'yellow' | 'red' = 'green';
      if (budgetType === 'expense') {
        if (totalBudget === 0 && fact > 0) {
          trafficColor = 'red';
        } else if (percent > 100) {
          trafficColor = 'red';
        } else if (percent >= 80) {
          trafficColor = 'yellow';
        } else {
          trafficColor = 'green';
        }
      } else {
        if (percent >= 100) {
          trafficColor = 'green';
        } else if (percent >= 70) {
          trafficColor = 'yellow';
        } else {
          trafficColor = 'red';
        }
      }

      return {
        category: cat.name,
        color: cat.color || '#3b82f6',
        planned,
        carriedOver,
        reallocated,
        totalBudget,
        fact,
        saldo,
        percent,
        trafficColor,
        budgetId: budgetItem?.id
      };
    });
  }, [currentCategories, budgetItems, periodTransactions, budgetType]);

  // Overall Totals for the Budget Type
  const totalPlanned = categoryBudgetStats.reduce((sum, i) => sum + i.planned, 0);
  const totalCarriedOver = categoryBudgetStats.reduce((sum, i) => sum + i.carriedOver, 0);
  const totalReallocated = categoryBudgetStats.reduce((sum, i) => sum + i.reallocated, 0);
  const grandTotalBudget = categoryBudgetStats.reduce((sum, i) => sum + i.totalBudget, 0);
  const grandTotalFact = categoryBudgetStats.reduce((sum, i) => sum + i.fact, 0);
  const grandTotalSaldo = budgetType === 'expense' 
    ? grandTotalBudget - grandTotalFact 
    : grandTotalFact - grandTotalBudget;
  const grandTotalPercent = grandTotalBudget > 0 ? (grandTotalFact / grandTotalBudget) * 100 : 0;

  // Cumulative Chart Data (План-Факт с накоплением за месяц/период)
  const cumulativeChartData = useMemo(() => {
    const dataPoints: {
      dayLabel: string;
      dayNum: number;
      date: string;
      factDaily: number;
      factCumulative: number;
      planCumulative: number;
      targetBudget: number;
    }[] = [];

    // Determine target budget for the selected category or all
    let targetBudget = grandTotalBudget;
    if (chartCategory !== 'all') {
      const found = categoryBudgetStats.find(s => s.category === chartCategory);
      targetBudget = found ? found.totalBudget : 0;
    }

    let runningFact = 0;
    const isCurrentMonthActive = periodType === 'month' && selectedMonth === currentMonthStr;
    const currentDayOfMonth = currentDate.getDate();

    // Group transactions by date
    const txByDate: { [dateStr: string]: number } = {};
    periodTransactions
      .filter(t => t.type === budgetType && (chartCategory === 'all' || t.category === chartCategory))
      .forEach(t => {
        txByDate[t.date] = (txByDate[t.date] || 0) + t.amount;
      });

    // Build timeline day by day
    for (let day = 1; day <= daysInPeriod; day++) {
      let dateStr = '';
      if (periodType === 'month') {
        const [yearStr, monthStr] = selectedMonth.split('-');
        dateStr = `${yearStr}-${monthStr}-${String(day).padStart(2, '0')}`;
      } else {
        const d = new Date(customStartDate);
        d.setDate(d.getDate() + (day - 1));
        dateStr = d.toISOString().split('T')[0];
      }

      const dailyFact = txByDate[dateStr] || 0;
      
      // Stop adding future days fact for current ongoing month
      const isFutureDay = isCurrentMonthActive && day > currentDayOfMonth;
      if (!isFutureDay) {
        runningFact += dailyFact;
      }

      // Linear cumulative plan progression
      const planCumulative = Math.round((targetBudget / daysInPeriod) * day);

      dataPoints.push({
        dayLabel: `${day} число`,
        dayNum: day,
        date: dateStr,
        factDaily: dailyFact,
        factCumulative: !isFutureDay ? runningFact : (undefined as any),
        planCumulative: planCumulative,
        targetBudget: targetBudget
      });
    }

    return dataPoints;
  }, [
    daysInPeriod, 
    periodType, 
    selectedMonth, 
    customStartDate, 
    periodTransactions, 
    budgetType, 
    chartCategory, 
    grandTotalBudget, 
    categoryBudgetStats, 
    currentMonthStr, 
    currentDate
  ]);

  // Save / Update Budget Item
  const handleSaveBudgetItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const planned = parseFloat(editingPlanAmount) || 0;
    const carriedOver = parseFloat(editingCarriedOver) || 0;

    const existing = await db.budgets
      .where({ period: activePeriodKey, category: editingCategory })
      .first();

    if (existing && existing.id) {
      await db.budgets.update(existing.id, {
        plannedAmount: planned,
        carriedOverAmount: carriedOver,
        updatedAt: new Date().toISOString()
      });
    } else {
      await db.budgets.add({
        period: activePeriodKey,
        category: editingCategory,
        type: budgetType,
        plannedAmount: planned,
        carriedOverAmount: carriedOver,
        reallocatedAmount: 0,
        updatedAt: new Date().toISOString()
      });
    }

    setIsEditModalOpen(false);
    loadData();
  };

  const openEditModal = (catName: string, currentPlan: number, currentCarried: number) => {
    setEditingCategory(catName);
    setEditingPlanAmount(currentPlan.toString());
    setEditingCarriedOver(currentCarried.toString());
    setIsEditModalOpen(true);
  };

  // Reallocate Budget between categories (Перераспределение)
  const handleReallocateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(reallocateAmount);
    if (!reallocateFrom || !reallocateTo) {
      alert('Пожалуйста, выберите обе категории');
      return;
    }
    if (reallocateFrom === reallocateTo) {
      alert('Категория-источник и категория-получатель должны быть разными');
      return;
    }
    if (isNaN(amountNum) || amountNum <= 0) {
      alert('Введите корректную сумму для перераспределения');
      return;
    }

    // Update 'from' category budget item (- amountNum)
    let fromItem = await db.budgets.where({ period: activePeriodKey, category: reallocateFrom }).first();
    if (!fromItem) {
      const id = await db.budgets.add({
        period: activePeriodKey,
        category: reallocateFrom,
        type: budgetType,
        plannedAmount: 0,
        carriedOverAmount: 0,
        reallocatedAmount: -amountNum,
        updatedAt: new Date().toISOString()
      });
    } else if (fromItem.id) {
      await db.budgets.update(fromItem.id, {
        reallocatedAmount: (fromItem.reallocatedAmount || 0) - amountNum,
        updatedAt: new Date().toISOString()
      });
    }

    // Update 'to' category budget item (+ amountNum)
    let toItem = await db.budgets.where({ period: activePeriodKey, category: reallocateTo }).first();
    if (!toItem) {
      await db.budgets.add({
        period: activePeriodKey,
        category: reallocateTo,
        type: budgetType,
        plannedAmount: 0,
        carriedOverAmount: 0,
        reallocatedAmount: amountNum,
        updatedAt: new Date().toISOString()
      });
    } else if (toItem.id) {
      await db.budgets.update(toItem.id, {
        reallocatedAmount: (toItem.reallocatedAmount || 0) + amountNum,
        updatedAt: new Date().toISOString()
      });
    }

    // Log reallocation event
    await db.reallocations.add({
      period: activePeriodKey,
      fromCategory: reallocateFrom,
      toCategory: reallocateTo,
      amount: amountNum,
      date: new Date().toISOString().split('T')[0],
      reason: reallocateReason.trim() || undefined
    });

    setIsReallocateModalOpen(false);
    setReallocateAmount('');
    setReallocateReason('');
    loadData();
  };

  // Open Rollover Modal (Calculate previous period remaining saldo)
  const openRolloverModal = async () => {
    // Determine previous month
    let prevPeriodKey = '';
    if (periodType === 'month') {
      const [yStr, mStr] = selectedMonth.split('-');
      let y = parseInt(yStr, 10);
      let m = parseInt(mStr, 10) - 1;
      if (m < 1) {
        m = 12;
        y -= 1;
      }
      prevPeriodKey = `${y}-${String(m).padStart(2, '0')}`;
    }

    if (!prevPeriodKey) {
      alert('Перенос остатков доступен при помесячном планировании.');
      return;
    }

    // Fetch previous month's budgets and transactions
    const prevBudgets = await db.budgets.where('period').equals(prevPeriodKey).toArray();
    const [prevY, prevM] = prevPeriodKey.split('-');
    const prevStart = `${prevY}-${prevM}-01`;
    const prevEndDateObj = new Date(parseInt(prevY, 10), parseInt(prevM, 10), 0);
    const prevEnd = prevEndDateObj.toISOString().split('T')[0];

    const prevTxs = await db.expenses
      .filter(t => t.date >= prevStart && t.date <= prevEnd)
      .toArray();

    const rolloverData: { [category: string]: { amount: number; selected: boolean } } = {};

    categories.filter(c => c.type === budgetType).forEach(cat => {
      const b = prevBudgets.find(item => item.category === cat.name && item.type === budgetType);
      const prevPlan = b?.plannedAmount || 0;
      const prevCarried = b?.carriedOverAmount || 0;
      const prevReallocated = b?.reallocatedAmount || 0;
      const prevTotalBudget = prevPlan + prevCarried + prevReallocated;

      const prevFact = prevTxs
        .filter(t => t.category === cat.name && t.type === budgetType)
        .reduce((sum, t) => sum + t.amount, 0);

      // Saldo from previous month
      const prevSaldo = budgetType === 'expense' 
        ? prevTotalBudget - prevFact 
        : prevFact - prevTotalBudget;

      rolloverData[cat.name] = {
        amount: Math.round(prevSaldo),
        selected: prevSaldo !== 0 // auto select non-zero
      };
    });

    setRolloverOptions(rolloverData);
    setIsRolloverModalOpen(true);
  };

  // Apply Rollover to Current Period
  const handleApplyRollover = async () => {
    for (const [catName, config] of Object.entries(rolloverOptions) as [string, RolloverItem][]) {
      if (config.selected) {
        const existing = await db.budgets
          .where({ period: activePeriodKey, category: catName })
          .first();

        if (existing && existing.id) {
          await db.budgets.update(existing.id, {
            carriedOverAmount: config.amount,
            updatedAt: new Date().toISOString()
          });
        } else {
          await db.budgets.add({
            period: activePeriodKey,
            category: catName,
            type: budgetType,
            plannedAmount: 0,
            carriedOverAmount: config.amount,
            reallocatedAmount: 0,
            updatedAt: new Date().toISOString()
          });
        }
      }
    }

    setIsRolloverModalOpen(false);
    loadData();
  };

  // Copy Plan from Previous Month
  const handleCopyFromPreviousMonth = async () => {
    if (periodType !== 'month') return;
    const [yStr, mStr] = selectedMonth.split('-');
    let y = parseInt(yStr, 10);
    let m = parseInt(mStr, 10) - 1;
    if (m < 1) {
      m = 12;
      y -= 1;
    }
    const prevPeriodKey = `${y}-${String(m).padStart(2, '0')}`;

    const prevBudgets = await db.budgets.where('period').equals(prevPeriodKey).toArray();
    if (prevBudgets.length === 0) {
      alert(`В предыдущем месяце (${prevPeriodKey}) нет сохраненных плановых данных.`);
      return;
    }

    if (confirm(`Скопировать плановые суммы из месяца ${prevPeriodKey}? Текущие базовые планы будут обновлены.`)) {
      for (const item of prevBudgets) {
        const existing = await db.budgets
          .where({ period: activePeriodKey, category: item.category })
          .first();

        if (existing && existing.id) {
          await db.budgets.update(existing.id, {
            plannedAmount: item.plannedAmount,
            updatedAt: new Date().toISOString()
          });
        } else {
          await db.budgets.add({
            period: activePeriodKey,
            category: item.category,
            type: item.type,
            plannedAmount: item.plannedAmount,
            carriedOverAmount: 0,
            reallocatedAmount: 0,
            updatedAt: new Date().toISOString()
          });
        }
      }
      loadData();
    }
  };

  // Delete reallocation record
  const handleDeleteReallocation = async (id?: number) => {
    if (!id) return;
    if (confirm('Отменить это перераспределение?')) {
      const item = await db.reallocations.get(id);
      if (item) {
        // Revert amounts
        const fromItem = await db.budgets.where({ period: item.period, category: item.fromCategory }).first();
        if (fromItem && fromItem.id) {
          await db.budgets.update(fromItem.id, {
            reallocatedAmount: (fromItem.reallocatedAmount || 0) + item.amount
          });
        }
        const toItem = await db.budgets.where({ period: item.period, category: item.toCategory }).first();
        if (toItem && toItem.id) {
          await db.budgets.update(toItem.id, {
            reallocatedAmount: (toItem.reallocatedAmount || 0) - item.amount
          });
        }
        await db.reallocations.delete(id);
        loadData();
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. TOP HEADER & PERIOD CONTROLS */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <PiggyBank className="w-6 h-6 text-blue-600" />
              Бюджетирование и План-Факт
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Управление лимитами, перенос остатков, контроль сальдо и своевременное перераспределение
            </p>
          </div>

          {/* Period Mode Toggle & Navigation */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="bg-gray-100 p-1 rounded-xl flex text-xs font-semibold">
              <button
                type="button"
                onClick={() => setPeriodType('month')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  periodType === 'month' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600'
                }`}
              >
                Помесячно
              </button>
              <button
                type="button"
                onClick={() => setPeriodType('custom')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  periodType === 'custom' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600'
                }`}
              >
                Любой период
              </button>
            </div>

            {periodType === 'month' ? (
              <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl px-2 py-1 gap-1">
                <button
                  onClick={handlePrevMonth}
                  className="p-1 text-gray-600 hover:text-blue-600 hover:bg-white rounded-lg transition-colors"
                  title="Предыдущий месяц"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <span className="text-xs font-bold text-gray-800 capitalize px-2 min-w-[130px] text-center">
                  {monthFormattedTitle}
                </span>

                <button
                  onClick={handleNextMonth}
                  className="p-1 text-gray-600 hover:text-blue-600 hover:bg-white rounded-lg transition-colors"
                  title="Следующий месяц"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={e => setCustomStartDate(e.target.value)}
                  className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs"
                />
                <span className="text-gray-400">—</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={e => setCustomEndDate(e.target.value)}
                  className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs"
                />
              </div>
            )}
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-100">
          {/* Type Selector (Expenses vs Incomes) */}
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setBudgetType('expense')}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                budgetType === 'expense'
                  ? 'bg-white text-rose-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <TrendingDown className="w-3.5 h-3.5" />
              Бюджет расходов
            </button>
            <button
              onClick={() => setBudgetType('income')}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                budgetType === 'income'
                  ? 'bg-white text-emerald-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              План доходов
            </button>
          </div>

          {/* Quick Management Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={openRolloverModal}
              className="px-3 py-1.5 text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-xl transition-all flex items-center gap-1.5 active:scale-95"
              title="Перенести остатки с прошлого периода"
            >
              <RefreshCw className="w-3.5 h-3.5 text-blue-600" />
              <span>Перенос остатков</span>
            </button>

            <button
              onClick={() => {
                if (categoryBudgetStats.length > 0) {
                  setReallocateFrom(categoryBudgetStats[0].category);
                  setReallocateTo(categoryBudgetStats.length > 1 ? categoryBudgetStats[1].category : categoryBudgetStats[0].category);
                }
                setIsReallocateModalOpen(true);
              }}
              className="px-3 py-1.5 text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-all flex items-center gap-1.5 active:scale-95"
              title="Перераспределить лимит между категориями"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-600" />
              <span>Перераспределить</span>
            </button>

            {periodType === 'month' && (
              <button
                onClick={handleCopyFromPreviousMonth}
                className="px-3 py-1.5 text-xs font-semibold bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200 rounded-xl transition-all flex items-center gap-1.5 active:scale-95"
                title="Скопировать базовый план из прошлого месяца"
              >
                <Copy className="w-3.5 h-3.5 text-gray-500" />
                <span className="hidden sm:inline">Копировать из пред. месяца</span>
              </button>
            )}

            {reallocations.length > 0 && (
              <button
                onClick={() => setIsHistoryModalOpen(true)}
                className="px-3 py-1.5 text-xs font-semibold bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200 rounded-xl transition-all flex items-center gap-1.5"
                title="История перераспределений за период"
              >
                <History className="w-3.5 h-3.5 text-amber-600" />
                <span>История ({reallocations.length})</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. OVERVIEW SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Итоговый бюджет */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 space-y-1">
          <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
            {budgetType === 'expense' ? 'Выделенный бюджет' : 'Запланировано'}
          </span>
          <p className="text-xl font-bold text-gray-900">
            {grandTotalBudget.toLocaleString('ru-RU')} ₸
          </p>
          <div className="text-[11px] text-gray-400 flex items-center gap-1 pt-0.5">
            <span>Базовый: {totalPlanned.toLocaleString('ru-RU')} ₸</span>
            {totalCarriedOver !== 0 && (
              <span className={totalCarriedOver > 0 ? 'text-emerald-600 font-medium' : 'text-rose-600 font-medium'}>
                • Перенос: {totalCarriedOver > 0 ? `+${totalCarriedOver}` : totalCarriedOver}
              </span>
            )}
          </div>
        </div>

        {/* Card 2: Фактически израсходовано/получено */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 space-y-1">
          <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
            {budgetType === 'expense' ? 'Фактический расход' : 'Фактический доход'}
          </span>
          <p className={`text-xl font-bold ${budgetType === 'expense' ? 'text-rose-600' : 'text-emerald-600'}`}>
            {grandTotalFact.toLocaleString('ru-RU')} ₸
          </p>
          <div className="text-[11px] text-gray-500 pt-0.5 flex items-center justify-between">
            <span>Исполнение плана:</span>
            <span className="font-bold text-gray-900">{grandTotalPercent.toFixed(1)}%</span>
          </div>
        </div>

        {/* Card 3: Сальдо (Остаток лимита / Перерасход) */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 space-y-1">
          <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
            {budgetType === 'expense' ? 'Сальдо (Остаток)' : 'Сальдо (Отклонение)'}
          </span>
          <p className={`text-xl font-bold ${
            grandTotalSaldo >= 0 ? 'text-emerald-600' : 'text-rose-600'
          }`}>
            {grandTotalSaldo > 0 ? `+${grandTotalSaldo.toLocaleString('ru-RU')}` : `${grandTotalSaldo.toLocaleString('ru-RU')}`} ₸
          </p>
          <div className="text-[11px] pt-0.5">
            {budgetType === 'expense' ? (
              grandTotalSaldo >= 0 ? (
                <span className="text-emerald-600 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Доступный остаток средств
                </span>
              ) : (
                <span className="text-rose-600 font-medium flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Превышение лимита бюджета
                </span>
              )
            ) : (
              grandTotalSaldo >= 0 ? (
                <span className="text-emerald-600 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> План доходов перевыполнен
                </span>
              ) : (
                <span className="text-amber-600 font-medium flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Доход ниже целевого плана
                </span>
              )
            )}
          </div>
        </div>

        {/* Card 4: Индикатор Светофор */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
          <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
            Статус бюджета (Светофор)
          </span>
          <div className="flex items-center gap-3 my-1">
            <div className="flex gap-1.5 bg-gray-100 p-1.5 rounded-full">
              <span className={`w-3.5 h-3.5 rounded-full transition-all ${
                grandTotalPercent <= 80 ? 'bg-emerald-500 shadow-md ring-2 ring-emerald-200' : 'bg-gray-300 opacity-40'
              }`} />
              <span className={`w-3.5 h-3.5 rounded-full transition-all ${
                grandTotalPercent > 80 && grandTotalPercent <= 100 ? 'bg-amber-500 shadow-md ring-2 ring-amber-200' : 'bg-gray-300 opacity-40'
              }`} />
              <span className={`w-3.5 h-3.5 rounded-full transition-all ${
                grandTotalPercent > 100 ? 'bg-rose-500 shadow-md ring-2 ring-rose-200' : 'bg-gray-300 opacity-40'
              }`} />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-900">
                {grandTotalPercent <= 80 && '🟢 В пределах нормы'}
                {grandTotalPercent > 80 && grandTotalPercent <= 100 && '🟡 Внимание, близко к лимиту'}
                {grandTotalPercent > 100 && '🔴 Превышение лимита'}
              </p>
              <p className="text-[10px] text-gray-400">
                {daysInPeriod} дней в периоде
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 3. CUMULATIVE PLAN-FACT CHART OVER THE MONTH */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-600" />
              График «План-Факт с накоплением» за период
            </h3>
            <p className="text-xs text-gray-500">
              Кумулятивное нарастание трат по дням по сравнению с плановой траекторией
            </p>
          </div>

          {/* Category Filter for Chart */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-500 font-medium">Категория:</span>
            <select
              value={chartCategory}
              onChange={e => setChartCategory(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-xl bg-white text-gray-800 font-semibold focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Все категории суммарно</option>
              {currentCategories.map((c, idx) => (
                <option key={c.id || `budget-chart-cat-${c.name}-${idx}`} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Chart Area */}
        <div className="h-72 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={cumulativeChartData}>
              <defs>
                <linearGradient id="factGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="planGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="dayNum" tick={{ fontSize: 11 }} tickFormatter={(val) => `${val} д.`} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(val: any, name: string) => {
                  if (val === undefined || val === null) return ['Нет данных', name];
                  const num = Number(val);
                  return [`${num.toLocaleString('ru-RU')} ₸`, name];
                }}
                labelFormatter={(label) => `День ${label} (${monthFormattedTitle})`}
              />
              <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '12px' }} />
              
              {/* Target Limit Line */}
              <Line
                type="monotone"
                dataKey="targetBudget"
                name="Лимит бюджета"
                stroke="#64748b"
                strokeDasharray="5 5"
                dot={false}
                strokeWidth={1.5}
              />

              {/* Planned cumulative trajectory */}
              <Line
                type="monotone"
                dataKey="planCumulative"
                name="Плановая траектория"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
              />

              {/* Actual cumulative spend */}
              <Area
                type="monotone"
                dataKey="factCumulative"
                name="Фактические накопления"
                stroke="#ef4444"
                strokeWidth={2.5}
                fill="url(#factGradient)"
                dot={{ r: 2, fill: '#ef4444' }}
                activeDot={{ r: 5 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="flex flex-wrap items-center justify-between text-xs text-gray-500 bg-slate-50 p-3 rounded-xl border border-slate-100">
          <span>
            📊 <strong>Как читать график:</strong> Если красная линия (Факт) находится <em>ниже</em> синей (План), вы расходуете бюджет медленнее плана (экономия). Если <em>выше</em> — имеет место опережающий перерасход.
          </span>
        </div>
      </div>

      {/* 4. PLAN-FACT TABLE WITH "TRAFFIC LIGHT" & SALDO */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              Таблица План-Факт и Сальдо по категориям
            </h3>
            <p className="text-xs sm:text-sm text-gray-500">
              Цветовая индикация «Светофор», сравнение плана с фактом и текущее сальдо
            </p>
          </div>

          <div className="text-xs text-gray-400">
            Всего категорий: {categoryBudgetStats.length}
          </div>
        </div>

        {/* Responsive Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm sm:text-base border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-200 text-gray-700 font-bold uppercase tracking-wider text-xs sm:text-sm bg-gray-50/80">
                <th className="py-4 px-4">Категория</th>
                <th className="py-4 px-4 font-bold text-gray-900">План</th>
                <th className="py-4 px-4 font-bold text-gray-900">Факт</th>
                <th className="py-4 px-4 font-bold">Сальдо (Остаток)</th>
                <th className="py-4 px-4 text-center">Светофор</th>
                <th className="py-4 px-4 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {categoryBudgetStats.map(item => {
                const isOverBudget = item.saldo < 0;

                return (
                  <tr key={item.category} className="hover:bg-slate-50/80 transition-colors group">
                    {/* Category */}
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <span
                          className="w-3.5 h-3.5 rounded-full flex-shrink-0 shadow-xs"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="font-bold text-gray-900 text-base sm:text-lg">
                          {item.category}
                        </span>
                      </div>
                    </td>

                    {/* Plan */}
                    <td className="py-4 px-4 font-bold text-gray-900 text-base sm:text-lg">
                      {item.totalBudget > 0 ? (
                        <span>{item.totalBudget.toLocaleString('ru-RU')} ₸</span>
                      ) : (
                        <span className="text-gray-400 font-normal italic text-sm">не задан</span>
                      )}
                    </td>

                    {/* Fact */}
                    <td className={`py-4 px-4 font-extrabold text-base sm:text-lg ${
                      budgetType === 'expense' ? 'text-rose-600' : 'text-emerald-600'
                    }`}>
                      {item.fact.toLocaleString('ru-RU')} ₸
                    </td>

                    {/* Saldo */}
                    <td className="py-4 px-4">
                      <span className={`font-bold px-3 py-1.5 rounded-xl inline-block text-sm sm:text-base ${
                        item.saldo >= 0
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}>
                        {item.saldo > 0 ? `+${item.saldo.toLocaleString('ru-RU')}` : item.saldo.toLocaleString('ru-RU')} ₸
                      </span>
                    </td>

                    {/* Traffic Light Indicator */}
                    <td className="py-4 px-4 text-center">
                      <div className="flex items-center justify-center">
                        {item.trafficColor === 'green' && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs sm:text-sm font-bold bg-emerald-100 text-emerald-800" title="В пределах нормы">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                            Норма
                          </span>
                        )}
                        {item.trafficColor === 'yellow' && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs sm:text-sm font-bold bg-amber-100 text-amber-800" title="Внимание: израсходовано более 80%">
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                            Внимание
                          </span>
                        )}
                        {item.trafficColor === 'red' && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs sm:text-sm font-bold bg-rose-100 text-rose-800" title="Превышение бюджета!">
                            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                            Перерасход
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openEditModal(item.category, item.planned, item.carriedOver)}
                          className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
                          title="Настроить план"
                        >
                          <Edit2 className="w-4.5 h-4.5" />
                        </button>
                        <button
                          onClick={() => {
                            setReallocateFrom(item.category);
                            const other = currentCategories.find(c => c.name !== item.category);
                            if (other) setReallocateTo(other.name);
                            setIsReallocateModalOpen(true);
                          }}
                          className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
                          title="Перераспределить из этой категории"
                        >
                          <ArrowRightLeft className="w-4.5 h-4.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {categoryBudgetStats.length > 0 && (
              <tfoot className="bg-slate-50/90 border-t-2 border-slate-200">
                <tr className="font-bold text-gray-900 text-base sm:text-lg">
                  <td className="py-4 px-4">Итого</td>
                  <td className="py-4 px-4">{grandTotalBudget.toLocaleString('ru-RU')} ₸</td>
                  <td className={`py-4 px-4 ${budgetType === 'expense' ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {grandTotalFact.toLocaleString('ru-RU')} ₸
                  </td>
                  <td className="py-4 px-4">
                    <span className={`font-bold px-3 py-1.5 rounded-xl inline-block text-sm sm:text-base ${
                      grandTotalSaldo >= 0
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}>
                      {grandTotalSaldo > 0 ? `+${grandTotalSaldo.toLocaleString('ru-RU')}` : grandTotalSaldo.toLocaleString('ru-RU')} ₸
                    </span>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <span className="text-xs sm:text-sm font-semibold text-gray-500">
                      {grandTotalPercent.toFixed(0)}% исп.
                    </span>
                  </td>
                  <td className="py-4 px-4"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* 5. MODAL: EDIT PLAN / BUDGET ITEM */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-gray-100 p-6 space-y-4 animate-fade-in">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-blue-600" />
                Настройка бюджета: {editingCategory}
              </h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBudgetItem} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Базовый план на период (₸)
                </label>
                <input
                  type="number"
                  step="100"
                  placeholder="0.00"
                  value={editingPlanAmount}
                  onChange={e => setEditingPlanAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 font-bold text-gray-900"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Перенесенный остаток с прошлого периода (₸)
                </label>
                <input
                  type="number"
                  step="10"
                  placeholder="0.00"
                  value={editingCarriedOver}
                  onChange={e => setEditingCarriedOver(e.target.value)}
                  className="w-full px-3.5 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 text-gray-800 text-sm"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Положительное число — неизрасходованная экономия; отрицательное — долг/перерасход.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md"
                >
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. MODAL: REALLOCATE BUDGET (ПЕРЕРАСПРЕДЕЛЕНИЕ) */}
      {isReallocateModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl border border-gray-100 p-6 space-y-4 animate-fade-in">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  <ArrowRightLeft className="w-5 h-5 text-indigo-600" />
                  Перераспределение бюджета
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Перенесите доступный остаток (сальдо) из одной категории в другую
                </p>
              </div>
              <button
                onClick={() => setIsReallocateModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReallocateSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* From Category */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Откуда забрать (Донор)
                  </label>
                  <select
                    value={reallocateFrom}
                    onChange={e => setReallocateFrom(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs bg-white text-gray-900"
                    required
                  >
                    {categoryBudgetStats.map(s => (
                      <option key={s.category} value={s.category}>
                        {s.category} (Сальдо: {s.saldo > 0 ? `+${s.saldo}` : s.saldo} ₸)
                      </option>
                    ))}
                  </select>
                </div>

                {/* To Category */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Куда добавить (Получатель)
                  </label>
                  <select
                    value={reallocateTo}
                    onChange={e => setReallocateTo(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs bg-white text-gray-900"
                    required
                  >
                    {categoryBudgetStats.map(s => (
                      <option key={s.category} value={s.category}>
                        {s.category} (Сальдо: {s.saldo > 0 ? `+${s.saldo}` : s.saldo} ₸)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Сумма перераспределения (₸)
                </label>
                <input
                  type="number"
                  step="100"
                  placeholder="0.00"
                  value={reallocateAmount}
                  onChange={e => setReallocateAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-bold text-gray-900"
                  required
                />
              </div>

              {/* Reason */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Причина / Комментарий (необязательно)
                </label>
                <input
                  type="text"
                  placeholder="Например: Покрытие перерасхода на продукты за счет кафе"
                  value={reallocateReason}
                  onChange={e => setReallocateReason(e.target.value)}
                  className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-xs text-gray-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsReallocateModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md flex items-center gap-1.5"
                >
                  <ArrowRightLeft className="w-4 h-4" />
                  Применить перераспределение
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. MODAL: ROLLOVER (ПЕРЕНОС ОСТАТКОВ С ПРОШЛОГО МЕСЯЦА) */}
      {isRolloverModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl border border-gray-100 p-6 space-y-4 animate-fade-in max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 flex-shrink-0">
              <div>
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  <RefreshCw className="w-5 h-5 text-blue-600" />
                  Перенос остатков с предыдущего периода
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Фактическое сальдо из прошлого месяца переносится в лимит текущего периода
                </p>
              </div>
              <button
                onClick={() => setIsRolloverModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 space-y-2 pr-1">
              {Object.keys(rolloverOptions).length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-6">
                  Нет данных для переноса из предыдущего месяца
                </p>
              ) : (
                (Object.entries(rolloverOptions) as [string, RolloverItem][]).map(([catName, data]) => (
                  <label
                    key={catName}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                      data.selected
                        ? 'border-blue-300 bg-blue-50/50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={data.selected}
                        onChange={e => {
                          setRolloverOptions({
                            ...rolloverOptions,
                            [catName]: { ...data, selected: e.target.checked }
                          });
                        }}
                        className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      />
                      <span className="font-semibold text-gray-900 text-xs sm:text-sm">
                        {catName}
                      </span>
                    </div>

                    <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                      data.amount >= 0
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}>
                      {data.amount > 0 ? `+${data.amount.toLocaleString('ru-RU')}` : data.amount.toLocaleString('ru-RU')} ₸
                    </span>
                  </label>
                ))
              )}

            </div>

            <div className="flex items-center justify-between pt-3 border-t border-gray-100 flex-shrink-0">
              <button
                type="button"
                onClick={() => {
                  const updated: typeof rolloverOptions = {};
                  Object.keys(rolloverOptions).forEach(k => {
                    updated[k] = { ...rolloverOptions[k], selected: true };
                  });
                  setRolloverOptions(updated);
                }}
                className="text-xs text-blue-600 hover:underline font-semibold"
              >
                Выбрать все
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsRolloverModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={handleApplyRollover}
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  Применить перенос
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 8. MODAL: REALLOCATION HISTORY */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl border border-gray-100 p-6 space-y-4 animate-fade-in max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 flex-shrink-0">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <History className="w-5 h-5 text-amber-600" />
                История перераспределений за период
              </h3>
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 space-y-2 pr-1">
              {reallocations.map(rec => (
                <div
                  key={rec.id}
                  className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="flex items-center gap-1.5 font-bold text-gray-800">
                      <span>{rec.fromCategory}</span>
                      <span className="text-gray-400">➔</span>
                      <span className="text-indigo-700">{rec.toCategory}</span>
                    </div>
                    <div className="text-[11px] text-gray-500 mt-0.5">
                      <span>{rec.date}</span>
                      {rec.reason && <span className="italic"> • {rec.reason}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="font-bold text-indigo-900 bg-indigo-50 px-2 py-1 rounded-md">
                      {rec.amount.toLocaleString('ru-RU')} ₸
                    </span>
                    <button
                      onClick={() => handleDeleteReallocation(rec.id)}
                      className="text-gray-400 hover:text-rose-600 p-1"
                      title="Отменить перераспределение"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-gray-100 text-right flex-shrink-0">
              <button
                type="button"
                onClick={() => setIsHistoryModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
