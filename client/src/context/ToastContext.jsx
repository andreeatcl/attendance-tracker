import { createContext, useContext, useMemo, useRef, useState } from "react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());

  function clearAllTimers() {
    for (const t of timersRef.current.values()) clearTimeout(t);
    timersRef.current.clear();
  }

  function removeToast(id) {
    clearAllTimers();
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }

  function showToast(message, type = "info", timeoutMs = 2500) {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const toast = { id, message: String(message || ""), type, leaving: false };

    clearAllTimers();
    setToasts([toast]);

    const leaveMs = Math.max(0, Number(timeoutMs) - 220);
    const leaveTimer = setTimeout(() => {
      setToasts((prev) =>
        prev.map((t) => (t.id === id ? { ...t, leaving: true } : t))
      );
    }, leaveMs);
    const removeTimer = setTimeout(() => removeToast(id), timeoutMs);

    timersRef.current.set(`${id}:leave`, leaveTimer);
    timersRef.current.set(`${id}:remove`, removeTimer);

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
            className={`toast toast-${t.type} ${t.leaving ? "is-leaving" : ""}`}
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
