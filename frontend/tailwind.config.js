/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // VitalStream pastel palette
        'vs-bg':       '#0D1117',
        'vs-surface':  '#161B22',
        'vs-border':   '#30363D',
        'vs-green':    '#3FB950',
        'vs-red':      '#F85149',
        'vs-yellow':   '#D29922',
        'vs-blue':     '#58A6FF',
        'vs-purple':   '#BC8CFF',
        'vs-text':     '#E6EDF3',
        'vs-muted':    '#8B949E',
        // OR status colors
        'or-active':   '#1F6FEB',
        'or-idle':     '#3FB950',
        'or-alert':    '#F85149',
        'or-cleaning': '#D29922',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-alert': 'pulse 1s cubic-bezier(0.4,0,0.6,1) infinite',
        'fade-in':     'fadeIn 0.3s ease-out',
      },
      keyframes: {
        fadeIn: { from: { opacity: 0, transform: 'translateY(4px)' }, to: { opacity: 1, transform: 'translateY(0)' } }
      }
    }
  },
  plugins: [],
}
