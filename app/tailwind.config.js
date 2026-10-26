/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Flat surfaces: depth comes from layering these, not from shadows.
        surface: {
          0: '#0b0f17',
          1: '#10151f',
          2: '#151b28',
          3: '#1b2232',
          4: '#222a3c',
        },
        line: {
          DEFAULT: 'rgba(148, 163, 184, 0.14)',
          strong: 'rgba(148, 163, 184, 0.26)',
        },
        // Neutral slate tuned for dark UI readability
        slate: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          850: '#172033',
          900: '#0f172a',
          950: '#020617',
        },
        // Primary accent — Chamber Purple (Chamber Design System v1.0)
        // Interactive + governance weight only.
        accent: {
          50: '#f5f2fb',
          100: '#ebe5f3',
          200: '#dcd5ee',
          300: '#c3a8ff',
          400: '#a685f5',
          500: '#7c5cd6',
          600: '#4a2f8f',
          700: '#3b2473',
          800: '#2e1c5c',
          900: '#221445',
          950: '#160c2e',
        },
      },
      fontFamily: {
        heading: ['"IBM Plex Sans"', 'Inter', 'system-ui', 'sans-serif'],
        sans: ['"IBM Plex Sans"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', '"JetBrains Mono"', 'Menlo', 'monospace'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        // Decorative gradients are retired; keys stay so stray call sites render flat.
        'gradient-accent': 'none',
        'gradient-dark': 'none',
        'mesh-gradient': 'none',
      },
      boxShadow: {
        soft: 'none',
        card: 'none',
        'card-hover': 'none',
        innerGlow: 'none',
      },
      animation: {
        'fade-in': 'fade-in 0.25s ease-out',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
