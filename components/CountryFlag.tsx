import { flagUrl, normalizeCountryCode } from "@/lib/countryFlags";

interface CountryFlagProps {
  code: unknown;
  size?: 20 | 24 | 40;
  className?: string;
}

/**
 * Renders a small country flag image from flagcdn.com.
 * Falls back silently (renders nothing) if the country code is unknown.
 */
export default function CountryFlag({ code, size = 20, className }: CountryFlagProps) {
  const url = flagUrl(code, size);
  if (!url) return null;

  const height = size === 20 ? 14 : size === 24 ? 16 : 28;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={normalizeCountryCode(code) ?? ""}
      width={size}
      height={height}
      className={className}
      style={{ display: "inline-block" }}
    />
  );
}
