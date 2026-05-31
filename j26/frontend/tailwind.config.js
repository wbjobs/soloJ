/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'editor-bg': '#1e1e1e',
        'editor-line': '#264f78',
        'editor-breakpoint': '#e51400',
        'debug-panel': '#252526',
        'debug-hover': '#2a2d2e',
        'accent-blue': '#007acc',
        'accent-green': '#4ec9b0',
        'accent-yellow': '#dcdcaa',
      },
      fontFamily: {
        'mono': ['Consolas', 'Monaco', 'monospace'],
      },
    },
  },
  plugins: [],
}
