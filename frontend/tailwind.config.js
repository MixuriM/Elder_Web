/** @type {import('tailwindcss').Config} */

export default {
  // Permite controlar o modo escuro pela classe "dark"
  darkMode: 'class',

  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}'
  ],

  theme: {
    extend: {},
  },

  plugins: [],
}