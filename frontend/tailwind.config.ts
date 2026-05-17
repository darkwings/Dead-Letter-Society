import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // shadcn/ui base tokens
        background:    'hsl(var(--background) / <alpha-value>)',
        foreground:    'hsl(var(--foreground) / <alpha-value>)',
        card:          'hsl(var(--card) / <alpha-value>)',
        'card-foreground': 'hsl(var(--card-foreground) / <alpha-value>)',
        popover:       'hsl(var(--popover) / <alpha-value>)',
        'popover-foreground': 'hsl(var(--popover-foreground) / <alpha-value>)',
        primary:       'hsl(var(--primary) / <alpha-value>)',
        'primary-foreground': 'hsl(var(--primary-foreground) / <alpha-value>)',
        muted:         'hsl(var(--muted) / <alpha-value>)',
        'muted-foreground': 'hsl(var(--muted-foreground) / <alpha-value>)',
        border:        'hsl(var(--border) / <alpha-value>)',
        input:         'hsl(var(--input) / <alpha-value>)',
        ring:          'hsl(var(--ring) / <alpha-value>)',
        // DLS status colors
        'status-new':              'hsl(var(--status-new) / <alpha-value>)',
        'status-under-review':     'hsl(var(--status-under-review) / <alpha-value>)',
        'status-replayed':         'hsl(var(--status-replayed) / <alpha-value>)',
        'status-discarded':        'hsl(var(--status-discarded) / <alpha-value>)',
        'status-replay-failed':    'hsl(var(--status-replay-failed) / <alpha-value>)',
        'status-new-bg':           'hsl(var(--status-new-bg) / <alpha-value>)',
        'status-under-review-bg':  'hsl(var(--status-under-review-bg) / <alpha-value>)',
        'status-replayed-bg':      'hsl(var(--status-replayed-bg) / <alpha-value>)',
        'status-discarded-bg':     'hsl(var(--status-discarded-bg) / <alpha-value>)',
        'status-replay-failed-bg': 'hsl(var(--status-replay-failed-bg) / <alpha-value>)',
        // Code viewer
        'code-bg':     'hsl(var(--code-bg) / <alpha-value>)',
        'code-fg':     'hsl(var(--code-fg) / <alpha-value>)',
        'code-key':    'hsl(var(--code-key) / <alpha-value>)',
        'code-string': 'hsl(var(--code-string) / <alpha-value>)',
        'code-number': 'hsl(var(--code-number) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Geist', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['Geist Mono', 'JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        DEFAULT: 'var(--radius)',
        sm: 'var(--radius-sm)',
        lg: 'var(--radius-lg)',
      },
    },
  },
}

export default config
