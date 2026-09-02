import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  X, 
  Camera, 
  SwitchCamera, 
  Check, 
  RotateCcw, 
  AlertCircle, 
  Loader2, 
  FolderOpen,
  Sparkles
} from 'lucide-react';
import { processAndCompressImage } from '../utils/imageUtils';

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (base64Image: string) => void;
  title?: string;
}

export const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({
  isOpen,
  onClose,
  onCapture,
  title = 'Съемка чека или квитанции'
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputFallbackRef = useRef<HTMLInputElement>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isFlashing, setIsFlashing] = useState<boolean>(false);

  // Play subtle shutter click sound via Web Audio API
  const playShutterSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(400, audioCtx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.08);
    } catch (_) {
      // Ignore audio failure
    }
  };

  // Stop current stream tracks
  const stopStream = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  }, [stream]);

  // Start video stream
  const startCamera = useCallback(async (mode: 'environment' | 'user') => {
    setIsLoading(true);
    setError(null);
    stopStream();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('Ваш браузер или устройство не поддерживает прямой доступ к камере. Воспользуйтесь системным выбором файлов.');
      setIsLoading(false);
      return;
    }

    try {
      // First try with ideal facingMode
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
      }
      setIsLoading(false);
    } catch (err: any) {
      console.warn('First camera attempt failed, trying fallback constraints:', err);
      // Fallback to basic video constraints
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        });
        setStream(fallbackStream);
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
          await videoRef.current.play();
        }
        setIsLoading(false);
      } catch (fallbackErr: any) {
        console.error('Camera access error:', fallbackErr);
        if (fallbackErr.name === 'NotAllowedError' || fallbackErr.name === 'PermissionDeniedError') {
          setError('Доступ к камере заблокирован. Пожалуйста, разрешите доступ к камере в настройках браузера или загрузите фото из галереи.');
        } else if (fallbackErr.name === 'NotFoundError' || fallbackErr.name === 'DevicesNotFoundError') {
          setError('Камера не обнаружена на данном устройстве.');
        } else {
          setError('Не удалось подключиться к камере. Попробуйте загрузить фото через стандартное приложение камеры.');
        }
        setIsLoading(false);
      }
    }
  }, [stopStream]);

  // Lifecycle when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setCapturedImage(null);
      startCamera(facingMode);
    } else {
      stopStream();
      setCapturedImage(null);
    }

    return () => {
      stopStream();
    };
  }, [isOpen, facingMode]);

  // Switch camera between front and back
  const handleToggleFacingMode = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
  };

  // Take photo from video frame
  const handleCapturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    
    // Trigger shutter flash & sound
    setIsFlashing(true);
    playShutterSound();
    setTimeout(() => setIsFlashing(false), 150);

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // If front camera, mirror image back for natural look
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const rawDataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setCapturedImage(rawDataUrl);
    stopStream();
  };

  // Retake photo
  const handleRetake = () => {
    setCapturedImage(null);
    startCamera(facingMode);
  };

  // Confirm photo and compress
  const handleConfirmPhoto = async () => {
    if (!capturedImage) return;
    setIsProcessing(true);

    try {
      // Convert data URL to Blob to pass into compression
      const res = await fetch(capturedImage);
      const blob = await res.blob();
      const file = new File([blob], 'camera_receipt.jpg', { type: 'image/jpeg' });
      const compressed = await processAndCompressImage(file);
      onCapture(compressed);
      onClose();
    } catch (err: any) {
      console.error('Error compressing captured image:', err);
      // Fallback to captured image directly if compression fails
      onCapture(capturedImage);
      onClose();
    } finally {
      setIsProcessing(false);
    }
  };

  // Fallback file input change handler
  const handleFallbackFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessing(true);
    try {
      const compressed = await processAndCompressImage(file);
      onCapture(compressed);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Ошибка обработки выбранного файла');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div 
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg max-h-[95vh] flex flex-col overflow-hidden shadow-2xl relative"
        onClick={e => e.stopPropagation()}
      >
        {/* Shutter flash overlay */}
        {isFlashing && (
          <div className="absolute inset-0 z-40 bg-white pointer-events-none animate-ping" />
        )}

        {/* Hidden canvas and fallback input */}
        <canvas ref={canvasRef} className="hidden" />
        <input 
          ref={fileInputFallbackRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFallbackFile}
          className="hidden"
        />

        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-900 text-white z-10">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-500/20 text-blue-400 rounded-lg">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">{title}</h3>
              <p className="text-[11px] text-slate-400">
                {capturedImage ? 'Проверьте снимок чека' : 'Наведите камеру на чек или квитанцию'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            title="Закрыть (Esc)"
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewfinder / Preview area */}
        <div className="relative flex-1 min-h-[380px] max-h-[65vh] bg-black flex items-center justify-center overflow-hidden select-none">
          {capturedImage ? (
            /* Snapshot Preview */
            <div className="w-full h-full flex items-center justify-center p-2">
              <img 
                src={capturedImage} 
                alt="Снимок" 
                className="max-h-[60vh] max-w-full object-contain rounded-lg shadow-lg"
              />
            </div>
          ) : error ? (
            /* Error / Permission State */
            <div className="p-6 text-center text-slate-300 max-w-xs mx-auto space-y-4">
              <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <p className="text-xs leading-relaxed text-slate-300">
                {error}
              </p>
              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={() => fileInputFallbackRef.current?.click()}
                  className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 shadow-md"
                >
                  <FolderOpen className="w-4 h-4" />
                  Открыть системную камеру / файл
                </button>
                <button
                  type="button"
                  onClick={() => startCamera(facingMode)}
                  className="w-full py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
                >
                  Попробовать снова
                </button>
              </div>
            </div>
          ) : (
            /* Live Camera Stream with Viewfinder */
            <>
              {isLoading && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-slate-950 text-slate-400">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                  <span className="text-xs font-medium">Запуск камеры...</span>
                </div>
              )}

              <video
                ref={videoRef}
                playsInline
                autoPlay
                muted
                className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
              />

              {/* Viewfinder Overlay Frame for Receipts */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6">
                <div className="relative w-full max-w-[320px] aspect-[3/4] border-2 border-white/40 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]">
                  {/* Corner targets */}
                  <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-blue-400 rounded-tl-lg" />
                  <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-blue-400 rounded-tr-lg" />
                  <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-blue-400 rounded-bl-lg" />
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-blue-400 rounded-br-lg" />
                  
                  <div className="absolute bottom-2 inset-x-0 text-center">
                    <span className="text-[10px] tracking-wide font-bold uppercase text-white/90 bg-black/60 px-2.5 py-1 rounded-full backdrop-blur-xs">
                      Поместите чек в рамку
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer Toolbar */}
        <div className="px-5 py-4 border-t border-slate-800 bg-slate-900 text-white flex items-center justify-between gap-3">
          {capturedImage ? (
            /* Actions for captured photo */
            <div className="w-full flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleRetake}
                disabled={isProcessing}
                className="flex-1 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 border border-slate-700"
              >
                <RotateCcw className="w-4 h-4" />
                Переснять
              </button>

              <button
                type="button"
                onClick={handleConfirmPhoto}
                disabled={isProcessing}
                className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30 disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Сохранение...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Использовать фото
                  </>
                )}
              </button>
            </div>
          ) : (
            /* Live Camera Controls */
            <div className="w-full flex items-center justify-between">
              {/* Fallback button (open file picker / system camera) */}
              <button
                type="button"
                onClick={() => fileInputFallbackRef.current?.click()}
                className="p-2.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors flex items-center gap-1.5 text-xs font-semibold"
                title="Выбрать из галереи / файлов"
              >
                <FolderOpen className="w-4 h-4" />
                <span className="hidden sm:inline">Файл</span>
              </button>

              {/* Shutter Button */}
              <button
                type="button"
                onClick={handleCapturePhoto}
                disabled={isLoading || !!error}
                className="relative group p-1 rounded-full border-2 border-white/80 hover:border-blue-400 active:scale-95 transition-transform disabled:opacity-40 disabled:cursor-not-allowed"
                title="Сделать снимок"
              >
                <div className="w-14 h-14 rounded-full bg-white group-hover:bg-blue-500 transition-colors flex items-center justify-center shadow-lg">
                  <Camera className="w-6 h-6 text-slate-900 group-hover:text-white transition-colors" />
                </div>
              </button>

              {/* Flip camera button */}
              <button
                type="button"
                onClick={handleToggleFacingMode}
                disabled={isLoading || !!error}
                className="p-2.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors flex items-center gap-1.5 text-xs font-semibold disabled:opacity-40"
                title="Переключить камеру (задняя/передняя)"
              >
                <SwitchCamera className="w-4 h-4" />
                <span className="hidden sm:inline">
                  {facingMode === 'environment' ? 'Основная' : 'Селфи'}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
