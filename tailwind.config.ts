// tailwind.config.ts
import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      /* add Halenoir + keep your Apple/system stack */
      fontFamily: {
        halenoir: ['"Halenoir Expanded"', "ui-sans-serif", "system-ui", "sans-serif"],
        sans: [
          "-apple-system",
          "SF Pro Text",
          "SF Pro Display",
          "Inter var",
          "Inter",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "ui-sans-serif",
          "system-ui",
        ],
      },

      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        zolvio: {
          purple: "#7323E5",
          "light-purple": "#8e46f5",
          "purple-hover": "#6019c5",
          "light-bg": "#f9f7ff",
        },
        // Flashcard specific colors
        flashcard: {
          blue: {
            50: "#eff6ff",
            100: "#dbeafe",
            200: "#bfdbfe",
            300: "#93c5fd",
            400: "#60a5fa",
            500: "#3b82f6",
            600: "#2563eb",
            700: "#1d4ed8",
            800: "#1e40af",
            900: "#1e3a8a",
          },
          emerald: {
            50: "#ecfdf5",
            100: "#d1fae5",
            200: "#a7f3d0",
            300: "#6ee7b7",
            400: "#34d399",
            500: "#10b981",
            600: "#059669",
            700: "#047857",
            800: "#065f46",
            900: "#064e3b",
          },
          amber: {
            50: "#fffbeb",
            100: "#fef3c7",
            200: "#fde68a",
            300: "#fcd34d",
            400: "#fbbf24",
            500: "#f59e0b",
            600: "#d97706",
            700: "#b45309",
            800: "#92400e",
            900: "#78350f",
          },
        },
      },

      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        "3xl": "1.5rem",
        "4xl": "2rem",
      },

      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-out": {
          "0%": { opacity: "1", transform: "translateY(0)" },
          "100%": { opacity: "0", transform: "translateY(10px)" },
        },
        // FLASHCARD ANIMATIONS - ADDED
        "blob": {
          "0%": { transform: "translate(0px, 0px) scale(1)" },
          "33%": { transform: "translate(30px, -50px) scale(1.1)" },
          "66%": { transform: "translate(-20px, 20px) scale(0.9)" },
          "100%": { transform: "translate(0px, 0px) scale(1)" },
        },
        "slide-in": {
          from: { opacity: "0", transform: "translateY(30px) scale(0.97)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "flip-hint": {
          "0%, 100%": { transform: "scale(1)", opacity: "0.7" },
          "50%": { transform: "scale(1.05)", opacity: "1" },
        },
        "success-pop": {
          "0%": { transform: "scale(0)", opacity: "0" },
          "70%": { transform: "scale(1.2)" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "float": {
          "0%, 100%": { transform: "translateY(0) rotate(0deg)" },
          "50%": { transform: "translateY(-20px) rotate(5deg)" },
        },
        "card-flip": {
          "0%": { transform: "rotateY(0deg)" },
          "100%": { transform: "rotateY(180deg)" },
        },
        "pulse-subtle": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
        "shimmer": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        "bounce-subtle": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-5px)" },
        },
        "progress-ring": {
          "0%": { strokeDashoffset: "264" },
          "100%": { strokeDashoffset: "0" },
        },
      },

      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.3s ease-out",
        // FLASHCARD ANIMATIONS - ADDED
        "blob": "blob 7s infinite",
        "slide-in": "slide-in 0.7s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards",
        "flip-hint": "flip-hint 2s ease-in-out infinite",
        "success-pop": "success-pop 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards",
        "float": "float 6s ease-in-out infinite",
        "card-flip": "card-flip 0.7s cubic-bezier(0.23, 1, 0.32, 1) forwards",
        "pulse-subtle": "pulse-subtle 2s ease-in-out infinite",
        "shimmer": "shimmer 2s infinite",
        "bounce-subtle": "bounce-subtle 0.5s ease-in-out infinite",
        "progress-ring": "progress-ring 1s ease-out forwards",
      },

      // Additional extensions for flashcards
      backdropBlur: {
        xs: "2px",
        sm: "4px",
        md: "8px",
        lg: "12px",
        xl: "16px",
        "2xl": "24px",
      },

      boxShadow: {
        'glass': "0 20px 50px rgba(15, 23, 42, 0.12)",
        'glass-lg': "0 30px 70px rgba(15, 23, 42, 0.22)",
        'glass-xl': "0 40px 80px rgba(15, 23, 42, 0.3)",
        'inner-glow': "inset 0 2px 4px 0 rgba(255, 255, 255, 0.1)",
        'button-glow': "0 12px 30px rgba(37, 99, 235, 0.45)",
        'button-glow-hover': "0 18px 40px rgba(37, 99, 235, 0.6)",
        'card-hover': "0 18px 34px rgba(15, 23, 42, 0.14)",
        'subject-card': "0 10px 24px rgba(15, 23, 42, 0.18)",
      },

      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'gradient-card': 'linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)',
        'gradient-card-back': 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
        'gradient-subject': 'linear-gradient(135deg, rgba(56, 189, 248, 0.9), rgba(37, 99, 235, 0.9))',
        'gradient-accent': 'linear-gradient(135deg, #8b5cf6 0%, #d946ef 100%)',
        'gradient-success': 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      },

      perspective: {
        '1200': '1200px',
        '1500': '1500px',
        '2000': '2000px',
      },

      // Custom spacing for flashcards
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
        '30': '7.5rem',
        '42': '10.5rem',
        '84': '21rem',
        '88': '22rem',
        '96': '24rem',
      },

      // Custom max-width for cards
      maxWidth: {
        'card': '28rem',
        'card-lg': '32rem',
        'card-xl': '36rem',
      },

      // Custom min-height
      minHeight: {
        'card': '20rem',
        'card-lg': '24rem',
        'card-xl': '28rem',
      },

      // Custom z-index
      zIndex: {
        '60': '60',
        '70': '70',
        '80': '80',
        '90': '90',
        '100': '100',
      },

      // Custom opacity
      opacity: {
        '15': '0.15',
        '35': '0.35',
        '65': '0.65',
        '85': '0.85',
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"),
    // Custom plugin for flashcard utilities
    function({ addUtilities }) {
      const newUtilities = {
        '.backface-hidden': {
          'backface-visibility': 'hidden',
        },
        '.preserve-3d': {
          'transform-style': 'preserve-3d',
        },
        '.text-stroke': {
          '-webkit-text-stroke': '1px currentColor',
          'text-stroke': '1px currentColor',
        },
        '.text-gradient-clip': {
          '-webkit-background-clip': 'text',
          'background-clip': 'text',
          '-webkit-text-fill-color': 'transparent',
        },
        '.glass-effect': {
          'background': 'rgba(255, 255, 255, 0.9)',
          'backdrop-filter': 'blur(16px)',
          '-webkit-backdrop-filter': 'blur(16px)',
          'border': '1px solid rgba(255, 255, 255, 0.6)',
        },
      }
      addUtilities(newUtilities)
    }
  ],
} satisfies Config;