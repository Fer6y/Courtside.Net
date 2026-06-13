"use client";

import { useState, useEffect } from "react";

export const GUIDE_SECTIONS = [
  { id: "rate-skills",    label: "Rate Skills"          },
  { id: "review-matches", label: "Review Matches"       },
  { id: "reactions",      label: "Reactions & Comments" },
  { id: "your-profile",   label: "Your Profile"         },
  { id: "compare",        label: "Compare & H2H"        },
  { id: "activity-feed",  label: "Activity Feed"        },
  { id: "search",         label: "Search"               },
  { id: "trophies",       label: "Trophies"             },
];

export default function GuideSidebar() {
  const [activeId, setActiveId] = useState(GUIDE_SECTIONS[0].id);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the first entry that is intersecting
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: "-15% 0px -70% 0px", threshold: 0 }
    );

    for (const { id } of GUIDE_SECTIONS) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  return (
    <nav className="flex flex-col gap-0.5">
      {GUIDE_SECTIONS.map(({ id, label }) => {
        const active = activeId === id;
        return (
          <a
            key={id}
            href={`#${id}`}
            className="eyebrow px-3 py-2 transition-all duration-150 block"
            style={{
              fontSize: 9,
              color:      active ? "#c9a96a"                  : "rgba(236,229,216,0.4)",
              borderLeft: active ? "2px solid rgba(201,169,106,0.6)" : "2px solid transparent",
            }}
          >
            {label}
          </a>
        );
      })}
    </nav>
  );
}
