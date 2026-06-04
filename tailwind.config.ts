import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        f1: {
          red: "#e10600",
          dark: "#0a0a0a",
          panel: "#111111",
          card: "#181818",
          border: "#222222",
          muted: "#555555",
          accent: "#ffd700",
        },
      },
      fontFamily: {
        mono: ["'JetBrains Mono'", "Consolas", "monospace"],
      },
      boxShadow: {
        "glow-red": "0 0 20px rgba(225,6,0,0.35), 0 0 40px rgba(225,6,0,0.1)",
        "glow-gold": "0 0 20px rgba(255,215,0,0.35), 0 0 40px rgba(255,215,0,0.1)",
        "panel": "0 4px 32px rgba(0,0,0,0.7)",
      },
      animation: {
        "fade-in": "fade-in 0.25s ease-out",
        "slide-up": "slide-up 0.25s ease-out",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
