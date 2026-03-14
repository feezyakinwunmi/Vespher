/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.{js,jsx,ts,tsx}", "./app/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: '#3b82f6',
        accent: '#10b981',
        background: '#0a0a0a',
        card: '#1a1a1a',
        destructive: '#ef4444',
        success: '#10b981',
      },
    },
  },
  plugins: [],
}