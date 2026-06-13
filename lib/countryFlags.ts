/**
 * Normalizes whatever the `players.country` column hands us into a clean
 * 3-letter code. Some rows were imported with the raw MatchStat shape —
 * either an object `{ name, acronym }` or its stringified JSON form — instead
 * of a plain code like "ITA". This unwraps all three so flags/names resolve
 * regardless of how the row was stored.
 */
export function normalizeCountryCode(code: unknown): string | null {
  if (!code) return null;

  // Object shape: { name: "Italy", acronym: "ITA" }
  if (typeof code === "object") {
    const acronym = (code as Record<string, unknown>).acronym;
    return typeof acronym === "string" ? acronym.trim().toUpperCase() : null;
  }

  if (typeof code !== "string") return null;
  const trimmed = code.trim();
  if (!trimmed) return null;

  // Stringified JSON: '{"name":"Italy","acronym":"ITA"}'
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      return typeof parsed.acronym === "string" ? parsed.acronym.trim().toUpperCase() : null;
    } catch {
      return null;
    }
  }

  return trimmed.toUpperCase();
}

/**
 * Maps 3-letter tennis country codes (ISO alpha-3 / ITF) to
 * 2-letter ISO alpha-2 codes used by flagcdn.com.
 */
const CODE_MAP: Record<string, string> = {
  AFG: "af", ALB: "al", ALG: "dz", AND: "ad", ANG: "ao",
  ARG: "ar", ARM: "am", AUS: "au", AUT: "at", AZE: "az",
  BAH: "bs", BAN: "bd", BEL: "be", BEN: "bj", BER: "bm",
  BIH: "ba", BLR: "by", BOL: "bo", BOT: "bw", BRA: "br",
  BUL: "bg", CAM: "kh", CAN: "ca", CHI: "cl", CHN: "cn",
  COL: "co", CRC: "cr", CRO: "hr", CYP: "cy", CZE: "cz",
  DEN: "dk", DOM: "do", ECU: "ec", EGY: "eg", ESA: "sv",
  ESP: "es", EST: "ee", ETH: "et", FIN: "fi", FRA: "fr",
  GBR: "gb", GEO: "ge", GER: "de", GHA: "gh", GRE: "gr",
  GUA: "gt", HKG: "hk", HUN: "hu", INA: "id", IND: "in",
  IRL: "ie", IRN: "ir", ISL: "is", ISR: "il", ITA: "it",
  IVB: "vg", JAM: "jm", JOR: "jo", JPN: "jp", KAZ: "kz", KEN: "ke",
  KGZ: "kg", KOR: "kr", KUW: "kw", LAT: "lv", LBA: "ly",
  LIE: "li", LTU: "lt", LUX: "lu", MAR: "ma", MAS: "my",
  MDA: "md", MEX: "mx", MKD: "mk", MLT: "mt", MNE: "me",
  MON: "mc", MOR: "ma", MOZ: "mz", NED: "nl", NEP: "np",
  NGR: "ng", NOR: "no", NZL: "nz", PAK: "pk", PAN: "pa",
  PAR: "py", PER: "pe", PHI: "ph", POL: "pl", POR: "pt",
  PUR: "pr", QAT: "qa", ROU: "ro", RSA: "za", RUS: "ru",
  RWA: "rw", SAU: "sa", SEN: "sn", SER: "rs", SLO: "si",
  SRB: "rs", SRI: "lk", SUI: "ch", SVK: "sk", SWE: "se",
  TAN: "tz", THA: "th", TKM: "tm", TPE: "tw", TTO: "tt",
  TUN: "tn", TUR: "tr", UAE: "ae", UKR: "ua", URU: "uy",
  USA: "us", UZB: "uz", VEN: "ve", VIE: "vn", ZIM: "zw",
};

/**
 * Returns a flagcdn.com URL for the given 3-letter country code,
 * or null if the code is unknown.
 *
 * @param code  3-letter country code as stored in players.country (e.g. "ITA")
 * @param size  Width in pixels — flagcdn supports 20, 24, 40, 48, 64, 160, 240, 320, 480, 640
 */
export function flagUrl(code: unknown, size: 20 | 24 | 40 = 20): string | null {
  const normalized = normalizeCountryCode(code);
  if (!normalized) return null;
  const alpha2 = CODE_MAP[normalized];
  if (!alpha2) return null;
  return `https://flagcdn.com/w${size}/${alpha2}.png`;
}

/** Returns the full country name for a 3-letter code, falling back to the code itself. */
const NAMES: Record<string, string> = {
  ARG: "Argentina",   AUS: "Australia",  AUT: "Austria",    BEL: "Belgium",
  BLR: "Belarus",     BOL: "Bolivia",    BRA: "Brazil",     BUL: "Bulgaria",
  CAN: "Canada",      CHI: "Chile",      CHN: "China",      COL: "Colombia",
  CRO: "Croatia",     CZE: "Czech Republic", DEN: "Denmark", ECU: "Ecuador",
  ESP: "Spain",       EST: "Estonia",    FIN: "Finland",    FRA: "France",
  GBR: "Great Britain", GEO: "Georgia", GER: "Germany",    GRE: "Greece",
  HUN: "Hungary",     IND: "India",      IRL: "Ireland",    ISR: "Israel",
  ITA: "Italy",       JPN: "Japan",      KAZ: "Kazakhstan", KOR: "South Korea",
  LAT: "Latvia",      LTU: "Lithuania",  LUX: "Luxembourg", MAR: "Morocco",
  MEX: "Mexico",      MDA: "Moldova",    MNE: "Montenegro", MON: "Monaco",
  NED: "Netherlands", NOR: "Norway",     NZL: "New Zealand",PAK: "Pakistan",
  PAR: "Paraguay",    PER: "Peru",       POL: "Poland",     POR: "Portugal",
  QAT: "Qatar",       ROU: "Romania",    RSA: "South Africa",RUS: "Russia",
  SER: "Serbia",      SLO: "Slovenia",   SRB: "Serbia",     SUI: "Switzerland",
  SVK: "Slovakia",    SWE: "Sweden",     TPE: "Chinese Taipei",TUR: "Turkey",
  UAE: "UAE",         UKR: "Ukraine",    URU: "Uruguay",    USA: "United States",
  UZB: "Uzbekistan",  VEN: "Venezuela",
};

export function countryName(code: unknown): string {
  const normalized = normalizeCountryCode(code);
  if (!normalized) return "";
  return NAMES[normalized] ?? normalized;
}
