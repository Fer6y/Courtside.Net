"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import type { Toast } from "./ToastContext";
import ToastItem from "./ToastItem";

interface Props {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

const emptySubscribe = () => () => {};

export default function ToastStack({ toasts, onDismiss }: Props) {
  // False during SSR and the hydration render, true after — the server
  // renders null (no document), so portaling during hydration causes a
  // mismatch error
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex flex-col gap-3 items-center justify-center"
      style={{ pointerEvents: "none" }}
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>,
    document.body
  );
}
