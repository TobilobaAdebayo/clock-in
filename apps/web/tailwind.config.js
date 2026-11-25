/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#EEF3F7',
          100: '#DCE6EE',
          200: '#BCCDDD',
          500: '#34526E',
          600: '#2B465F',
          700: '#21374B',
          900: '#162534',
        },
        surface: {
          canvas: '#F7F9FB',
          card: '#FFFFFF',
          border: '#E6ECF2',
          muted: '#6B7A8C',
        },
      },
    },
  },
  plugins: [],
};
