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
        genome: {
          blue: '#165DFF',
          'blue-light': '#4080FF',
          'blue-dark': '#0E42D2',
          green: '#00B42A',
          red: '#F53F3F',
          orange: '#FF7D00',
          bg: '#0A0E1A',
          surface: '#111827',
          'surface-2': '#1F2937',
          border: '#374151',
          text: '#F3F4F6',
          'text-muted': '#9CA3AF',
          'text-dim': '#6B7280',
        }
      },
      fontFamily: {
        sans: ['Noto Sans SC', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
