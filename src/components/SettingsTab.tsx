import React, { useState, useEffect } from 'react';
import { 
  db, 
  downloadBackupFile, 
  importDataFromJSON, 
  resetDatabaseToDefault 
} from '../db/database';
import type { Category, PaymentMethod } from '../types';
import { 
  FolderPlus, 
  Trash2, 
  CreditCard, 
  Download, 
  Upload, 
  Tag, 
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  HardDrive,
  RefreshCw,
  FileJson,
  Smartphone
} from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';

export const SettingsTab: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);

  // Category Inputs
  const [newCatName, setNewCatName] = useState('');
  const [newCatType, setNewCatType] = useState<'expense' | 'income'>('expense');

  // Method Input
  const [newMethodName, setNewMethodName] = useState('');

  // Status message / toast
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const loadData = async () => {
    const cats = await db.categories.toArray();
    const meths = await db.methods.toArray();
    setCategories(cats);
    setMethods(meths);
  };

  useEffect(() => {
    loadData();
  }, []);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  // Add Category
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCatName.trim();
    if (!trimmed) return;

    const exists = categories.some(
      c => c.name.trim().toLowerCase() === trimmed.toLowerCase() && c.type === newCatType
    );
    if (exists) {
      showToast(`Категория "${trimmed}" уже существует`, 'error');
      return;
    }

    await db.categories.add({
      name: trimmed,
      type: newCatType
    });

    setNewCatName('');
    showToast(`Категория "${trimmed}" успешно добавлена`);
    loadData();
  };

  // Delete Category
  const handleDeleteCategory = async (id?: number, name?: string) => {
    if (!id) return;
    if (window.confirm(`Удалить категорию "${name}"?`)) {
      await db.categories.delete(id);
      showToast(`Категория "${name}" удалена`);
      loadData();
    }
  };

  // Add Payment Method
  const handleAddMethod = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newMethodName.trim();
    if (!trimmed) return;

    const exists = methods.some(
      m => m.name.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (exists) {
      showToast(`Способ оплаты "${trimmed}" уже существует`, 'error');
      return;
    }

    await db.methods.add({ name: trimmed });
    setNewMethodName('');
    showToast(`Способ оплаты "${trimmed}" добавлен`);
    loadData();
  };

  // Delete Method
  const handleDeleteMethod = async (id?: number, name?: string) => {
    if (!id) return;
    if (window.confirm(`Удалить способ оплаты "${name}"?`)) {
      await db.methods.delete(id);
      showToast(`Способ оплаты "${name}" удален`);
      loadData();
    }
  };

  // Резервная копия: Экспорт в JSON
  const handleExport = async () => {
    try {
      setIsProcessing(true);
      await downloadBackupFile();
      showToast('Резервная копия (.json) успешно сохранена на ваше устройство!');
    } catch (err: any) {
      showToast(err?.message || 'Ошибка при экспорте данных', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Восстановление из JSON
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const confirmed = window.confirm(
      'Внимание! Импорт из файла перезапишет текущие данные в IndexedDB на вашем устройстве.\n\nПродолжить восстановление?'
    );

    if (!confirmed) {
      e.target.value = '';
      return;
    }

    setIsProcessing(true);
    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const stats = await importDataFromJSON(content);

        showToast(
          `Данные успешно восстановлены! Загружено: ${stats.expensesCount} операций, ${stats.categoriesCount} категорий, ${stats.budgetsCount} бюджетов.`
        );
        loadData();
      } catch (err: any) {
        showToast(err?.message || 'Ошибка при восстановлении файла', 'error');
      } finally {
        setIsProcessing(false);
        e.target.value = '';
      }
    };

    reader.onerror = () => {
      showToast('Не удалось прочитать выбранный файл', 'error');
      setIsProcessing(false);
      e.target.value = '';
    };

    reader.readAsText(file);
  };

  // Сброс базы данных
  const handleReset = async () => {
    const confirmed = window.confirm(
      'Внимание! Все операции, планы бюджета и категории будут сброшены до начальных настроек.\n\nПеред сбросом рекомендуется скачать резервную копию JSON.\n\nВы уверены?'
    );

    if (confirmed) {
      setIsProcessing(true);
      try {
        await resetDatabaseToDefault();
        showToast('База данных успешно сброшена до стандартных значений');
        loadData();
      } catch (err: any) {
        showToast('Ошибка при сбросе данных', 'error');
      } finally {
        setIsProcessing(false);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* PWA Mobile Install Banner */}
      <PWAInstallButton variant="card" />

      {/* Toast Alert */}
      {message && (
        <div 
          className={`p-3.5 rounded-xl text-sm font-medium flex items-center gap-2.5 transition-all shadow-sm ${
            message.type === 'success' 
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Local-First Architecture Badge */}
      <div className="bg-gradient-to-br from-slate-900 to-blue-950 text-white p-5 rounded-2xl shadow-sm border border-slate-800 space-y-2">
        <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
          <ShieldCheck className="w-4 h-4" />
          100% Local-First Архитектура
        </div>
        <h3 className="text-base font-bold text-white">Ваши данные хранятся только на вашем устройстве</h3>
        <p className="text-xs text-slate-300 leading-relaxed">
          Все операции, бюджеты и категории сохраняются в изолированной локальной базе данных браузера (IndexedDB).
          При развертывании новых версий интерфейса на Vercel ваши данные не удаляются и остаются в сохранности.
        </p>
      </div>

      {/* Backup & Data Management */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-blue-600" />
            Резервное копирование и перенос данных
          </h2>
          <span className="text-xs text-gray-400 font-medium hidden sm:inline">JSON Резервная копия</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Export Box */}
          <div className="p-4 border border-gray-100 rounded-xl bg-gray-50 flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <FileJson className="w-4 h-4 text-blue-600" />
                <p className="font-bold text-gray-900 text-sm">Скачать резервную копию</p>
              </div>
              <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
                Выгружает все транзакции, статьи бюджета, историю перераспределений и справочники в единый .json файл.
              </p>
            </div>
            <button
              onClick={handleExport}
              disabled={isProcessing}
              className="py-2.5 px-4 bg-gray-900 hover:bg-gray-800 active:scale-[0.98] text-white font-medium rounded-xl text-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Download className="w-4 h-4 text-blue-400" />
              Скачать резервную копию (.json)
            </button>
          </div>

          {/* Import Box */}
          <div className="p-4 border border-gray-100 rounded-xl bg-gray-50 flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-emerald-600" />
                <p className="font-bold text-gray-900 text-sm">Восстановить из файла</p>
              </div>
              <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
                Загрузите ранее экспортированный файл .json для переноса на новый телефон, планшет или другой браузер.
              </p>
            </div>
            <label className="py-2.5 px-4 bg-white border border-gray-300 hover:bg-gray-100 active:scale-[0.98] text-gray-800 font-semibold rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center gap-2">
              <Upload className="w-4 h-4 text-emerald-600" />
              Восстановить из файла (.json)
              <input 
                type="file" 
                accept=".json,application/json" 
                onChange={handleImport} 
                className="hidden" 
                disabled={isProcessing}
              />
            </label>
          </div>
        </div>

        <div className="pt-2 border-t border-gray-100 flex justify-between items-center">
          <button
            onClick={handleReset}
            disabled={isProcessing}
            className="text-xs text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1.5 py-1 disabled:opacity-50"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Сбросить локальную базу данных
          </button>
          <span className="text-[11px] text-gray-400">IndexedDB: FinanceDB (v4)</span>
        </div>
      </div>

      {/* Categories Section */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4">
        <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
          <Tag className="w-5 h-5 text-blue-600" />
          Управление Категориями
        </h2>

        {/* Add Form */}
        <form onSubmit={handleAddCategory} className="flex flex-col sm:flex-row gap-2">
          <select
            value={newCatType}
            onChange={e => setNewCatType(e.target.value as 'expense' | 'income')}
            className="px-3 py-2 border border-gray-200 rounded-xl text-xs font-semibold bg-gray-50 text-gray-700"
          >
            <option value="expense">Расход</option>
            <option value="income">Доход</option>
          </select>
          <input
            type="text"
            placeholder="Название новой категории..."
            value={newCatName}
            onChange={e => setNewCatName(e.target.value)}
            className="flex-1 px-3.5 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
            required
          />
          <button
            type="submit"
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-sm transition-all flex items-center justify-center gap-1 shadow-sm"
          >
            <FolderPlus className="w-4 h-4" /> Добавить
          </button>
        </form>

        {/* Categories List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
          <div>
            <p className="text-xs font-bold text-rose-600 uppercase mb-2">Категории расходов</p>
            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
              {categories
                .filter(c => c.type === 'expense' || !c.type)
                .map(c => (
                  <div
                    key={c.id}
                    className="flex justify-between items-center p-2.5 bg-gray-50 rounded-xl border border-gray-100 text-sm font-medium"
                  >
                    <span className="text-gray-800">{c.name}</span>
                    <button
                      onClick={() => handleDeleteCategory(c.id, c.name)}
                      className="p-1 text-gray-400 hover:text-rose-600 transition-colors"
                      title="Удалить категорию"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-bold text-emerald-600 uppercase mb-2">Категории доходов</p>
            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
              {categories
                .filter(c => c.type === 'income')
                .map(c => (
                  <div
                    key={c.id}
                    className="flex justify-between items-center p-2.5 bg-gray-50 rounded-xl border border-gray-100 text-sm font-medium"
                  >
                    <span className="text-gray-800">{c.name}</span>
                    <button
                      onClick={() => handleDeleteCategory(c.id, c.name)}
                      className="p-1 text-gray-400 hover:text-rose-600 transition-colors"
                      title="Удалить категорию"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>

      {/* Payment Methods Section */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4">
        <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-blue-600" />
          Виды платежей
        </h2>

        <form onSubmit={handleAddMethod} className="flex gap-2">
          <input
            type="text"
            placeholder="Новый способ оплаты (напр., Карта Kaspi Gold)..."
            value={newMethodName}
            onChange={e => setNewMethodName(e.target.value)}
            className="flex-1 px-3.5 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
            required
          />
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition-all flex items-center gap-1 shadow-sm"
          >
            Добавить
          </button>
        </form>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
          {methods.map(m => (
            <div
              key={m.id}
              className="flex justify-between items-center p-2.5 bg-gray-50 rounded-xl border border-gray-100 text-sm font-medium"
            >
              <span className="text-gray-800">{m.name}</span>
              <button
                onClick={() => handleDeleteMethod(m.id, m.name)}
                className="p-1 text-gray-400 hover:text-rose-600 transition-colors"
                title="Удалить способ оплаты"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
