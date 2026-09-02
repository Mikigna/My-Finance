import React, { useState } from 'react';
import { usePWAInstall } from '../utils/usePWAInstall';
import { 
  Download, 
  Smartphone, 
  Share, 
  PlusSquare, 
  X, 
  CheckCircle2, 
  Sparkles,
  Info,
  Apple
} from 'lucide-react';

interface PWAInstallButtonProps {
  className?: string;
  variant?: 'header' | 'card' | 'badge';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ 
  className = '',
  variant = 'header'
}) => {
  const { isInstallable, isInstalled, isIOS, isAndroid, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState<boolean>(false);
  const [activeGuideTab, setActiveGuideTab] = useState<'ios' | 'android'>(isIOS ? 'ios' : 'android');

  // If already running as standalone app, don't show the install trigger
  if (isInstalled) {
    return null;
  }

  const handleAction = () => {
    if (isInstallable) {
      install();
    } else {
      setShowGuideModal(true);
    }
  };

  return (
    <>
      {/* Header Button Variant */}
      {variant === 'header' && (
        <button
          onClick={handleAction}
          className={`flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 active:bg-white/30 text-white rounded-xl text-xs font-semibold backdrop-blur-md border border-white/20 transition-all shadow-sm ${className}`}
          title="Установить приложение на телефон"
        >
          <Smartphone className="w-3.5 h-3.5 text-emerald-300" />
          <span className="hidden xs:inline">На телефон</span>
          <span className="xs:hidden">Установить</span>
        </button>
      )}

      {/* Card Banner Variant */}
      {variant === 'card' && (
        <div className={`p-4 bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-2xl shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${className}`}>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/15 rounded-xl border border-white/20">
              <Smartphone className="w-6 h-6 text-emerald-300" />
            </div>
            <div>
              <h4 className="text-sm font-bold">Установить на iPhone или Android</h4>
              <p className="text-xs text-blue-100 mt-0.5">
                Работает без интернета, сохраняет данные офлайн и запускается как нативное приложение
              </p>
            </div>
          </div>

          <button
            onClick={handleAction}
            className="w-full sm:w-auto px-4 py-2 bg-white text-blue-700 hover:bg-blue-50 active:scale-95 font-bold rounded-xl text-xs shadow-sm transition-all flex items-center justify-center gap-1.5"
          >
            <Download className="w-4 h-4 text-blue-600" />
            <span>{isInstallable ? 'Установить в 1 клик' : 'Инструкция по установке'}</span>
          </button>
        </div>
      )}

      {/* Mobile Step-by-Step Installation Modal Guide */}
      {showGuideModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn"
          onClick={() => setShowGuideModal(false)}
        >
          <div 
            className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-100 flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-5 py-4 bg-gradient-to-r from-blue-700 to-indigo-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-white/15 rounded-lg border border-white/20">
                  <Smartphone className="w-5 h-5 text-emerald-300" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Установка «Мои Финансы»</h3>
                  <p className="text-[11px] text-blue-100">Используйте как приложение на смартфоне</p>
                </div>
              </div>

              <button
                onClick={() => setShowGuideModal(false)}
                className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Platform Selector Tabs */}
            <div className="flex border-b border-slate-200 bg-slate-50 p-1.5 gap-1.5">
              <button
                onClick={() => setActiveGuideTab('ios')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  activeGuideTab === 'ios'
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Apple className="w-4 h-4" />
                iPhone / iPad (iOS)
              </button>
              <button
                onClick={() => setActiveGuideTab('android')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  activeGuideTab === 'android'
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Smartphone className="w-4 h-4 text-emerald-600" />
                Android
              </button>
            </div>

            {/* Step instructions */}
            <div className="p-5 space-y-4 text-xs text-slate-700">
              {activeGuideTab === 'ios' ? (
                /* iOS Safari Guide */
                <div className="space-y-3.5">
                  <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-blue-900 text-xs flex items-start gap-2.5">
                    <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                    <span>Откройте сайт в стандартном браузере <strong>Safari</strong> на вашем iPhone.</span>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center flex-shrink-0 text-xs">
                      1
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">
                        Нажмите кнопку «Поделиться»
                      </p>
                      <p className="text-slate-500 text-[11px] mt-0.5 flex items-center gap-1">
                        Иконка <Share className="w-3.5 h-3.5 text-blue-600 inline" /> в нижней панели Safari.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center flex-shrink-0 text-xs">
                      2
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">
                        Выберите «На экран «Домой»»
                      </p>
                      <p className="text-slate-500 text-[11px] mt-0.5 flex items-center gap-1">
                        Иконка <PlusSquare className="w-3.5 h-3.5 text-slate-700 inline" /> (Add to Home Screen).
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center flex-shrink-0 text-xs">
                      3
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">
                        Нажмите «Добавить» в правом верхнем углу
                      </p>
                      <p className="text-slate-500 text-[11px] mt-0.5">
                        Иконка «Финансы» появится на рабочем столе и будет запускаться на полный экран без рамок браузера!
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                /* Android Guide */
                <div className="space-y-3.5">
                  <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-900 text-xs flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <span>Поддерживаются браузеры <strong>Chrome</strong>, <strong>Яндекс Браузер</strong>, <strong>Samsung Internet</strong>.</span>
                  </div>

                  {isInstallable && (
                    <button
                      onClick={() => {
                        install();
                        setShowGuideModal(false);
                      }}
                      className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Нажмите здесь для быстрой установки
                    </button>
                  )}

                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center flex-shrink-0 text-xs">
                      1
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">
                        Нажмите меню (три точки ⋮) в браузере
                      </p>
                      <p className="text-slate-500 text-[11px] mt-0.5">
                        В правом верхнем углу Chrome.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center flex-shrink-0 text-xs">
                      2
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">
                        Выберите «Установить приложение» или «Добавить на главный экран»
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center flex-shrink-0 text-xs">
                      3
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">
                        Подтвердите установку
                      </p>
                      <p className="text-slate-500 text-[11px] mt-0.5">
                        Приложение появится в списке ваших программ на смартфоне.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-end">
              <button
                onClick={() => setShowGuideModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl transition-colors"
              >
                Понятно
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
