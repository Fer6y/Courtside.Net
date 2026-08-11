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

export interface NotifyOptions {
  /** Small gold link rendered after the message, e.g. "View honours" */
  actionLabel?: string;
  actionHref?: string;
  /** Auto-dismiss delay in ms (default 3400) */
  duration?: number;
}

export interface Toast {
  id: string;
  message: string;
  state: ToastState;
  /** "card" = the centered ball/racquet save toast; "note" = small bottom pill */
  kind: "card" | "note";
  actionLabel?: string;
  actionHref?: string;
  duration?: number;
}

interface ToastContextValue {
  loading: (message?: string) => string;
  success: (id: string, message?: string) => void;
  error: (id: string, message?: string) => void;
  /** Fire a lightweight bottom notification — follows, comments, progress nudges. */
  notify: (message: string, opts?: NotifyOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counterRef = useRef(0);

  const addToast = useCallback((message: string, state: ToastState): string => {
    const id = `toast-${++counterRef.current}`;
    setToasts((prev) => [...prev, { id, message, state, kind: "card" }]);
    return id;
  }, []);

  const notify = useCallback((message: string, opts?: NotifyOptions) => {
    const id = `toast-${++counterRef.current}`;
    setToasts((prev) => {
      const next = [...prev, { id, message, state: "success" as ToastState, kind: "note" as const, ...opts }];
      // Cap the note stack at 3 — drop the oldest note, never a card
      const oldestNote = next.find((t) => t.kind === "note");
      return next.filter((t) => t.kind === "note").length > 3 && oldestNote
        ? next.filter((t) => t !== oldestNote)
        : next;
    });
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
    <ToastContext.Provider value={{ loading, success, error, notify }}>
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
