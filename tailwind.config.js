/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        base: {
          950: '#0A0B0F',
          900: '#0D0F16',
          800: '#12151E',
          700: '#171B26',
          600: '#1A1D27',
          500: '#1E2231',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'Menlo', 'monospace'],
        // Hebrew + Latin in one family — used by the Ministry of Health pillar.
        heebo: ['Heebo', 'Inter', 'system-ui', 'sans-serif'],
        // Instrument display face for the API Intercept 2027 console.
        grotesk: ['"Space Grotesk"', 'Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'radar-spin': 'radarSpin 2.4s linear infinite',
        'glow-pulse': 'glowPulse 2s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'scan-line': 'scanLine 2s ease-in-out infinite',
      },
      keyframes: {
        radarSpin: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        glowPulse: {
          '0%, 100%': { opacity: 0.6 },
          '50%': { opacity: 1 },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        scanLine: {
          '0%, 100%': { transform: 'translateY(-100%)', opacity: 0 },
          '50%': { opacity: 1 },
          '100%': { transform: 'translateY(100%)' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        'glow-red': '0 0 20px rgba(239,68,68,0.3), 0 0 60px rgba(239,68,68,0.1)',
        'glow-emerald': '0 0 20px rgba(52,211,153,0.3), 0 0 60px rgba(52,211,153,0.1)',
        'glow-blue': '0 0 20px rgba(59,130,246,0.3), 0 0 60px rgba(59,130,246,0.1)',
        'card': '0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
      },
    },
  },
  plugins: [],
}
