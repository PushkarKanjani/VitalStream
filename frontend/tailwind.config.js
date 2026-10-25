/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // ── Light pastel clinical palette ────────────────────────────────────
        'vs-bg':        '#F7F8FA',   // warm off-white page background
        'vs-surface':   '#FFFFFF',   // card surfaces
        'vs-border':    '#E4E7EE',   // subtle borders
        'vs-border-soft':'#EEF0F5',  // very subtle dividers

        // Status — muted, clinically readable (not neon)
        'vs-green':     '#2D9B6F',   // sage green — healthy/ok
        'vs-green-bg':  '#EBF7F3',   // sage tint
        'vs-red':       '#C7344C',   // rose red — critical
        'vs-red-bg':    '#FDF0F2',   // rose tint
        'vs-amber':     '#B07A20',   // warm amber — warning
        'vs-amber-bg':  '#FDF6E8',   // amber tint
        'vs-blue':      '#2563EB',   // calm blue — active/primary
        'vs-blue-bg':   '#EEF4FF',   // blue tint
        'vs-purple':    '#6B46C1',   // soft purple — info
        'vs-purple-bg': '#F3EFFC',   // purple tint

        // Text hierarchy
        'vs-text':      '#1A1D27',   // near-black primary text
        'vs-text-2':    '#4B5263',   // secondary text
        'vs-muted':     '#8890A4',   // muted / labels
        'vs-placeholder':'#B0B9CC',  // placeholder text

        // OR status backgrounds (pastel tints)
        'or-active':    '#EEF4FF',
        'or-alert':     '#FDF0F2',
        'or-idle':      '#F7F8FA',
        'or-cleaning':  '#FDF6E8',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'card':  '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.05)',
        'modal': '0 20px 50px rgba(0,0,0,0.14)',
      },
      animation: {
        'pulse-alert': 'pulseAlert 2s ease-in-out infinite',
        'fade-in':     'fadeIn 0.2s ease-out',
        'slide-up':    'slideUp 0.25s ease-out',
      },
      keyframes: {
        fadeIn:     { from: { opacity: 0 },                          to: { opacity: 1 } },
        slideUp:    { from: { opacity: 0, transform: 'translateY(6px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        pulseAlert: { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.5 } },
      }
    }
  },
  plugins: [],
}
