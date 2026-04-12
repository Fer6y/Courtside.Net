"use client";

import { useEffect, useState } from "react";

// IOC 3-letter → ISO 3166-1 alpha-2 for flag emojis
const IOC_TO_ISO2: Record<string, string> = {
  ESP: "ES", ITA: "IT", GBR: "GB", FRA: "FR", USA: "US",
  GER: "DE", AUS: "AU", SRB: "RS", RUS: "RU", NOR: "NO",
  DEN: "DK", POL: "PL", GRE: "GR", ARG: "AR", CAN: "CA",
  BEL: "BE", NED: "NL", AUT: "AT", CRO: "HR", CZE: "CZ",
  SUI: "CH", BUL: "BG", KAZ: "KZ", CHN: "CN", JPN: "JP",
  KOR: "KR", BRA: "BR", COL: "CO", CHI: "CL", URU: "UY",
  POR: "PT", ROU: "RO", HUN: "HU", SVK: "SK", UKR: "UA",
  LAT: "LV", EST: "EE", FIN: "FI", SWE: "SE", RSA: "ZA",
  TUN: "TN", MAR: "MA", EGY: "EG", IND: "IN",
  TPE: "TW", HKG: "HK", THA: "TH", MEX: "MX", VEN: "VE",
};

function countryToFlag(ioc: string): string {
  const iso2 = IOC_TO_ISO2[ioc.toUpperCase()];
  if (!iso2) return "";
  return Array.from(iso2.toUpperCase())
    .map((c) => String.fromCodePoint(0x1f1e0 + c.charCodeAt(0) - 65))
    .join("");
}

interface BubbleData {
  name: string;
  country: string | null;
  current_rank: number | null;
  wins: number;
  losses: number;
  match_count: number;
  topSkill: { label: string; value: number } | null;
}

interface Props {
  playerId: string;
  playerName: string;
  position: { top: number; left: number };
}

export default function PlayerBubble({ playerId, playerName, position }: Props) {
  const [data, setData] = useState<BubbleData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/players/${playerId}/bubble`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [playerId]);

  const initials = playerName
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const flag = data?.country ? countryToFlag(data.country) : "";

  return (
    <div
      className="fixed z-50 pointer-events-none select-none"
      style={{ top: position.top, left: position.left }}
    >
      <div
        className="flex items-center rounded-full overflow-hidden"
        style={{
          background: "#1a1e26",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.7), 0 0 0 1px rgba(34,214,138,0.06)",
        }}
      >
        {/* Avatar + flag */}
        <div className="flex items-center gap-2 pl-3 pr-2 py-2.5">
          <div
            className="w-[34px] h-[34px] rounded-full flex items-center justify-center font-mono text-xs font-bold shrink-0"
            style={{ background: "rgba(34,214,138,0.15)", color: "#22d68a" }}
          >
            {initials}
          </div>
          {flag && (
            <span className="text-base leading-none shrink-0">{flag}</span>
          )}
        </div>

        {loading ? (
          <div className="flex items-center px-4 py-2.5">
            <span className="font-mono text-xs" style={{ color: "#6b7280" }}>
              ···
            </span>
          </div>
        ) : (
          <>
            <Divider />

            {/* Rank */}
            <Slot
              value={data?.current_rank ? String(data.current_rank) : "—"}
              label="rank"
            />

            <Divider />

            {/* W/L */}
            <div className="px-4 py-2.5 text-center shrink-0">
              <div className="font-mono text-sm font-bold leading-none whitespace-nowrap">
                <span style={{ color: "#22d68a" }}>{data?.wins ?? 0}W</span>
                {" "}
                <span style={{ color: "#9ca3af" }}>{data?.losses ?? 0}L</span>
              </div>
              <div
                className="font-mono mt-0.5 whitespace-nowrap"
                style={{ fontSize: 10, color: "#6b7280" }}
              >
                last {data?.match_count ?? 20} matches
              </div>
            </div>

            {/* Top skill — only if available */}
            {data?.topSkill && (
              <>
                <Divider />
                <div className="px-3 py-2.5 shrink-0">
                  <span
                    className="font-mono text-xs font-semibold px-3 py-1.5 rounded-full whitespace-nowrap"
                    style={{
                      background: "rgba(34,214,138,0.15)",
                      color: "#22d68a",
                    }}
                  >
                    {data.topSkill.label} {data.topSkill.value.toFixed(1)}
                  </span>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Divider() {
  return (
    <div
      className="w-px self-stretch shrink-0"
      style={{ background: "rgba(255,255,255,0.08)" }}
    />
  );
}

function Slot({ value, label }: { value: string; label: string }) {
  return (
    <div className="px-4 py-2.5 text-center shrink-0">
      <div
        className="font-mono text-sm font-bold leading-none"
        style={{ color: "#e8eaed" }}
      >
        {value}
      </div>
      <div
        className="font-mono mt-0.5"
        style={{ fontSize: 10, color: "#6b7280" }}
      >
        {label}
      </div>
    </div>
  );
}
