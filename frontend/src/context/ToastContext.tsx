"use client";

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { CheckCircle, AlertTriangle, Info, X } from "lucide-react";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: number;
  type: ToastType;
  message: string;
  exiting?: boolean;
}

interface ToastContextValue {
  toast: (type: ToastType, message: string) => void;
}

const ToastContext = createContext<ToastContextValue>({
  toast: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

let nextId = 0;

function ToastItem({ t, onDismiss }: { t: Toast; onDismiss: (id: number) => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger enter animation on next frame
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const icons = {
    success: <CheckCircle size={16} strokeWidth={1.5} className="text-[var(--accent-emerald)] flex-shrink-0" />,
    error: <AlertTriangle size={16} strokeWidth={1.5} className="text-[var(--accent-red)] flex-shrink-0" />,
    info: <Info size={16} strokeWidth={1.5} className="text-[var(--text-secondary)] flex-shrink-0" />,
  };

  const styles = {
    success: "bg-[var(--bg-secondary)] border-[var(--accent-emerald)]/30 text-[var(--accent-emerald)] border-l-2 border-l-[var(--accent-emerald)]",
    error: "bg-[var(--bg-secondary)] border-[var(--accent-red)]/30 text-[var(--accent-red)] border-l-2 border-l-[var(--accent-red)]",
    info: "bg-[var(--bg-secondary)] border-[var(--border-medium)] text-[var(--text-primary)] border-l-2 border-l-[#4D4DFF]",
  };

  const glows = {
    success: "shadow-[0_0_40px_rgba(52,211,153,0.20)]",
    error: "shadow-[0_0_40px_rgba(239,68,68,0.20)]",
    info: "shadow-xl",
  };

  return (
    <div
      className={`flex items-center gap-2.5 px-5 py-3.5 rounded-xl border backdrop-blur-xl ${styles[t.type]} ${glows[t.type]} transition-all duration-200 ${
        visible && !t.exiting
          ? "opacity-100 translate-y-0 scale-100"
          : "opacity-0 translate-y-5 scale-95"
      }`}
    >
      {icons[t.type]}
      <span className="text-[13px] font-medium flex-1">{t.message}</span>
      <button
        onClick={() => onDismiss(t.id)}
        className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] cursor-pointer flex-shrink-0"
      >
        <X size={12} strokeWidth={1.5} />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    // Mark as exiting for animation, then remove after transition
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)));
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 200);
  }, []);

  const toast = useCallback((type: ToastType, message: string) => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      dismiss(id);
    }, 5000);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
        {toasts.map((t) => (
          <ToastItem key={t.id} t={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
