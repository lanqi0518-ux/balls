/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: "1.25rem", lg: "2rem" },
      screens: { "2xl": "1280px" },
    },
    extend: {
      colors: {
        // Paper / ivory / off-white surfaces
        paper: {
          DEFAULT: "#FFFFFF",
          50: "#FDFCF9",
          100: "#FAF9F5",
          200: "#F5F3EC",
          300: "#EDEAE0",
        },
        // Ink (text + occasional dark surfaces)
        ink: {
          DEFAULT: "#0A0A0A",
          950: "#050505",
          900: "#0A0A0A",
          800: "#141414",
          700: "#26272B",
          600: "#3A3B41",
          500: "#5C5F66",
          400: "#8A8D93",
          300: "#B4B6BC",
          200: "#D8D9DD",
          100: "#EDEEF0",
        },
        line: {
          DEFAULT: "rgba(10,10,10,0.08)",
          strong: "rgba(10,10,10,0.14)",
          faint: "rgba(10,10,10,0.04)",
        },
        // Forest — institutional primary
        forest: {
          50: "#EEF6F1",
          100: "#D4E6DA",
          200: "#A6CCB1",
          300: "#6EAF83",
          400: "#3A8E5B",
          500: "#0B4D3E",
          600: "#083D31",
          700: "#062E25",
          800: "#04201A",
        },
        // Peach / warm — 3D accent
        peach: {
          50: "#FFF3EE",
          100: "#FFE3D4",
          200: "#FFC6A9",
          300: "#FFA37A",
          400: "#FF7F4D",
          500: "#FF6A3D",
          600: "#E4522B",
        },
        // Cream / vanilla — cards
        cream: {
          DEFAULT: "#FBF6E9",
          dim: "#EFE9D6",
        },
        // Back-compat aliases so any lingering utility classes keep working.
        fg: {
          DEFAULT: "#0A0A0A",
          muted: "#5C5F66",
          dim: "#8A8D93",
        },
        mint: {
          400: "#3A8E5B",
          500: "#0B4D3E",
          600: "#083D31",
        },
        brand: { DEFAULT: "#0B4D3E", dark: "#062E25" },
        chain: {
          bg: "#FFFFFF",
          panel: "#FAF9F5",
          border: "rgba(10,10,10,0.08)",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui"],
        display: ["var(--font-display)", "ui-serif", "Georgia"],
        mono: ["var(--font-mono)", "JetBrains Mono", "monospace"],
      },
      fontSize: {
        "display-lg": [
          "clamp(3.5rem, 8vw, 7rem)",
          { lineHeight: "0.98", letterSpacing: "-0.04em" },
        ],
        "display-md": [
          "clamp(2.5rem, 5.5vw, 4.75rem)",
          { lineHeight: "1.02", letterSpacing: "-0.03em" },
        ],
        "display-sm": [
          "clamp(2rem, 3.5vw, 3rem)",
          { lineHeight: "1.08", letterSpacing: "-0.02em" },
        ],
      },
      boxShadow: {
        // Soft, layered, luxury shadows
        soft: "0 1px 2px rgba(10,10,10,0.04), 0 4px 12px -4px rgba(10,10,10,0.06)",
        card:
          "0 1px 2px rgba(10,10,10,0.05), 0 8px 24px -12px rgba(10,10,10,0.12)",
        floating:
          "0 2px 4px rgba(10,10,10,0.04), 0 20px 50px -20px rgba(10,10,10,0.20), 0 40px 80px -40px rgba(10,10,10,0.15)",
        inset: "inset 0 0 0 1px rgba(10,10,10,0.06)",
        insetStrong: "inset 0 0 0 1px rgba(10,10,10,0.12)",
        // 3D-feeling luxe shadow
        "3d":
          "0 1px 2px rgba(10,10,10,0.06), 0 6px 16px -6px rgba(10,10,10,0.10), 0 40px 80px -40px rgba(255,106,61,0.18)",
      },
      backgroundImage: {
        "mesh-warm":
          "radial-gradient(ellipse 55% 45% at 20% 10%, rgba(255,106,61,0.20), transparent 60%), radial-gradient(ellipse 45% 40% at 85% 20%, rgba(255,195,138,0.22), transparent 60%), radial-gradient(ellipse 45% 40% at 50% 90%, rgba(11,77,62,0.10), transparent 60%)",
        "mesh-cool":
          "radial-gradient(ellipse 45% 40% at 15% 20%, rgba(11,77,62,0.10), transparent 60%), radial-gradient(ellipse 40% 35% at 85% 80%, rgba(255,106,61,0.10), transparent 60%)",
        "paper-noise":
          "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.04 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease-out both",
        "fade-in-up": "fadeInUp 0.6s ease-out both",
        float: "float 14s ease-in-out infinite",
        "float-slow": "float 22s ease-in-out infinite",
        marquee: "marquee 60s linear infinite",
        "spin-slow": "spin 60s linear infinite",
      },
      keyframes: {
        fadeIn: { "0%": { opacity: 0 }, "100%": { opacity: 1 } },
        fadeInUp: {
          "0%": { opacity: 0, transform: "translateY(16px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        },
        float: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-12px)" },
        },
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
      },
    },
  },
  plugins: [],
};
