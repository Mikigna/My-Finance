import React, { useEffect, useState } from 'react';
import { WifiOff, Wifi } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [showReconnectedToast, setShowReconnectedToast] = useState<boolean>(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowReconnectedToast(true);
      const timer = setTimeout(() => setShowReconnectedToast(false), 3000);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowReconnectedToast(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline && !showReconnectedToast) return null;

  if (showReconnectedToast) {
    return (
      <div className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold shadow-lg backdrop-blur-md animate-bounce">
        <Wifi className="w-4 h-4" />
        <span>Соединение восстановлено</span>
      </div>
    );
  }

  return (
    <div className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900/90 text-amber-300 text-xs font-semibold shadow-xl border border-slate-700 backdrop-blur-md">
      <WifiOff className="w-4 h-4 text-amber-400 animate-pulse" />
      <span>Офлайн режим — данные сохраняются локально</span>
    </div>
  );
};
