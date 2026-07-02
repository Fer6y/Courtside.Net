/**
 * review-texts.ts — hand-written Press Box review comments.
 *
 * Every text is anchored to a real match via matchKey:
 *   `${tournament}::${round}::${player1.name} v ${player2.name}`
 * (player order exactly as stored in the matches table). seed.ts resolves
 * keys against the live pool and warns about any that no longer match, so a
 * re-import that changes rows degrades gracefully instead of crashing.
 *
 * House rule (docs content rules): texts only reference what the catalogue
 * itself shows — scoreline, round, surface, players — plus opinion. No
 * invented stats.
 */

export type ReviewText = {
  persona: string;   // Persona.slug
  matchKey: string;
  comment: string;
};

export const REVIEW_TEXTS: ReviewText[] = [
  // ── Leslie Snow — serve nerd ────────────────────────────────────────────
  {
    persona: "leslie_snow",
    matchKey: "Australian Open 2026::Final::Elena Rybakina v Aryna Sabalenka",
    comment: "Two of the biggest serves in the women's game trading haymakers for three sets. Rybakina's serving in the tight moments WAS the match. This is the tennis I subscribe for.",
  },
  {
    persona: "leslie_snow",
    matchKey: "Australian Open 2026::Semifinal::Elena Rybakina v Jessica Pegula",
    comment: "A 9-7 tiebreak to reach a slam final is exactly the currency I trade in. Rybakina served her way out of every spot of trouble like it was a formality.",
  },
  {
    persona: "leslie_snow",
    matchKey: "Canadian Open 2025::Final::Ben Shelton v Karen Khachanov",
    comment: "Three sets, two tiebreaks, zero failures of nerve. Shelton's serving under pressure grew up this week.",
  },
  {
    persona: "leslie_snow",
    matchKey: "Wimbledon 2026::Round of 128::Otto Virtanen v Ben Shelton",
    comment: "I'm a Shelton guy, so this one hurt — but 7-6(9) in the fifth is the purest form of the sport. Hours of holds and then sudden death. Brutal, perfect theatre.",
  },
  {
    persona: "leslie_snow",
    matchKey: "Wimbledon 2026::Round of 128::Alexander Zverev v Alexander Blockx",
    comment: "Three tiebreaks, including a 7-0 shutout to close it. Zverev's serve on grass is a cheat code when it lands.",
  },
  {
    persona: "leslie_snow",
    matchKey: "Wimbledon 2026::Round of 64::Jannik Sinner v Nuno Borges",
    comment: "Borges hung in two tiebreaks with the world number one without ever really sniffing the finish line. That's a serving contest, and I mean it as a compliment.",
  },
  {
    persona: "leslie_snow",
    matchKey: "Wimbledon 2026::Round of 128::Elena Rybakina v Lois Boisson",
    comment: "Strange middle set, but when Rybakina's serve is on, grass tennis turns into a formality. Closed the third with zero drama.",
  },

  // ── John Flowers — technician ───────────────────────────────────────────
  {
    persona: "john_flowers",
    matchKey: "Australian Open 2024::Final::Jannik Sinner v Daniil Medvedev",
    comment: "Down two sets, Sinner just kept hitting the same clean, flat lines until the match tilted. No panic, no reinvention — just better execution for three straight hours.",
  },
  {
    persona: "john_flowers",
    matchKey: "Roland Garros 2025::Final::Carlos Alcaraz v Jannik Sinner",
    comment: "Five sets, three tiebreaks, and the level never dipped. The two best ball-strikers alive taking turns being unplayable. Reference-point tennis — everything else this year gets judged against it.",
  },
  {
    persona: "john_flowers",
    matchKey: "Wimbledon 2025::Final::Jannik Sinner v Carlos Alcaraz",
    comment: "Dropped the first, then won three near-identical sets by refusing to miss the same ball twice. Sinner's backhand cross-court was a metronome. Craft over chaos.",
  },
  {
    persona: "john_flowers",
    matchKey: "Roland Garros 2026::Final::Alexander Zverev v Flavio Cobolli",
    comment: "Not a clean final — Zverev went walkabout in the fourth — but the first and fifth sets were ruthless, and the title he's been chasing his whole career finally landed.",
  },
  {
    persona: "john_flowers",
    matchKey: "Indian Wells Masters 2026::Final::Jannik Sinner v Daniil Medvedev",
    comment: "Two tiebreaks, no breaks. Sounds dull; was anything but. Every service game was a chess problem. The margins at this level are absurd.",
  },
  {
    persona: "john_flowers",
    matchKey: "Monte-Carlo Masters 2026::Final::Jannik Sinner v Carlos Alcaraz",
    comment: "Sinner beating Alcaraz on clay, in Monte Carlo, mostly from the baseline. That first-set tiebreak was as high a sustained level as you'll see all season.",
  },
  {
    persona: "john_flowers",
    matchKey: "Paris Masters 2025::Final::Jannik Sinner v Felix Auger Aliassime",
    comment: "Indoor Sinner is the cleanest version of Sinner. Felix played well and it mattered not at all.",
  },
  {
    persona: "john_flowers",
    matchKey: "Wimbledon 2026::Round of 128::Jannik Sinner v Miomir Kecmanovic",
    comment: "The top seed dropping two sets in round one isn't a crisis, but Kecmanovic redirecting pace for two of those sets was genuinely fine viewing. Sinner's ceiling reasserted itself late.",
  },

  // ── Priya Raman — clay romantic ─────────────────────────────────────────
  {
    persona: "priya_raman",
    matchKey: "Roland Garros 2024::Final::Carlos Alcaraz v Alexander Zverev",
    comment: "Five sets in Paris, momentum swinging like a pendulum, Alcaraz sliding into winners that shouldn't exist. This is why clay is the sport's true canvas.",
  },
  {
    persona: "priya_raman",
    matchKey: "Roland Garros 2025::Final::Carlos Alcaraz v Jannik Sinner",
    comment: "I sat down for a final and got an epic poem. Three tiebreaks, hours of tennis where losing felt impossible for both men. The best match I have ever logged on this site.",
  },
  {
    persona: "priya_raman",
    matchKey: "Roland Garros 2024::Semifinal::Carlos Alcaraz v Jannik Sinner",
    comment: "The rivalry's Paris chapter, part one. Alcaraz surviving in five on the dirt felt like a coronation rehearsal.",
  },
  {
    persona: "priya_raman",
    matchKey: "Roland Garros 2026::Semifinal::Maja Chwalinska v Diana Shnaider",
    comment: "The run nobody scripted, and she played the biggest match of her life like the moment weighed nothing — 7-6(4) 6-4, all touch and nerve. Clay keeps making poets out of strangers.",
  },
  {
    persona: "priya_raman",
    matchKey: "Monte-Carlo Masters 2025::Final::Carlos Alcaraz v Lorenzo Musetti",
    comment: "Musetti's one-hander took the first set and my whole heart. Then Alcaraz remembered who he was and conceded one game in two sets. Cruel, gorgeous sport.",
  },
  {
    persona: "priya_raman",
    matchKey: "Madrid Open 2025::Final::Casper Ruud v Jack Draper",
    comment: "Casper finally landing a big one on his beloved dirt. Patient, heavy, unglamorous clay tennis rewarded at last. I may have teared up.",
  },
  {
    persona: "priya_raman",
    matchKey: "Italian Open 2025::Final::Carlos Alcaraz v Jannik Sinner",
    comment: "That first set was a duel; the second was a statement. Rome in May, Alcaraz on clay — the calendar's finest hour.",
  },
  {
    persona: "priya_raman",
    matchKey: "Wimbledon 2026::Round of 128::Iga Swiatek v Taylor Townsend",
    comment: "Even on the lawns, Iga plays with a clay-courter's brain. The second-set wobble was just Townsend refusing to rally on Iga's terms. The defending champion moves on.",
  },

  // ── Marcus Hale — grass traditionalist ──────────────────────────────────
  {
    persona: "marcus_hale",
    matchKey: "Wimbledon 2024::Final::Carlos Alcaraz v Novak Djokovic",
    comment: "The kid took the champion apart on the sport's most important lawn and had the decency to make the third set dramatic. Forecourt instincts you cannot teach.",
  },
  {
    persona: "marcus_hale",
    matchKey: "Wimbledon 2025::Final::Jannik Sinner v Carlos Alcaraz",
    comment: "A Wimbledon final of relentless baseline precision. Magnificent, yes. But somebody, anybody — chip and charge once. For me.",
  },
  {
    persona: "marcus_hale",
    matchKey: "Australian Open 2026::Final::Carlos Alcaraz v Novak Djokovic",
    comment: "The old master took the first set on guile alone, and for half an hour it was yesteryear again. Then Alcaraz's legs made the argument no one has ever answered.",
  },
  {
    persona: "marcus_hale",
    matchKey: "Australian Open 2026::Semifinal::Novak Djokovic v Jannik Sinner",
    comment: "Whatever you believe about age curves, Djokovic beating the world number one over five sets rewrites it. The last two sets were a masterclass in playing the scoreboard, not the opponent.",
  },
  {
    persona: "marcus_hale",
    matchKey: "Monte-Carlo Masters 2025::Final::Carlos Alcaraz v Lorenzo Musetti",
    comment: "A set of Musetti's one-handed backhand in the Monte Carlo sun is worth the annual subscription alone. The scoreline thereafter, we shall not discuss.",
  },
  {
    persona: "marcus_hale",
    matchKey: "Wimbledon 2026::Round of 128::Alexander Bublik v Thanasi Kokkinakis",
    comment: "Drop volleys, ambushes, a 12-10 tiebreak lost and shrugged off — Bublik is the last of the vaudeville acts and grass is his stage. Five sets of pure mischief.",
  },
  {
    persona: "marcus_hale",
    matchKey: "Wimbledon 2026::Round of 64::Novak Djokovic v Stefanos Tsitsipas",
    comment: "An old rivalry reduced to a procession. Djokovic on grass remains a man mowing his own lawn — everything in its place.",
  },

  // ── Dot Kowalski — heart and comebacks ──────────────────────────────────
  {
    persona: "dot_kowalski",
    matchKey: "Australian Open 2024::Final::Jannik Sinner v Daniil Medvedev",
    comment: "Two sets down in a slam final and the boy didn't blink. In my day we called that heart; now they call it 'resetting'. Either way I was on my feet at 2am.",
  },
  {
    persona: "dot_kowalski",
    matchKey: "Australian Open 2025::Final::Madison Keys v Aryna Sabalenka",
    comment: "Madison Keys spent a decade being everyone's 'talented, but'. Watch that third set and try saying 'but' again. Wonderful stuff.",
  },
  {
    persona: "dot_kowalski",
    matchKey: "Australian Open 2025::Semifinal::Madison Keys v Iga Swiatek",
    comment: "Winning it 10-8 in the deciding tiebreak, against Iga of all people. I've watched fifty years of this sport and that third set still had me pacing the kitchen.",
  },
  {
    persona: "dot_kowalski",
    matchKey: "Australian Open 2026::Semifinal::Novak Djokovic v Jannik Sinner",
    comment: "Five sets against a man fifteen years younger, and it was the old fella dictating at the end. Some players have careers. That man has a saga.",
  },
  {
    persona: "dot_kowalski",
    matchKey: "Canadian Open 2025::Final::Victoria Mboko v Naomi Osaka",
    comment: "Blown off the court for a set, and then she simply decided otherwise. Whoever raised that young woman, well done.",
  },
  {
    persona: "dot_kowalski",
    matchKey: "Wimbledon 2026::Round of 64::Barbora Krejcikova v Mirra Andreeva",
    comment: "The former champion, a set down to the teenager everyone's already crowning, and she just refused. Grass remembers its own.",
  },
  {
    persona: "dot_kowalski",
    matchKey: "Wimbledon 2026::Round of 128::Jasmine Paolini v Robin Montgomery",
    comment: "Lost the first set to love and won the match. That's not tactics, dear, that's character. Paolini's grin at the end said everything.",
  },
  {
    persona: "dot_kowalski",
    matchKey: "Wimbledon 2026::Round of 128::Novak Djokovic v Yibing Wu",
    comment: "He drops a set now and again just to check we're all still paying attention. Four sets of vintage problem-solving.",
  },

  // ── Felix Okafor — movement ─────────────────────────────────────────────
  {
    persona: "felix_okafor",
    matchKey: "Roland Garros 2025::Final::Coco Gauff v Aryna Sabalenka",
    comment: "Sabalenka hit through her for a set. Then Gauff's defence started turning bullets into counterattacks and the whole match inverted. Legs won this title.",
  },
  {
    persona: "felix_okafor",
    matchKey: "US Open 2025::Final::Carlos Alcaraz v Jannik Sinner",
    comment: "Watch the fourth set again and count how many rallies Alcaraz finishes at full sprint. Nobody converts defence into offence faster. Nobody is close.",
  },
  {
    persona: "felix_okafor",
    matchKey: "Australian Open 2026::Final::Carlos Alcaraz v Novak Djokovic",
    comment: "Djokovic played the angles; Alcaraz simply arrived at all of them. By the fourth set the court looked small on one side and enormous on the other.",
  },
  {
    persona: "felix_okafor",
    matchKey: "Australian Open 2026::Semifinal::Carlos Alcaraz v Alexander Zverev",
    comment: "Two tiebreaks lost in the middle of the match, and Alcaraz still trusted his legs to win him a 7-5 fifth set. Movement is a mentality.",
  },
  {
    persona: "felix_okafor",
    matchKey: "US Open 2025::Semifinal::Carlos Alcaraz v Novak Djokovic",
    comment: "The great returner met a man whose feet answer every question. That second-set tiebreak was decided entirely by first-step speed.",
  },
  {
    persona: "felix_okafor",
    matchKey: "Wimbledon 2026::Round of 64::Coco Gauff v Solana Sierra",
    comment: "Deciding-set tiebreak and Gauff's answer was to chase down two would-be winners nobody else reaches. Wheels bail out wobbles. That's the whole formula.",
  },
  {
    persona: "felix_okafor",
    matchKey: "Wimbledon 2026::Round of 64::Alex De Minaur v Adrian Mannarino",
    comment: "De Minaur on grass is a highlights reel of impossible gets. Mannarino's slice asked awkward questions; the answer was footspeed, every time.",
  },

  // ── Sofia Marino — WTA power ────────────────────────────────────────────
  {
    persona: "sofia_marino",
    matchKey: "Australian Open 2025::Final::Madison Keys v Aryna Sabalenka",
    comment: "Two women trying to hit the fuzz off the ball, and the one with nothing to lose swung freer. Keys deserved this for a decade of clean striking.",
  },
  {
    persona: "sofia_marino",
    matchKey: "Wimbledon 2025::Final::Iga Swiatek v Amanda Anisimova",
    comment: "A double bagel in a Wimbledon final. Ruthless from Iga — and honestly, the bravest thing Anisimova did was walk back out for the second set. The good ones come back. Watch.",
  },
  {
    persona: "sofia_marino",
    matchKey: "US Open 2025::Final::Aryna Sabalenka v Amanda Anisimova",
    comment: "And there's the comeback. Two months after the London nightmare, Anisimova pushed the world number one to a tiebreak in a slam final. Ball-striking that pure always resurfaces.",
  },
  {
    persona: "sofia_marino",
    matchKey: "Roland Garros 2025::Semifinal::Aryna Sabalenka v Iga Swiatek",
    comment: "Beating Iga at Roland Garros used to be theoretical physics. Sabalenka made the third set look like a demonstration. Massive result.",
  },
  {
    persona: "sofia_marino",
    matchKey: "US Open 2025::Semifinal::Amanda Anisimova v Naomi Osaka",
    comment: "Two tiebreak sets between two of the flattest hitters alive. Hardest-hit match of the year, and I will not be taking fact-checks on that.",
  },
  {
    persona: "sofia_marino",
    matchKey: "Indian Wells Masters 2026::Final::Aryna Sabalenka v Elena Rybakina",
    comment: "Down a set to that serve, and she still found 8-6 in the deciding breaker. This rivalry is carrying the tour right now.",
  },
  {
    persona: "sofia_marino",
    matchKey: "Wimbledon 2026::Round of 64::Amanda Anisimova v Sofia Kenin",
    comment: "Anisimova's backhand up the line is worth the stream on its own. Kenin scrapped, as ever. Proper grass-court scrap from both.",
  },
  {
    persona: "sofia_marino",
    matchKey: "Wimbledon 2026::Round of 64::Aryna Sabalenka v Mccartney Kessler",
    comment: "One set of demolition, then Kessler refusing to leave. 11-9 in the breaker — Sabalenka's serve clocked in exactly when required.",
  },

  // ── Ted Barnum — chaos ──────────────────────────────────────────────────
  {
    persona: "ted_barnum",
    matchKey: "Roland Garros 2025::Final::Carlos Alcaraz v Jannik Sinner",
    comment: "THREE TIEBREAKS. FIVE SETS. I paced a hole in my carpet. Sport does not get better than this, and I'm genuinely annoyed that normal-length tennis matches will resume tomorrow.",
  },
  {
    persona: "ted_barnum",
    matchKey: "Roland Garros 2026::Final::Alexander Zverev v Flavio Cobolli",
    comment: "A 6-1 first set, then Cobolli decides he belongs, drags a slam final to a fourth-set breaker — and Zverev slams the door 6-1. Momentum whiplash. My favourite kind of mess.",
  },
  {
    persona: "ted_barnum",
    matchKey: "Australian Open 2026::Semifinal::Novak Djokovic v Jannik Sinner",
    comment: "The world number one, cruising on reputation, and the old man drags him into deep water for five sets. I screamed at a television at 4am. No regrets.",
  },
  {
    persona: "ted_barnum",
    matchKey: "Australian Open 2026::Semifinal::Carlos Alcaraz v Alexander Zverev",
    comment: "Alcaraz lost back-to-back tiebreaks and had every excuse to fold. 7-5 in the fifth. This is why we watch, folks.",
  },
  {
    persona: "ted_barnum",
    matchKey: "US Open 2024::Semifinal::Taylor Fritz v Frances Tiafoe",
    comment: "Two Americans, a home-slam semifinal, everything on the line, and neither man blinking until the fifth. That Tiafoe fourth set was cinema.",
  },
  {
    persona: "ted_barnum",
    matchKey: "Shanghai Masters 2025::Final::Valentin Vacherot v Arthur Rinderknech",
    comment: "A Masters final between two names most brackets couldn't spell a fortnight earlier. Chaos is a ladder and I love this sport.",
  },
  {
    persona: "ted_barnum",
    matchKey: "Wimbledon 2026::Round of 128::Otto Virtanen v Ben Shelton",
    comment: "TOP-FIVE PLAYER. ROUND ONE. 7-6(9) IN THE FIFTH. Wimbledon giveth immediately. Otto Virtanen, you absolute menace.",
  },
  {
    persona: "ted_barnum",
    matchKey: "Wimbledon 2026::Round of 128::Alexander Bublik v Thanasi Kokkinakis",
    comment: "Bublik lost a 12-10 tiebreak mid-match and responded with more nonsense, better nonsense, winning nonsense. Five sets of a man juggling knives.",
  },

  // ── Ingrid Larsen — the number is the review ────────────────────────────
  {
    persona: "ingrid_larsen",
    matchKey: "Roland Garros 2025::Final::Carlos Alcaraz v Jannik Sinner",
    comment: "Five sets, three tiebreaks, no sustained dip from either player. I don't hand out tens. This is a ten.",
  },
  {
    persona: "ingrid_larsen",
    matchKey: "Wimbledon 2025::Final::Iga Swiatek v Amanda Anisimova",
    comment: "6-0 6-0. The number is the review.",
  },
  {
    persona: "ingrid_larsen",
    matchKey: "Australian Open 2024::Semifinal::Daniil Medvedev v Alexander Zverev",
    comment: "Two sets down, then three straight, two of them tiebreaks. The margin across five sets: a handful of points at the correct moments. That is the entire sport.",
  },
  {
    persona: "ingrid_larsen",
    matchKey: "Australian Open 2025::Semifinal::Alexander Zverev v Novak Djokovic",
    comment: "One set, then a retirement. Rated accordingly. Asterisks are not narratives.",
  },
  {
    persona: "ingrid_larsen",
    matchKey: "Indian Wells Masters 2026::Final::Jannik Sinner v Daniil Medvedev",
    comment: "7-6 7-6, no breaks of serve. Two players trading holds until the smallest errors decided it. Clean, high-floor tennis. Approved.",
  },
  {
    persona: "ingrid_larsen",
    matchKey: "Western & Southern Open 2025::Final::Carlos Alcaraz v Jannik Sinner",
    comment: "Five games, then a retirement. A final that wasn't. Logged for completeness, rated for what was actually played.",
  },
  {
    persona: "ingrid_larsen",
    matchKey: "Wimbledon 2026::Round of 128::Otto Virtanen v Ben Shelton",
    comment: "Top-five player out in round one, 7-6(9) fifth set. Variance is what best-of-five is designed to suppress and occasionally cannot. Well played, Virtanen.",
  },
  {
    persona: "ingrid_larsen",
    matchKey: "Wimbledon 2026::Round of 128::Daniil Medvedev v Marin Cilic",
    comment: "Routine. Straight sets of expected outcomes, executed without fuss. Not every match is a story; this one was an errand.",
  },

  // ── Rafa Delgado — next-gen scout ───────────────────────────────────────
  {
    persona: "rafa_delgado",
    matchKey: "Roland Garros 2026::Final::Mirra Andreeva v Maja Chwalinska",
    comment: "A teenager winning Roland Garros and it felt inevitable rather than shocking — that's the frightening part. Andreeva's ceiling isn't visible from here.",
  },
  {
    persona: "rafa_delgado",
    matchKey: "Miami Open 2025::Final::Jakub Mensik v Novak Djokovic",
    comment: "A teenager out-serving Djokovic in two tiebreaks for a Masters title, no coin-flips about it. Generational stuff. Told you about the serve.",
  },
  {
    persona: "rafa_delgado",
    matchKey: "Canadian Open 2025::Final::Victoria Mboko v Naomi Osaka",
    comment: "Lost the first set to a four-time slam champion and won the next two going away. Mboko's been on my list all season. She's on everyone's now.",
  },
  {
    persona: "rafa_delgado",
    matchKey: "Indian Wells Masters 2025::Final::Mirra Andreeva v Aryna Sabalenka",
    comment: "Getting rolled 6-2 by the world number one and adjusting mid-match to win it — as a seventeen-year-old. That's not talent, that's processing. Bookmark this one.",
  },
  {
    persona: "rafa_delgado",
    matchKey: "Wimbledon 2026::Round of 128::Jakub Mensik v Toby Samuel",
    comment: "Toby Samuel nearly pulled the heist of the fortnight — 9-7 in the fifth-set breaker before Mensik slammed the vault shut. Two names worth having seen early.",
  },
  {
    persona: "rafa_delgado",
    matchKey: "Wimbledon 2026::Round of 64::Barbora Krejcikova v Mirra Andreeva",
    comment: "Painful day for the Andreeva stock portfolio, but losing from a set up to a former Wimbledon champion is a lesson, not a verdict. Holding my position.",
  },
  {
    persona: "rafa_delgado",
    matchKey: "Wimbledon 2026::Round of 128::Joao Fonseca v Roberto Bautista Agut",
    comment: "Fonseca dismantling a veteran wall like Bautista Agut in straight sets, on grass — the surface that was supposed to expose him. Buy. Buy. Buy.",
  },
  {
    persona: "rafa_delgado",
    matchKey: "Wimbledon 2026::Round of 64::Marton Fucsovics v Learner Tien",
    comment: "Tien took the first breaker, then ran into a grass-court veteran in full flow. Part of the syllabus. The backhand is still special and I'm not moving off the pick.",
  },
];
