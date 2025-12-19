import { createContext, useContext, useMemo, useRef, useState } from "react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());

  function removeToast(id) {
    const timers = timersRef.current;
    const t = timers.get(id);
    if (t) {
      clearTimeout(t);
      timers.delete(id);
    }
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }

  function showToast(message, type = "info", timeoutMs = 2500) {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const toast = { id, message: String(message || ""), type };
    setToasts((prev) => [...prev, toast]);

    const t = setTimeout(() => removeToast(id), timeoutMs);
    timersRef.current.set(id, t);

    return id;
  }

  const value = useMemo(() => ({ showToast }), []);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-host" aria-live="polite" aria-atomic="true">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast toast-${t.type}`}
            role="status"
            onClick={() => removeToast(t.id)}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}
