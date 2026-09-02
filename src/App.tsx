import React, { useState, useEffect } from 'react';
import { seedInitialData } from './db/database';
import { ExpensesTab } from './components/ExpensesTab';
import { BudgetTab } from './components/BudgetTab';
import { FreedomTab } from './components/FreedomTab';
import { SettingsTab } from './components/SettingsTab';
import { ReportsTab } from './components/ReportsTab';
import { DeployGuideModal } from './components/DeployGuideModal';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';
import { Wallet, PieChart, Settings, Rocket, ShieldCheck, PiggyBank, Sparkles } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'expenses' | 'budget' | 'freedom' | 'reports' | 'settings'>('expenses');
  const [isDeployModalOpen, setIsDeployModalOpen] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedInitialData().then(() => {
      setIsReady(true);
    });
  }, []);

  if (!isReady) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-sm font-medium text-gray-500">Загрузка базы данных IndexedDB...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col font-sans antialiased selection:bg-blue-100 selection:text-blue-900">
      {/* Offline Status Toast */}
      <OfflineIndicator />

      {/* Top Header with iOS Safe Area support */}
      <header className="bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 text-white shadow-md sticky top-0 z-30 pt-[env(safe-area-inset-top,0px)]">
        <div className="max-w-4xl mx-auto px-4 py-3.5 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="p-2 sm:p-2.5 bg-white/10 rounded-2xl backdrop-blur-md border border-white/20 shadow-xs">
              <Wallet className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold tracking-tight">Мои Финансы</h1>
              <p className="text-[10px] sm:text-xs text-blue-100 flex items-center gap-1 mt-0.5">
                <ShieldCheck className="w-3 h-3 text-emerald-300 flex-shrink-0" />
                <span className="hidden xs:inline">Локальная база данных (IndexedDB)</span>
                <span className="xs:hidden">Офлайн база</span>
              </p>
            </div>
          </div>

          {/* Action Buttons: PWA Install + Deploy Guide */}
          <div className="flex items-center gap-2">
            <PWAInstallButton variant="header" />

            <button
              onClick={() => setIsDeployModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 bg-white/10 hover:bg-white/20 active:bg-white/30 text-white rounded-xl text-xs font-semibold backdrop-blur-md border border-white/20 transition-all shadow-sm"
              title="Инструкция по публикации в сеть"
            >
              <Rocket className="w-3.5 h-3.5 text-amber-300" />
              <span className="hidden sm:inline">Как задеплоить?</span>
              <span className="sm:hidden">Деплой</span>
            </button>
          </div>
        </div>

        {/* Desktop / Tablet Tab Navigation (Hidden on small mobile screens to use native bottom bar) */}
        <div className="hidden sm:block bg-white/10 backdrop-blur-md border-t border-white/10">
          <div className="max-w-4xl mx-auto flex">
            <button
              onClick={() => setActiveTab('expenses')}
              className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-1.5 sm:gap-2 border-b-2 transition-all ${
                activeTab === 'expenses'
                  ? 'border-white text-white font-bold bg-white/10'
                  : 'border-transparent text-blue-100 hover:text-white hover:bg-white/5'
              }`}
            >
              <Wallet className="w-4 h-4" />
              <span>Затраты</span>
            </button>

            <button
              onClick={() => setActiveTab('budget')}
              className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-1.5 sm:gap-2 border-b-2 transition-all ${
                activeTab === 'budget'
                  ? 'border-white text-white font-bold bg-white/10'
                  : 'border-transparent text-blue-100 hover:text-white hover:bg-white/5'
              }`}
            >
              <PiggyBank className="w-4 h-4" />
              <span>Бюджет</span>
            </button>

            <button
              onClick={() => setActiveTab('freedom')}
              className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-1.5 sm:gap-2 border-b-2 transition-all ${
                activeTab === 'freedom'
                  ? 'border-white text-white font-bold bg-white/10'
                  : 'border-transparent text-blue-100 hover:text-white hover:bg-white/5'
              }`}
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>Свобода</span>
            </button>

            <button
              onClick={() => setActiveTab('reports')}
              className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-1.5 sm:gap-2 border-b-2 transition-all ${
                activeTab === 'reports'
                  ? 'border-white text-white font-bold bg-white/10'
                  : 'border-transparent text-blue-100 hover:text-white hover:bg-white/5'
              }`}
            >
              <PieChart className="w-4 h-4" />
              <span>Отчеты</span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-1.5 sm:gap-2 border-b-2 transition-all ${
                activeTab === 'settings'
                  ? 'border-white text-white font-bold bg-white/10'
                  : 'border-transparent text-blue-100 hover:text-white hover:bg-white/5'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Настройки</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-3 sm:p-6 pb-28 sm:pb-20">
        {activeTab === 'expenses' && <ExpensesTab />}
        {activeTab === 'budget' && <BudgetTab />}
        {activeTab === 'freedom' && <FreedomTab />}
        {activeTab === 'reports' && <ReportsTab />}
        {activeTab === 'settings' && <SettingsTab />}
      </main>

      {/* Mobile Native Bottom Navigation Bar (Optimized for iPhone notch/home bar and Android) */}
      <nav className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-lg border-t border-slate-200/90 shadow-2xl pb-[env(safe-area-inset-bottom,0.5rem)]">
        <div className="grid grid-cols-5 px-1 py-1">
          <button
            type="button"
            onClick={() => setActiveTab('expenses')}
            className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all ${
              activeTab === 'expenses'
                ? 'text-blue-600 font-bold scale-105'
                : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            <Wallet className={`w-5 h-5 mb-0.5 ${activeTab === 'expenses' ? 'stroke-[2.5]' : ''}`} />
            <span className="text-[10px] leading-tight">Затраты</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('budget')}
            className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all ${
              activeTab === 'budget'
                ? 'text-blue-600 font-bold scale-105'
                : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            <PiggyBank className={`w-5 h-5 mb-0.5 ${activeTab === 'budget' ? 'stroke-[2.5]' : ''}`} />
            <span className="text-[10px] leading-tight">Бюджет</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('freedom')}
            className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all ${
              activeTab === 'freedom'
                ? 'text-indigo-600 font-bold scale-105'
                : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            <Sparkles className={`w-5 h-5 mb-0.5 ${activeTab === 'freedom' ? 'stroke-[2.5] text-amber-500' : ''}`} />
            <span className="text-[10px] leading-tight">Свобода</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('reports')}
            className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all ${
              activeTab === 'reports'
                ? 'text-blue-600 font-bold scale-105'
                : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            <PieChart className={`w-5 h-5 mb-0.5 ${activeTab === 'reports' ? 'stroke-[2.5]' : ''}`} />
            <span className="text-[10px] leading-tight">Отчеты</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all ${
              activeTab === 'settings'
                ? 'text-blue-600 font-bold scale-105'
                : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            <Settings className={`w-5 h-5 mb-0.5 ${activeTab === 'settings' ? 'stroke-[2.5]' : ''}`} />
            <span className="text-[10px] leading-tight">Настройки</span>
          </button>
        </div>
      </nav>

      {/* Desktop / Tablet Footer */}
      <footer className="hidden sm:block border-t border-gray-200 bg-white py-4 text-center text-xs text-gray-500">
        <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Личные Финансы • Автономное PWA-приложение для iPhone и Android</span>
          <button
            onClick={() => setIsDeployModalOpen(true)}
            className="text-blue-600 hover:underline font-medium"
          >
            Инструкция по деплою на Vercel / GitHub Pages
          </button>
        </div>
      </footer>

      {/* Deploy Modal */}
      <DeployGuideModal
        isOpen={isDeployModalOpen}
        onClose={() => setIsDeployModalOpen(false)}
      />
    </div>
  );
}


