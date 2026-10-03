/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f4ff',
          100: '#e0e9fe',
          200: '#c7d7fe',
          300: '#9cbafd',
          400: '#6892fb',
          500: '#3b6ef6',
          600: '#1d4ed8',
          700: '#000080', // Core Navy
          800: '#000066', // Deep Navy
          900: '#00004d',
          950: '#000033',
        },
        navy: {
          DEFAULT: '#000080',
          hover: '#000066',
          dark: '#00004d',
          light: '#1d4ed8',
        },
        silver: {
          DEFAULT: '#C0C0C0',
          50: '#fcfcfd',
          100: '#f4f5f7',
          200: '#e4e7eb',
          300: '#d1d5db',
          400: '#C0C0C0',
          500: '#9e9e9e',
        },
        dark: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#030712',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Outfit', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
