import { createContext, useCallback, useContext, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Info, X } from 'lucide-react';

export interface ToastOptions {
  /** Short bold headline (optional). */
  title?: string;
  variant?: 'default' | 'success';
  /** ms before auto-dismiss. Default 3500. */
  duration?: number;
}

interface ToastItem extends Required<Omit<ToastOptions, 'title'>> {
  id: number;
  message: string;
  title?: string;
}

interface ToastContextValue {
  toast: (message: string, opts?: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/**
 * Global toast system (design.md §5): top-right slide-in, navy-950 bg, white text,
 * auto-dismiss 3.5s. Usage:
 *   const { toast } = useToast();
 *   toast('Welcome back, Alex');
 *   toast('Booking confirmed', { title: 'MF 2042 · MUC → NCE', variant: 'success' });
 * Requires <ToastProvider> mounted (done in main.tsx).
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, opts?: ToastOptions) => {
      const id = ++idRef.current;
      const item: ToastItem = {
        id,
        message,
        title: opts?.title,
        variant: opts?.variant ?? 'default',
        duration: opts?.duration ?? 3500,
      };
      setToasts((t) => [...t, item]);
      window.setTimeout(() => dismiss(id), item.duration);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[min(92vw,360px)] flex-col gap-2">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout="position"
              initial={{ opacity: 0, x: 32, scale: 0.97 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 24, scale: 0.97 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="pointer-events-auto flex items-start gap-3 rounded-xl bg-ink-dark px-4 py-3 text-white shadow-modal"
            >
              {t.variant === 'success' ? (
                <CheckCircle2 className="mt-0.5 h-4.5 w-4.5 shrink-0 text-gold" size={18} />
              ) : (
                <Info className="mt-0.5 shrink-0 text-sky" size={18} />
              )}
              <div className="min-w-0 flex-1">
                {t.title && <p className="font-display text-[13px] font-bold leading-tight">{t.title}</p>}
                <p className="text-[13px] leading-snug text-white/85">{t.message}</p>
              </div>
              <button
                onClick={() => dismiss(t.id)}
                className="mt-0.5 shrink-0 rounded p-0.5 text-white/50 transition-colors hover:text-white"
                aria-label="Dismiss"
              >
                <X size={14} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
