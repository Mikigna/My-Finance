import React, { useRef, useState } from 'react';
import { 
  Camera, 
  Upload, 
  Trash2, 
  Eye, 
  CheckCircle2, 
  Loader2, 
  AlertCircle,
  FileImage
} from 'lucide-react';
import { processAndCompressImage, getBase64SizeInKB } from '../utils/imageUtils';
import { CameraCaptureModal } from './CameraCaptureModal';

interface ReceiptUploadProps {
  receiptImage?: string;
  onChange: (base64Image: string | undefined) => void;
  onPreview?: (imageSrc: string) => void;
  label?: string;
}

export const ReceiptUpload: React.FC<ReceiptUploadProps> = ({
  receiptImage,
  onChange,
  onPreview,
  label = 'Чек или фото к расходу'
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState<boolean>(false);

  const handleFile = async (file: File) => {
    if (!file) return;
    setErrorMessage(null);
    setIsProcessing(true);

    try {
      const compressedDataUrl = await processAndCompressImage(file);
      onChange(compressedDataUrl);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Ошибка обработки изображения чека');
    } finally {
      setIsProcessing(false);
    }
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
    // Reset value so re-selecting same file triggers change
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          handleFile(file);
          break;
        }
      }
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(undefined);
    setErrorMessage(null);
  };

  const handleCameraCapture = (base64Image: string) => {
    onChange(base64Image);
    setErrorMessage(null);
  };

  return (
    <div className="space-y-1.5" onPaste={handlePaste}>
      <div className="flex items-center justify-between text-xs">
        <label className="font-semibold text-slate-700 flex items-center gap-1.5">
          <Camera className="w-3.5 h-3.5 text-blue-600" />
          {label}
        </label>
        {receiptImage && (
          <span className="text-[11px] font-medium text-emerald-600 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Прикреплен ({getBase64SizeInKB(receiptImage)})
          </span>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onInputChange}
        className="hidden"
      />

      {errorMessage && (
        <div className="p-2 bg-rose-50 text-rose-700 text-xs rounded-lg border border-rose-200 flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {receiptImage ? (
        /* Preview Card */
        <div className="relative group bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 flex items-center justify-between gap-3 transition-all hover:border-slate-300">
          <div className="flex items-center gap-3 overflow-hidden">
            <div 
              className="relative w-14 h-14 rounded-lg overflow-hidden bg-slate-200 border border-slate-300 flex-shrink-0 cursor-pointer group/thumb"
              onClick={() => onPreview?.(receiptImage)}
              title="Нажмите для полноэкранного просмотра"
            >
              <img
                src={receiptImage}
                alt="Превью чека"
                className="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform"
              />
              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center transition-opacity">
                <Eye className="w-4 h-4 text-white" />
              </div>
            </div>

            <div className="text-left overflow-hidden">
              <p className="text-xs font-bold text-slate-800 flex items-center gap-1 truncate">
                <FileImage className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                Чек прикреплен
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Оптимизирован для базы: {getBase64SizeInKB(receiptImage)}
              </p>
              <div className="flex items-center gap-3 mt-1">
                <button
                  type="button"
                  onClick={() => setIsCameraOpen(true)}
                  className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold inline-flex items-center gap-1"
                >
                  <Camera className="w-3 h-3" />
                  Переснять камерой
                </button>
                <span className="text-slate-300">•</span>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-[11px] text-slate-600 hover:text-slate-900 font-medium underline inline-block"
                >
                  Выбрать файл
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {onPreview && (
              <button
                type="button"
                onClick={() => onPreview(receiptImage)}
                className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="Посмотреть чек"
              >
                <Eye className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={handleRemove}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
              title="Удалить чек"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        /* Action Options: Camera vs File vs Drag & Drop */
        <div className="space-y-2">
          {isProcessing ? (
            <div className="border border-blue-200 bg-blue-50/50 rounded-xl p-4 flex items-center justify-center gap-2 text-xs font-semibold text-blue-600">
              <Loader2 className="w-4 h-4 animate-spin" />
              Сжатие и обработка изображения...
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* Camera Button */}
              <button
                type="button"
                onClick={() => setIsCameraOpen(true)}
                className="py-2.5 px-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 active:scale-[0.98] shadow-2xs"
              >
                <Camera className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <span>Сделать фото камерой</span>
              </button>

              {/* File / Gallery Button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`py-2.5 px-3 bg-white hover:bg-slate-50 border rounded-xl text-xs font-semibold text-slate-700 transition-all flex items-center justify-center gap-2 active:scale-[0.98] shadow-2xs ${
                  isDragging ? 'border-blue-500 bg-blue-50/60' : 'border-slate-200'
                }`}
              >
                <Upload className="w-4 h-4 text-slate-500 flex-shrink-0" />
                <span>Загрузить из файлов</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Live Phone Camera Capture Modal */}
      <CameraCaptureModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={handleCameraCapture}
        title="Съемка чека или квитанции"
      />
    </div>
  );
};
