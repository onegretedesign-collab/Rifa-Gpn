import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { CheckCircle2, AlertCircle, Info, X, Sparkles } from 'lucide-react';

export type ToastType = 'success' | 'info' | 'warning' | 'error';

export interface ToastItem {
  id: string;
  title?: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType, title?: string, duration?: number) => void;
  success: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = 'success', title?: string, duration: number = 3000) => {
      const id = 'toast_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
      const newToast: ToastItem = { id, message, type, title, duration };

      setToasts((prev) => [...prev.slice(-3), newToast]); // Keep max 4 visible

      if (duration > 0) {
        setTimeout(() => {
          dismiss(id);
        }, duration);
      }
    },
    [dismiss]
  );

  const success = useCallback((msg: string, title?: string) => showToast(msg, 'success', title), [showToast]);
  const info = useCallback((msg: string, title?: string) => showToast(msg, 'info', title), [showToast]);
  const warning = useCallback((msg: string, title?: string) => showToast(msg, 'warning', title), [showToast]);
  const error = useCallback((msg: string, title?: string) => showToast(msg, 'error', title), [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, success, info, warning, error, dismiss }}>
      {children}

      {/* Floating Notifications Container */}
      <aside
        aria-live="polite"
        aria-label="Notificações do sistema"
        className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0"
      >
        {toasts.map((t) => {
          const isSuccess = t.type === 'success';
          const isWarning = t.type === 'warning';
          const isError = t.type === 'error';

          return (
            <div
              key={t.id}
              role="alert"
              className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-2xl shadow-2xl backdrop-blur-xl border transition-all duration-300 transform translate-y-0 opacity-100 ${
                isSuccess
                  ? 'bg-neutral-900/95 border-emerald-500/40 text-neutral-100 shadow-emerald-500/10'
                  : isWarning
                  ? 'bg-neutral-900/95 border-amber-500/40 text-neutral-100 shadow-amber-500/10'
                  : isError
                  ? 'bg-neutral-900/95 border-red-500/40 text-neutral-100 shadow-red-500/10'
                  : 'bg-neutral-900/95 border-neutral-700/60 text-neutral-100 shadow-black/40'
              }`}
            >
              <div
                className={`w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
                  isSuccess
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : isWarning
                    ? 'bg-amber-500/20 text-amber-400'
                    : isError
                    ? 'bg-red-500/20 text-red-400'
                    : 'bg-neutral-800 text-neutral-300'
                }`}
              >
                {isSuccess && <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />}
                {isWarning && <AlertCircle className="w-4 h-4 stroke-[2.5]" />}
                {isError && <AlertCircle className="w-4 h-4 stroke-[2.5]" />}
                {!isSuccess && !isWarning && !isError && <Info className="w-4 h-4 stroke-[2.5]" />}
              </div>

              <div className="flex-1 text-xs">
                {t.title && (
                  <p className="font-bold text-white mb-0.5 leading-snug flex items-center gap-1">
                    {isSuccess && <Sparkles className="w-3 h-3 text-emerald-400 inline" />}
                    {t.title}
                  </p>
                )}
                <p className="text-neutral-300 font-medium leading-relaxed">{t.message}</p>
              </div>

              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className="text-neutral-500 hover:text-white p-1 rounded-lg transition"
                aria-label="Fechar notificação"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </aside>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextType {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
