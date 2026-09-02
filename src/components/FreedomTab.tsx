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
  Percent, 
  ShieldCheck, 
  Coins, 
  Layers, 
  X, 
  Compass,
  BookOpen,
  Award,
  Check
} from 'lucide-react';

export function FreedomTab() {
  // State for database records
  const [sources, setSources] = useState<PassiveIncomeSource[]>([]);
  const [currencies, setCurrencies] = useState<CurrencyRate[]>([]);
  const [settings, setSettings] = useState<FreedomSettings>({
    inflation: 8.5,
    expensePeriod: 3,
    useInflation: true,
    excludeIncomplete: true,
    expectedPortfolioReturn: 10,
    trinitySWR: 4.0,
    calculationMethod: 'PORTFOLIO_YIELD'
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
        setSettings({
          inflation: dbSettingsArray[0].inflation ?? 8.5,
          expensePeriod: dbSettingsArray[0].expensePeriod ?? 3,
          useInflation: dbSettingsArray[0].useInflation ?? true,
          excludeIncomplete: dbSettingsArray[0].excludeIncomplete ?? true,
          expectedPortfolioReturn: dbSettingsArray[0].expectedPortfolioReturn ?? 10,
          trinitySWR: dbSettingsArray[0].trinitySWR ?? 4.0,
          calculationMethod: dbSettingsArray[0].calculationMethod ?? 'PORTFOLIO_YIELD'
        });
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

    // 3.3 Weighted Return of current assets or default setting
    let effectiveReturn = settings.expectedPortfolioReturn || 10;
    if (sources.length > 0 && totalCapitalKZT > 0) {
      const annualIncomeAllKZT = totalPassiveIncomeKZT * 12;
      const weightedReturn = (annualIncomeAllKZT / totalCapitalKZT) * 100;
      if (weightedReturn > 0) {
        effectiveReturn = weightedReturn;
      }
    }

    // 3.4 Method A: Portfolio Yield calculation (БЕЗ инфляции)
    const requiredCapitalTotalYield = effectiveReturn > 0 ? (avgExpenses * 12) / (effectiveReturn / 100) : 0;
    const requiredAdditionalCapitalYield = effectiveReturn > 0 ? (deficit * 12) / (effectiveReturn / 100) : 0;

    // 3.5 Method B: Trinity Study (Правило 4% / SWR - БЕЗ инфляции)
    const trinitySWR = settings.trinitySWR || 4.0;
    const trinityMultiplier = 100 / trinitySWR; // e.g. 25x
    const trinityRequiredCapitalTotal = avgExpenses > 0 ? (avgExpenses * 12) / (trinitySWR / 100) : 0;
    const trinityRequiredAdditionalCapital = deficit > 0 ? (deficit * 12) / (trinitySWR / 100) : 0;

    // 3.6 Active Method selection
    const isTrinity = settings.calculationMethod === 'TRINITY_4PCT';
    const requiredCapitalTotal = isTrinity ? trinityRequiredCapitalTotal : requiredCapitalTotalYield;
    const requiredAdditionalCapital = isTrinity ? trinityRequiredAdditionalCapital : requiredAdditionalCapitalYield;

    // 3.7 Capital Progress
    const capitalProgress = requiredCapitalTotal > 0 
      ? Math.min(100, (totalCapitalKZT / requiredCapitalTotal) * 100) 
      : (coverage >= 100 ? 100 : 0);

    // 3.8 Inflation reference for detailed modal
    const estimatedYears = deficit > 0 ? Math.min(25, Math.max(3, Math.ceil(requiredAdditionalCapital / (Math.max(1, avgExpenses * 0.3 * 12))))) : 0;
    const inflationFactor = settings.useInflation ? Math.pow(1 + (settings.inflation || 8.5) / 100, estimatedYears || 5) : 1;
    const realInflationCapital = requiredAdditionalCapital * inflationFactor;

    return {
      coverage,
      deficit,
      effectiveReturn,
      trinitySWR,
      trinityMultiplier,
      isTrinity,
      // Method A: Yield
      requiredCapitalTotalYield,
      requiredAdditionalCapitalYield,
      // Method B: Trinity Study
      trinityRequiredCapitalTotal,
      trinityRequiredAdditionalCapital,
      // Active Selection (БЕЗ инфляции)
      requiredCapitalTotal,
      requiredAdditionalCapital,
      capitalProgress,
      // Inflation details
      estimatedYears,
      inflationFactor,
      realInflationCapital
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
                Покрытие расходов: {freedomMetrics.coverage.toFixed(1)}%
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
                title="Настроить инфляцию, Trinity Study, период усреднения и курсы валют"
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

            {/* 3. Required Capital (WITHOUT INFLATION) */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/15 shadow-xs sm:col-span-2 lg:col-span-1">
              <div className="flex items-center justify-between text-blue-200 text-xs font-medium mb-1">
                <span className="flex items-center gap-1.5">
                  <span>Необходимый капитал</span>
                </span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded-md font-bold">
                  без инфляции
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                {Math.round(freedomMetrics.requiredCapitalTotal).toLocaleString('ru-RU')} ₸
              </div>
              <div className="text-[11px] text-blue-200/70 mt-1 flex items-center justify-between">
                <span>Накоплено: {Math.round(totalCapitalKZT).toLocaleString('ru-RU')} ₸</span>
                <span className="font-bold text-emerald-300">
                  {freedomMetrics.capitalProgress.toFixed(1)}%
                </span>
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-blue-200/70 gap-1">
              <span>
                {freedomMetrics.isTrinity 
                  ? `Расчёт по Trinity Study (${freedomMetrics.trinitySWR}% / ${freedomMetrics.trinityMultiplier}x расходов)`
                  : `Расчёт по доходности портфеля (${freedomMetrics.effectiveReturn.toFixed(1)}% годовых)`}
              </span>
              <span className="text-blue-100 font-medium sm:text-right">
                {freedomLevel.subtitle}
              </span>
            </div>
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
                incomeAbsolute: 220000
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
                incomePercent: 14.5
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
                incomePercent: 7.5
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

            // Calculate effective annual return for display
            let annualReturnPercent = 0;
            if (source.incomeType === 'PERCENT') {
              annualReturnPercent = source.incomePercent || 0;
            } else if (source.marketValue > 0) {
              annualReturnPercent = ((source.incomeAbsolute || 0) * 12 / source.marketValue) * 100;
            }

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
                      {source.incomeType === 'ABSOLUTE' && (
                        <span className="text-[10px] text-slate-400 block">
                          ≈ {annualReturnPercent.toFixed(1)}% годовых
                        </span>
                      )}
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
            <span className="text-xs text-slate-500 block font-medium">Капитал по Trinity Study</span>
            <span className="text-xl font-bold text-indigo-600 block mt-0.5">
              {Math.round(freedomMetrics.trinityRequiredCapitalTotal).toLocaleString('ru-RU')} ₸
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
      {/* MODAL 2: SETTINGS & CURRENCY RATES (WITH TRINITY STUDY)                    */}
      {/* ========================================================================= */}
      {isSettingsModalOpen && (
        <FreedomSettingsModal
          settings={settings}
          currencies={currencies}
          avgExpenses={avgExpenses}
          totalPassiveIncome={totalPassiveIncomeKZT}
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
              showToast('Настройки и параметры Trinity Study сохранены');
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
// SUB-COMPONENT: ADD/EDIT SOURCE MODAL (WITH SINGLE UNIFIED YIELD INPUT)
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
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Live calculation of income and effective annual return in modal
  const liveIncome = useMemo(() => {
    const val = parseFloat(marketValue) || 0;
    const cur = currency.toUpperCase();
    const rate = rateMap[cur] || 1;

    let monthlyInCur = 0;
    let annualPct = 0;
    if (incomeType === 'PERCENT') {
      const pct = parseFloat(incomePercent) || 0;
      monthlyInCur = (val * (pct / 100)) / 12;
      annualPct = pct;
    } else {
      monthlyInCur = parseFloat(incomeAbsolute) || 0;
      annualPct = val > 0 ? ((monthlyInCur * 12) / val) * 100 : 0;
    }

    const monthlyInKZT = cur === 'KZT' ? monthlyInCur : monthlyInCur * rate;
    const totalValKZT = cur === 'KZT' ? val : val * rate;

    return {
      monthlyInCur: Math.round(monthlyInCur),
      monthlyInKZT: Math.round(monthlyInKZT),
      totalValKZT: Math.round(totalValKZT),
      annualPct: parseFloat(annualPct.toFixed(2))
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
      incomeAbsolute: incomeType === 'ABSOLUTE' ? parseFloat(incomeAbsolute) : undefined
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

          {/* Single Unified Yield Type Selector */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">
              Доходность актива *
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

          {/* Single Yield Input */}
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

          {/* LIVE SUMMARY BANNER */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-3.5 space-y-1.5">
            <span className="text-[11px] font-bold text-blue-900 block flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              Предпросмотр дохода от актива:
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
                <span>+{liveIncome.monthlyInCur.toLocaleString('ru-RU')} {currency}/мес</span>
              </div>
            )}
            <div className="flex items-center justify-between text-[11px] text-indigo-700 pt-0.5 border-t border-blue-200/50 font-semibold">
              <span>Годовая доходность:</span>
              <span>{liveIncome.annualPct}% годовых</span>
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
// SUB-COMPONENT: SETTINGS MODAL (INCLUDING TRINITY STUDY SETTINGS & LIVE CALCULATION)
// ------------------------------------------------------------------------------------------------
interface FreedomSettingsModalProps {
  settings: FreedomSettings;
  currencies: CurrencyRate[];
  avgExpenses: number;
  totalPassiveIncome: number;
  onClose: () => void;
  onSave: (newSettings: FreedomSettings, newCurrencies: CurrencyRate[]) => void;
}

function FreedomSettingsModal({ settings, currencies, avgExpenses, totalPassiveIncome, onClose, onSave }: FreedomSettingsModalProps) {
  const [inflation, setInflation] = useState<string>(String(settings.inflation));
  const [expensePeriod, setExpensePeriod] = useState<number>(settings.expensePeriod);
  const [useInflation, setUseInflation] = useState<boolean>(settings.useInflation);
  const [excludeIncomplete, setExcludeIncomplete] = useState<boolean>(settings.excludeIncomplete);
  
  // Trinity Study and Portfolio Return Settings
  const [trinitySWR, setTrinitySWR] = useState<string>(String(settings.trinitySWR || 4.0));
  const [expectedPortfolioReturn, setExpectedPortfolioReturn] = useState<string>(String(settings.expectedPortfolioReturn || 10));
  const [calculationMethod, setCalculationMethod] = useState<'PORTFOLIO_YIELD' | 'TRINITY_4PCT'>(
    settings.calculationMethod || 'PORTFOLIO_YIELD'
  );

  const [rates, setRates] = useState<CurrencyRate[]>(currencies);
  const [newCurrencyCode, setNewCurrencyCode] = useState('');
  const [newCurrencyRate, setNewCurrencyRate] = useState('');

  // Live Trinity calculation inside settings
  const parsedSWR = parseFloat(trinitySWR) || 4.0;
  const trinityMultiplier = parsedSWR > 0 ? 100 / parsedSWR : 25;
  const liveTrinityRequiredCapital = Math.round(avgExpenses * 12 * trinityMultiplier);
  const liveDeficit = Math.max(0, avgExpenses - totalPassiveIncome);
  const liveTrinityDeficitCapital = Math.round(liveDeficit * 12 * trinityMultiplier);

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

    const swr = parseFloat(trinitySWR);
    if (isNaN(swr) || swr <= 0 || swr > 50) {
      alert('Укажите корректную ставку изъятия по Trinity Study (например 4.0%)');
      return;
    }

    const expRet = parseFloat(expectedPortfolioReturn);
    if (isNaN(expRet) || expRet <= 0 || expRet > 100) {
      alert('Укажите корректную ожидаемую доходность портфеля (например 10%)');
      return;
    }

    onSave(
      {
        inflation: inf,
        expensePeriod,
        useInflation,
        excludeIncomplete,
        trinitySWR: swr,
        expectedPortfolioReturn: expRet,
        calculationMethod
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
              Настройки и Trinity Study
            </h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-5">
          {/* 1. TRINITY STUDY (4% RULE) DEDICATED SECTION */}
          <div className="bg-gradient-to-br from-indigo-50 via-blue-50 to-slate-50 rounded-2xl p-4 border border-indigo-200/80 space-y-3">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-indigo-600" />
              <h4 className="text-xs sm:text-sm font-extrabold text-indigo-950 uppercase tracking-wide">
                Необходимый капитал по Trinity Study (Правило 4%)
              </h4>
            </div>

            <p className="text-[11px] text-slate-600 leading-relaxed">
              Классическое финансовое исследование (Trinity University) доказало: при безопасной ставке изъятия <strong>4% годовых</strong> капитал в <strong>25 годовых расходов</strong> сохраняется бессрочно в 95%+ исторических сценариев.
            </p>

            {/* Live Trinity Result Card */}
            <div className="bg-white rounded-xl p-3.5 border border-indigo-200 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>Капитал для 100% расходов:</span>
                <span className="font-bold text-slate-900">
                  {avgExpenses.toLocaleString('ru-RU')} ₸ × 12 × {trinityMultiplier.toFixed(1)}x
                </span>
              </div>
              <div className="text-lg sm:text-xl font-extrabold text-indigo-700">
                {liveTrinityRequiredCapital.toLocaleString('ru-RU')} ₸
              </div>
              {liveDeficit > 0 && liveDeficit < avgExpenses && (
                <div className="text-[11px] text-emerald-700 font-semibold pt-1 border-t border-slate-100 flex items-center justify-between">
                  <span>С учётом текущего пассивного дохода дефицит:</span>
                  <span>{liveTrinityDeficitCapital.toLocaleString('ru-RU')} ₸</span>
                </div>
              )}
            </div>

            {/* SWR Preset Buttons */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                Безопасная ставка изъятия (Safe Withdrawal Rate — SWR):
              </label>
              <div className="grid grid-cols-3 gap-1.5 mb-2">
                <button
                  type="button"
                  onClick={() => setTrinitySWR('3.5')}
                  className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border transition-all ${
                    trinitySWR === '3.5'
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  3.5% (28.6x)
                </button>
                <button
                  type="button"
                  onClick={() => setTrinitySWR('4.0')}
                  className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border transition-all ${
                    trinitySWR === '4.0' || trinitySWR === '4'
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  4.0% (25x) ★
                </button>
                <button
                  type="button"
                  onClick={() => setTrinitySWR('5.0')}
                  className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border transition-all ${
                    trinitySWR === '5.0' || trinitySWR === '5'
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  5.0% (20x)
                </button>
              </div>

              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  value={trinitySWR}
                  onChange={e => setTrinitySWR(e.target.value)}
                  placeholder="4.0"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
                <Percent className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
              </div>
            </div>
          </div>

          {/* 2. CALCULATION METHOD SELECTOR FOR MAIN WIDGET */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-blue-600" />
              Метод расчёта необходимого капитала в виджете
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCalculationMethod('PORTFOLIO_YIELD')}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  calculationMethod === 'PORTFOLIO_YIELD'
                    ? 'border-blue-600 bg-blue-50/50 shadow-xs'
                    : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-900">По доходности активов</span>
                  {calculationMethod === 'PORTFOLIO_YIELD' && <Check className="w-4 h-4 text-blue-600" />}
                </div>
                <span className="text-[10px] text-slate-500 block mt-1">
                  Капитал = Расходы × 12 / Доходность %
                </span>
              </button>

              <button
                type="button"
                onClick={() => setCalculationMethod('TRINITY_4PCT')}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  calculationMethod === 'TRINITY_4PCT'
                    ? 'border-indigo-600 bg-indigo-50/50 shadow-xs'
                    : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-900">Trinity Study ({parsedSWR}%)</span>
                  {calculationMethod === 'TRINITY_4PCT' && <Check className="w-4 h-4 text-indigo-600" />}
                </div>
                <span className="text-[10px] text-slate-500 block mt-1">
                  Капитал = {trinityMultiplier.toFixed(1)}x годовых расходов (FIRE)
                </span>
              </button>
            </div>
          </div>

          {/* 3. PORTFOLIO BASE RETURN & EXPENSE PERIOD */}
          <div className="border-t border-slate-100 pt-4 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              Параметры усреднения и доходности
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Expense Averaging Period */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Период расходов
                </label>
                <select
                  value={expensePeriod}
                  onChange={e => setExpensePeriod(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/50 text-xs font-bold focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                >
                  <option value={1}>1 месяц</option>
                  <option value={3}>3 месяца (стандарт)</option>
                  <option value={6}>6 месяцев</option>
                  <option value={12}>12 месяцев</option>
                </select>
              </div>

              {/* Expected Base Portfolio Return */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Базовая доходность (%)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={expectedPortfolioReturn}
                  onChange={e => setExpectedPortfolioReturn(e.target.value)}
                  placeholder="10"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/50 text-xs font-bold focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Inflation Rate */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Годовая инфляция (% для справочных расчетов)
              </label>
              <input
                type="number"
                step="0.1"
                value={inflation}
                onChange={e => setInflation(e.target.value)}
                placeholder="8.5"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/50 text-xs font-bold focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            {/* Toggles */}
            <div className="space-y-2 pt-1">
              <label className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
                <div>
                  <span className="text-xs font-bold text-gray-900 block">Исключать неполный текущий месяц</span>
                  <span className="text-[10px] text-gray-500 block">Не занижать средние расходы текущим незавершенным месяцем</span>
                </div>
                <input
                  type="checkbox"
                  checked={excludeIncomplete}
                  onChange={e => setExcludeIncomplete(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded-md focus:ring-blue-500"
                />
              </label>
            </div>
          </div>

          {/* 4. CURRENCY RATES TABLE */}
          <div className="border-t border-slate-100 pt-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-blue-600" />
              Курсы валют к тенге (1 единица = X ₸)
            </h4>

            <div className="space-y-2">
              {rates.map((c, idx) => (
                <div key={c.code} className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
                  <span className="w-14 font-extrabold text-xs text-slate-800 px-1">{c.code}</span>
                  <input
                    type="number"
                    step="any"
                    value={c.rate}
                    onChange={e => handleUpdateRate(idx, e.target.value)}
                    className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                  <span className="text-xs text-slate-500 font-bold px-1">₸</span>
                  {!['USD', 'EUR', 'RUB'].includes(c.code) && (
                    <button
                      type="button"
                      onClick={() => handleDeleteCurrency(idx)}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded-lg"
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
                placeholder="Код (CNY)"
                className="w-24 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-bold uppercase focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
              <input
                type="number"
                step="any"
                value={newCurrencyRate}
                onChange={e => setNewCurrencyRate(e.target.value)}
                placeholder="Курс к ₸"
                className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
              <button
                type="button"
                onClick={handleAddCurrency}
                className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-bold transition-colors"
              >
                + Добавить
              </button>
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
// SUB-COMPONENT: CALCULATION FORMULAS MODAL (WITH TRINITY STUDY BREAKDOWN)
// ------------------------------------------------------------------------------------------------
interface FreedomCalculationModalProps {
  metrics: {
    coverage: number;
    deficit: number;
    effectiveReturn: number;
    trinitySWR: number;
    trinityMultiplier: number;
    isTrinity: boolean;
    requiredCapitalTotalYield: number;
    requiredAdditionalCapitalYield: number;
    trinityRequiredCapitalTotal: number;
    trinityRequiredAdditionalCapital: number;
    requiredCapitalTotal: number;
    requiredAdditionalCapital: number;
    capitalProgress: number;
    inflationFactor: number;
    realInflationCapital: number;
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
            Расчёт точки финансовой свободы опирается на две основные методики: расчёт по доходности активов и международный стандарт <strong>Trinity Study (Правило 4% / FIRE)</strong>.
          </p>

          {/* Formula 1: Coverage */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between font-bold text-gray-900">
              <span>1. Коэффициент покрытия расходов</span>
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

          {/* Formula 3: Required Capital WITHOUT Inflation */}
          <div className="bg-blue-50/60 rounded-2xl p-4 border border-blue-200 space-y-2">
            <div className="flex items-center justify-between font-bold text-blue-950">
              <span>3. Необходимый капитал (по доходности активов)</span>
              <span className="text-blue-700 font-extrabold">{Math.round(metrics.requiredCapitalTotalYield).toLocaleString('ru-RU')} ₸</span>
            </div>
            <code className="block bg-white p-2 rounded-xl border border-blue-200 text-slate-800 text-[11px]">
              Капитал = (Расходы × 12) / (Доходность / 100)
            </code>
            <p className="text-[11px] text-slate-600">
              = ({avgExpenses.toLocaleString('ru-RU')} × 12) / {metrics.effectiveReturn.toFixed(1)}% = {Math.round(metrics.requiredCapitalTotalYield).toLocaleString('ru-RU')} ₸
            </p>
          </div>

          {/* Formula 4: Trinity Study (4% Rule) */}
          <div className="bg-indigo-50/60 rounded-2xl p-4 border border-indigo-200 space-y-2">
            <div className="flex items-center justify-between font-bold text-indigo-950">
              <span>4. Необходимый капитал по Trinity Study (Правило 4%)</span>
              <span className="text-indigo-700 font-extrabold">{Math.round(metrics.trinityRequiredCapitalTotal).toLocaleString('ru-RU')} ₸</span>
            </div>
            <code className="block bg-white p-2 rounded-xl border border-indigo-200 text-slate-800 text-[11px]">
              Капитал Trinity = Расходы × 12 × {metrics.trinityMultiplier.toFixed(1)} (при SWR {metrics.trinitySWR}%)
            </code>
            <p className="text-[11px] text-slate-600">
              = {avgExpenses.toLocaleString('ru-RU')} ₸ × 12 × {metrics.trinityMultiplier.toFixed(1)} = {Math.round(metrics.trinityRequiredCapitalTotal).toLocaleString('ru-RU')} ₸
            </p>
          </div>

          {/* Summary Box */}
          <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-2xl p-4 space-y-2 shadow-md">
            <div className="flex items-center justify-between font-bold text-white">
              <span>Итог (активный метод: {metrics.isTrinity ? `Trinity ${metrics.trinitySWR}%` : `Доходность ${metrics.effectiveReturn.toFixed(1)}%`})</span>
              <span className="text-emerald-400 font-extrabold text-base">
                {Math.round(metrics.requiredCapitalTotal).toLocaleString('ru-RU')} ₸
              </span>
            </div>
            <div className="text-xs text-blue-200/80 space-y-1 pt-1">
              <p>• Накопленный капитал в активах: {Math.round(totalCapital).toLocaleString('ru-RU')} ₸</p>
              <p>• Осталось донакопить (без инфляции): {Math.round(metrics.requiredAdditionalCapital).toLocaleString('ru-RU')} ₸</p>
              <p className="font-bold text-white pt-1">
                Прогресс формирования капитала: {metrics.capitalProgress.toFixed(1)}%
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
