import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // CSS-variable-driven so each university can override them
        brand: {
          DEFAULT: "rgb(var(--color-brand) / <alpha-value>)",
          light:   "rgb(var(--color-brand-light) / <alpha-value>)",
          dark:    "rgb(var(--color-brand-dark) / <alpha-value>)",
        },
        cream:   "var(--color-cream)",
        agslate: "#0F172A",
        yellow: {
          accent: "#EAB308",
        },
      },
      fontFamily: {
        sans: ["var(--font-body)", "system-ui", "-apple-system", "sans-serif"],
        display: ["var(--font-display)", "var(--font-body)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
