import { createContext, useContext, useMemo, useRef, useState } from "react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());
  const TRANSITION_MS = 400;

  function clearAllTimers() {
    for (const t of timersRef.current.values()) clearTimeout(t);
    timersRef.current.clear();
  }

  function removeToast(id) {
    clearAllTimers();
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }

  function dismissToast(id) {
    clearAllTimers();
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, leaving: true } : t))
    );
    const removeTimer = setTimeout(() => removeToast(id), TRANSITION_MS);
    timersRef.current.set(`${id}:remove`, removeTimer);
  }

  function showToast(message, type = "info", timeoutMs = 2500) {
    const text =
      typeof message === "string"
        ? message
        : message && typeof message === "object" && "message" in message
        ? String(message.message || "")
        : String(message ?? "");
    const normalized = text.trim();
    if (!normalized) return null;

    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const toast = {
      id,
      message: normalized,
      type,
      visible: false,
      leaving: false,
    };

    clearAllTimers();
    setToasts([toast]);

    // Kick in the CSS transition.
    const showTimer = setTimeout(() => {
      setToasts((prev) =>
        prev.map((t) => (t.id === id ? { ...t, visible: true } : t))
      );
    }, 10);
    timersRef.current.set(`${id}:show`, showTimer);

    const leaveMs = Math.max(0, Number(timeoutMs) - TRANSITION_MS);
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
        {toasts
          .filter((t) => String(t.message || "").trim())
          .map((t) => (
            <div
              key={t.id}
              className={`toast toast-${t.type} ${
                t.visible ? "is-visible" : ""
              } ${t.leaving ? "is-leaving" : ""}`}
              role="status"
              onClick={() => dismissToast(t.id)}
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
