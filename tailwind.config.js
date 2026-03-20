/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Manrope', 'sans-serif'],
        display: ['Sora', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 12px 30px -18px rgba(15, 23, 42, 0.65)',
        glow: '0 20px 50px -24px rgba(56, 189, 248, 0.55)',
      },
    },
  },
  plugins: [],
};
