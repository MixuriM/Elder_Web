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
      fontFamily: {
        sans: ['"Atkinson Hyperlegible"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },

  plugins: [],
}