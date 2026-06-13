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
            {/* Category header — eyebrow in the quadrant colour over a hairline */}
            <div className="eyebrow mb-2" style={{ fontSize: 10, color: cat.color }}>
              {cat.name}
            </div>
            <hr className="rule mb-5" />

            <div className="flex flex-col gap-6">
              {cat.skills.map((skill) => {
                const val = values[skill.key as SkillKey];
                const pct = ((val - 1) / 4) * 100;
                return (
                  <div key={skill.key}>
                    <div className="flex items-baseline justify-between mb-3 gap-3">
                      <div>
                        <span className="font-sans text-sm text-text-primary">
                          {skill.label}
                        </span>
                        <span className="font-sans text-xs text-text-dim ml-2 hidden sm:inline">
                          {skill.desc}
                        </span>
                      </div>
                      <span
                        className="font-mono tabular-nums"
                        style={{ fontSize: 16, fontWeight: 600, color: cat.color, minWidth: 30, textAlign: "right" }}
                      >
                        {val.toFixed(1)}
                      </span>
                    </div>

                    {/* Slider */}
                    <div>
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
                        className="prog-slider"
                        style={{ "--fill": pct, "--accent": cat.color } as React.CSSProperties}
                      />
                      {/* Scale ticks */}
                      <div className="flex justify-between mt-2">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <span key={n} className="eyebrow" style={{ fontSize: 9, color: "rgba(236,229,216,0.3)" }}>
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
      <section className="mt-10">
        <div className="eyebrow mb-2" style={{ fontSize: 10, color: "#c9a96a" }}>
          Featured Skill
        </div>
        <hr className="rule" />
        <p className="font-sans text-xs text-text-dim mb-4 mt-3">
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
                  background: isSelected ? `${color}18` : "rgba(236,229,216,0.04)",
                  border:     isSelected ? `1px solid ${color}55` : "1px solid var(--hairline)",
                  color:      isSelected ? color : "rgba(236,229,216,0.45)",
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
          className="eyebrow btn-solid rounded-md px-6 py-3 font-semibold"
          style={{ fontSize: 11 }}
        >
          {pending ? "Saving…" : existing ? "Update Rating" : "Submit Rating"}
        </button>
        <a
          href={`/players/${playerId}`}
          className="eyebrow rounded-md px-6 py-3 transition-colors duration-150"
          style={{ fontSize: 11, border: "1px solid rgba(201,169,106,0.45)", color: "#c9a96a" }}
        >
          Cancel
        </a>
      </div>
    </form>
    </>
  );
}
