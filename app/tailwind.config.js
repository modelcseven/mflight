/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Saira Condensed"', 'Manrope', 'sans-serif'],
        race: ['"Saira Condensed"', 'sans-serif'],
        sans: ['Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        navy: {
          950: '#0A0F1E',
          900: '#101A30',
          800: '#1A2540',
        },
        'bmw-blue': {
          DEFAULT: 'rgb(var(--brand) / <alpha-value>)',
          dark: 'rgb(var(--brand-dark) / <alpha-value>)',
        },
        'bmw-blue-light': 'rgb(var(--brand-light) / <alpha-value>)',
        'm-red': {
          DEFAULT: 'rgb(var(--m-red) / <alpha-value>)',
          dark: '#B00500',
          light: 'rgb(var(--m-red-light) / <alpha-value>)',
        },
        sky: 'rgb(var(--sky-c) / <alpha-value>)',
        gold: {
          DEFAULT: 'rgb(var(--gold) / <alpha-value>)',
          dark: 'rgb(var(--gold-dark) / <alpha-value>)',
          light: 'rgb(var(--gold-light) / <alpha-value>)',
        },
        hot: {
          DEFAULT: 'rgb(var(--hot) / <alpha-value>)',
          on: 'rgb(var(--on-hot) / <alpha-value>)',
        },
        surface: {
          DEFAULT: 'rgb(var(--surface) / <alpha-value>)',
          2: 'rgb(var(--surface-2) / <alpha-value>)',
        },
        line: 'rgb(var(--line) / <alpha-value>)',
        navbar: 'rgb(var(--navbar) / <alpha-value>)',
        silver: {
          DEFAULT: '#C0C6CE',
          dark: '#8A919B',
          light: 'rgb(var(--silver-light) / <alpha-value>)',
        },
        'bg-app': 'rgb(var(--bg-app) / <alpha-value>)',
        ink: {
          DEFAULT: 'rgb(var(--ink) / <alpha-value>)',
          dark: 'rgb(var(--ink-dark) / <alpha-value>)',
          muted: 'rgb(var(--ink-muted) / <alpha-value>)',
          faint: 'rgb(var(--ink-faint) / <alpha-value>)',
        },
        success: '#22c55e',
        warning: '#D97706',
        danger: '#DC2626',
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
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
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
      },
      borderRadius: {
        xl: "calc(var(--radius) + 4px)",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xs: "calc(var(--radius) - 6px)",
      },
      boxShadow: {
        xs: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
        card: "0 1px 2px rgba(16,24,40,0.04), 0 8px 24px -12px rgba(16,24,40,0.12)",
        elevated: "0 24px 60px -20px rgba(10,15,30,0.25), inset 0 1px 0 rgba(255,255,255,0.9)",
        modal: "0 24px 60px -20px rgba(10,15,30,0.25)",
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
        "caret-blink": {
          "0%,70%,100%": { opacity: "1" },
          "20%,50%": { opacity: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "caret-blink": "caret-blink 1.25s ease-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}