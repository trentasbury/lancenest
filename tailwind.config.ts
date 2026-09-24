import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: '#102431', deep: '#071821', soft: '#1d3444' },
        cream: '#f4f0e7',
        paper: '#fbfaf6',
        ivory: '#fffdf8',
        brass: { DEFAULT: '#b9975b', light: '#d9c9a8', dark: '#8c7040' },
        ink: '#182d3b',
        muted: '#64717a',
        line: '#d9d5ca',
        olive: '#4f5b4a',
        charcoal: '#2b2f33',
        signal: '#8f2d2d',
      },
      fontFamily: {
        serif: ['"Cormorant Garamond"', 'Georgia', '"Times New Roman"', 'serif'],
        sans: ['Inter', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      letterSpacing: { eyebrow: '0.26em', wordmark: '0.18em' },
      boxShadow: {
        card: '0 1px 2px rgba(7,24,33,0.05), 0 10px 30px rgba(7,24,33,0.06)',
        lift: '0 18px 44px rgba(7,24,33,0.28)',
      },
    },
  },
  plugins: [],
};

export default config;
