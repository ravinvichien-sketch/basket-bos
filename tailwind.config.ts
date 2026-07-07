import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./features/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Kanit", "sans-serif"],
        display: ["Oswald", "Kanit", "sans-serif"],
      },
      colors: {
        court: {
          DEFAULT: "#F97316", // basketball orange
          dark: "#C2570B",
        },
        line: "#06C755",
        surface: {
          DEFAULT: "#0B0F14",
          raised: "#141B23",
          overlay: "#1D2733",
        },
        ink: {
          DEFAULT: "#F1F5F9",
          dim: "#94A3B8",
          faint: "#64748B",
        },
      },
      borderRadius: {
        xl2: "1.25rem",
      },
    },
  },
  plugins: [],
};
export default config;
