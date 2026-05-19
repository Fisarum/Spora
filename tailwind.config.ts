import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        mono: ["IBM Plex Mono", "monospace"],
      },
      colors: {
        primary: "#dffb0a",
        background: "#171717",
        foreground: "#fdfdfd",
        spora: {
          50: "#f8ffd6",
          100: "#f0ffad",
          200: "#e7ff7a",
          300: "#dffb0a",
          400: "#c8e109",
          500: "#afc608",
          600: "#899c06",
          700: "#677505",
          800: "#454e03",
          900: "#222702",
          950: "#111401",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
