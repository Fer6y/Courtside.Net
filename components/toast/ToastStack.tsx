"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import type { Toast } from "./ToastContext";
import ToastItem from "./ToastItem";
import NoteToast from "./NoteToast";

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

  const cards = toasts.filter((t) => t.kind === "card");
  const notes = toasts.filter((t) => t.kind === "note");

  return createPortal(
    <>
      {/* Centered save-flow cards (ball/racquet animation) */}
      <div
        className="fixed inset-0 z-[9999] flex flex-col gap-3 items-center justify-center"
        style={{ pointerEvents: "none" }}
      >
        {cards.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
        ))}
      </div>

      {/* Quiet event notes, stacked above the bottom nav */}
      <div
        className="fixed inset-x-0 z-[9998] flex flex-col-reverse gap-2 items-center"
        style={{
          pointerEvents: "none",
          bottom: "calc(var(--nav-bottom-total, 64px) + 12px)",
        }}
      >
        {notes.map((toast) => (
          <NoteToast key={toast.id} toast={toast} onDismiss={onDismiss} />
        ))}
      </div>
    </>,
    document.body
  );
}
