import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // ─── Legacy shadcn tokens (kept for existing components) ───
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
        },
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        sidebar: {
          DEFAULT: "var(--sidebar)",
          foreground: "var(--sidebar-foreground)",
          primary: "var(--sidebar-primary)",
          "primary-foreground": "var(--sidebar-primary-foreground)",
          accent: "var(--sidebar-accent)",
          "accent-foreground": "var(--sidebar-accent-foreground)",
          border: "var(--sidebar-border)",
          ring: "var(--sidebar-ring)",
        },

        // ─── Material Design 3 — "Gamified Atelier" ───
        "primary-fixed": "var(--md-primary-fixed)",
        "primary-fixed-dim": "var(--md-primary-fixed-dim)",
        "primary-dim": "var(--md-primary-dim)",
        "primary-container": "var(--md-primary-container)",
        "on-primary": "var(--md-on-primary)",
        "on-primary-container": "var(--md-on-primary-container)",
        "on-primary-fixed": "var(--md-on-primary-fixed)",
        "on-primary-fixed-variant": "var(--md-on-primary-fixed-variant)",
        "inverse-primary": "var(--md-inverse-primary)",

        "secondary-fixed": "var(--md-secondary-fixed)",
        "secondary-fixed-dim": "var(--md-secondary-fixed-dim)",
        "secondary-dim": "var(--md-secondary-dim)",
        "secondary-container": "var(--md-secondary-container)",
        "on-secondary": "var(--md-on-secondary)",
        "on-secondary-container": "var(--md-on-secondary-container)",
        "on-secondary-fixed": "var(--md-on-secondary-fixed)",
        "on-secondary-fixed-variant": "var(--md-on-secondary-fixed-variant)",

        tertiary: "var(--md-tertiary)",
        "tertiary-fixed": "var(--md-tertiary-fixed)",
        "tertiary-fixed-dim": "var(--md-tertiary-fixed-dim)",
        "tertiary-dim": "var(--md-tertiary-dim)",
        "tertiary-container": "var(--md-tertiary-container)",
        "on-tertiary": "var(--md-on-tertiary)",
        "on-tertiary-container": "var(--md-on-tertiary-container)",
        "on-tertiary-fixed": "var(--md-on-tertiary-fixed)",
        "on-tertiary-fixed-variant": "var(--md-on-tertiary-fixed-variant)",

        surface: "var(--md-surface)",
        "surface-dim": "var(--md-surface-dim)",
        "surface-bright": "var(--md-surface-bright)",
        "surface-variant": "var(--md-surface-variant)",
        "surface-tint": "var(--md-surface-tint)",
        "surface-container": "var(--md-surface-container)",
        "surface-container-low": "var(--md-surface-container-low)",
        "surface-container-lowest": "var(--md-surface-container-lowest)",
        "surface-container-high": "var(--md-surface-container-high)",
        "surface-container-highest": "var(--md-surface-container-highest)",
        "on-surface": "var(--md-on-surface)",
        "on-surface-variant": "var(--md-on-surface-variant)",
        "inverse-surface": "var(--md-inverse-surface)",
        "inverse-on-surface": "var(--md-inverse-on-surface)",
        "on-background": "var(--md-on-background)",

        "md-error": "var(--md-error)",
        "error-dim": "var(--md-error-dim)",
        "error-container": "var(--md-error-container)",
        "on-error": "var(--md-on-error)",
        "on-error-container": "var(--md-on-error-container)",

        outline: "var(--md-outline)",
        "outline-variant": "var(--md-outline-variant)",
      },
      fontFamily: {
        sans: ["var(--font-tajawal)", "Tajawal", "Inter", "system-ui", "sans-serif"],
        headline: ["'Plus Jakarta Sans'", "var(--font-tajawal)", "Tajawal", "system-ui", "sans-serif"],
        body: ["Inter", "var(--font-tajawal)", "Tajawal", "system-ui", "sans-serif"],
      },
      borderRadius: {
        sm: "calc(var(--radius) - 4px)",
        md: "calc(var(--radius) - 2px)",
        lg: "2rem",
        xl: "3rem",
      },
      boxShadow: {
        "ambient-glow": "0 10px 40px 0 rgba(44, 47, 51, 0.05)",
        "primary-glow": "0 0 10px 0 rgba(129, 28, 217, 0.25)",
        "primary-glow-lg": "0 10px 40px -10px rgba(129, 28, 217, 0.4)",
      },
      backdropBlur: {
        xs: "2px",
      },
      keyframes: {
        "spring-in": {
          "0%": { transform: "scale(0.95)", opacity: "0" },
          "60%": { transform: "scale(1.02)", opacity: "1" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        wave: {
          "0%, 100%": { transform: "rotate(0deg)" },
          "50%": { transform: "rotate(20deg)" },
        },
      },
      animation: {
        "spring-in": "spring-in 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55)",
        wave: "wave 1.5s ease-in-out infinite",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};
export default config;
