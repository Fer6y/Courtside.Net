"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { submitSkillRating } from "./actions";
import { useToast } from "@/components/toast/ToastContext";
import AchievementBanner from "@/components/AchievementBanner";

const CATEGORIES = [
  {
    name: "MENTAL",
    color: "#d4734e",
    skills: [
      { key: "focus",           label: "Focus",       desc: "Concentration across long matches" },
      { key: "clutch",          label: "Clutch",      desc: "Performance on break points & tiebreaks" },
      { key: "resilience",      label: "Resilience",  desc: "Bouncing back from lost sets & momentum shifts" },
      { key: "processing_time", label: "Proc. Time",  desc: "Speed of reading situations & making decisions" },
    ],
  },
  {
    name: "TECHNIQUE",
    color: "#22d68a",
    skills: [
      { key: "serve",        label: "Serve",        desc: "Power, placement & variation" },
      { key: "forehand",     label: "Forehand",     desc: "Forehand groundstroke quality" },
      { key: "backhand",     label: "Backhand",     desc: "Backhand groundstroke quality" },
      { key: "shot_variety", label: "Shot Variety", desc: "Range of shots & tactical diversity" },
    ],
  },
  {
    name: "SKILL",
    color: "#f5c518",
    skills: [
      { key: "net_play",      label: "Net Play",    desc: "Volleying & finishing at the net" },
      { key: "touch",         label: "Touch",       desc: "Drop shots, lobs & feel" },
      { key: "return_play",   label: "Ret. Play",   desc: "Quality of service return" },
      { key: "reaction_time", label: "React. Time", desc: "Response speed to opponent's shots" },
      { key: "deception",     label: "Deception",   desc: "Disguise on shots, fakes & misdirection" },
    ],
  },
  {
    name: "MOVEMENT",
    color: "#4a9eff",
    skills: [
      { key: "speed",          label: "Speed",        desc: "Raw foot speed & first-step quickness" },
      { key: "court_coverage", label: "Coverage",     desc: "Reaching balls across the full court" },
      { key: "positioning",    label: "Positioning",  desc: "Court awareness & optimal positioning" },
      { key: "anticipation",   label: "Anticipation", desc: "Reading play & predicting opponent's shots" },
    ],
  },
] as const;

type SkillKey =
  | "focus" | "clutch" | "resilience" | "processing_time"
  | "serve" | "forehand" | "backhand" | "shot_variety"
  | "net_play" | "touch" | "return_play" | "reaction_time" | "deception"
  | "speed" | "court_coverage" | "positioning" | "anticipation";

function defaultValues(existing: Record<string, unknown> | null): Record<SkillKey, number> {
  const defaults: Record<string, number> = {};
  for (const cat of CATEGORIES) {
    for (const skill of cat.skills) {
      const v = existing?.[skill.key];
      defaults[skill.key] = typeof v === "number" ? v : 3.0;
    }
  }
  return defaults as Record<SkillKey, number>;
}

// Flat list of all skills for the highlight picker
const ALL_SKILLS = CATEGORIES.flatMap((cat) =>
  cat.skills.map((s) => ({ key: s.key as SkillKey, label: s.label, color: cat.color }))
);

function topSkillKey(vals: Record<SkillKey, number>): SkillKey {
  let best: SkillKey = "serve";
  let bestVal = 0;
  for (const { key } of ALL_SKILLS) {
    if (vals[key] > bestVal) { bestVal = vals[key]; best = key; }
  }
  return best;
}

export default function RatePlayerForm({
  playerId,
  existing,
}: {
  playerId: string;
  existing: Record<string, unknown> | null;
}) {
  const [values, setValues] = useState<Record<SkillKey, number>>(
    () => defaultValues(existing)
  );
  const [highlightedSkill, setHighlightedSkill] = useState<SkillKey>(() => {
    const existingHighlight = existing?.highlighted_skill as string | undefined;
    if (existingHighlight && ALL_SKILLS.some((s) => s.key === existingHighlight)) {
      return existingHighlight as SkillKey;
    }
    return topSkillKey(defaultValues(existing));
  });
  const [pending, setPending]   = useState(false);
  const [earnedIds, setEarnedIds] = useState<string[]>([]);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const toast = useToast();

  const set = (key: SkillKey, val: number) =>
    setValues((prev) => ({ ...prev, [key]: val }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const toastId = toast.loading("Saving rating…");
    try {
      const fd = new FormData(formRef.current!);
      const result = await submitSkillRating(playerId, fd);
      toast.success(toastId, "Rating saved!");
      setPending(false);
      if (result.newAchievements?.length) setEarnedIds(result.newAchievements);
      router.push(`/players/${playerId}`);
      router.refresh();
    } catch {
      toast.error(toastId, "Something went wrong");
      setPending(false);
    }
  }

  return (
    <>
    <AchievementBanner achievementIds={earnedIds} onClear={() => setEarnedIds([])} />
    <form ref={formRef} onSubmit={handleSubmit}>
      <div className="flex flex-col gap-8">
        {CATEGORIES.map((cat) => (
          <section key={cat.name}>
            {/* Category header */}
            <div
              className="font-mono text-xs font-semibold uppercase tracking-widest mb-4 pb-2 border-b"
              style={{ color: cat.color, borderColor: `${cat.color}22` }}
            >
              {cat.name}
            </div>

            <div className="flex flex-col gap-5">
              {cat.skills.map((skill) => {
                const val = values[skill.key as SkillKey];
                return (
                  <div key={skill.key}>
                    <div className="flex items-baseline justify-between mb-2">
                      <div>
                        <span className="font-sans text-sm font-medium text-text-primary">
                          {skill.label}
                        </span>
                        <span className="font-sans text-xs text-text-dim ml-2 hidden sm:inline">
                          {skill.desc}
                        </span>
                      </div>
                      <span
                        className="font-mono text-sm font-bold tabular-nums"
                        style={{ color: cat.color, minWidth: 28, textAlign: "right" }}
                      >
                        {val.toFixed(1)}
                      </span>
                    </div>

                    {/* Slider */}
                    <div className="relative">
                      <input
                        type="range"
                        name={skill.key}
                        min={1}
                        max={5}
                        step={0.5}
                        value={val}
                        onChange={(e) =>
                          set(skill.key as SkillKey, parseFloat(e.target.value))
                        }
                        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                        style={{
                          background: `linear-gradient(to right, ${cat.color} 0%, ${cat.color} ${((val - 1) / 4) * 100}%, rgba(255,255,255,0.08) ${((val - 1) / 4) * 100}%, rgba(255,255,255,0.08) 100%)`,
                          accentColor: cat.color,
                        }}
                      />
                      {/* Scale ticks */}
                      <div className="flex justify-between mt-1 px-0.5">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <span key={n} className="font-mono text-[10px] text-text-dim">
                            {n}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {/* Hidden field for highlighted skill */}
      <input type="hidden" name="highlighted_skill" value={highlightedSkill} />

      {/* Highlight picker */}
      <section className="mt-8">
        <div
          className="font-mono text-xs font-semibold uppercase tracking-widest mb-1 pb-2 border-b"
          style={{ color: "#9ca3af", borderColor: "rgba(255,255,255,0.07)" }}
        >
          Featured Skill
        </div>
        <p className="font-sans text-xs text-text-dim mb-4 mt-2">
          Choose one skill to highlight on your profile and in the activity feed.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {ALL_SKILLS.map(({ key, label, color }) => {
            const isSelected = highlightedSkill === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setHighlightedSkill(key)}
                className="font-mono text-[10px] px-2.5 py-1 rounded-full transition-all duration-150"
                style={{
                  background: isSelected ? `${color}18` : "rgba(255,255,255,0.04)",
                  border:     isSelected ? `1px solid ${color}44` : "1px solid rgba(255,255,255,0.08)",
                  color:      isSelected ? color : "#6b7280",
                }}
              >
                {label} <span style={{ opacity: 0.7 }}>{values[key].toFixed(1)}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Submit */}
      <div className="mt-10 flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="font-mono text-sm px-6 py-3 rounded-lg font-semibold transition-all duration-150"
          style={{
            background: pending ? "rgba(34,214,138,0.3)" : "#22d68a",
            color: pending ? "rgba(255,255,255,0.5)" : "#0e1116",
            cursor: pending ? "not-allowed" : "pointer",
          }}
        >
          {pending ? "Saving…" : existing ? "Update Rating" : "Submit Rating"}
        </button>
        <a
          href={`/players/${playerId}`}
          className="font-mono text-sm px-6 py-3 rounded-lg border border-white/10 text-text-dim hover:text-text-primary transition-colors duration-150"
        >
          Cancel
        </a>
      </div>
    </form>
    </>
  );
}
