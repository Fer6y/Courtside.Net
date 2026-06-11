"use client";

import {
  type AvatarConfig,
  type AvatarTemplate,
  AVATAR_TEMPLATES,
  BG_COLORS,
  FG_COLORS,
  DEFAULT_AVATAR_CONFIG,
  BallSVG,
  RacquetSVG,
  NetSVG,
} from "@/lib/avatarTemplates";

interface Props {
  value:     AvatarConfig;
  initials:  string;
  onChange:  (next: AvatarConfig) => void;
}

// ── Mini preview at a fixed 72 px ─────────────────────────────────────────────
function AvatarPreview({ cfg, initials }: { cfg: AvatarConfig; initials: string }) {
  const size = 72;
  const { template, bgColor, fgColor } = cfg;

  let inner: React.ReactNode;
  if (template === "ball") {
    inner = <BallSVG fg={fgColor} bg={bgColor} size={size} />;
  } else if (template === "racquet") {
    inner = <RacquetSVG fg={fgColor} bg={bgColor} size={size} />;
  } else if (template === "net") {
    inner = <NetSVG fg={fgColor} bg={bgColor} size={size} />;
  } else {
    inner = (
      <span
        style={{
          fontFamily: "var(--font-ibm-plex-mono), monospace",
          fontSize:   "26px",
          fontWeight: 700,
          color:      fgColor,
          lineHeight: 1,
        }}
      >
        {initials.slice(0, 2).toUpperCase()}
      </span>
    );
  }

  return (
    <div
      style={{
        width:           size,
        height:          size,
        borderRadius:    "50%",
        backgroundColor: bgColor,
        display:         "flex",
        alignItems:      "center",
        justifyContent:  "center",
        overflow:        "hidden",
        flexShrink:      0,
      }}
    >
      {inner}
    </div>
  );
}

// ── Color swatch button ────────────────────────────────────────────────────────
function Swatch({
  color,
  selected,
  onClick,
}: {
  color:    string;
  selected: boolean;
  onClick:  () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width:        28,
        height:       28,
        borderRadius: "50%",
        backgroundColor: color,
        border: selected
          ? "2px solid #22d68a"
          : "2px solid transparent",
        boxShadow: selected ? "0 0 0 1px rgba(34,214,138,0.5)" : "none",
        cursor:    "pointer",
        flexShrink: 0,
        transition: "box-shadow 100ms, border-color 100ms",
      }}
      aria-label={color}
    />
  );
}

// ── Template swatch button ─────────────────────────────────────────────────────
function TemplateSwatch({
  templateKey,
  label,
  selected,
  cfg,
  initials,
  onClick,
}: {
  templateKey: AvatarTemplate;
  label:       string;
  selected:    boolean;
  cfg:         AvatarConfig;
  initials:    string;
  onClick:     () => void;
}) {
  const previewCfg = { ...cfg, template: templateKey };
  const size = 44;

  let inner: React.ReactNode;
  if (templateKey === "ball") {
    inner = <BallSVG fg={cfg.fgColor} bg={cfg.bgColor} size={size} />;
  } else if (templateKey === "racquet") {
    inner = <RacquetSVG fg={cfg.fgColor} bg={cfg.bgColor} size={size} />;
  } else if (templateKey === "net") {
    inner = <NetSVG fg={cfg.fgColor} bg={cfg.bgColor} size={size} />;
  } else {
    inner = (
      <span
        style={{
          fontFamily: "var(--font-ibm-plex-mono), monospace",
          fontSize:   "16px",
          fontWeight: 700,
          color:      cfg.fgColor,
          lineHeight: 1,
        }}
      >
        {initials.slice(0, 2).toUpperCase()}
      </span>
    );
  }
  // suppress unused previewCfg warning
  void previewCfg;

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1.5"
      style={{ opacity: 1 }}
    >
      <div
        style={{
          width:           size,
          height:          size,
          borderRadius:    "50%",
          backgroundColor: cfg.bgColor,
          display:         "flex",
          alignItems:      "center",
          justifyContent:  "center",
          overflow:        "hidden",
          border:          selected ? "2px solid #22d68a" : "2px solid rgba(255,255,255,0.1)",
          boxShadow:       selected ? "0 0 0 1px rgba(34,214,138,0.4)" : "none",
          transition:      "border-color 100ms, box-shadow 100ms",
          cursor:          "pointer",
        }}
      >
        {inner}
      </div>
      <span
        className="font-mono text-[9px] uppercase tracking-widest"
        style={{ color: selected ? "#22d68a" : "#6b7280" }}
      >
        {label}
      </span>
    </button>
  );
}

// ── Main picker ────────────────────────────────────────────────────────────────
export default function AvatarPicker({ value, initials, onChange }: Props) {
  function set(partial: Partial<AvatarConfig>) {
    onChange({ ...value, ...partial });
  }

  return (
    <div className="space-y-5">

      {/* Preview */}
      <div className="flex items-center gap-4">
        <AvatarPreview cfg={value} initials={initials} />
        <div>
          <p className="font-mono text-sm font-semibold text-text-primary">Avatar Preview</p>
          <p className="font-sans text-xs text-text-dim mt-0.5">
            Choose a template, background, and icon color below.
          </p>
        </div>
      </div>

      {/* Template row */}
      <div>
        <p className="font-mono text-[10px] uppercase tracking-widest text-text-dim mb-3">
          Template
        </p>
        <div className="flex flex-wrap gap-4">
          {AVATAR_TEMPLATES.map(({ key, label }) => (
            <TemplateSwatch
              key={key}
              templateKey={key}
              label={label}
              selected={value.template === key}
              cfg={value}
              initials={initials}
              onClick={() => set({ template: key })}
            />
          ))}
        </div>
      </div>

      {/* Background color */}
      <div>
        <p className="font-mono text-[10px] uppercase tracking-widest text-text-dim mb-3">
          Background
        </p>
        <div className="flex flex-wrap gap-2.5">
          {BG_COLORS.map(({ value: hex, label }) => (
            <Swatch
              key={hex}
              color={hex}
              selected={value.bgColor === hex}
              onClick={() => set({ bgColor: hex })}
            />
          ))}
        </div>
        <p className="font-sans text-[10px] text-text-dim mt-1.5">
          {BG_COLORS.find((c) => c.value === value.bgColor)?.label ?? "Custom"}
        </p>
      </div>

      {/* Icon / foreground color */}
      <div>
        <p className="font-mono text-[10px] uppercase tracking-widest text-text-dim mb-3">
          Icon Color
        </p>
        <div className="flex flex-wrap gap-2.5">
          {FG_COLORS.map(({ value: hex, label }) => (
            <Swatch
              key={hex}
              color={hex}
              selected={value.fgColor === hex}
              onClick={() => set({ fgColor: hex })}
            />
          ))}
        </div>
        <p className="font-sans text-[10px] text-text-dim mt-1.5">
          {FG_COLORS.find((c) => c.value === value.fgColor)?.label ?? "Custom"}
        </p>
      </div>

      {/* Reset */}
      <button
        type="button"
        onClick={() => onChange(DEFAULT_AVATAR_CONFIG)}
        className="font-mono text-[10px] text-text-dim hover:text-text-mid transition-colors duration-150"
      >
        Reset to default
      </button>
    </div>
  );
}
