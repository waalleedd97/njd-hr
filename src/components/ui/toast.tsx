"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

type ToastVariant = "success" | "error" | "warning" | "info";

interface ToastItem {
  id: number;
  variant: ToastVariant;
  message: string;
  duration: number;
}

interface ToastApi {
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

const ICON_BY_VARIANT: Record<ToastVariant, string> = {
  success: "check_circle",
  error: "error",
  warning: "warning",
  info: "info",
};

const STYLE_BY_VARIANT: Record<ToastVariant, string> = {
  success:
    "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  error: "bg-error-container/30 text-md-error border-md-error/30",
  warning:
    "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  info: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
    const handle = timersRef.current.get(id);
    if (handle) {
      clearTimeout(handle);
      timersRef.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (variant: ToastVariant, message: string, duration = 4000) => {
      const id = ++idRef.current;
      setToasts((list) => [...list, { id, variant, message, duration }]);
      const handle = setTimeout(() => dismiss(id), duration);
      timersRef.current.set(id, handle);
    },
    [dismiss]
  );

  // Cleanup all timers on unmount
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const handle of timers.values()) clearTimeout(handle);
      timers.clear();
    };
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      success: (m, d) => push("success", m, d),
      error: (m, d) => push("error", m, d),
      warning: (m, d) => push("warning", m, d),
      info: (m, d) => push("info", m, d),
      dismiss,
    }),
    [push, dismiss]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* Floating toast stack — bottom center, max-w on small screens */}
      <div
        className="pointer-events-none fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col-reverse gap-2 w-full max-w-sm px-3"
        role="region"
        aria-label="Notifications"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cn(
              "pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-2xl border backdrop-blur-md shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200",
              STYLE_BY_VARIANT[t.variant]
            )}
          >
            <Icon name={ICON_BY_VARIANT[t.variant]} size={20} fill className="shrink-0 mt-0.5" />
            <p className="text-sm font-medium flex-1 leading-snug">{t.message}</p>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="opacity-70 hover:opacity-100 transition-opacity shrink-0 -me-1"
              aria-label="Close"
            >
              <Icon name="close" size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
