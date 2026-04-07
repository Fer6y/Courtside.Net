# Courtside — Radar Chart Specification

## Overview

The category-weighted skill radar chart is Courtside's visual signature. It displays community-aggregated player skill ratings across 11 axes grouped into 4 major tennis categories. When screenshotted and shared, it should be immediately recognizable as a Courtside graphic.

## Categories and Axes

### Movement (Blue — #4a9eff)
| Axis | Key | Description |
|------|-----|-------------|
| Speed | speed | Raw foot speed and first-step quickness |
| Court Coverage | court_coverage | Ability to reach and return balls across the full court |
| Positioning | positioning | Court awareness, anticipation, being in the right place |

### Technique (Green — #22d68a)
| Axis | Key | Description |
|------|-----|-------------|
| Serve | serve | Overall serve quality — power, placement, variation |
| Forehand | forehand | Forehand groundstroke quality and reliability |
| Backhand | backhand | Backhand groundstroke quality and reliability |

### Skill (Gold — #f5c518)
| Axis | Key | Description |
|------|-----|-------------|
| Net Play | net_play | Volleying ability, approach shots, finishing at the net |
| Touch | touch | Finesse shots — drop shots, lobs, angles, feel |
| Reaction Time | reaction_time | Response to opponent's shots, especially at speed and at the net |
| Return Play | return_play | Quality of service return and ability to neutralize the serve |

### Mental Strength (Coral — #d4734e)
| Axis | Key | Description |
|------|-----|-------------|
| Mental Strength | mental_strength | Composure under pressure, clutch performance, consistency in big moments |

**Total: 11 axes across 4 categories**

## Chart Layout: Category-Weighted

### How it works
The full 360° circle is divided into 4 equal quadrants (90° each), one per category. Within each quadrant, the axes are spaced equally.

This means:
- Movement (3 axes) → each axis gets 30° of arc
- Technique (3 axes) → each axis gets 30° of arc
- Skill (4 axes) → each axis gets 22.5° of arc
- Mental Strength (1 axis) → that one axis gets the full 90° of arc

### Why weighted
Mental Strength has one axis but gets the same visual space as Movement (3 axes). This is deliberate — at the top level of tennis, mental game is arguably the single most important differentiator. The chart communicates this visually: a player with weak mental strength has a collapsed quadrant that's impossible to miss.

### Angle calculation (pseudocode)
```javascript
function getAngle(skillIndex) {
  // Find which category this skill belongs to and its position within
  let cumulativeIndex = 0;
  for (let catIdx = 0; catIdx < CATEGORIES.length; catIdx++) {
    const cat = CATEGORIES[catIdx];
    for (let i = 0; i < cat.skills.length; i++) {
      if (cumulativeIndex === skillIndex) {
        const catStart = (catIdx / 4) * Math.PI * 2;
        const catArc = (1 / 4) * Math.PI * 2;
        const skillAngle = catStart + (i / cat.skills.length) * catArc 
                         + (catArc / cat.skills.length) / 2;
        return skillAngle - Math.PI / 2;  // rotate so top is 12 o'clock
      }
      cumulativeIndex++;
    }
  }
}
```

## Visual Design

### Color System

**Category colors (fixed on axes, arcs, labels):**
| Category | Solid | Dim Fill (background arc) |
|----------|-------|---------------------------|
| Movement | #4a9eff | rgba(74,158,255,0.12) |
| Technique | #22d68a | rgba(34,214,138,0.12) |
| Skill | #f5c518 | rgba(245,197,24,0.12) |
| Mental | #d4734e | rgba(212,115,78,0.12) |

**Player colors (on the data polygon — unique per player):**
Each player is assigned a unique color. Examples:
- Alcaraz: #22d68a (green), fill: rgba(34,214,138,0.18)
- Sinner: #4a9eff (blue), fill: rgba(74,158,255,0.18)
- Djokovic: #d4734e (coral), fill: rgba(212,115,78,0.18)
- Swiatek: #f5c518 (gold), fill: rgba(245,197,24,0.18)

Player colors should not duplicate category colors when possible. If overlap is unavoidable, the context (polygon vs axis) disambiguates.

### Elements (back to front layer order)

1. **Category arc backgrounds** — Subtle colored pie-slice wedges behind each quadrant. Low opacity (0.5 of the dim fill color). These give immediate visual grouping.

2. **Grid rings** — 5 concentric polygons at values 1, 2, 3, 4, 5. Stroke: rgba(255,255,255,0.06), width: 0.5px. No fill.

3. **Category divider lines** — Lines from center to edge at each quadrant boundary (0°, 90°, 180°, 270°). Stroke: rgba(255,255,255,0.1), width: 1px.

4. **Axis lines** — Lines from center to the outermost grid ring for each of the 11 axes. Stroke: the axis's category color, width: 0.5px, opacity: 0.2.

5. **Compare player polygon** (if comparing) — The second player's data shape. Uses quadratic bezier curves between points. Fill: player's colorFill. Stroke: player's color, width: 1.5px.

6. **Primary player polygon** — The first (or only) player's data shape. Quadratic bezier curves. Fill: player's colorFill. Stroke: player's color, width: 2px.

7. **Compare player dots** (if comparing) — Small circles at each data point. Radius: 3.5px. Fill: player's color. Stroke: #0e1116, width: 1.5px.

8. **Primary player dots** — Same spec as compare dots but for the primary player.

9. **Skill labels** — Text at each axis tip, positioned outside the outermost grid ring (1.22× radius). Font: DM Sans, 9.5px, weight 600. Color: the axis's category color. Text-anchor adjusts based on position (start/middle/end).

10. **Category labels** — Text at the midpoint of each category arc, positioned further out (1.42× radius). Font: IBM Plex Mono, 10px, weight 700, uppercase, letter-spacing 0.5px. Color: category's solid color.

### Curved Lines (Bezier)

The polygon connecting data points uses **quadratic bezier curves** instead of straight lines. This gives the shape an organic, athletic feel — like the arc of a tennis stroke.

```javascript
// For each pair of adjacent points, draw a quadratic curve
// using the current point as the control point and the midpoint as the end
let path = `M ${points[0].x} ${points[0].y}`;
for (let i = 0; i < points.length; i++) {
  const curr = points[i];
  const next = points[(i + 1) % points.length];
  const midX = (curr.x + next.x) / 2;
  const midY = (curr.y + next.y) / 2;
  path += ` Q ${curr.x} ${curr.y} ${midX} ${midY}`;
}
path += " Z";
```

### Animation

On load, the radar chart animates in:
- The polygon draws axis-by-axis with a staggered reveal (each axis point fades in sequentially, ~50ms apart)
- The polygon fill fades from 0 to its target opacity over 300ms
- Grid rings and labels appear instantly (no animation — they're structural)

### Sizing

- Default size: 340–380px (viewBox matches)
- Responsive: `width: 100%` with `maxWidth` set to the viewBox size
- Grid radius: 36% of the viewBox size
- Label radius: 122% of grid radius (skill labels) and 142% (category labels)

## Comparison Mode

When two players are selected:
- Both polygons render on the same chart
- Primary player's polygon is on top (rendered second in SVG for z-ordering)
- Each player's polygon is their unique player color
- Category colors on axes/arcs stay fixed
- A legend below the chart shows colored dots with player names
- The skill breakdown bars (below the radar) show side-by-side columns

## Skill Breakdown Bars

Below the radar chart, an optional detail view shows exact values:
- Grouped by category (category name as section header in IBM Plex Mono, uppercase, category color)
- Each skill: label (DM Sans, 11px) + horizontal progress bar + value (IBM Plex Mono, 12px, bold)
- Bar fill: gradient from category color at 50% opacity to category color at 100%
- Bar background: rgba(255,255,255,0.06)
- Bar height: 6px, border-radius: 3px

## Rating Scale

- Each axis: 1.0 to 5.0 (rated by users in 0.5 increments)
- Community value: average of all user ratings for that player on that axis
- Grid rings correspond to values 1 through 5
- A player with all 5.0s would have their polygon touching the outer ring on every axis

## Implementation Notes

- Build as a standalone React component: `<RadarChart ratings={} playerColor={} ... />`
- The chart is pure SVG — no chart library dependency
- The `CATEGORIES` and `SKILLS` arrays are defined as a config constant — changing categories later means changing one array
- The component accepts an optional `compareRatings` prop for dual-player overlay
- The `mode` prop can toggle between "weighted" (recommended) and "equal" spacing for development/testing
