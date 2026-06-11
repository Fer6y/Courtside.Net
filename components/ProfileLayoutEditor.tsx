"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveLayoutConfig } from "@/app/profile/[username]/customize/actions";
import {
  type SectionId,
  type LayoutConfig,
  SECTION_META,
  DEFAULT_ORDER,
} from "@/lib/profileLayout";

interface Props {
  username: string;
  initialConfig: LayoutConfig | null;
}

export default function ProfileLayoutEditor({ username, initialConfig }: Props) {
  // Merge stored order with DEFAULT_ORDER so new sections always appear
  const stored  = initialConfig?.order ?? DEFAULT_ORDER;
  const known   = new Set(stored);
  const fullOrder = [
    ...stored,
    ...DEFAULT_ORDER.filter((s) => !known.has(s)),
  ] as SectionId[];

  const [order,    setOrder]    = useState<SectionId[]>(fullOrder);
  const [hidden,   setHidden]   = useState<Set<SectionId>>(new Set((initialConfig?.hidden ?? []) as SectionId[]));
  const [variants, setVariants] = useState<Partial<Record<SectionId, string>>>(initialConfig?.variants ?? {});
  const [saved,    setSaved]    = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function moveUp(idx: number) {
    if (idx === 0) return;
    const next = [...order];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    setOrder(next); setSaved(false);
  }

  function moveDown(idx: number) {
    if (idx === order.length - 1) return;
    const next = [...order];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    setOrder(next); setSaved(false);
  }

  function toggleHidden(id: SectionId) {
    setHidden((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    setSaved(false);
  }

  function setVariant(id: SectionId, v: string) {
    setVariants((prev) => ({ ...prev, [id]: v }));
    setSaved(false);
  }

  function save() {
    startTransition(async () => {
      try {
        await saveLayoutConfig(username, {
          order,
          hidden: [...hidden] as SectionId[],
          variants,
        });
        setSaved(true);
        router.refresh();
      } catch { /* silent */ }
    });
  }

  const visibleSections = order.filter((id) => !hidden.has(id));
  const hiddenSections  = order.filter((id) =>  hidden.has(id));

  return (
    <div>

      {/* Live preview hint */}
      <p className="font-sans text-sm text-text-dim mb-8">
        Reorder sections, toggle visibility, and choose how each one displays. Changes apply to your public profile.
      </p>

      {/* Visible sections */}
      <div className="mb-2">
        <p className="font-mono text-[10px] uppercase tracking-widest text-text-dim mb-3">Visible</p>
        <div className="flex flex-col gap-2">
          {visibleSections.map((id) => {
            const meta           = SECTION_META[id];
            const globalIdx      = order.indexOf(id);
            const currentVariant = variants[id] ?? meta.variants?.[0]?.key ?? "default";

            return (
              <SectionCard
                key={id}
                id={id}
                meta={meta}
                isHidden={false}
                currentVariant={currentVariant}
                isFirst={id === visibleSections[0]}
                isLast={id === visibleSections[visibleSections.length - 1]}
                onMoveUp={() => moveUp(globalIdx)}
                onMoveDown={() => moveDown(globalIdx)}
                onToggleHidden={() => toggleHidden(id)}
                onSetVariant={(v) => setVariant(id, v)}
              />
            );
          })}
        </div>
      </div>

      {/* Hidden sections */}
      {hiddenSections.length > 0 && (
        <div className="mt-6">
          <p className="font-mono text-[10px] uppercase tracking-widest text-text-dim mb-3">Hidden</p>
          <div className="flex flex-col gap-2">
            {hiddenSections.map((id) => {
              const meta           = SECTION_META[id];
              const globalIdx      = order.indexOf(id);
              const currentVariant = variants[id] ?? meta.variants?.[0]?.key ?? "default";

              return (
                <SectionCard
                  key={id}
                  id={id}
                  meta={meta}
                  isHidden={true}
                  currentVariant={currentVariant}
                  isFirst={false}
                  isLast={false}
                  onMoveUp={() => moveUp(globalIdx)}
                  onMoveDown={() => moveDown(globalIdx)}
                  onToggleHidden={() => toggleHidden(id)}
                  onSetVariant={(v) => setVariant(id, v)}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Save */}
      <div className="mt-8 flex items-center gap-4">
        <button
          onClick={save}
          disabled={isPending}
          className="font-mono text-sm px-6 py-2.5 rounded-lg font-semibold transition-all duration-200"
          style={{
            background: saved  ? "rgba(34,214,138,0.12)" : "#22d68a",
            color:      saved  ? "#22d68a"               : "#0e1116",
            border:     saved  ? "1px solid rgba(34,214,138,0.3)" : "none",
            opacity:    isPending ? 0.6 : 1,
            cursor:     isPending ? "not-allowed" : "pointer",
          }}
        >
          {isPending ? "Saving…" : saved ? "Saved ✓" : "Save Layout"}
        </button>
        {saved && (
          <span className="font-sans text-sm text-text-dim">
            Your profile has been updated.
          </span>
        )}
      </div>
    </div>
  );
}

// ── Section card ──────────────────────────────────────────────────────────────

interface SectionCardProps {
  id:             SectionId;
  meta:           (typeof SECTION_META)[SectionId];
  isHidden:       boolean;
  currentVariant: string;
  isFirst:        boolean;
  isLast:         boolean;
  onMoveUp:       () => void;
  onMoveDown:     () => void;
  onToggleHidden: () => void;
  onSetVariant:   (v: string) => void;
}

function SectionCard({
  meta,
  isHidden,
  currentVariant,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onToggleHidden,
  onSetVariant,
}: SectionCardProps) {
  return (
    <div
      className="rounded-xl p-4 transition-all duration-150"
      style={{
        border:     isHidden ? "1px solid rgba(255,255,255,0.04)" : "1px solid rgba(255,255,255,0.09)",
        background: isHidden ? "rgba(255,255,255,0.01)" : "rgba(255,255,255,0.03)",
        opacity:    isHidden ? 0.55 : 1,
      }}
    >
      <div className="flex items-start gap-3">

        {/* Reorder arrows — only for visible sections */}
        {!isHidden && (
          <div className="flex flex-col gap-0.5 shrink-0 mt-0.5">
            <button
              onClick={onMoveUp}
              disabled={isFirst}
              className="w-7 h-7 flex items-center justify-center rounded-md font-mono text-sm text-text-dim hover:text-text-primary hover:bg-white/5 disabled:opacity-20 transition-all duration-100"
            >
              ↑
            </button>
            <button
              onClick={onMoveDown}
              disabled={isLast}
              className="w-7 h-7 flex items-center justify-center rounded-md font-mono text-sm text-text-dim hover:text-text-primary hover:bg-white/5 disabled:opacity-20 transition-all duration-100"
            >
              ↓
            </button>
          </div>
        )}

        {/* Icon */}
        <span className="text-xl shrink-0 mt-0.5">{meta.icon}</span>

        {/* Info + variant picker */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-mono text-sm font-semibold text-text-primary">{meta.label}</span>
          </div>
          <p className="font-sans text-xs text-text-dim leading-relaxed">{meta.description}</p>

          {/* Variant pills — only when visible */}
          {meta.variants && !isHidden && (
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {meta.variants.map((v) => (
                <button
                  key={v.key}
                  onClick={() => onSetVariant(v.key)}
                  className="font-mono text-[10px] px-2.5 py-1 rounded-full transition-all duration-150"
                  style={{
                    background: currentVariant === v.key ? "rgba(34,214,138,0.14)" : "rgba(255,255,255,0.05)",
                    border:     currentVariant === v.key ? "1px solid rgba(34,214,138,0.3)" : "1px solid rgba(255,255,255,0.08)",
                    color:      currentVariant === v.key ? "#22d68a" : "#6b7280",
                  }}
                >
                  {v.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Visible / Hidden toggle */}
        <button
          onClick={onToggleHidden}
          className="shrink-0 font-mono text-xs px-3 py-1.5 rounded-lg transition-all duration-150 whitespace-nowrap"
          style={{
            background: isHidden ? "rgba(255,255,255,0.05)" : "rgba(34,214,138,0.1)",
            border:     isHidden ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(34,214,138,0.2)",
            color:      isHidden ? "#6b7280" : "#22d68a",
          }}
        >
          {isHidden ? "Show" : "Hide"}
        </button>
      </div>
    </div>
  );
}
