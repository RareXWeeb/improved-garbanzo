/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,html}",
    "./*.html"
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        cinema: {
          950: '#09090b', // Deepest background (zinc-950)
          900: '#111113', // Card surface
          850: '#17171a', // Hover / elevated surface
          800: '#212124', // Border subtle
          750: '#27272a', // Standard border (zinc-800)
          700: '#323236', // Active border
          600: '#52525b', // Muted text
          500: '#71717a', // Placeholder
          400: '#a1a1aa', // Secondary text (zinc-400)
          accent: '#ffffff', // Clean, crisp white primary accent
          'accent-hover': '#e4e4e7',
          gold: '#e5a93b', // Restrained warm gold for status only
        }
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'Inter', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
