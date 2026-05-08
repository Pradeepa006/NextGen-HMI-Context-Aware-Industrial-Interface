/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'hmi-dark': '#080c14',
        'hmi-darker': '#050810',
        'hmi-panel': '#0f1724',
        'hmi-surface': '#141e2e',
        'hmi-border': '#1c2840',
        'hmi-border-light': '#2a3a52',
        'hmi-critical': '#ef4444',
        'hmi-warning': '#f59e0b',
        'hmi-normal': '#10b981',
        'hmi-info': '#3b82f6',
        'hmi-purple': '#8b5cf6',
        'hmi-cyan': '#06b6d4',
      },
      animation: {
        'pulse-critical': 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.4s ease-out',
      },
      boxShadow: {
        'glow-blue': '0 0 15px rgba(59, 130, 246, 0.3)',
        'glow-red': '0 0 15px rgba(239, 68, 68, 0.3)',
        'glow-green': '0 0 15px rgba(16, 185, 129, 0.3)',
      }
    },
  },
  plugins: [],
}
