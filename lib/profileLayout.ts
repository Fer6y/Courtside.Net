// Shared types and helpers for user profile layout customization

import type { LucideIcon } from "lucide-react";
import { Star, Trophy, MessageSquare, Folder, Activity, PenLine } from "lucide-react";

export type SectionId =
  | "favorites"
  | "trophy_case"
  | "featured_comments"
  | "collections"
  | "recent_activity"
  | "reviews";

export interface LayoutConfig {
  order:    SectionId[];
  hidden:   SectionId[];
  variants: Partial<Record<SectionId, string>>;
  // The owner's chosen court background. Mirrored to the `court` cookie,
  // which is what the root layout actually reads (durable backup here).
  court_theme?: "grass" | "clay" | "hard";
  // Which tours to surface in tour-agnostic spots (e.g. home "Top of the
  // Draw"). Mirrored to the `tour_pref` cookie (durable backup here).
  tour_pref?: "atp" | "all";
}

export const DEFAULT_ORDER: SectionId[] = [
  "favorites",
  "trophy_case",
  "featured_comments",
  "collections",
  "recent_activity",
  "reviews",
];

export interface SectionVariant { key: string; label: string }

export interface SectionMeta {
  label:       string;
  description: string;
  Icon:        LucideIcon;
  variants?:   SectionVariant[];
}

export const SECTION_META: Record<SectionId, SectionMeta> = {
  favorites: {
    label:       "Favorites",
    description: "Your favorited matches",
    Icon:        Star,
    variants: [
      { key: "carousel", label: "Carousel" },
      { key: "grid",     label: "Grid"     },
    ],
  },
  trophy_case: {
    label:       "Honours",
    description: "Achievement badges & decals",
    Icon:        Trophy,
  },
  featured_comments: {
    label:       "Featured Comments",
    description: "Your most notable match comments",
    Icon:        MessageSquare,
    variants: [
      { key: "cards", label: "Cards" },
      { key: "list",  label: "List"  },
    ],
  },
  collections: {
    label:       "Collections",
    description: "Named match folders",
    Icon:        Folder,
  },
  recent_activity: {
    label:       "Recent Activity",
    description: "Recently watched & players rated",
    Icon:        Activity,
    variants: [
      { key: "two_col", label: "Two Columns" },
      { key: "single",  label: "Full Width"  },
    ],
  },
  reviews: {
    label:       "All Reviews",
    description: "Your complete review history",
    Icon:        PenLine,
    variants: [
      { key: "cards",   label: "Cards"   },
      { key: "compact", label: "Compact" },
    ],
  },
};

/** Returns the visible section order, merging stored config with defaults (handles new sections). */
export function resolveLayout(config: LayoutConfig | null): {
  order:    SectionId[];
  hidden:   Set<SectionId>;
  variants: Partial<Record<SectionId, string>>;
} {
  const storedOrder = config?.order ?? DEFAULT_ORDER;
  const hidden      = new Set<SectionId>((config?.hidden ?? []) as SectionId[]);

  // Append any new sections (added after the user last saved) to the end
  const known  = new Set(storedOrder);
  const merged = [
    ...storedOrder,
    ...DEFAULT_ORDER.filter((s) => !known.has(s)),
  ] as SectionId[];

  return {
    order:    merged.filter((s) => !hidden.has(s)),
    hidden,
    variants: config?.variants ?? {},
  };
}

export function getVariant(config: LayoutConfig | null, id: SectionId): string {
  const stored = config?.variants?.[id];
  if (stored) return stored;
  return SECTION_META[id].variants?.[0]?.key ?? "default";
}
