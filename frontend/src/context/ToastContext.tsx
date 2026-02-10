"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, AlertTriangle, Info, X } from "lucide-react";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: number;
  type: ToastType;
  message: string;
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

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((type: ToastType, message: string) => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const icons = {
    success: <CheckCircle size={14} strokeWidth={1.5} className="text-emerald-400 flex-shrink-0" />,
    error: <AlertTriangle size={14} strokeWidth={1.5} className="text-red-400 flex-shrink-0" />,
    info: <Info size={14} strokeWidth={1.5} className="text-blue-400 flex-shrink-0" />,
  };

  const styles = {
    success: "bg-emerald-950/90 border-emerald-800/40 text-emerald-300",
    error: "bg-red-950/90 border-red-800/40 text-red-300",
    info: "bg-blue-950/90 border-blue-800/40 text-blue-300",
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border backdrop-blur-sm shadow-lg ${styles[t.type]}`}
            >
              {icons[t.type]}
              <span className="text-[12px] font-medium flex-1">{t.message}</span>
              <button
                onClick={() => dismiss(t.id)}
                className="text-white/40 hover:text-white/70 cursor-pointer flex-shrink-0"
              >
                <X size={12} strokeWidth={1.5} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
