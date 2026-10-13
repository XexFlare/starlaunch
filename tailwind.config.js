/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        space: {
          950: '#04050c',
          900: '#070a16',
          800: '#0b0f20',
          700: '#11162b',
          600: '#181f3a'
        },
        nebula: {
          purple: '#6d5adf',
          blue: '#4b9fe0',
          teal: '#2dd4bf',
          pink: '#e879f9'
        },
        status: {
          running: '#34d399',
          stopped: '#f87171',
          starting: '#fb923c',
          building: '#60a5fa'
        }
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace']
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(255,255,255,0.06), 0 8px 30px rgba(0,0,0,0.5)',
        'glow-green': '0 0 20px rgba(52,211,153,0.35)',
        'glow-blue': '0 0 20px rgba(75,159,224,0.35)',
        'glow-purple': '0 0 24px rgba(109,90,223,0.35)'
      },
      backdropBlur: {
        xs: '2px'
      },
      keyframes: {
        'pulse-soft': {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.55 }
        },
        rise: {
          '0%': { opacity: 0, transform: 'translateY(6px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' }
        }
      },
      animation: {
        'pulse-soft': 'pulse-soft 2.4s ease-in-out infinite',
        rise: 'rise 0.25s ease-out'
      }
    }
  },
  plugins: []
}
