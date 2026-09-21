/** @type {import('tailwindcss').Config} */
// Explorers design system — the collection showcase.
// The slate ramp + accent blue stay aligned with app/ (trust/clarity blue,
// never neon-DeFi), but this app runs bolder: a fluid display scale, a
// cinematic aurora backdrop, art-frame glows, and purposeful motion. It is a
// public collection page, not the operator console, so it may diverge.
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
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
        // Deep base surfaces for the cinematic showcase (darker than app/'s
        // #0b0f17 body so art and glows carry more contrast).
        void: {
          DEFAULT: '#05070d',
          900: '#070b12',
          800: '#0b1120',
        },
        // A restrained cool highlight used only inside gradients/glows —
        // never as a flat fill (keeps us off neon-DeFi).
        glow: {
          cyan: '#38bdf8',
          indigo: '#818cf8',
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', '"IBM Plex Sans"', 'Inter', 'system-ui', 'sans-serif'],
        heading: ['"Space Grotesk"', '"IBM Plex Sans"', 'Inter', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'Menlo', 'monospace'],
      },
      fontSize: {
        // Fluid display sizes for hero headlines.
        'display-sm': ['clamp(1.9rem, 4vw, 2.75rem)', { lineHeight: '1.05', letterSpacing: '-0.02em' }],
        'display': ['clamp(2.5rem, 6vw, 4.25rem)', { lineHeight: '1.0', letterSpacing: '-0.03em' }],
        'display-lg': ['clamp(3rem, 8vw, 6rem)', { lineHeight: '0.96', letterSpacing: '-0.035em' }],
      },
      letterSpacing: {
        eyebrow: '0.22em',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-accent': 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
        // The signature cinematic backdrop for hero surfaces.
        'aurora':
          'radial-gradient(60% 55% at 15% 8%, rgba(37, 99, 235, 0.22) 0px, transparent 60%),' +
          'radial-gradient(50% 50% at 88% 4%, rgba(129, 140, 248, 0.16) 0px, transparent 55%),' +
          'radial-gradient(70% 60% at 60% 100%, rgba(56, 189, 248, 0.10) 0px, transparent 60%),' +
          'linear-gradient(180deg, #070b12 0%, #05070d 100%)',
        // Gradient used for clip-text display headings.
        'text-gradient': 'linear-gradient(100deg, #f8fafc 0%, #bfdbfe 45%, #93c5fd 100%)',
        'grid-faint':
          'linear-gradient(rgba(148,163,184,0.05) 1px, transparent 1px),' +
          'linear-gradient(90deg, rgba(148,163,184,0.05) 1px, transparent 1px)',
      },
      boxShadow: {
        soft: '0 1px 2px rgba(0, 0, 0, 0.35), 0 4px 16px rgba(0, 0, 0, 0.22)',
        card: '0 4px 24px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(148, 163, 184, 0.06)',
        'card-hover': '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(59, 130, 246, 0.12)',
        innerGlow: 'inset 0 1px 0 rgba(255, 255, 255, 0.04)',
        // Art-frame glow + deep gallery shadow.
        art: '0 24px 70px -20px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(148, 163, 184, 0.08)',
        glow: '0 0 0 1px rgba(59, 130, 246, 0.25), 0 20px 60px -25px rgba(37, 99, 235, 0.55)',
      },
      animation: {
        'pulse-soft': 'pulse-soft 2.8s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        shimmer: 'shimmer 2s linear infinite',
        float: 'float 7s ease-in-out infinite',
        'fade-in': 'fade-in 0.5s ease-out both',
        'fade-up': 'fade-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) both',
        aurora: 'aurora 18s ease-in-out infinite',
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
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(18px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        aurora: {
          '0%, 100%': { transform: 'translate3d(0,0,0) scale(1)', opacity: '0.9' },
          '50%': { transform: 'translate3d(0,-2%,0) scale(1.04)', opacity: '1' },
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
