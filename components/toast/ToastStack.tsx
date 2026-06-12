"use client";

import { createPortal } from "react-dom";
import type { Toast } from "./ToastContext";
import ToastItem from "./ToastItem";

interface Props {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

export default function ToastStack({ toasts, onDismiss }: Props) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 items-end"
      style={{ pointerEvents: "none" }}
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>,
    document.body
  );
}
