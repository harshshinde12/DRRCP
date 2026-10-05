/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#eef6ff', 100: '#d9eaff', 200: '#bcdcff', 300: '#8ec6ff',
          400: '#59a5ff', 500: '#3280fc', 600: '#1c5ff5', 700: '#154ce3',
          800: '#173fb8', 900: '#183892', 950: '#12214f',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgb(16 24 40 / 0.06), 0 1px 3px rgb(16 24 40 / 0.1)',
      },
    },
  },
  plugins: [],
};
