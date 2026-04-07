# Courtside — Rating System Specification

## Overview

Courtside has two distinct rating systems that serve different purposes. They live in separate database tables and are accessed through separate UI flows.

## System 1: Match Ratings (Primary — The Quick Loop)

### Purpose
Rate a match and both players' performances immediately after watching. This is the core interaction that drives the app. It must be fast and satisfying.

### Database Table
`reviews`

### UI Flow
1. User opens a match page (/matches/[id])
2. Taps sets watched (quick button selector)
3. Three sliders appear:
   - **Match rating** — "How good was this match overall?"
   - **Player 1 rating** — "How well did [Player 1 name] play?"
   - **Player 2 rating** — "How well did [Player 2 name] play?"
4. Optional written comment/review
5. Post

### Slider Specification
- **Range:** 1.0 to 10.0
- **Increments:** 0.1 (so: 1.0, 1.1, 1.2 ... 9.8, 9.9, 10.0)
- **Total positions:** 91 (from 1.0 to 10.0 inclusive)
- **Display format:** Always show one decimal (e.g., "7.0" not "7", "10.0" not "10")
- **Default state:** No default — slider starts unset, user must actively choose
- **Visual:** Track with filled portion in category color. Current value displayed prominently in IBM Plex Mono above/beside the slider thumb.
- **All three sliders are required** — a review cannot be posted without all three ratings

### Sets Watched Selector
- Displayed before the sliders
- Options generated dynamically from match score:
  - For a 5-set match: "1 Set", "2 Sets", "3 Sets", "4 Sets", "5 Sets", "Full Match", "Highlights"
  - For a 3-set match: "1 Set", "2 Sets", "3 Sets", "Full Match", "Highlights"
- **UI:** Row of pill buttons, single-select
- **Color coding:** Green for Full Match, blue for majority of sets, amber for partial/highlights
- **Badge:** Appears on published review beside the username (e.g., "📺 Full Match" or "📡 3/5 Sets")
- **Required** — must select before posting

### How Match Ratings Aggregate

The **consensus community rating** shown on a player's profile is the average of all their per-player ratings (player1_rating and player2_rating) across all reviewed matches.

Example: If Alcaraz has been rated in 50 matches, his consensus rating is the average of those 50 player-specific slider values. This is NOT the average of match ratings — those rate the match quality, not the player.

```
Player consensus rating = AVG(player1_rating WHERE player1_id = player_id) 
                        + AVG(player2_rating WHERE player2_id = player_id)
                        across all reviews
```

Implementation: Use a Supabase database function or edge function triggered on review insert/update/delete.

### Database Schema

```sql
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES profiles(clerk_user_id),
  match_id UUID NOT NULL REFERENCES matches(id),
  match_rating NUMERIC(3,1) NOT NULL CHECK (match_rating >= 1.0 AND match_rating <= 10.0),
  player1_rating NUMERIC(3,1) NOT NULL CHECK (player1_rating >= 1.0 AND player1_rating <= 10.0),
  player2_rating NUMERIC(3,1) NOT NULL CHECK (player2_rating >= 1.0 AND player2_rating <= 10.0),
  comment TEXT,
  sets_watched TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, match_id)  -- one review per user per match
);
```

---

## System 2: Skill Ratings (Secondary — The Deep Engagement)

### Purpose
Rate a player's overall skill level across 11 tennis-specific axes. This is the data that builds the signature radar charts. It's a separate, more deliberate activity done from a player's profile page.

### Database Table
`skill_ratings`

### UI Flow
1. User navigates to a player's profile (/players/[id])
2. Taps "Rate Skills" button
3. Panel opens with 11 sliders grouped into 4 categories:
   - **Movement** (blue section): Speed, Court Coverage, Positioning
   - **Technique** (green section): Serve, Forehand, Backhand
   - **Skill** (gold section): Net Play, Touch, Reaction Time, Return Play
   - **Mental Strength** (coral section): Mental Strength
4. User adjusts sliders for each axis
5. Submit

This can also appear as an optional prompt after the user has reviewed a match — "Rate [Player Name]'s skills?" — but it navigates to the profile page skill form, not inline on the match page.

### Slider Specification (Skill Axes)
- **Range:** 1.0 to 5.0
- **Increments:** 0.5 (so: 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0)
- **Total positions:** 9 per axis
- **Display format:** Always show one decimal
- **Not all axes required** — user can rate as many or as few as they want

### How Skill Ratings Aggregate

Each axis on the radar chart is the average of all community ratings for that player on that axis. Only axes the user actually rated are counted (don't count zeros or unset values).

```
Radar axis value = AVG(axis_value) WHERE axis_value IS NOT NULL AND player_id = target_player
```

The radar chart on a player profile updates whenever a new skill rating is submitted.

### Database Schema

```sql
CREATE TABLE skill_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES profiles(clerk_user_id),
  player_id UUID NOT NULL REFERENCES players(id),
  speed NUMERIC(2,1) CHECK (speed >= 1.0 AND speed <= 5.0),
  court_coverage NUMERIC(2,1) CHECK (court_coverage >= 1.0 AND court_coverage <= 5.0),
  positioning NUMERIC(2,1) CHECK (positioning >= 1.0 AND positioning <= 5.0),
  serve NUMERIC(2,1) CHECK (serve >= 1.0 AND serve <= 5.0),
  forehand NUMERIC(2,1) CHECK (forehand >= 1.0 AND forehand <= 5.0),
  backhand NUMERIC(2,1) CHECK (backhand >= 1.0 AND backhand <= 5.0),
  net_play NUMERIC(2,1) CHECK (net_play >= 1.0 AND net_play <= 5.0),
  touch NUMERIC(2,1) CHECK (touch >= 1.0 AND touch <= 5.0),
  reaction_time NUMERIC(2,1) CHECK (reaction_time >= 1.0 AND reaction_time <= 5.0),
  return_play NUMERIC(2,1) CHECK (return_play >= 1.0 AND return_play <= 5.0),
  mental_strength NUMERIC(2,1) CHECK (mental_strength >= 1.0 AND mental_strength <= 5.0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, player_id)  -- one skill rating per user per player (can update)
);
```

---

## Summary: Two Systems Side by Side

| | Match Ratings | Skill Ratings |
|--|--------------|---------------|
| **Table** | reviews | skill_ratings |
| **Trigger** | After watching a match | From player profile, any time |
| **Scale** | 1.0–10.0 (0.1 increments) | 1.0–5.0 (0.5 increments) |
| **Axes** | 3 (match + player 1 + player 2) | 11 (grouped into 4 categories) |
| **Required** | All 3 sliders + sets watched | Any axes user chooses |
| **Produces** | Consensus community rating on profile | Radar chart on profile |
| **Frequency** | Once per match per user | Once per player per user (updatable) |
| **Feel** | Quick, snappy, 20 seconds | Deliberate, thoughtful, 1-2 minutes |
