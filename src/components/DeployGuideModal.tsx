import React, { useState } from 'react';
import { X, Globe, Github, Terminal, ExternalLink, Copy, Check, Rocket } from 'lucide-react';

interface DeployGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DeployGuideModal: React.FC<DeployGuideModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'vercel' | 'github' | 'aistudio'>('vercel');
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(id);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 relative my-8 border border-gray-100">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
            <Rocket className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Инструкция по деплою</h2>
            <p className="text-sm text-gray-500">Разверните ваше приложение за 2 минуты в сети</p>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-gray-200 mb-6 gap-2">
          <button
            onClick={() => setActiveTab('vercel')}
            className={`flex items-center gap-2 px-4 py-2.5 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'vercel'
                ? 'border-blue-600 text-blue-600 font-semibold'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Globe className="w-4 h-4" /> Vercel (Рекомендуется)
          </button>
          <button
            onClick={() => setActiveTab('github')}
            className={`flex items-center gap-2 px-4 py-2.5 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'github'
                ? 'border-blue-600 text-blue-600 font-semibold'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Github className="w-4 h-4" /> GitHub Pages
          </button>
          <button
            onClick={() => setActiveTab('aistudio')}
            className={`flex items-center gap-2 px-4 py-2.5 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'aistudio'
                ? 'border-blue-600 text-blue-600 font-semibold'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Terminal className="w-4 h-4" /> Экспорт из AI Studio
          </button>
        </div>

        {/* Vercel Instructions */}
        {activeTab === 'vercel' && (
          <div className="space-y-4 text-sm text-gray-700">
            <div className="p-3 bg-blue-50 text-blue-800 rounded-xl border border-blue-100 flex items-start gap-2">
              <span className="font-bold">✨</span>
              <span>
                <strong>Vercel</strong> — самый быстрый и бесплатный способ публикации приложения на React + Vite с мгновенным HTTPS доступом.
              </span>
            </div>

            <h3 className="font-semibold text-gray-900 text-base">Способ 1: Деплой через GitHub и панель Vercel</h3>
            <ol className="list-decimal list-inside space-y-2 text-gray-600">
              <li>Экспортируйте код в ваш GitHub репозиторий (через меню <strong>Settings → Export / Deploy</strong> в AI Studio).</li>
              <li>Перейдите на <a href="https://vercel.com" target="_blank" rel="noreferrer" className="text-blue-600 underline font-medium">vercel.com</a> и войдите через GitHub.</li>
              <li>Нажмите <strong>«Add New Project»</strong> и выберите ваш репозиторий.</li>
              <li>Vercel автоматически определит Vite! Нажмите <strong>«Deploy»</strong>.</li>
            </ol>

            <h3 className="font-semibold text-gray-900 text-base mt-4">Способ 2: Деплой через консоль (Vercel CLI)</h3>
            <div className="relative bg-gray-900 text-gray-100 p-4 rounded-xl font-mono text-xs overflow-x-auto">
              <button
                onClick={() => handleCopy('npm install -g vercel\nvercel', 'cli-ver')}
                className="absolute top-2 right-2 p-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded transition-colors flex items-center gap-1 text-[11px]"
              >
                {copiedIndex === 'cli-ver' ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedIndex === 'cli-ver' ? 'Скопировано' : 'Копировать'}
              </button>
              <pre className="pr-16">{`# 1. Установите Vercel CLI
npm install -g vercel

# 2. Выполните команду деплоя в папке проекта
vercel`}</pre>
            </div>
          </div>
        )}

        {/* GitHub Pages Instructions */}
        {activeTab === 'github' && (
          <div className="space-y-4 text-sm text-gray-700">
            <div className="p-3 bg-purple-50 text-purple-800 rounded-xl border border-purple-100 flex items-start gap-2">
              <span className="font-bold">🐙</span>
              <span>
                <strong>GitHub Pages</strong> позволяет бесплатно хостить статическое веб-приложение прямо из GitHub репозитория.
              </span>
            </div>

            <h3 className="font-semibold text-gray-900 text-base">Инструкция по настройке `gh-pages`:</h3>

            <div className="space-y-3">
              <p><strong>1. Установите пакет gh-pages:</strong></p>
              <div className="relative bg-gray-900 text-gray-100 p-3 rounded-xl font-mono text-xs">
                <button
                  onClick={() => handleCopy('npm install -D gh-pages', 'gh-p1')}
                  className="absolute top-2 right-2 p-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded"
                >
                  {copiedIndex === 'gh-p1' ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
                <pre>npm install -D gh-pages</pre>
              </div>

              <p><strong>2. Добавьте в `package.json` поле `homepage` и скрипты:</strong></p>
              <div className="relative bg-gray-900 text-gray-100 p-3 rounded-xl font-mono text-xs overflow-x-auto">
                <button
                  onClick={() => handleCopy(`"homepage": "https://username.github.io/my-finance-app",\n"scripts": {\n  "predeploy": "npm run build",\n  "deploy": "gh-pages -d dist"\n}`, 'gh-p2')}
                  className="absolute top-2 right-2 p-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded"
                >
                  {copiedIndex === 'gh-p2' ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
                <pre>{`"homepage": "https://username.github.io/my-finance-app",
"scripts": {
  "predeploy": "npm run build",
  "deploy": "gh-pages -d dist"
}`}</pre>
              </div>

              <p><strong>3. Выполните команду публикации:</strong></p>
              <div className="relative bg-gray-900 text-gray-100 p-3 rounded-xl font-mono text-xs">
                <button
                  onClick={() => handleCopy('npm run deploy', 'gh-p3')}
                  className="absolute top-2 right-2 p-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded"
                >
                  {copiedIndex === 'gh-p3' ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
                <pre>npm run deploy</pre>
              </div>
            </div>
          </div>
        )}

        {/* AI Studio Instructions */}
        {activeTab === 'aistudio' && (
          <div className="space-y-4 text-sm text-gray-700">
            <h3 className="font-semibold text-gray-900 text-base">Загрузка исходников и экспорт</h3>
            <p>Вы можете легко скачать или выгрузить код этого приложения прямо сейчас из AI Studio:</p>
            <ul className="list-disc list-inside space-y-2 text-gray-600">
              <li>Откройте меню настройки справа вверху (иконка Шестеренки ⚙️).</li>
              <li>Выберите пункт <strong>Export Code / GitHub</strong> или <strong>Download ZIP</strong>.</li>
              <li>Распакуйте проект на своем компьютере, выполните <code>npm install</code> и <code>npm run dev</code>.</li>
            </ul>
          </div>
        )}

        <div className="mt-8 pt-4 border-t border-gray-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-gray-900 text-white font-medium text-sm rounded-xl hover:bg-gray-800 transition-colors"
          >
            Понятно, закрыть
          </button>
        </div>
      </div>
    </div>
  );
};
