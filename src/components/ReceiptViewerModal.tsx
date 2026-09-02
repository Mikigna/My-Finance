import React, { useState, useEffect } from 'react';
import { 
  X, 
  Download, 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  Maximize2,
  Receipt,
  Calendar,
  Tag,
  CreditCard
} from 'lucide-react';
import type { Transaction } from '../types';

interface ReceiptViewerModalProps {
  transaction: Transaction | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ReceiptViewerModal: React.FC<ReceiptViewerModalProps> = ({
  transaction,
  isOpen,
  onClose
}) => {
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);

  // Reset transform on open/transaction change
  useEffect(() => {
    if (isOpen) {
      setZoom(1);
      setRotation(0);
    }
  }, [isOpen, transaction]);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !transaction || !transaction.receiptImage) {
    return null;
  }

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.5));
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);
  const handleReset = () => {
    setZoom(1);
    setRotation(0);
  };

  const handleDownload = () => {
    if (!transaction.receiptImage) return;
    const link = document.createElement('a');
    link.href = transaction.receiptImage;
    link.download = `receipt_${transaction.date}_${transaction.category.replace(/\s+/g, '_')}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div 
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 text-blue-400 rounded-xl">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">Чек / Фото операции</h3>
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-blue-500/20 text-blue-300">
                  {transaction.amount.toLocaleString('ru-RU')} ₸
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                <span className="flex items-center gap-1">
                  <Tag className="w-3 h-3 text-slate-500" />
                  {transaction.category}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-500" />
                  {transaction.date}
                </span>
                <span className="flex items-center gap-1">
                  <CreditCard className="w-3 h-3 text-slate-500" />
                  {transaction.method}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              title="Скачать фото чека"
              className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              title="Закрыть (Esc)"
              className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Image Canvas Container */}
        <div className="flex-1 overflow-auto p-4 flex items-center justify-center min-h-[300px] max-h-[70vh] bg-slate-950/60 select-none">
          <div className="transition-transform duration-200 ease-out flex items-center justify-center">
            <img
              src={transaction.receiptImage}
              alt="Чек операции"
              style={{
                transform: `scale(${zoom}) rotate(${rotation}deg)`,
                transformOrigin: 'center center',
                transition: 'transform 0.2s ease-out'
              }}
              className="max-h-[60vh] max-w-full object-contain rounded-lg shadow-lg"
            />
          </div>
        </div>

        {/* Footer Toolbar */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-900/90 flex flex-wrap items-center justify-between gap-3 text-white text-xs">
          {transaction.note ? (
            <p className="text-slate-400 italic max-w-md truncate">
              "{transaction.note}"
            </p>
          ) : (
            <span className="text-slate-500">Чек прикреплен к операции</span>
          )}

          {/* Controls */}
          <div className="flex items-center gap-1.5 bg-slate-800/80 p-1 rounded-xl border border-slate-700/60">
            <button
              onClick={handleZoomOut}
              disabled={zoom <= 0.5}
              title="Уменьшить"
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg disabled:opacity-40 transition-colors"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="px-2 font-mono text-slate-300 min-w-[3rem] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              disabled={zoom >= 3}
              title="Увеличить"
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg disabled:opacity-40 transition-colors"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <div className="w-px h-4 bg-slate-700 mx-1" />
            <button
              onClick={handleRotate}
              title="Повернуть на 90°"
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-1"
            >
              <RotateCw className="w-4 h-4" />
            </button>
            <button
              onClick={handleReset}
              title="Сбросить масштаб"
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
