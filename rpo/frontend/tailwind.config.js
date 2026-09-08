/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: "1.25rem", lg: "2rem" },
      screens: { "2xl": "1280px" },
    },
    extend: {
      colors: {
        ink: {
          950: "#050608",
          900: "#08090B",
          800: "#0F1114",
          700: "#16181C",
          600: "#1D2025",
          500: "#2A2E35",
        },
        line: {
          DEFAULT: "rgba(255,255,255,0.06)",
          strong: "rgba(255,255,255,0.10)",
        },
        fg: {
          DEFAULT: "#F4F5F6",
          muted: "#A0A4AB",
          dim: "#6B6F76",
        },
        mint: {
          50: "#E5FFF3",
          100: "#B7FFDE",
          300: "#6EF6C4",
          400: "#3EEFAF",
          500: "#00E38F",
          600: "#00C77D",
          700: "#00A566",
        },
        cream: {
          DEFAULT: "#FBF6E9",
          dim: "#D9D1BC",
        },
        // Back-compat aliases so existing utility classes still work.
        brand: { DEFAULT: "#00E38F", dark: "#00A566" },
        chain: {
          bg: "#08090B",
          panel: "#0F1114",
          border: "rgba(255,255,255,0.06)",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui"],
        display: ["var(--font-display)", "ui-serif", "Georgia"],
        mono: ["var(--font-mono)", "JetBrains Mono", "monospace"],
      },
      fontSize: {
        "display-lg": [
          "clamp(3.25rem, 7vw, 6rem)",
          { lineHeight: "1.02", letterSpacing: "-0.03em" },
        ],
        "display-md": [
          "clamp(2.5rem, 5vw, 4.25rem)",
          { lineHeight: "1.05", letterSpacing: "-0.02em" },
        ],
        "display-sm": [
          "clamp(2rem, 3.5vw, 2.75rem)",
          { lineHeight: "1.1", letterSpacing: "-0.02em" },
        ],
      },
      boxShadow: {
        glow: "0 0 40px -8px rgba(0, 227, 143, 0.35)",
        card:
          "0 0 0 1px rgba(255,255,255,0.06), 0 8px 24px -12px rgba(0,0,0,0.6)",
        floating:
          "0 0 0 1px rgba(255,255,255,0.08), 0 20px 60px -20px rgba(0,0,0,0.8), 0 0 60px -20px rgba(0,227,143,0.15)",
      },
      backgroundImage: {
        "mint-gradient":
          "linear-gradient(135deg, #00E38F 0%, #3EEFAF 100%)",
        "hero-glow":
          "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(0,227,143,0.18), transparent 70%)",
        "cream-glow":
          "radial-gradient(ellipse 40% 30% at 80% 20%, rgba(251,246,233,0.06), transparent 70%)",
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease-out",
        "fade-in-up": "fadeInUp 0.6s ease-out",
        marquee: "marquee 40s linear infinite",
        shimmer: "shimmer 2s linear infinite",
        "pulse-mint": "pulseMint 2.4s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: { "0%": { opacity: 0 }, "100%": { opacity: 1 } },
        fadeInUp: {
          "0%": { opacity: 0, transform: "translateY(12px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        },
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        pulseMint: {
          "0%,100%": { boxShadow: "0 0 0 0 rgba(0,227,143,0.5)" },
          "50%": { boxShadow: "0 0 0 12px rgba(0,227,143,0)" },
        },
      },
    },
  },
  plugins: [],
};
