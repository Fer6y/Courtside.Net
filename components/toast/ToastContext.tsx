"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import ToastStack from "./ToastStack";

export type ToastState = "loading" | "success" | "error";

export interface Toast {
  id: string;
  message: string;
  state: ToastState;
}

interface ToastContextValue {
  loading: (message?: string) => string;
  success: (id: string, message?: string) => void;
  error: (id: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counterRef = useRef(0);

  const addToast = useCallback((message: string, state: ToastState): string => {
    const id = `toast-${++counterRef.current}`;
    setToasts((prev) => [...prev, { id, message, state }]);
    return id;
  }, []);

  const updateToast = useCallback((id: string, state: ToastState, message: string) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, state, message } : t))
    );
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const loading = useCallback(
    (message = "Saving...") => addToast(message, "loading"),
    [addToast]
  );

  const success = useCallback(
    (id: string, message = "Done!") => updateToast(id, "success", message),
    [updateToast]
  );

  const error = useCallback(
    (id: string, message = "Something went wrong") =>
      updateToast(id, "error", message),
    [updateToast]
  );

  return (
    <ToastContext.Provider value={{ loading, success, error }}>
      {children}
      <ToastStack toasts={toasts} onDismiss={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
