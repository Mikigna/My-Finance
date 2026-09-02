import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../db/database';
import type { PassiveIncomeSource, CurrencyRate, FreedomSettings, Transaction } from '../types';
import { 
  Sparkles, 
  Plus, 
  Settings as SettingsIcon, 
  Calculator, 
  TrendingUp, 
  DollarSign, 
  Building2, 
  PieChart, 
  Trash2, 
  Edit3, 
  Info, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight, 
  RefreshCw, 
  Percent, 
  ShieldCheck, 
  Coins, 
  Layers, 
  HelpCircle,
  Clock,
  ChevronRight,
  X,
  Lock,
  Compass
} from 'lucide-react';

export function FreedomTab() {
  // State for database records
  const [sources, setSources] = useState<PassiveIncomeSource[]>([]);
  const [currencies, setCurrencies] = useState<CurrencyRate[]>([]);
  const [settings, setSettings] = useState<FreedomSettings>({
    inflation: 8.5,
    expensePeriod: 3,
    useInflation: true,
    excludeIncomplete: true
  });
  const [allExpenses, setAllExpenses] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modals state
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<PassiveIncomeSource | null>(null);

  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isCalcDetailsModalOpen, setIsCalcDetailsModalOpen] = useState(false);
  const [deleteConfirmSource, setDeleteConfirmSource] = useState<PassiveIncomeSource | null>(null);

  // Toast message
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Load all initial data
  const loadData = async () => {
    try {
      const [dbSources, dbCurrencies, dbSettingsArray, dbExpenses] = await Promise.all([
        db.freedomSources.toArray(),
        db.freedomCurrencies.toArray(),
        db.freedomSettings.toArray(),
        db.expenses.where('type').equals('expense').toArray()
      ]);

      setSources(dbSources);
      setCurrencies(dbCurrencies);
      if (dbSettingsArray.length > 0) {
        setSettings(dbSettingsArray[0]);
      }
      setAllExpenses(dbExpenses);
    } catch (error) {
      console.error('Ошибка загрузки данных вкладки Свобода:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Convert rates into a fast lookup map: { 'USD': 500, 'EUR': 540, ... }
  const rateMap = useMemo(() => {
    const map: Record<string, number> = { KZT: 1 };
    currencies.forEach(c => {
      map[c.code.toUpperCase()] = c.rate;
    });
    return map;
  }, [currencies]);

  // Helper conversion to KZT
  const convertToKZT = (amount: number, currencyCode: string): number => {
    if (!amount) return 0;
    const code = currencyCode.toUpperCase();
    if (code === 'KZT') return amount;
    const rate = rateMap[code] || 1;
    return amount * rate;
  };

  // Helper calculate monthly income of a source in KZT
  const getSourceMonthlyIncomeKZT = (s: PassiveIncomeSource): number => {
    let incomeInCurrency = 0;
    if (s.incomeType === 'PERCENT') {
      const percent = s.incomePercent || 0;
      incomeInCurrency = (s.marketValue * (percent / 100)) / 12;
    } else {
      incomeInCurrency = s.incomeAbsolute || 0;
    }
    return convertToKZT(incomeInCurrency, s.currency);
  };

  // 1. Group expenses by month and calculate average based on settings
  const { avgExpenses, analyzedMonths, currentMonthExpenses } = useMemo(() => {
    const monthlyMap: Record<string, number> = {};
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    allExpenses.forEach(tx => {
      const monthKey = (tx.date || '').substring(0, 7);
      if (monthKey) {
        monthlyMap[monthKey] = (monthlyMap[monthKey] || 0) + tx.amount;
      }
    });

    const allMonthKeys = Object.keys(monthlyMap).sort((a, b) => b.localeCompare(a));
    const currentMonthSum = monthlyMap[currentMonthKey] || 0;

    let candidateKeys = allMonthKeys;
    if (settings.excludeIncomplete) {
      candidateKeys = allMonthKeys.filter(k => k !== currentMonthKey);
    }

    // Take the last N months according to expensePeriod setting
    const targetKeys = candidateKeys.slice(0, settings.expensePeriod);
    const monthsBreakdown = targetKeys.map(k => ({
      month: k,
      amount: monthlyMap[k] || 0
    }));

    let average = 0;
    if (monthsBreakdown.length > 0) {
      const total = monthsBreakdown.reduce((sum, item) => sum + item.amount, 0);
      average = total / monthsBreakdown.length;
    } else if (currentMonthSum > 0) {
      // Fallback if no full past months exist
      average = currentMonthSum;
    }

    return {
      avgExpenses: Math.round(average),
      analyzedMonths: monthsBreakdown,
      currentMonthExpenses: currentMonthSum
    };
  }, [allExpenses, settings.excludeIncomplete, settings.expensePeriod]);

  // 2. Aggregate Passive Income & Total Capital
  const totalPassiveIncomeKZT = useMemo(() => {
    return sources.reduce((sum, s) => sum + getSourceMonthlyIncomeKZT(s), 0);
  }, [sources, rateMap]);

  const totalCapitalKZT = useMemo(() => {
    return sources.reduce((sum, s) => sum + convertToKZT(s.marketValue, s.currency), 0);
  }, [sources, rateMap]);

  // 3. Freedom Calculation Core
  const freedomMetrics = useMemo(() => {
    // 3.1 Coverage Ratio
    const coverage = avgExpenses > 0 ? (totalPassiveIncomeKZT / avgExpenses) * 100 : (totalPassiveIncomeKZT > 0 ? 100 : 0);

    // 3.2 Deficit
    const deficit = Math.max(0, avgExpenses - totalPassiveIncomeKZT);

    // 3.3 Weighted / Default Expected Return
    let expectedReturn = 10; // default 10%
    if (sources.length > 0) {
      const totalW = sources.reduce((s, src) => s + convertToKZT(src.marketValue, src.currency), 0);
      if (totalW > 0) {
        const weightedSum = sources.reduce((s, src) => {
          return s + src.expectedReturn * convertToKZT(src.marketValue, src.currency);
        }, 0);
        expectedReturn = weightedSum / totalW;
      }
    }

    // 3.4 Required Additional Capital
    const requiredCapital = expectedReturn > 0 ? (deficit * 12) / (expectedReturn / 100) : 0;

    // 3.5 Inflation adjustment
    // Standard horizon assumption for goal: 5 years or based on accumulation
    const estimatedYears = deficit > 0 ? Math.min(25, Math.max(3, Math.ceil(requiredCapital / (Math.max(1, avgExpenses * 0.3 * 12))))) : 0;
    const inflationFactor = settings.useInflation ? Math.pow(1 + (settings.inflation || 8.5) / 100, estimatedYears || 5) : 1;
    const realCapital = requiredCapital * inflationFactor;

    // 3.6 Total Target Capital
    const targetCapital = totalCapitalKZT + realCapital;

    // 3.7 Progress
    const progress = targetCapital > 0 ? Math.min(100, (totalCapitalKZT / targetCapital) * 100) : (coverage >= 100 ? 100 : 0);

    return {
      coverage,
      deficit,
      expectedReturn,
      requiredCapital,
      realCapital,
      targetCapital,
      progress,
      estimatedYears,
      inflationFactor
    };
  }, [avgExpenses, totalPassiveIncomeKZT, totalCapitalKZT, sources, settings, rateMap]);

  // Freedom Level Badge
  const freedomLevel = useMemo(() => {
    const c = freedomMetrics.coverage;
    if (c >= 100) {
      return {
        title: 'Финансовая Свобода',
        subtitle: 'Пассивный доход на 100% покрывает все ваши расходы!',
        color: 'from-emerald-500 to-teal-600',
        textColor: 'text-emerald-700',
        bgColor: 'bg-emerald-50',
        borderColor: 'border-emerald-200',
        badgeColor: 'bg-emerald-600 text-white',
        icon: Sparkles
      };
    } else if (c >= 80) {
      return {
        title: 'Финансовая Независимость',
        subtitle: 'Покрыто 80%+ расходов. Финишная прямая к полной свободе.',
        color: 'from-blue-600 to-indigo-600',
        textColor: 'text-blue-700',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200',
        badgeColor: 'bg-blue-600 text-white',
        icon: ShieldCheck
      };
    } else if (c >= 50) {
      return {
        title: 'Финансовая Безопасность',
        subtitle: 'Покрыта половина расходов. Отличный фундамент устойчивости.',
        color: 'from-indigo-500 to-purple-600',
        textColor: 'text-indigo-700',
        bgColor: 'bg-indigo-50',
        borderColor: 'border-indigo-200',
        badgeColor: 'bg-indigo-600 text-white',
        icon: TrendingUp
      };
    } else if (c >= 25) {
      return {
        title: 'Финансовая Стабильность',
        subtitle: 'Четверть расходов закрывается активами. Хороший старт.',
        color: 'from-amber-500 to-orange-600',
        textColor: 'text-amber-800',
        bgColor: 'bg-amber-50',
        borderColor: 'border-amber-200',
        badgeColor: 'bg-amber-600 text-white',
        icon: Coins
      };
    } else {
      return {
        title: 'Формирование Капитала',
        subtitle: 'Начальный этап: инвестируйте излишки для запуска денежного потока.',
        color: 'from-slate-600 to-slate-800',
        textColor: 'text-slate-700',
        bgColor: 'bg-slate-50',
        borderColor: 'border-slate-200',
        badgeColor: 'bg-slate-700 text-white',
        icon: Layers
      };
    }
  }, [freedomMetrics.coverage]);

  // Handlers for Sources
  const handleSaveSource = async (sourceData: Omit<PassiveIncomeSource, 'id'>, id?: number) => {
    try {
      const now = new Date().toISOString();
      if (id) {
        await db.freedomSources.update(id, {
          ...sourceData,
          updatedAt: now
        });
        showToast('Источник дохода успешно обновлен');
      } else {
        await db.freedomSources.add({
          ...sourceData,
          createdAt: now,
          updatedAt: now
        });
        showToast('Новый источник дохода добавлен');
      }
      setIsAddEditModalOpen(false);
      setEditingSource(null);
      await loadData();
    } catch (e) {
      console.error('Ошибка сохранения источника:', e);
      alert('Не удалось сохранить источник дохода');
    }
  };

  const handleDeleteSource = async (source: PassiveIncomeSource) => {
    if (!source.id) return;
    try {
      await db.freedomSources.delete(source.id);
      showToast(`Источник «${source.name}» удален`);
      setDeleteConfirmSource(null);
      await loadData();
    } catch (e) {
      console.error('Ошибка удаления источника:', e);
      alert('Не удалось удалить источник');
    }
  };

  // Preset fast templates for empty state
  const handleAddPreset = async (preset: {
    name: string;
    currency: string;
    marketValue: number;
    incomeType: 'PERCENT' | 'ABSOLUTE';
    incomePercent?: number;
    incomeAbsolute?: number;
    expectedReturn: number;
  }) => {
    try {
      const now = new Date().toISOString();
      await db.freedomSources.add({
        ...preset,
        createdAt: now,
        updatedAt: now
      });
      showToast(`Добавлен шаблон: «${preset.name}»`);
      await loadData();
    } catch (e) {
      console.error(e);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-40 bg-gray-200 rounded-3xl" />
        <div className="h-32 bg-gray-200 rounded-2xl" />
        <div className="h-64 bg-gray-200 rounded-2xl" />
      </div>
    );
  }

  const LevelIcon = freedomLevel.icon;

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 right-4 sm:right-6 z-50 bg-gray-900 text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 text-xs sm:text-sm font-medium animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* HERO CARD: Header & Level */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-blue-950 text-white shadow-xl border border-white/10 p-5 sm:p-7">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-56 h-56 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-56 h-56 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-5">
          {/* Top Line: Badge & Quick Settings Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className={`inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-bold tracking-wide shadow-sm ${freedomLevel.badgeColor}`}>
                <LevelIcon className="w-3.5 h-3.5" />
                {freedomLevel.title}
              </span>
              <span className="text-xs text-blue-200/80 hidden sm:inline">
                Покрытие: {freedomMetrics.coverage.toFixed(1)}%
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsCalcDetailsModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 active:bg-white/30 rounded-xl text-xs font-medium text-white backdrop-blur-md border border-white/15 transition-all"
                title="Посмотреть все формулы и подробный расчет"
              >
                <Calculator className="w-3.5 h-3.5 text-blue-300" />
                <span className="hidden sm:inline">Расчёт точки свободы</span>
                <span className="sm:hidden">Формулы</span>
              </button>

              <button
                onClick={() => setIsSettingsModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 active:bg-white/30 rounded-xl text-xs font-medium text-white backdrop-blur-md border border-white/15 transition-all"
                title="Настроить инфляцию, период усреднения и курсы валют"
              >
                <SettingsIcon className="w-3.5 h-3.5 text-amber-300" />
                <span>Настройки</span>
              </button>
            </div>
          </div>

          {/* Main Hero KPI Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
            {/* 1. Monthly Passive Income */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/15 shadow-xs">
              <div className="flex items-center justify-between text-blue-200 text-xs font-medium mb-1">
                <span>Пассивный доход в месяц</span>
                <Sparkles className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                {Math.round(totalPassiveIncomeKZT).toLocaleString('ru-RU')} ₸
              </div>
              <div className="text-[11px] text-blue-200/70 mt-1 flex items-center gap-1">
                <span>Из {sources.length} {sources.length === 1 ? 'источника' : sources.length > 4 ? 'источников' : 'источников'}</span>
              </div>
            </div>

            {/* 2. Monthly Expenses Benchmark */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/15 shadow-xs">
              <div className="flex items-center justify-between text-blue-200 text-xs font-medium mb-1">
                <span>Среднемесячные расходы</span>
                <span className="text-[10px] bg-white/15 px-2 py-0.5 rounded-md text-blue-100">
                  за {settings.expensePeriod} мес.
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                {avgExpenses.toLocaleString('ru-RU')} ₸
              </div>
              <div className="text-[11px] text-blue-200/70 mt-1">
                {freedomMetrics.deficit > 0 ? (
                  <span className="text-amber-300 font-semibold">Дефицит: -{Math.round(freedomMetrics.deficit).toLocaleString('ru-RU')} ₸/мес</span>
                ) : (
                  <span className="text-emerald-300 font-semibold">Профицит: +{Math.round(totalPassiveIncomeKZT - avgExpenses).toLocaleString('ru-RU')} ₸/мес</span>
                )}
              </div>
            </div>

            {/* 3. Target vs Current Capital */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/15 shadow-xs sm:col-span-2 lg:col-span-1">
              <div className="flex items-center justify-between text-blue-200 text-xs font-medium mb-1">
                <span>Целевой капитал</span>
                <Coins className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                {Math.round(freedomMetrics.targetCapital).toLocaleString('ru-RU')} ₸
              </div>
              <div className="text-[11px] text-blue-200/70 mt-1 flex items-center justify-between">
                <span>Накоплено: {Math.round(totalCapitalKZT).toLocaleString('ru-RU')} ₸</span>
                <span className="font-bold text-emerald-300">{freedomMetrics.progress.toFixed(1)}%</span>
              </div>
            </div>
          </div>

          {/* Progress Bar towards Freedom */}
          <div className="space-y-2 pt-1">
            <div className="flex justify-between items-center text-xs text-blue-100 font-medium">
              <span className="flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-blue-300" />
                Шкала покрытия расходов
              </span>
              <span className="font-bold text-white text-sm">
                {freedomMetrics.coverage.toFixed(1)}% из 100%
              </span>
            </div>
            <div className="w-full bg-black/30 h-3 rounded-full overflow-hidden p-0.5 border border-white/10">
              <div 
                className={`h-full rounded-full transition-all duration-700 bg-gradient-to-r ${freedomLevel.color}`}
                style={{ width: `${Math.min(freedomMetrics.coverage, 100)}%` }}
              />
            </div>
            <p className="text-[11px] text-blue-200/70 text-right">
              {freedomLevel.subtitle}
            </p>
          </div>
        </div>
      </div>

      {/* QUICK CURRENCY RATES BAR */}
      <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
          <DollarSign className="w-4 h-4 text-blue-600" />
          <span>Курсы валют к тенге (₸):</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {currencies.map(c => (
            <div key={c.code} className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-xl text-xs font-semibold text-slate-800">
              <span className="text-slate-500 font-bold">{c.code}:</span>
              <span>{c.rate.toLocaleString('ru-RU')} ₸</span>
            </div>
          ))}
          <button
            onClick={() => setIsSettingsModalOpen(true)}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium hover:underline px-1 py-1"
          >
            Изменить
          </button>
        </div>
      </div>

      {/* SOURCES HEADER & ACTIONS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-600" />
            Источники пассивного дохода
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Активы, приносящие регулярный доход: аренда недвижимости, дивиденды, проценты по депозитам и облигациям
          </p>
        </div>

        <button
          onClick={() => {
            setEditingSource(null);
            setIsAddEditModalOpen(true);
          }}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-2xl text-sm font-bold shadow-md shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          <span>Добавить источник</span>
        </button>
      </div>

      {/* SOURCES LIST OR EMPTY STATE */}
      {sources.length === 0 ? (
        <div className="bg-white rounded-3xl p-6 sm:p-10 border border-dashed border-slate-300 text-center space-y-5">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
            <Building2 className="w-8 h-8" />
          </div>

          <div className="max-w-md mx-auto space-y-1.5">
            <h3 className="text-lg font-extrabold text-gray-900">Добавьте первый источник дохода</h3>
            <p className="text-xs sm:text-sm text-gray-500">
              Внесите ваши текущие активы или выберите готовый шаблон ниже, чтобы увидеть расчёт вашей точки финансовой свободы.
            </p>
          </div>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-2 max-w-xl mx-auto">
            <button
              onClick={() => handleAddPreset({
                name: 'Квартира под аренду',
                currency: 'KZT',
                marketValue: 28000000,
                incomeType: 'ABSOLUTE',
                incomeAbsolute: 220000,
                expectedReturn: 10
              })}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5"
            >
              <Building2 className="w-3.5 h-3.5 text-blue-600" />
              + Квартира (Аренда 220 000 ₸)
            </button>

            <button
              onClick={() => handleAddPreset({
                name: 'Сберегательный Депозит KZT',
                currency: 'KZT',
                marketValue: 5000000,
                incomeType: 'PERCENT',
                incomePercent: 14.5,
                expectedReturn: 12
              })}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5"
            >
              <Coins className="w-3.5 h-3.5 text-emerald-600" />
              + Депозит KZT (14.5% годовых)
            </button>

            <button
              onClick={() => handleAddPreset({
                name: 'Облигации в USD',
                currency: 'USD',
                marketValue: 15000,
                incomeType: 'PERCENT',
                incomePercent: 7.5,
                expectedReturn: 9
              })}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5"
            >
              <DollarSign className="w-3.5 h-3.5 text-indigo-600" />
              + Облигации $15 000 (7.5% USD)
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sources.map(source => {
            const monthlyIncomeKZT = getSourceMonthlyIncomeKZT(source);
            const marketValueKZT = convertToKZT(source.marketValue, source.currency);
            const isForeign = source.currency.toUpperCase() !== 'KZT';

            return (
              <div 
                key={source.id} 
                className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
              >
                <div>
                  {/* Card Header: Name + Actions */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold uppercase ${
                          source.currency === 'KZT' 
                            ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                            : source.currency === 'USD'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-purple-50 text-purple-700 border border-purple-200'
                        }`}>
                          {source.currency}
                        </span>
                        <h3 className="font-extrabold text-base text-gray-900 tracking-tight group-hover:text-blue-600 transition-colors">
                          {source.name}
                        </h3>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditingSource(source);
                          setIsAddEditModalOpen(true);
                        }}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
                        title="Редактировать источник"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirmSource(source)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                        title="Удалить источник"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Card Metrics Grid */}
                  <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-slate-100">
                    <div>
                      <span className="text-[11px] text-slate-500 block font-medium">Рыночная стоимость</span>
                      <span className="text-sm font-bold text-gray-900 block">
                        {source.marketValue.toLocaleString('ru-RU')} {source.currency}
                      </span>
                      {isForeign && (
                        <span className="text-[10px] text-slate-400 block">
                          ≈ {Math.round(marketValueKZT).toLocaleString('ru-RU')} ₸
                        </span>
                      )}
                    </div>

                    <div>
                      <span className="text-[11px] text-slate-500 block font-medium">Доходность</span>
                      <span className="text-sm font-bold text-indigo-700 block">
                        {source.incomeType === 'PERCENT' 
                          ? `${source.incomePercent || 0}% годовых` 
                          : `${(source.incomeAbsolute || 0).toLocaleString('ru-RU')} ${source.currency}/мес`}
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        Цель: {source.expectedReturn}% год.
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Footer: Monthly Yield in KZT */}
                <div className="mt-4 pt-3 border-t border-slate-100 bg-slate-50/80 -mx-5 -mb-5 px-5 py-3 rounded-b-3xl flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600">Доход в месяц (₸):</span>
                  <span className="text-base font-extrabold text-emerald-600">
                    +{Math.round(monthlyIncomeKZT).toLocaleString('ru-RU')} ₸
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* EXPENSE BENCHMARK DETAIL BOX */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <PieChart className="w-5 h-5 text-indigo-600" />
            <h3 className="font-extrabold text-base text-gray-900">
              База расходов из отчетов ({settings.expensePeriod} {settings.expensePeriod === 1 ? 'месяц' : settings.expensePeriod > 4 ? 'месяцев' : 'месяца'})
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            {settings.excludeIncomplete ? 'Текущий неполный месяц исключен' : 'Включая текущий месяц'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-100">
            <span className="text-xs text-slate-500 block font-medium">Средний расход в месяц</span>
            <span className="text-xl font-extrabold text-gray-900 block mt-0.5">
              {avgExpenses.toLocaleString('ru-RU')} ₸
            </span>
          </div>

          <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-100">
            <span className="text-xs text-slate-500 block font-medium">Текущий месяц (факт)</span>
            <span className="text-xl font-bold text-slate-700 block mt-0.5">
              {currentMonthExpenses.toLocaleString('ru-RU')} ₸
            </span>
          </div>

          <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-100">
            <span className="text-xs text-slate-500 block font-medium">Коэфф. инфляции</span>
            <span className="text-xl font-bold text-amber-600 block mt-0.5">
              {settings.useInflation ? `${settings.inflation}%` : 'Выкл'}
            </span>
          </div>
        </div>

        {analyzedMonths.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              Учтённые месяцы для усреднения:
            </span>
            <div className="flex flex-wrap gap-2">
              {analyzedMonths.map(m => (
                <div key={m.month} className="bg-slate-100 text-slate-800 text-xs px-3 py-1.5 rounded-xl font-medium flex items-center gap-2">
                  <span className="font-bold">{m.month}:</span>
                  <span>{m.amount.toLocaleString('ru-RU')} ₸</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: ADD / EDIT SOURCE                                                */}
      {/* ========================================================================= */}
      {isAddEditModalOpen && (
        <AddEditSourceModal
          source={editingSource}
          currencies={currencies}
          rateMap={rateMap}
          onClose={() => {
            setIsAddEditModalOpen(false);
            setEditingSource(null);
          }}
          onSave={handleSaveSource}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: SETTINGS & CURRENCY RATES                                        */}
      {/* ========================================================================= */}
      {isSettingsModalOpen && (
        <FreedomSettingsModal
          settings={settings}
          currencies={currencies}
          onClose={() => setIsSettingsModalOpen(false)}
          onSave={async (newSettings, newCurrencies) => {
            try {
              // Update settings in DB
              const dbSettings = await db.freedomSettings.toArray();
              if (dbSettings.length > 0 && dbSettings[0].id) {
                await db.freedomSettings.update(dbSettings[0].id, newSettings);
              } else {
                await db.freedomSettings.add(newSettings);
              }

              // Update currencies in DB
              await db.freedomCurrencies.clear();
              await db.freedomCurrencies.bulkAdd(newCurrencies);

              setSettings(newSettings);
              setCurrencies(newCurrencies);
              setIsSettingsModalOpen(false);
              showToast('Настройки и курсы валют сохранены');
              await loadData();
            } catch (e) {
              console.error(e);
              alert('Ошибка сохранения настроек');
            }
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: CALCULATION DETAILS & FORMULAS                                   */}
      {/* ========================================================================= */}
      {isCalcDetailsModalOpen && (
        <FreedomCalculationModal
          metrics={freedomMetrics}
          avgExpenses={avgExpenses}
          totalPassiveIncome={totalPassiveIncomeKZT}
          totalCapital={totalCapitalKZT}
          settings={settings}
          onClose={() => setIsCalcDetailsModalOpen(false)}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: DELETE CONFIRMATION                                              */}
      {/* ========================================================================= */}
      {deleteConfirmSource && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="font-extrabold text-lg text-gray-900">Удалить источник?</h3>
              <p className="text-xs text-gray-500">
                Вы действительно хотите удалить источник «{deleteConfirmSource.name}»? Это действие необратимо.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setDeleteConfirmSource(null)}
                className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={() => handleDeleteSource(deleteConfirmSource)}
                className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs shadow-md shadow-rose-600/20 transition-colors"
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------------------------------------
// SUB-COMPONENT: ADD/EDIT SOURCE MODAL
// ------------------------------------------------------------------------------------------------
interface AddEditSourceModalProps {
  source: PassiveIncomeSource | null;
  currencies: CurrencyRate[];
  rateMap: Record<string, number>;
  onClose: () => void;
  onSave: (data: Omit<PassiveIncomeSource, 'id'>, id?: number) => void;
}

function AddEditSourceModal({ source, currencies, rateMap, onClose, onSave }: AddEditSourceModalProps) {
  const [name, setName] = useState(source?.name || '');
  const [currency, setCurrency] = useState(source?.currency || 'KZT');
  const [marketValue, setMarketValue] = useState<string>(source ? String(source.marketValue) : '');
  const [incomeType, setIncomeType] = useState<'PERCENT' | 'ABSOLUTE'>(source?.incomeType || 'PERCENT');
  const [incomePercent, setIncomePercent] = useState<string>(source?.incomePercent ? String(source.incomePercent) : '10');
  const [incomeAbsolute, setIncomeAbsolute] = useState<string>(source?.incomeAbsolute ? String(source.incomeAbsolute) : '');
  const [expectedReturn, setExpectedReturn] = useState<string>(source ? String(source.expectedReturn) : '10');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Live calculation of income in modal
  const liveIncome = useMemo(() => {
    const val = parseFloat(marketValue) || 0;
    const cur = currency.toUpperCase();
    const rate = rateMap[cur] || 1;

    let monthlyInCur = 0;
    if (incomeType === 'PERCENT') {
      const pct = parseFloat(incomePercent) || 0;
      monthlyInCur = (val * (pct / 100)) / 12;
    } else {
      monthlyInCur = parseFloat(incomeAbsolute) || 0;
    }

    const monthlyInKZT = cur === 'KZT' ? monthlyInCur : monthlyInCur * rate;
    const totalValKZT = cur === 'KZT' ? val : val * rate;

    return {
      monthlyInCur: Math.round(monthlyInCur),
      monthlyInKZT: Math.round(monthlyInKZT),
      totalValKZT: Math.round(totalValKZT)
    };
  }, [marketValue, currency, incomeType, incomePercent, incomeAbsolute, rateMap]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!name.trim() || name.trim().length < 2) {
      newErrors.name = 'Название обязательно (минимум 2 символа)';
    }

    const val = parseFloat(marketValue);
    if (isNaN(val) || val <= 0) {
      newErrors.marketValue = 'Стоимость должна быть больше 0';
    }

    if (incomeType === 'PERCENT') {
      const pct = parseFloat(incomePercent);
      if (isNaN(pct) || pct < 0 || pct > 100) {
        newErrors.incomePercent = 'Процент доходности должен быть от 0 до 100%';
      }
    } else {
      const abs = parseFloat(incomeAbsolute);
      if (isNaN(abs) || abs <= 0) {
        newErrors.incomeAbsolute = 'Сумма дохода в месяц должна быть больше 0';
      }
    }

    const expRet = parseFloat(expectedReturn);
    if (isNaN(expRet) || expRet <= 0 || expRet > 100) {
      newErrors.expectedReturn = 'Ожидаемая доходность должна быть от 1 до 100%';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSave({
      name: name.trim(),
      currency: currency.toUpperCase(),
      marketValue: parseFloat(marketValue),
      incomeType,
      incomePercent: incomeType === 'PERCENT' ? parseFloat(incomePercent) : undefined,
      incomeAbsolute: incomeType === 'ABSOLUTE' ? parseFloat(incomeAbsolute) : undefined,
      expectedReturn: parseFloat(expectedReturn)
    }, source?.id);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-7 shadow-2xl space-y-5 animate-in zoom-in-95 my-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-600" />
            <h3 className="font-extrabold text-lg text-gray-900">
              {source ? 'Редактировать источник' : 'Новый источник дохода'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Название источника *
            </label>
            <input
              type="text"
              value={name}
              onChange={e => {
                setName(e.target.value);
                if (errors.name) setErrors({ ...errors, name: '' });
              }}
              placeholder="Например: Квартира на Абая, Облигации KASE, Депозит"
              className={`w-full px-3.5 py-2.5 rounded-2xl border text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden transition-all ${
                errors.name ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200 bg-slate-50/50'
              }`}
            />
            {errors.name && <p className="text-[11px] text-rose-600 mt-1">{errors.name}</p>}
          </div>

          {/* Currency & Market Value */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Валюта *
              </label>
              <select
                value={currency}
                onChange={e => setCurrency(e.target.value)}
                className="w-full px-3 py-2.5 rounded-2xl border border-slate-200 bg-slate-50/50 text-sm font-bold focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              >
                <option value="KZT">KZT (₸)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="RUB">RUB (₽)</option>
                {currencies
                  .filter(c => !['KZT', 'USD', 'EUR', 'RUB'].includes(c.code.toUpperCase()))
                  .map(c => (
                    <option key={c.code} value={c.code}>{c.code}</option>
                  ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Рыночная стоимость (в валюте) *
              </label>
              <input
                type="number"
                step="any"
                value={marketValue}
                onChange={e => {
                  setMarketValue(e.target.value);
                  if (errors.marketValue) setErrors({ ...errors, marketValue: '' });
                }}
                placeholder="25000000"
                className={`w-full px-3.5 py-2.5 rounded-2xl border text-sm font-bold focus:ring-2 focus:ring-blue-500 focus:outline-hidden ${
                  errors.marketValue ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200 bg-slate-50/50'
                }`}
              />
              {errors.marketValue && <p className="text-[11px] text-rose-600 mt-1">{errors.marketValue}</p>}
            </div>
          </div>

          {/* Yield Type Selector */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">
              Тип доходности *
            </label>
            <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-2xl">
              <button
                type="button"
                onClick={() => setIncomeType('PERCENT')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                  incomeType === 'PERCENT'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                % Годовых
              </button>
              <button
                type="button"
                onClick={() => setIncomeType('ABSOLUTE')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                  incomeType === 'ABSOLUTE'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Сумма в месяц
              </button>
            </div>
          </div>

          {/* Yield Value Inputs */}
          {incomeType === 'PERCENT' ? (
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Доходность (% годовых) *
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  value={incomePercent}
                  onChange={e => {
                    setIncomePercent(e.target.value);
                    if (errors.incomePercent) setErrors({ ...errors, incomePercent: '' });
                  }}
                  placeholder="10.5"
                  className={`w-full px-3.5 py-2.5 rounded-2xl border text-sm font-bold focus:ring-2 focus:ring-blue-500 focus:outline-hidden ${
                    errors.incomePercent ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200 bg-slate-50/50'
                  }`}
                />
                <Percent className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
              </div>
              {errors.incomePercent && <p className="text-[11px] text-rose-600 mt-1">{errors.incomePercent}</p>}
            </div>
          ) : (
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Сумма дохода в месяц ({currency}) *
              </label>
              <input
                type="number"
                step="any"
                value={incomeAbsolute}
                onChange={e => {
                  setIncomeAbsolute(e.target.value);
                  if (errors.incomeAbsolute) setErrors({ ...errors, incomeAbsolute: '' });
                }}
                placeholder="200000"
                className={`w-full px-3.5 py-2.5 rounded-2xl border text-sm font-bold focus:ring-2 focus:ring-blue-500 focus:outline-hidden ${
                  errors.incomeAbsolute ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200 bg-slate-50/50'
                }`}
              />
              {errors.incomeAbsolute && <p className="text-[11px] text-rose-600 mt-1">{errors.incomeAbsolute}</p>}
            </div>
          )}

          {/* Expected Return for New Investments */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Ожидаемая доходность новых вложений (% годовых)
            </label>
            <input
              type="number"
              step="0.5"
              value={expectedReturn}
              onChange={e => {
                setExpectedReturn(e.target.value);
                if (errors.expectedReturn) setErrors({ ...errors, expectedReturn: '' });
              }}
              placeholder="10"
              className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 bg-slate-50/50 text-sm font-bold focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Используется в формуле расчета целевого капитала для покрытия дефицита.
            </p>
          </div>

          {/* LIVE SUMMARY BANNER */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-3.5 space-y-1">
            <span className="text-[11px] font-bold text-blue-900 block">
              💡 Предпросмотр дохода от актива:
            </span>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600">В месяц:</span>
              <span className="font-extrabold text-emerald-700 text-sm">
                +{liveIncome.monthlyInKZT.toLocaleString('ru-RU')} ₸ / мес
              </span>
            </div>
            {currency !== 'KZT' && (
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>В валюте ({currency}):</span>
                <span>+{liveIncome.monthlyInCur.toLocaleString('ru-RU')} {currency}</span>
              </div>
            )}
          </div>

          {/* Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold text-xs transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-xs shadow-md shadow-blue-600/20 transition-colors"
            >
              {source ? 'Сохранить изменения' : 'Добавить источник'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------
// SUB-COMPONENT: SETTINGS & CURRENCIES MODAL
// ------------------------------------------------------------------------------------------------
interface FreedomSettingsModalProps {
  settings: FreedomSettings;
  currencies: CurrencyRate[];
  onClose: () => void;
  onSave: (newSettings: FreedomSettings, newCurrencies: CurrencyRate[]) => void;
}

function FreedomSettingsModal({ settings, currencies, onClose, onSave }: FreedomSettingsModalProps) {
  const [inflation, setInflation] = useState<string>(String(settings.inflation));
  const [expensePeriod, setExpensePeriod] = useState<number>(settings.expensePeriod);
  const [useInflation, setUseInflation] = useState<boolean>(settings.useInflation);
  const [excludeIncomplete, setExcludeIncomplete] = useState<boolean>(settings.excludeIncomplete);

  const [rates, setRates] = useState<CurrencyRate[]>(currencies);
  const [newCurrencyCode, setNewCurrencyCode] = useState('');
  const [newCurrencyRate, setNewCurrencyRate] = useState('');

  const handleAddCurrency = () => {
    const code = newCurrencyCode.trim().toUpperCase();
    const rate = parseFloat(newCurrencyRate);
    if (!code || isNaN(rate) || rate <= 0) {
      alert('Введите корректный код валюты (например USDT) и курс');
      return;
    }
    if (rates.some(r => r.code === code)) {
      alert('Валюта с таким кодом уже существует');
      return;
    }
    setRates([...rates, { code, rate, updatedAt: new Date().toISOString() }]);
    setNewCurrencyCode('');
    setNewCurrencyRate('');
  };

  const handleUpdateRate = (index: number, newRateVal: string) => {
    const val = parseFloat(newRateVal) || 0;
    const updated = [...rates];
    updated[index] = { ...updated[index], rate: val, updatedAt: new Date().toISOString() };
    setRates(updated);
  };

  const handleDeleteCurrency = (index: number) => {
    const updated = rates.filter((_, i) => i !== index);
    setRates(updated);
  };

  const handleSave = () => {
    const inf = parseFloat(inflation);
    if (isNaN(inf) || inf < 0 || inf > 100) {
      alert('Укажите корректный процент инфляции (от 0 до 100%)');
      return;
    }

    onSave(
      {
        inflation: inf,
        expensePeriod,
        useInflation,
        excludeIncomplete
      },
      rates
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-7 shadow-2xl space-y-5 animate-in zoom-in-95 my-auto max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-amber-500" />
            <h3 className="font-extrabold text-lg text-gray-900">
              Настройки и Курсы валют
            </h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-5">
          {/* 1. CURRENCY RATES TABLE */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-blue-600" />
              Курсы валют к тенге (1 единица = X ₸)
            </h4>

            <div className="space-y-2">
              {rates.map((c, idx) => (
                <div key={c.code} className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-2xl border border-slate-200">
                  <span className="w-16 font-extrabold text-sm text-slate-800 px-2">{c.code}</span>
                  <input
                    type="number"
                    step="any"
                    value={c.rate}
                    onChange={e => handleUpdateRate(idx, e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-sm font-bold focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                  <span className="text-xs text-slate-500 font-bold px-1">₸</span>
                  {!['USD', 'EUR', 'RUB'].includes(c.code) && (
                    <button
                      type="button"
                      onClick={() => handleDeleteCurrency(idx)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Add Custom Currency */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={newCurrencyCode}
                onChange={e => setNewCurrencyCode(e.target.value)}
                placeholder="Код (CNY, USDT)"
                className="w-28 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold uppercase focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
              <input
                type="number"
                step="any"
                value={newCurrencyRate}
                onChange={e => setNewCurrencyRate(e.target.value)}
                placeholder="Курс к ₸"
                className="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
              <button
                type="button"
                onClick={handleAddCurrency}
                className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl text-xs font-bold transition-colors"
              >
                + Добавить
              </button>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              Параметры расчёта целей
            </h4>

            {/* Expense Averaging Period */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Период усреднения расходов
              </label>
              <select
                value={expensePeriod}
                onChange={e => setExpensePeriod(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 bg-slate-50/50 text-sm font-bold focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              >
                <option value={1}>1 месяц (последний полный)</option>
                <option value={3}>3 месяца (рекомендуется)</option>
                <option value={6}>6 месяцев (сглаживание сезонности)</option>
                <option value={12}>12 месяцев (годовой цикл)</option>
              </select>
            </div>

            {/* Inflation Rate */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Годовая инфляция (%)
              </label>
              <input
                type="number"
                step="0.1"
                value={inflation}
                onChange={e => setInflation(e.target.value)}
                placeholder="8.5"
                className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 bg-slate-50/50 text-sm font-bold focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            {/* Toggles */}
            <div className="space-y-3 pt-1">
              <label className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-200 cursor-pointer">
                <div>
                  <span className="text-xs font-bold text-gray-900 block">Учитывать инфляцию</span>
                  <span className="text-[11px] text-gray-500 block">Корректировать целевой капитал на покупательную способность</span>
                </div>
                <input
                  type="checkbox"
                  checked={useInflation}
                  onChange={e => setUseInflation(e.target.checked)}
                  className="w-5 h-5 text-blue-600 rounded-lg focus:ring-blue-500"
                />
              </label>

              <label className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-200 cursor-pointer">
                <div>
                  <span className="text-xs font-bold text-gray-900 block">Исключать неполный текущий месяц</span>
                  <span className="text-[11px] text-gray-500 block">Не занижать средние расходы текущим незавершенным месяцем</span>
                </div>
                <input
                  type="checkbox"
                  checked={excludeIncomplete}
                  onChange={e => setExcludeIncomplete(e.target.checked)}
                  className="w-5 h-5 text-blue-600 rounded-lg focus:ring-blue-500"
                />
              </label>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold text-xs transition-colors"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-xs shadow-md shadow-blue-600/20 transition-colors"
            >
              Сохранить настройки
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------
// SUB-COMPONENT: CALCULATION FORMULAS MODAL
// ------------------------------------------------------------------------------------------------
interface FreedomCalculationModalProps {
  metrics: {
    coverage: number;
    deficit: number;
    expectedReturn: number;
    requiredCapital: number;
    realCapital: number;
    targetCapital: number;
    progress: number;
    estimatedYears: number;
    inflationFactor: number;
  };
  avgExpenses: number;
  totalPassiveIncome: number;
  totalCapital: number;
  settings: FreedomSettings;
  onClose: () => void;
}

function FreedomCalculationModal({ metrics, avgExpenses, totalPassiveIncome, totalCapital, settings, onClose }: FreedomCalculationModalProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-xl w-full p-5 sm:p-7 shadow-2xl space-y-5 animate-in zoom-in-95 my-auto max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-indigo-600" />
            <h3 className="font-extrabold text-lg text-gray-900">
              Математика и Расчёт Точки Свободы
            </h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 text-xs sm:text-sm text-slate-700">
          <p className="text-slate-500 text-xs leading-relaxed">
            Расчёт базируется на принципах правила 4% (Trinity Study) с адаптацией под доходность активов и инфляцию в Казахстане.
          </p>

          {/* Formula 1: Coverage */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between font-bold text-gray-900">
              <span>1. Коэффициент покрытия</span>
              <span className="text-blue-600 font-extrabold">{metrics.coverage.toFixed(1)}%</span>
            </div>
            <code className="block bg-white p-2 rounded-xl border border-slate-200 text-slate-800 text-[11px]">
              Покрытие = ПассивныйДоход / Расходы × 100%
            </code>
            <p className="text-[11px] text-slate-500">
              = {Math.round(totalPassiveIncome).toLocaleString('ru-RU')} ₸ / {avgExpenses.toLocaleString('ru-RU')} ₸ × 100% = {metrics.coverage.toFixed(1)}%
            </p>
          </div>

          {/* Formula 2: Deficit */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between font-bold text-gray-900">
              <span>2. Дефицит пассивного дохода</span>
              <span className="text-rose-600 font-extrabold">{Math.round(metrics.deficit).toLocaleString('ru-RU')} ₸/мес</span>
            </div>
            <code className="block bg-white p-2 rounded-xl border border-slate-200 text-slate-800 text-[11px]">
              Дефицит = Расходы - ПассивныйДоход
            </code>
            <p className="text-[11px] text-slate-500">
              = {avgExpenses.toLocaleString('ru-RU')} ₸ - {Math.round(totalPassiveIncome).toLocaleString('ru-RU')} ₸ = {Math.round(metrics.deficit).toLocaleString('ru-RU')} ₸/мес
            </p>
          </div>

          {/* Formula 3: Required Capital */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between font-bold text-gray-900">
              <span>3. Необходимый капитал (без инфляции)</span>
              <span className="text-gray-900 font-extrabold">{Math.round(metrics.requiredCapital).toLocaleString('ru-RU')} ₸</span>
            </div>
            <code className="block bg-white p-2 rounded-xl border border-slate-200 text-slate-800 text-[11px]">
              НеобходимыйКапитал = (Дефицит × 12) / ОжидаемаяДоходность × 100
            </code>
            <p className="text-[11px] text-slate-500">
              = ({Math.round(metrics.deficit).toLocaleString('ru-RU')} × 12) / {metrics.expectedReturn.toFixed(1)}% = {Math.round(metrics.requiredCapital).toLocaleString('ru-RU')} ₸
            </p>
          </div>

          {/* Formula 4: Inflation Adjusted */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between font-bold text-gray-900">
              <span>4. Капитал с учётом инфляции ({settings.inflation}%)</span>
              <span className="text-amber-700 font-extrabold">{Math.round(metrics.realCapital).toLocaleString('ru-RU')} ₸</span>
            </div>
            <code className="block bg-white p-2 rounded-xl border border-slate-200 text-slate-800 text-[11px]">
              ИнфляционныйФактор = (1 + Инфляция/100)^Годы ({metrics.inflationFactor.toFixed(2)}x)
            </code>
            <p className="text-[11px] text-slate-500">
              = {Math.round(metrics.requiredCapital).toLocaleString('ru-RU')} ₸ × {metrics.inflationFactor.toFixed(2)} = {Math.round(metrics.realCapital).toLocaleString('ru-RU')} ₸
            </p>
          </div>

          {/* Formula 5: Total Target Capital & Progress */}
          <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-2xl p-4 space-y-2 shadow-md">
            <div className="flex items-center justify-between font-bold text-white">
              <span>5. Общий целевой капитал</span>
              <span className="text-emerald-400 font-extrabold text-base">
                {Math.round(metrics.targetCapital).toLocaleString('ru-RU')} ₸
              </span>
            </div>
            <div className="text-xs text-blue-200/80 space-y-1 pt-1">
              <p>• Накопленный капитал: {Math.round(totalCapital).toLocaleString('ru-RU')} ₸</p>
              <p>• Требуется донакопить: {Math.round(metrics.realCapital).toLocaleString('ru-RU')} ₸</p>
              <p className="font-bold text-white pt-1">
                Общий прогресс: {metrics.progress.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-xs transition-colors shadow-md shadow-blue-600/20"
        >
          Понятно, закрыть
        </button>
      </div>
    </div>
  );
}
