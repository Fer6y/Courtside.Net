import type { Metadata } from "next";
import { IBM_Plex_Mono, DM_Sans } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import Navbar from "@/components/nav/Navbar";
import { ToastProvider } from "@/components/toast/ToastContext";
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

export const metadata: Metadata = {
  title: "Courtside — Catalogue your tennis fandom",
  description: "Rate players, review matches, and build your tennis catalogue.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}>
      <html
        lang="en"
        className={`${ibmPlexMono.variable} ${dmSans.variable} dark h-full antialiased`}
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
