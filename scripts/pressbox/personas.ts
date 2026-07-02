/**
 * personas.ts — the Courtside Press Box cast.
 *
 * Ten house critics, each a disclosed bot account (clerk_user_id starts with
 * "bot_", which is what lib/pressBox.ts keys the PRESS BOX tag off). Every
 * persona has tastes that drive BOTH which matches they review and how they
 * score them, so their catalogues read like real people with real opinions
 * rather than a random-number generator.
 *
 * Weights are small nudges added to a shared base rating — see seed.ts for
 * the scoring model. All randomness is seeded per (persona, match) so
 * re-running the seeder is idempotent.
 */

export type AvatarTemplate = "initials" | "ball" | "racquet" | "net";

export type Persona = {
  slug: string;          // clerk_user_id = `bot_${slug}`
  username: string;
  displayName: string;
  bio: string;           // always discloses Press Box membership
  avatar: { template: AvatarTemplate; bgColor: string; fgColor: string };

  favorites: string[];   // exact players.name values — selection + rating bonus
  surfaces: Partial<Record<"Hard" | "Clay" | "Grass", number>>; // affinity 0–0.5

  weights: {
    drama: number;         // tiebreaks, deciders, five-setters
    quality: number;       // tight scorelines, competitive sets
    upset: number;         // rank-gap winners
    final: number;         // showpiece rounds
    slam: number;          // grand slam bonus
    blowoutPenalty: number;// how much one-sided matches annoy them
    generosity: number;    // flat offset — soft vs harsh raters
  };

  reviewTarget: number;    // roughly how many matches they log
  skillEmphasis: string[]; // axes they over-notice when radar-rating
  skillPlayers: string[];  // exact players.name values they skill-rate
};

export const BOT_PREFIX = "bot_";

export const PERSONAS: Persona[] = [
  {
    slug: "leslie_snow",
    username: "lesliesnow",
    displayName: "Leslie Snow",
    bio: "Courtside Press Box — house critic. Serve nerd. I count aces so you don't have to, and a 7-6(9) set is worth more to me than most finals.",
    avatar: { template: "ball", bgColor: "#22d68a", fgColor: "#0e1116" },
    favorites: ["Ben Shelton", "Alexander Bublik", "Elena Rybakina", "Jakub Mensik", "Taylor Fritz"],
    surfaces: { Grass: 0.35, Hard: 0.2 },
    weights: { drama: 0.9, quality: 0.4, upset: 0.3, final: 0.3, slam: 0.25, blowoutPenalty: 0.7, generosity: 0.1 },
    reviewTarget: 46,
    skillEmphasis: ["serve", "clutch", "reaction_time"],
    skillPlayers: [
      "Ben Shelton", "Alexander Bublik", "Elena Rybakina", "Jakub Mensik",
      "Taylor Fritz", "Jannik Sinner", "Aryna Sabalenka", "Naomi Osaka",
      "Madison Keys", "Alexander Zverev", "Novak Djokovic", "Carlos Alcaraz",
    ],
  },
  {
    slug: "john_flowers",
    username: "johnflowers",
    displayName: "John Flowers",
    bio: "Courtside Press Box — house critic. Here for clean hitting and closer scorelines. A 7-5 in the third tells you more about a player than any highlight reel.",
    avatar: { template: "racquet", bgColor: "#1a1e26", fgColor: "#c9a96a" },
    favorites: ["Jannik Sinner", "Iga Swiatek", "Alexander Zverev", "Mirra Andreeva"],
    surfaces: { Hard: 0.3 },
    weights: { drama: 0.4, quality: 1.0, upset: 0.1, final: 0.4, slam: 0.3, blowoutPenalty: 0.9, generosity: -0.2 },
    reviewTarget: 44,
    skillEmphasis: ["forehand", "backhand", "positioning"],
    skillPlayers: [
      "Jannik Sinner", "Iga Swiatek", "Alexander Zverev", "Mirra Andreeva",
      "Carlos Alcaraz", "Novak Djokovic", "Daniil Medvedev", "Coco Gauff",
      "Aryna Sabalenka", "Casper Ruud", "Jessica Pegula", "Andrey Rublev",
    ],
  },
  {
    slug: "priya_raman",
    username: "priyaonclay",
    displayName: "Priya Raman",
    bio: "Courtside Press Box — house critic. Clay-season romantic. The sliding, the grinding, the fifth hour — Paris in June is the whole point of the calendar.",
    avatar: { template: "initials", bgColor: "#d4734e", fgColor: "#0e1116" },
    favorites: ["Carlos Alcaraz", "Iga Swiatek", "Casper Ruud", "Lorenzo Musetti", "Jasmine Paolini"],
    surfaces: { Clay: 0.5 },
    weights: { drama: 0.7, quality: 0.6, upset: 0.3, final: 0.4, slam: 0.35, blowoutPenalty: 0.4, generosity: 0.25 },
    reviewTarget: 40,
    skillEmphasis: ["court_coverage", "resilience", "touch"],
    skillPlayers: [
      "Carlos Alcaraz", "Iga Swiatek", "Casper Ruud", "Lorenzo Musetti",
      "Jasmine Paolini", "Jannik Sinner", "Alexander Zverev", "Coco Gauff",
      "Mirra Andreeva", "Novak Djokovic",
    ],
  },
  {
    slug: "marcus_hale",
    username: "halecourtside",
    displayName: "Marcus Hale",
    bio: "Courtside Press Box — house critic. Grass-court traditionalist. Serve-and-volley isn't dead, it's resting. SW19 fortnight is sacred and I will not be taking questions.",
    avatar: { template: "net", bgColor: "#5cb85c", fgColor: "#0e1116" },
    favorites: ["Novak Djokovic", "Lorenzo Musetti", "Alexander Bublik", "Frances Tiafoe"],
    surfaces: { Grass: 0.5 },
    weights: { drama: 0.5, quality: 0.7, upset: 0.2, final: 0.5, slam: 0.4, blowoutPenalty: 0.5, generosity: 0 },
    reviewTarget: 38,
    skillEmphasis: ["net_play", "touch", "deception"],
    skillPlayers: [
      "Novak Djokovic", "Lorenzo Musetti", "Alexander Bublik", "Frances Tiafoe",
      "Carlos Alcaraz", "Jannik Sinner", "Elena Rybakina", "Elina Svitolina",
      "Daniil Medvedev", "Madison Keys",
    ],
  },
  {
    slug: "dot_kowalski",
    username: "aunt_dot",
    displayName: "Dot Kowalski",
    bio: "Courtside Press Box — house critic. Watching since Evert v Navratilova. What I want is guts: comebacks, third sets, players who hang around when it looks lost.",
    avatar: { template: "initials", bgColor: "#ece5d8", fgColor: "#0e1116" },
    favorites: ["Aryna Sabalenka", "Elina Svitolina", "Novak Djokovic", "Madison Keys", "Jasmine Paolini"],
    surfaces: { Hard: 0.15, Grass: 0.15, Clay: 0.15 },
    weights: { drama: 0.8, quality: 0.5, upset: 0.4, final: 0.3, slam: 0.2, blowoutPenalty: 0.6, generosity: 0.35 },
    reviewTarget: 42,
    skillEmphasis: ["resilience", "focus", "clutch"],
    skillPlayers: [
      "Aryna Sabalenka", "Elina Svitolina", "Novak Djokovic", "Madison Keys",
      "Jasmine Paolini", "Coco Gauff", "Iga Swiatek", "Naomi Osaka",
      "Jessica Pegula", "Carlos Alcaraz",
    ],
  },
  {
    slug: "felix_okafor",
    username: "felixspeed",
    displayName: "Felix Okafor",
    bio: "Courtside Press Box — house critic. Movement is the sport. Watch the feet, not the ball — defence turning into offence is the best trick tennis has.",
    avatar: { template: "ball", bgColor: "#4a9eff", fgColor: "#0e1116" },
    favorites: ["Carlos Alcaraz", "Coco Gauff", "Alex De Minaur", "Mirra Andreeva", "Iga Swiatek"],
    surfaces: { Hard: 0.25, Clay: 0.2 },
    weights: { drama: 0.6, quality: 0.7, upset: 0.2, final: 0.3, slam: 0.25, blowoutPenalty: 0.5, generosity: 0.1 },
    reviewTarget: 40,
    skillEmphasis: ["speed", "court_coverage", "anticipation"],
    skillPlayers: [
      "Carlos Alcaraz", "Coco Gauff", "Alex De Minaur", "Mirra Andreeva",
      "Iga Swiatek", "Jannik Sinner", "Elina Svitolina", "Jasmine Paolini",
      "Novak Djokovic", "Daniil Medvedev", "Learner Tien",
    ],
  },
  {
    slug: "sofia_marino",
    username: "sofiaswings",
    displayName: "Sofia Marino",
    bio: "Courtside Press Box — house critic. WTA first, everything else second. Clean power off both wings is the most honest thing in tennis. Blunt by design.",
    avatar: { template: "racquet", bgColor: "#f5c518", fgColor: "#0e1116" },
    favorites: ["Aryna Sabalenka", "Elena Rybakina", "Madison Keys", "Amanda Anisimova", "Naomi Osaka"],
    surfaces: { Hard: 0.3 },
    weights: { drama: 0.5, quality: 0.8, upset: 0.3, final: 0.4, slam: 0.3, blowoutPenalty: 0.3, generosity: -0.1 },
    reviewTarget: 42,
    skillEmphasis: ["forehand", "backhand", "serve"],
    skillPlayers: [
      "Aryna Sabalenka", "Elena Rybakina", "Madison Keys", "Amanda Anisimova",
      "Naomi Osaka", "Iga Swiatek", "Coco Gauff", "Mirra Andreeva",
      "Jessica Pegula", "Jasmine Paolini", "Victoria Mboko", "Elina Svitolina",
    ],
  },
  {
    slug: "ted_barnum",
    username: "tedwatchestennis",
    displayName: "Ted Barnum",
    bio: "Courtside Press Box — house critic. Chaos merchant. Five setters, deciding tiebreaks, qualifiers beating seeds — I don't need it pretty, I need it unhinged.",
    avatar: { template: "ball", bgColor: "#e74c3c", fgColor: "#0e1116" },
    favorites: ["Alexander Bublik", "Frances Tiafoe", "Joao Fonseca", "Jakub Mensik"],
    surfaces: {},
    weights: { drama: 1.2, quality: 0.2, upset: 0.9, final: 0.2, slam: 0.2, blowoutPenalty: 1.0, generosity: 0.2 },
    reviewTarget: 46,
    skillEmphasis: ["clutch", "deception", "shot_variety"],
    skillPlayers: [
      "Alexander Bublik", "Frances Tiafoe", "Joao Fonseca", "Jakub Mensik",
      "Ben Shelton", "Carlos Alcaraz", "Aryna Sabalenka", "Madison Keys",
      "Learner Tien", "Amanda Anisimova",
    ],
  },
  {
    slug: "ingrid_larsen",
    username: "ingridcourtside",
    displayName: "Ingrid Larsen",
    bio: "Courtside Press Box — house critic. Ratings calibrated, sentiment minimal. A 6-0 6-0 is data. A retirement is an asterisk. The number is the review.",
    avatar: { template: "initials", bgColor: "#22272f", fgColor: "#ece5d8" },
    favorites: ["Jannik Sinner", "Iga Swiatek"],
    surfaces: {},
    weights: { drama: 0.5, quality: 0.9, upset: 0.2, final: 0.3, slam: 0.2, blowoutPenalty: 1.1, generosity: -0.45 },
    reviewTarget: 48,
    skillEmphasis: ["positioning", "processing_time", "return_play"],
    skillPlayers: [
      "Jannik Sinner", "Iga Swiatek", "Carlos Alcaraz", "Novak Djokovic",
      "Alexander Zverev", "Daniil Medvedev", "Aryna Sabalenka", "Elena Rybakina",
      "Coco Gauff", "Jessica Pegula", "Alex De Minaur", "Taylor Fritz",
    ],
  },
  {
    slug: "rafa_delgado",
    username: "rafa_del",
    displayName: "Rafa Delgado",
    bio: "Courtside Press Box — house critic. Scouting the next lot: teenagers, qualifiers, anyone whose ranking hasn't caught up with their forehand yet. The future is my beat.",
    avatar: { template: "net", bgColor: "#c9a96a", fgColor: "#0e1116" },
    favorites: ["Joao Fonseca", "Mirra Andreeva", "Learner Tien", "Jakub Mensik", "Victoria Mboko"],
    surfaces: {},
    weights: { drama: 0.6, quality: 0.5, upset: 0.8, final: 0.2, slam: 0.2, blowoutPenalty: 0.4, generosity: 0.3 },
    reviewTarget: 40,
    skillEmphasis: ["anticipation", "shot_variety", "speed"],
    skillPlayers: [
      "Joao Fonseca", "Mirra Andreeva", "Learner Tien", "Jakub Mensik",
      "Victoria Mboko", "Ben Shelton", "Carlos Alcaraz", "Jannik Sinner",
      "Coco Gauff", "Amanda Anisimova",
    ],
  },
];
