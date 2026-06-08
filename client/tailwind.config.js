/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#f9f3fb',
          100: '#f1e5f6',
          200: '#e3cced',
          300: '#cfaae0',
          400: '#c8a0c4',
          500: '#aa78a6',
          600: '#8c5a88',
          700: '#724578',
          800: '#5a3560',
          900: '#3e3264',
          950: '#2d3047',
        },
        surface: {
          DEFAULT: '#15162a',
          mid:     '#1e1f38',
          card:    '#242538',
          border:  'rgba(170,120,166,0.15)',
          hover:   'rgba(170,120,166,0.08)',
        },
      },
      fontFamily: {
        sans:    ['Inter', 'system-ui', 'sans-serif'],
        display: ['Cal Sans', 'Inter', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-brand':  'linear-gradient(135deg, #aa78a6, #7a5090, #3e3264)',
        'glass':           'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
      },
      animation: {
        'float':      'float 6s ease-in-out infinite',
        'pulse-glow': 'pulse-glow 2.5s ease-in-out infinite',
        'slide-up':   'slide-up 0.5s ease-out',
        'fade-in':    'fade-in 0.4s ease-out',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(-10px)' },
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 20px rgba(170,120,166,0.3)' },
          '50%':      { boxShadow: '0 0 40px rgba(170,120,166,0.6)' },
        },
        'slide-up': {
          from: { opacity: 0, transform: 'translateY(20px)' },
          to:   { opacity: 1, transform: 'translateY(0)' },
        },
        'fade-in': {
          from: { opacity: 0 },
          to:   { opacity: 1 },
        },
      },
      backdropBlur: { xs: '2px' },
    },
  },
  plugins: [],
};
