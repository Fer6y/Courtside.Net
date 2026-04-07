// Courtside — tailwind.config.ts reference
// Copy this into your project's tailwind.config.ts

import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Backgrounds & surfaces
        background: "#0e1116",
        surface: {
          DEFAULT: "#1a1e26",
          2: "#22272f",
          3: "#2a303a",
        },
        // Brand & semantic
        primary: "#22d68a",        // Green — actions, wins, CTA
        accent: "#4a9eff",         // Blue — comparisons, Movement category
        amber: "#f5c518",          // Highlights, Skill category
        coral: "#d4734e",          // Mental category
        loss: "#e74c3c",           // Red — losses, errors, destructive
        // Text
        "text-primary": "#e8eaed",
        "text-mid": "#9ca3af",
        "text-dim": "#6b7280",
        // Surface badges
        "court-hard": "#4a90d9",
        "court-clay": "#d4734e",
        "court-grass": "#5cb85c",
        // Radar category colors
        "cat-movement": "#4a9eff",
        "cat-technique": "#22d68a",
        "cat-skill": "#f5c518",
        "cat-mental": "#d4734e",
      },
      fontFamily: {
        mono: ['"IBM Plex Mono"', "monospace"],  // Numbers, scores, headings, data, brand
        sans: ['"DM Sans"', "sans-serif"],        // Body, reviews, comments, UI labels
      },
      borderRadius: {
        DEFAULT: "0.5rem",
      },
      animation: {
        "spring-in": "springIn 0.18s ease-out",
        "fade-in": "fadeIn 0.3s ease-out",
      },
      keyframes: {
        springIn: {
          "0%": { transform: "scale(0.92)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
