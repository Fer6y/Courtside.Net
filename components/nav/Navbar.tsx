"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser, SignInButton, UserButton } from "@clerk/nextjs";
import {
  Home,
  Users,
  Calendar,
  GitCompare,
  User,
  Search,
} from "lucide-react";
import GlobalSearch from "@/components/GlobalSearch";
import CourtsideMark from "@/components/CourtsideMark";

const DESKTOP_LINKS = [
  { label: "Players", href: "/players" },
  { label: "Matches", href: "/matches" },
  { label: "Activity", href: "/feed" },
  { label: "Compare", href: "/compare" },
];

const MOBILE_TABS = [
  { label: "Home",     href: "/",        icon: Home },
  { label: "Players",  href: "/players", icon: Users },
  { label: "Matches",  href: "/matches", icon: Calendar },
  { label: "Activity", href: "/feed",    icon: GitCompare },
  { label: "Profile",  href: "/profile", icon: User },
];

// A slightly lifted "paper" band over the court-textured page background.
const MASTHEAD_BG =
  "linear-gradient(rgba(236,229,216,0.025), rgba(236,229,216,0.025)), var(--court-bg, #0d1a11)";

const GOLD = "#c9a96a";
const CREAM = "#ece5d8";
const CREAM_DIM = "rgba(236,229,216,0.45)";

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export default function Navbar() {
  const pathname    = usePathname();
  const { isSignedIn } = useUser();
  const [searchOpen, setSearchOpen] = useState(false);

  // Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Small-caps programme tab — gold underline when active.
  function NavTab({ label, href }: { label: string; href: string }) {
    const active = isActive(pathname, href);
    return (
      <Link
        key={href}
        href={href}
        className="eyebrow relative transition-colors duration-150 pb-[7px]"
        style={{ fontSize: 11, letterSpacing: "0.18em", color: active ? CREAM : CREAM_DIM }}
        onMouseEnter={(e) => {
          if (!active) (e.currentTarget as HTMLAnchorElement).style.color = "rgba(236,229,216,0.7)";
        }}
        onMouseLeave={(e) => {
          if (!active) (e.currentTarget as HTMLAnchorElement).style.color = CREAM_DIM;
        }}
      >
        {label}
        {active && (
          <span
            className="absolute bottom-0 left-0 right-0"
            style={{ height: 2, background: GOLD }}
          />
        )}
      </Link>
    );
  }

  return (
    <>
      {/* ── Desktop top nav ─────────────────────────────────────────── */}
      <header
        className="hidden md:flex fixed top-0 left-0 right-0 z-50 items-center h-[60px]"
        style={{ background: MASTHEAD_BG, borderBottom: "1px solid var(--hairline)" }}
      >
        <div className="w-full max-w-[1280px] mx-auto px-6 flex items-center gap-9">
          {/* Wordmark — ball mark + serif name */}
          <Link
            href="/"
            className="flex items-center gap-2.5 shrink-0 hover:opacity-80 transition-opacity"
          >
            <CourtsideMark size={26} gradientId="csmark-nav" />
            <span className="bill-name" style={{ fontSize: 20, fontWeight: 500, color: CREAM }}>
              Courtside
            </span>
          </Link>

          {/* Nav links */}
          <nav className="flex items-center gap-7 ml-1">
            {DESKTOP_LINKS.map((l) => (
              <NavTab key={l.href} {...l} />
            ))}
          </nav>

          {/* Right side */}
          <div className="ml-auto flex items-center gap-4">
            {/* Search icon + Cmd+K hint */}
            <button
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-2 transition-colors duration-150"
              style={{ color: CREAM_DIM }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "rgba(236,229,216,0.7)")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = CREAM_DIM)}
              aria-label="Search (⌘K)"
            >
              <Search size={17} />
              <kbd
                className="font-mono text-[9px] px-1.5 py-0.5 rounded hidden lg:inline"
                style={{ color: CREAM_DIM, border: "1px solid var(--hairline)", background: "rgba(236,229,216,0.04)" }}
              >
                ⌘K
              </kbd>
            </button>

            {/* Divider */}
            <span className="w-px h-5" style={{ background: "var(--hairline)" }} />

            {isSignedIn ? (
              <>
                <NavTab label="Profile" href="/profile" />
                <UserButton afterSignOutUrl="/" />
              </>
            ) : (
              <SignInButton mode="modal">
                <button
                  className="eyebrow rounded-md transition-colors duration-150"
                  style={{
                    fontSize: 11,
                    height: 34,
                    padding: "0 18px",
                    border: `1px solid rgba(201,169,106,0.45)`,
                    color: GOLD,
                  }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "rgba(201,169,106,0.1)")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "transparent")}
                >
                  Sign In
                </button>
              </SignInButton>
            )}
          </div>
        </div>
      </header>

      {/* ── Mobile top header ────────────────────────────────────────── */}
      <header
        className="md:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 h-[44px]"
        style={{ background: MASTHEAD_BG, borderBottom: "1px solid var(--hairline)" }}
      >
        <div className="w-8" />
        <Link href="/" className="flex items-center gap-2">
          <CourtsideMark size={20} gradientId="csmark-mobile" />
          <span className="bill-name" style={{ fontSize: 17, fontWeight: 500, color: CREAM }}>
            Courtside
          </span>
        </Link>
        <button
          onClick={() => setSearchOpen(true)}
          className="w-8 flex justify-end transition-colors"
          style={{ color: CREAM_DIM }}
          aria-label="Search"
        >
          <Search size={18} />
        </button>
      </header>

      {/* ── Global search modal ──────────────────────────────────────── */}
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* ── Mobile bottom tab bar ─────────────────────────────────────── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-stretch justify-around"
        style={{
          height: 56,
          background: MASTHEAD_BG,
          borderTop: "1px solid var(--hairline)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {MOBILE_TABS.map(({ label, href, icon: Icon }) => {
          const active = isActive(pathname, href);
          const color = active ? GOLD : "rgba(236,229,216,0.4)";
          return (
            <Link
              key={href}
              href={href}
              className="relative flex flex-col items-center justify-center gap-0.5 min-w-[44px] flex-1"
            >
              {/* Active indicator — gold rule at the top edge, echoing desktop */}
              {active && (
                <span
                  className="absolute top-0 left-1/2 -translate-x-1/2"
                  style={{ width: 26, height: 2, background: GOLD }}
                />
              )}
              <Icon size={20} color={color} strokeWidth={active ? 2 : 1.5} />
              <span className="eyebrow" style={{ fontSize: 8.5, letterSpacing: "0.12em", color }}>
                {label}
              </span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
