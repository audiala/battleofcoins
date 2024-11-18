/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        primary: '#f53e98',
        dark: {
          100: '#272727',
          200: '#1e1e1e',
          300: '#121212',
        },
      },
    },
  },
  plugins: [],
} 