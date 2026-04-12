"use client";

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

const DESKTOP_LINKS = [
  { label: "Players", href: "/players" },
  { label: "Matches", href: "/matches" },
  { label: "Compare", href: "/compare" },
];

const MOBILE_TABS = [
  { label: "Home",    href: "/",        icon: Home },
  { label: "Players", href: "/players", icon: Users },
  { label: "Matches", href: "/matches", icon: Calendar },
  { label: "Compare", href: "/compare", icon: GitCompare },
  { label: "Profile", href: "/profile", icon: User },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export default function Navbar() {
  const pathname = usePathname();
  const { isSignedIn } = useUser();

  return (
    <>
      {/* ── Desktop top nav ─────────────────────────────────────────── */}
      <header
        className="hidden md:flex fixed top-0 left-0 right-0 z-50 items-center h-[60px]"
        style={{
          background: "#0e1116",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <div className="w-full max-w-[1280px] mx-auto px-6 flex items-center gap-8">
          {/* Wordmark */}
          <Link
            href="/"
            className="font-mono font-semibold text-xl text-primary shrink-0 hover:opacity-80 transition-opacity"
          >
            Courtside
          </Link>

          {/* Nav links */}
          <nav className="flex items-center gap-8 ml-2">
            {DESKTOP_LINKS.map(({ label, href }) => {
              const active = isActive(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  className="relative font-sans font-medium text-[15px] transition-colors duration-150 pb-[6px]"
                  style={{ color: active ? "#e8eaed" : "#6b7280" }}
                  onMouseEnter={(e) => {
                    if (!active) (e.currentTarget as HTMLAnchorElement).style.color = "#9ca3af";
                  }}
                  onMouseLeave={(e) => {
                    if (!active) (e.currentTarget as HTMLAnchorElement).style.color = "#6b7280";
                  }}
                >
                  {label}
                  {active && (
                    <span
                      className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full"
                      style={{ background: "#22d68a" }}
                    />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Right side */}
          <div className="ml-auto flex items-center gap-4">
            {/* Search icon */}
            <button
              className="text-[#6b7280] hover:text-[#9ca3af] transition-colors duration-150"
              aria-label="Search"
            >
              <Search size={18} />
            </button>

            {/* Divider */}
            <span
              className="w-px h-5"
              style={{ background: "rgba(255,255,255,0.1)" }}
            />

            {isSignedIn ? (
              <>
                <Link
                  href="/profile"
                  className="font-sans font-medium text-[15px] transition-colors duration-150 pb-[6px]"
                  style={{ color: isActive(pathname, "/profile") ? "#e8eaed" : "#6b7280" }}
                >
                  Profile
                </Link>
                <UserButton afterSignOutUrl="/" />
              </>
            ) : (
              <>
                {/* Guest avatar circle */}
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ border: "1px solid rgba(255,255,255,0.15)" }}
                >
                  <User size={13} color="#6b7280" />
                </div>

                {/* Sign In button */}
                <SignInButton mode="modal">
                  <button
                    className="font-sans font-medium text-sm px-4 rounded-full transition-colors duration-150 hover:bg-primary/10"
                    style={{
                      height: 36,
                      border: "1px solid #22d68a",
                      color: "#22d68a",
                    }}
                  >
                    Sign In
                  </button>
                </SignInButton>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── Mobile top header ────────────────────────────────────────── */}
      <header
        className="md:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-center h-[44px]"
        style={{
          background: "#0e1116",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <Link
          href="/"
          className="font-mono font-semibold text-lg text-primary"
        >
          Courtside
        </Link>
      </header>

      {/* ── Mobile bottom tab bar ─────────────────────────────────────── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-start justify-around pt-2"
        style={{
          height: 56,
          background: "#1a1e26",
          borderTop: "1px solid rgba(255,255,255,0.05)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {MOBILE_TABS.map(({ label, href, icon: Icon }) => {
          const active = isActive(pathname, href);
          const color = active ? "#22d68a" : "#6b7280";
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-0.5 min-w-[44px]"
            >
              <Icon size={20} color={color} strokeWidth={active ? 2 : 1.5} />
              <span
                className="font-sans"
                style={{ fontSize: 10, color }}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
