/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,vue}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        primary: "#0ea5e9",
        success: "#10b981",
        warning: "#f59e0b",
        danger: "#ef4444",
        dark: {
          900: "#0f172a",
          800: "#1e293b",
          700: "#334155",
        }
      },
      fontFamily: {
        orbitron: ['Orbitron', 'sans-serif'],
        inter: ['Inter', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 3s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'breathe': 'breathe 2s ease-in-out infinite',
        'alert-pulse': 'alertPulse 1s ease-in-out infinite',
        'alert-flash': 'alertFlash 1.5s ease-in-out infinite',
        'sweep': 'sweep 2s linear infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(14, 165, 233, 0.5)' },
          '100%': { boxShadow: '0 0 20px rgba(14, 165, 233, 0.8)' },
        },
        breathe: {
          '0%, 100%': { 
            boxShadow: '0 0 5px rgba(239, 68, 68, 0.3)',
            borderColor: 'rgba(239, 68, 68, 0.5)'
          },
          '50%': { 
            boxShadow: '0 0 20px rgba(239, 68, 68, 0.6)',
            borderColor: 'rgba(239, 68, 68, 0.8)'
          },
        },
        alertPulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        alertFlash: {
          '0%, 100%': { 
            boxShadow: '0 0 10px rgba(239, 68, 68, 0.4)',
          },
          '25%': { 
            boxShadow: '0 0 30px rgba(239, 68, 68, 0.8)',
          },
          '50%': { 
            boxShadow: '0 0 20px rgba(239, 68, 68, 0.6)',
          },
          '75%': { 
            boxShadow: '0 0 35px rgba(239, 68, 68, 0.9)',
          },
        },
        sweep: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        }
      }
    },
  },
  plugins: [],
};
