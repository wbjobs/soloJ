/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        cyber: {
          bg: '#0a0e1a',
          panel: 'rgba(15, 23, 42, 0.7)',
          border: 'rgba(34, 211, 238, 0.3)',
          accent: '#22d3ee',
          accentHover: '#06b6d4',
          secondary: '#818cf8',
          warning: '#f59e0b',
          danger: '#ef4444',
          success: '#10b981',
        }
      },
      fontFamily: {
        display: ['Space Grotesk', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        'cyber': '0 0 20px rgba(34, 211, 238, 0.15)',
        'cyber-lg': '0 0 40px rgba(34, 211, 238, 0.25)',
        'cyber-inner': 'inset 0 0 20px rgba(34, 211, 238, 0.1)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(34, 211, 238, 0.5)' },
          '100%': { boxShadow: '0 0 20px rgba(34, 211, 238, 0.8)' },
        }
      }
    },
  },
  plugins: [],
};
