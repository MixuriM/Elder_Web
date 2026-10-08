/** @type {import('tailwindcss').Config} */

export default {
  // Permite controlar o modo escuro pela classe "dark"
  darkMode: 'class',

  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}'
  ],

  theme: {
    extend: {
      keyframes: {
        'check-entrada': {
          from: { transform: 'scale(0.8)', opacity: '0' },
          to: { transform: 'scale(1)', opacity: '1' },
        },
      },
      animation: {
        'check-entrada': 'check-entrada 250ms cubic-bezier(0.2, 0, 0, 1)',
      },
      fontFamily: {
        sans: ['"Atkinson Hyperlegible"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },

  plugins: [],
}