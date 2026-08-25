/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'es-bg': '#0e0e10',
        'es-surface': '#16161a',
        'es-surface-2': '#1e1e24',
        'es-border': '#2a2a2e',
        'es-accent': '#7c6af7',
        'es-accent-dim': '#5a4ed4',
        'es-text': '#e8e8f0',
        'es-text-muted': '#a0a0b0',
        'es-green': '#4ade80',
        'es-red': '#f87171',
        'es-yellow': '#facc15',
        'es-blue': '#60a5fa',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
