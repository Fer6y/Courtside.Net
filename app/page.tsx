import Image from "next/image";

export default function Home() {
  return (
    <main
      className="flex flex-col items-center justify-center flex-1"
      style={{
        minHeight: "calc(100vh - 60px)",
        background:
          "radial-gradient(ellipse 70% 50% at 50% 36%, rgba(100,200,20,0.16) 0%, rgba(14,17,22,0) 65%), #0e1116",
      }}
    >
      {/* Ball image */}
      <Image
        src="/Homepage_Ball.png"
        alt="Tennis ball"
        width={320}
        height={320}
        priority
        style={{
          marginBottom: 36,
          filter:
            "drop-shadow(0 0 40px rgba(110,200,10,0.65)) drop-shadow(0 0 80px rgba(80,160,0,0.35))",
        }}
      />

      {/* Wordmark */}
      <h1
        className="font-mono font-bold text-white"
        style={{ fontSize: 54, letterSpacing: "-0.01em", marginBottom: 14, lineHeight: 1 }}
      >
        Courtside
      </h1>

      {/* Tagline */}
      <p
        className="font-sans"
        style={{ fontSize: 17, color: "#9ca3af", letterSpacing: "0.015em" }}
      >
        Catalogue your tennis fandom.
      </p>
    </main>
  );
}
