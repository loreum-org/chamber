/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
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
        // Primary accent — restrained institutional blue (trust / clarity)
        accent: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
      },
      fontFamily: {
        heading: ['"IBM Plex Sans"', 'Inter', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'monospace'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(var(--tw-gradient-stops))',
        'gradient-accent': 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
        'gradient-dark': 'linear-gradient(180deg, #151d2e 0%, #0b0f17 100%)',
        // Very subtle depth — no purple / neon spots
        'mesh-gradient':
          'radial-gradient(at 18% 12%, rgba(37, 99, 235, 0.07) 0px, transparent 45%), radial-gradient(at 92% 8%, rgba(37, 99, 235, 0.05) 0px, transparent 42%), radial-gradient(at 50% 88%, rgba(15, 23, 42, 0.5) 0px, transparent 55%)',
      },
      boxShadow: {
        soft: '0 1px 2px rgba(0, 0, 0, 0.35), 0 4px 16px rgba(0, 0, 0, 0.22)',
        card: '0 4px 24px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(148, 163, 184, 0.06)',
        'card-hover': '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(59, 130, 246, 0.12)',
        innerGlow: 'inset 0 1px 0 rgba(255, 255, 255, 0.04)',
      },
      animation: {
        'pulse-soft': 'pulse-soft 2.8s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        shimmer: 'shimmer 2s linear infinite',
        float: 'float 6s ease-in-out infinite',
        'fade-in': 'fade-in 0.5s ease-out',
      },
      keyframes: {
        'pulse-soft': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(37, 99, 235, 0.18)' },
          '50%': { boxShadow: '0 0 24px 2px rgba(37, 99, 235, 0.12)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      borderRadius: {
        '4xl': '2rem',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
