import type { Metadata } from "next";
import { IBM_Plex_Mono, DM_Sans, Fraunces } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { cookies } from "next/headers";
import Navbar from "@/components/nav/Navbar";
import { ToastProvider } from "@/components/toast/ToastContext";
import { COURT_COOKIE, asCourt } from "@/lib/courts";
import "./globals.css";

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const dmSans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

// Display serif — "The Programme" voice: player names, page titles,
// match-ups. Italic carries the editorial flourishes ("v.", "d.").
const fraunces = Fraunces({
  variable: "--font-serif",
  subsets: ["latin"],
  style: ["normal", "italic"],
  weight: ["300", "400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Courtside — Catalogue your tennis fandom",
  description: "Rate players, review matches, and build your tennis catalogue.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // The user's chosen court drives the page background. Read from the cookie
  // server-side so it applies before first paint (no flash) without a DB hit.
  const court = asCourt((await cookies()).get(COURT_COOKIE)?.value);

  return (
    <ClerkProvider publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}>
      <html
        lang="en"
        data-court={court}
        className={`${ibmPlexMono.variable} ${dmSans.variable} ${fraunces.variable} dark h-full antialiased`}
        suppressHydrationWarning
      >
        <body className="min-h-full flex flex-col bg-background text-text-primary">
          <ToastProvider>
            <Navbar />
            <div className="flex flex-col flex-1 pt-[44px] md:pt-[60px] pb-[56px] md:pb-0">
              {children}
            </div>
          </ToastProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
