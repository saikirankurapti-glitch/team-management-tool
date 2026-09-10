/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: {
          DEFAULT: 'var(--canvas-main)',
          secondary: 'var(--canvas-secondary)',
        },
        surface: {
          DEFAULT: 'var(--surface-primary)',
          elevated: 'var(--surface-elevated)',
          secondary: 'var(--surface-secondary)',
          hover: 'var(--surface-hover)',
        },
        ink: {
          DEFAULT: 'var(--ink-primary)',
          secondary: 'var(--ink-secondary)',
          muted: 'var(--ink-muted)',
        },
        borderWarm: {
          DEFAULT: 'var(--border-warm)',
          subtle: 'var(--border-subtle)',
        },
        olive: {
          DEFAULT: 'var(--olive-primary)',
          dark: 'var(--olive-dark)',
          light: 'var(--olive-light)',
        },
        lime: {
          DEFAULT: 'var(--lime-highlight)',
          soft: 'var(--lime-soft)',
        },
        status: {
          success: 'var(--status-success)',
          warning: 'var(--status-warning)',
          error: 'var(--status-error)',
          info: 'var(--status-info)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      letterSpacing: {
        tighter: '-0.04em',
        tight: '-0.02em',
        eyebrow: '0.14em',
      },
      borderRadius: {
        'pill': '9999px',
        'soft': '14px',
        'card': '18px',
        'modal': '22px',
      },
      fontSize: {
        '2xs': '0.65rem',
        'eyebrow': ['0.72rem', { letterSpacing: '0.14em', lineHeight: '1rem' }],
        'display': ['3.5rem', { lineHeight: '0.98', letterSpacing: '-0.04em' }],
        'display-lg': ['4.25rem', { lineHeight: '0.96', letterSpacing: '-0.045em' }],
      },
    },
  },
  plugins: [],
};
