# Courtside — Radar Chart Specification (v2)

## Overview

The category-weighted skill radar chart is Courtside's visual signature. It displays community-aggregated player skill ratings across 13 axes grouped into 4 major tennis categories. When screenshotted and shared, it should be immediately recognizable as a Courtside graphic.

This spec supersedes the original 11-axis version. Key changes: Mental Strength expanded from 1 axis to 3 (Focus, Clutch, Resilience), Court Coverage shortened to "Coverage," Reaction Time to "React. Time," Return Play to "Ret. Play" for label spacing.

## Categories and Axes

### Mental (top quadrant)
| Axis | Key | Label | Description |
|------|-----|-------|-------------|
| Focus | focus | Focus | Concentration, discipline, ability to maintain intensity across long matches |
| Clutch | clutch | Clutch | Performance in critical moments — break points, tiebreaks, match points |
| Resilience | resilience | Resilience | Ability to bounce back from lost sets, bad calls, momentum shifts |

### Technique (right quadrant)
| Axis | Key | Label | Description |
|------|-----|-------|-------------|
| Serve | serve | Serve | Overall serve quality — power, placement, variation |
| Forehand | forehand | Forehand | Forehand groundstroke quality and reliability |
| Backhand | backhand | Backhand | Backhand groundstroke quality and reliability |

### Skill (bottom quadrant)
| Axis | Key | Label | Description |
|------|-----|-------|-------------|
| Net Play | net_play | Net Play | Volleying ability, approach shots, finishing at the net |
| Touch | touch | Touch | Finesse shots — drop shots, lobs, angles, feel |
| Return Play | return_play | Ret. Play | Quality of service return and ability to neutralize the serve |
| Reaction Time | reaction_time | React. Time | Response to opponent's shots, especially at speed and at the net |

### Movement (left quadrant)
| Axis | Key | Label | Description |
|------|-----|-------|-------------|
| Speed | speed | Speed | Raw foot speed and first-step quickness |
| Court Coverage | court_coverage | Coverage | Ability to reach and return balls across the full court |
| Positioning | positioning | Positioning | Court awareness, anticipation, being in the right place |

**Total: 13 axes across 4 categories**

## Chart Layout: Category-Weighted

### How it works
The full 360° circle is divided into 4 equal quadrants (90° each), one per category. Within each quadrant, the axes are spaced equally.

- Mental (3 axes) → each axis gets 30° of arc
- Technique (3 axes) → each axis gets 30° of arc
- Skill (4 axes) → each axis gets 22.5° of arc
- Movement (3 axes) → each axis gets 30° of arc

### Quadrant positions
- Mental: 0° to 90° (top)
- Technique: 90° to 180° (right)
- Skill: 180° to 270° (bottom)
- Movement: 270° to 360° (left)

All angles are pre-rotation. A -90° rotation is applied so that 0° points to 12 o'clock.

### Axis order (clockwise from top)
1. Focus (Mental)
2. Clutch (Mental)
3. Resilience (Mental)
4. Serve (Technique)
5. Forehand (Technique)
6. Backhand (Technique)
7. Net Play (Skill)
8. Touch (Skill)
9. Ret. Play (Skill)
10. React. Time (Skill)
11. Speed (Movement)
12. Coverage (Movement)
13. Positioning (Movement)

### Angle calculation

```typescript
const CATEGORIES = [
  {
    name: 'MENTAL',
    startAngle: 0,
    skills: [
      { key: 'focus', label: 'Focus' },
      { key: 'clutch', label: 'Clutch' },
      { key: 'resilience', label: 'Resilience' },
    ],
  },
  {
    name: 'TECHNIQUE',
    startAngle: 90,
    skills: [
      { key: 'serve', label: 'Serve' },
      { key: 'forehand', label: 'Forehand' },
      { key: 'backhand', label: 'Backhand' },
    ],
  },
  {
    name: 'SKILL',
    startAngle: 180,
    skills: [
      { key: 'net_play', label: 'Net Play' },
      { key: 'touch', label: 'Touch' },
      { key: 'return_play', label: 'Ret. Play' },
      { key: 'reaction_time', label: 'React. Time' },
    ],
  },
  {
    name: 'MOVEMENT',
    startAngle: 270,
    skills: [
      { key: 'speed', label: 'Speed' },
      { key: 'court_coverage', label: 'Coverage' },
      { key: 'positioning', label: 'Positioning' },
    ],
  },
];

function getAxisAngle(categoryIndex: number, skillIndex: number): number {
  const cat = CATEGORIES[categoryIndex];
  const quadrantStart = cat.startAngle;
  const axisSpacing = 90 / cat.skills.length;
  const angle = quadrantStart + (skillIndex * axisSpacing) + (axisSpacing / 2);
  return angle - 90; // rotate so 0° is 12 o'clock
}
```

## Visual Design

### Color System

**Player colors (on the data polygon — unique per player):**
Each player is assigned a unique color. The player's entire polygon, dots, and values use this single color. Examples:
- Alcaraz: #22d68a (green), fill: rgba(34,214,138,0.06)
- Sinner: #00e5ff (cyan), fill: rgba(0,229,255,0.06)
- Djokovic: #ff6b35 (orange), fill: rgba(255,107,53,0.06)
- Swiatek: #e040fb (purple), fill: rgba(224,64,251,0.06)

**Chart structure colors:**
All structural elements are neutral grey/white at low opacity. No colored quadrants, no colored axis lines. The only bright color on the chart comes from player data.

### Brightness Philosophy

The player data is the star. Everything structural is quiet scaffolding. Think "backlit keyboard key" not "neon bar sign." The green (or any player color) should register as "this is the data" without overwhelming the chart structure.

- Player polygon stroke: player color at 80% opacity
- Player dots: player color at 85% opacity
- Player values: player color at 70% opacity
- All structural elements: white/grey at 4-12% opacity

### Elements (back to front layer order)

1. **Grid rings** — 5 concentric circles at values 1, 2, 3, 4, 5. Stroke: rgba(255,255,255,0.06), width: 0.5px. No fill. Perfect circles (not polygons).

2. **Quadrant divider lines** — 4 dashed lines from center to slightly past the outer grid ring (~105% of grid radius). Positioned at the quadrant boundaries (between Resilience/Serve, Backhand/Net Play, React. Time/Speed, Positioning/Focus). Stroke: rgba(255,255,255,0.12), width: 1px, strokeDasharray: "4 4".

3. **Axis lines** — 13 thin lines from center to the outermost grid ring for each axis. Stroke: rgba(255,255,255,0.04), width: 0.5px. All identical — no color differentiation.

4. **Scale numbers** — "1" "2" "3" "4" "5" along the 12 o'clock axis (Clutch axis) only, positioned at each grid ring with slight horizontal offset. Font: IBM Plex Mono, 9px. Fill: rgba(255,255,255,0.12).

5. **Compare player polygon** (if comparing) — The second player's data shape. Rendered first (behind). Quadratic bezier curves between points. Fill: player's color at 0.06 opacity. Stroke: player's color at 70% opacity, width: 1.5px. Subtle filter blur glow (1px stdDeviation).

6. **Primary player polygon** — The first (or only) player's data shape. Rendered second (on top). Quadratic bezier curves. Fill: player's color at 0.06 opacity. Stroke: player's color at 80% opacity, width: 1.5px. Subtle filter blur glow (1px stdDeviation).

7. **Compare player dots** (if comparing) — 13 circles at each data point. Radius: 3.5px. Fill: player's color at 75% opacity. Stroke: #0e1116, width: 1.5px.

8. **Primary player dots** — 13 circles at each data point. Radius: 3.5px. Fill: player's color at 85% opacity. Stroke: #0e1116, width: 1.5px.

9. **Data values** — Rating number positioned just outside each dot along the axis radial, consistently outside the polygon. Font: IBM Plex Mono, 10px. Fill: player's color at 70% opacity. textAnchor adjusts based on position around chart.

10. **Skill labels (inner text ring)** — 13 text labels at each axis tip, positioned at 1.18× grid radius. Font: DM Sans, 11px, weight 500. Fill: #9ca3af. Straight horizontal text (not curved). textAnchor adjusts: "middle" at top/bottom, "start" on right side, "end" on left side. These are the primary readable labels.

11. **Category labels (outer text ring)** — 4 text labels at the midpoint angle of each quadrant, positioned at 1.38× grid radius. Font: IBM Plex Mono, 9px, weight 600, uppercase, letter-spacing 3px. Fill: rgba(255,255,255,0.18). Straight horizontal text. These are dim secondary labels that frame the chart — like zone markers on a blueprint.

### Label Hierarchy

Reading from center outward:
1. Chart data (polygon, dots, values) — brightest
2. Grid rings and axis lines — faintest structural
3. Skill labels — inner ring, clearly readable (#9ca3af)
4. Category labels — outer ring, dim perimeter text (rgba(255,255,255,0.18))

Category labels and skill labels are visually distinct: different font family (monospace vs sans-serif), different brightness, different position ring, different case (uppercase vs title case).

### No Outer Border

There is no thick circle, arc, or border around the outside of the chart. The outermost structural element is grid ring 5. Beyond that are only the two text label layers. The chart fades naturally into the dark background.

### Curved Lines (Bezier)

The polygon connecting data points uses quadratic bezier curves instead of straight lines. This gives the shape an organic, athletic feel.

```typescript
function buildPolygonPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  const first = points[0];
  const last = points[points.length - 1];
  const startX = (first.x + last.x) / 2;
  const startY = (first.y + last.y) / 2;
  let path = `M ${startX} ${startY}`;
  for (let i = 0; i < points.length; i++) {
    const curr = points[i];
    const next = points[(i + 1) % points.length];
    const midX = (curr.x + next.x) / 2;
    const midY = (curr.y + next.y) / 2;
    path += ` Q ${curr.x} ${curr.y} ${midX} ${midY}`;
  }
  path += ' Z';
  return path;
}
```

### Animation

On load, the radar chart animates in:
- The polygon draws axis-by-axis with a staggered reveal (each data point fades in sequentially, ~50ms apart)
- The polygon fill fades from opacity 0 to its target (0.06) over 300ms
- Dots scale in from 0 to 1 with the same stagger timing
- Grid rings, labels, and all structural elements appear instantly (no animation — they're structural)

### Sizing

- SVG viewBox: "0 0 600 600"
- Center point: (300, 300)
- Grid radius (outermost ring, value 5): 200px
- Responsive: `width: 100%` with `maxWidth: 600px`
- Skill label radius: 1.18× grid radius = ~236px
- Category label radius: 1.38× grid radius = ~276px

## Comparison Mode

When two players are selected:
- Both polygons render on the same chart
- Compare player renders first (behind), primary player renders second (on top)
- Compare player uses slightly lower opacity on stroke (70% vs 80%) and dots (75% vs 85%)
- Each player's polygon uses their unique assigned color
- All structural elements stay identical — no changes to grid, labels, or dividers
- Where values are close on the same axis, offset value labels slightly to avoid overlap
- Legend below the chart: colored dots with player names, side by side

## Skill Breakdown Bars

Below the radar chart, an optional detail view shows exact values:
- Grouped by category (category name as section header in IBM Plex Mono, uppercase, rgba(255,255,255,0.18))
- Each skill: label (DM Sans, 11px, #9ca3af) + horizontal progress bar + value (IBM Plex Mono, 12px, bold, player color)
- Bar fill: player color at 30% opacity to player color at 60% opacity gradient
- Bar background: rgba(255,255,255,0.06)
- Bar height: 6px, border-radius: 3px
- In comparison mode: side-by-side bars per skill, each in the player's color

## Rating Scale

- Each axis: 1.0 to 5.0 (rated by users in 0.5 increments)
- Community value: average of all user ratings for that player on that axis (NULL values excluded)
- Grid rings correspond to values 1 through 5
- A player with all 5.0s would have their polygon touching the outer ring on every axis

## Database Schema

```sql
CREATE TABLE skill_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES profiles(clerk_user_id),
  player_id UUID NOT NULL REFERENCES players(id),
  -- Mental
  focus NUMERIC(2,1) CHECK (focus >= 1.0 AND focus <= 5.0),
  clutch NUMERIC(2,1) CHECK (clutch >= 1.0 AND clutch <= 5.0),
  resilience NUMERIC(2,1) CHECK (resilience >= 1.0 AND resilience <= 5.0),
  -- Technique
  serve NUMERIC(2,1) CHECK (serve >= 1.0 AND serve <= 5.0),
  forehand NUMERIC(2,1) CHECK (forehand >= 1.0 AND forehand <= 5.0),
  backhand NUMERIC(2,1) CHECK (backhand >= 1.0 AND backhand <= 5.0),
  -- Skill
  net_play NUMERIC(2,1) CHECK (net_play >= 1.0 AND net_play <= 5.0),
  touch NUMERIC(2,1) CHECK (touch >= 1.0 AND touch <= 5.0),
  return_play NUMERIC(2,1) CHECK (return_play >= 1.0 AND return_play <= 5.0),
  reaction_time NUMERIC(2,1) CHECK (reaction_time >= 1.0 AND reaction_time <= 5.0),
  -- Movement
  speed NUMERIC(2,1) CHECK (speed >= 1.0 AND speed <= 5.0),
  court_coverage NUMERIC(2,1) CHECK (court_coverage >= 1.0 AND court_coverage <= 5.0),
  positioning NUMERIC(2,1) CHECK (positioning >= 1.0 AND positioning <= 5.0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, player_id)
);
```

## Aggregation Query

```sql
SELECT
  AVG(focus) AS focus,
  AVG(clutch) AS clutch,
  AVG(resilience) AS resilience,
  AVG(serve) AS serve,
  AVG(forehand) AS forehand,
  AVG(backhand) AS backhand,
  AVG(net_play) AS net_play,
  AVG(touch) AS touch,
  AVG(return_play) AS return_play,
  AVG(reaction_time) AS reaction_time,
  AVG(speed) AS speed,
  AVG(court_coverage) AS court_coverage,
  AVG(positioning) AS positioning,
  COUNT(*) AS total_ratings
FROM skill_ratings
WHERE player_id = :player_id;
```

## Implementation Notes

- Build as a standalone React component: `<RadarChart ratings={} playerColor={} ... />`
- The chart is pure SVG — no chart library dependency
- The `CATEGORIES` array is defined as a config constant — changing categories means changing one array
- The component accepts an optional `compareRatings` prop for dual-player overlay
- All structural colors are neutral grey/white — no colored quadrants or axes
- Player color is the only bright color on the chart
- Component accepts `playerName` and `ratingCount` for the legend below

### Component API

```typescript
interface RadarChartProps {
  ratings: Record<string, number>;          // { focus: 4.6, clutch: 4.4, ... }
  playerColor?: string;                     // default: '#22d68a'
  playerName?: string;                      // shown in legend
  ratingCount?: number;                     // "XX ratings" in legend
  compareRatings?: Record<string, number>;  // optional second player
  compareColor?: string;                    // default: '#00e5ff'
  comparePlayerName?: string;
  size?: number;                            // viewBox size, default 600
  showBreakdown?: boolean;                  // show skill bars below
}
```
