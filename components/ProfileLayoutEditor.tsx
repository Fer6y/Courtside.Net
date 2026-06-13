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
      <p className="bill-name italic mb-8" style={{ fontWeight: 300, fontSize: 14, color: "rgba(236,229,216,0.5)" }}>
        Reorder sections, toggle visibility, and choose how each one displays. Changes apply to your public profile.
      </p>

      {/* Visible sections */}
      <div className="mb-2">
        <p className="eyebrow mb-3" style={{ fontSize: 9, color: "rgba(236,229,216,0.4)" }}>Visible</p>
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
          <p className="eyebrow mb-3" style={{ fontSize: 9, color: "rgba(236,229,216,0.4)" }}>Hidden</p>
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
          className={`font-mono text-sm px-6 py-2.5 rounded-lg font-semibold transition-all duration-200 ${saved ? "btn-confirmed" : "btn-solid"}`}
          style={{
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
      className="rounded-lg p-4 transition-all duration-150"
      style={{
        border:     isHidden ? "1px solid var(--hairline-soft)" : "1px solid var(--hairline)",
        background: "rgba(236,229,216,0.02)",
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
        <meta.Icon size={18} strokeWidth={1.6} className="shrink-0 mt-1" style={{ color: "rgba(236,229,216,0.5)" }} />


        {/* Info + variant picker */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="bill-name" style={{ fontSize: 15, color: "#ece5d8" }}>{meta.label}</span>
          </div>
          <p className="font-sans text-xs leading-relaxed" style={{ color: "rgba(236,229,216,0.45)" }}>{meta.description}</p>

          {/* Variant options — only when visible */}
          {meta.variants && !isHidden && (
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2.5">
              {meta.variants.map((v) => (
                <button
                  key={v.key}
                  onClick={() => onSetVariant(v.key)}
                  className="eyebrow transition-all duration-150"
                  style={{
                    fontSize: 9,
                    paddingBottom: 2,
                    color: currentVariant === v.key ? "#c9a96a" : "rgba(236,229,216,0.4)",
                    borderBottom: currentVariant === v.key ? "1px solid rgba(201,169,106,0.6)" : "1px solid transparent",
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
          className="shrink-0 eyebrow px-3 py-1.5 rounded-md transition-all duration-150 whitespace-nowrap"
          style={{
            border: "1px solid var(--hairline)",
            color:  isHidden ? "rgba(236,229,216,0.45)" : "#c9a96a",
            fontSize: 9,
          }}
        >
          {isHidden ? "Show" : "Hide"}
        </button>
      </div>
    </div>
  );
}
