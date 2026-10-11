/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#1C1917',
        paper: '#FAFAF9',
        accent: '#EA580C',
      },
      fontFamily: {
        display: ['"Saira Condensed"', 'sans-serif'],
        body: ['"Be Vietnam Pro"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
