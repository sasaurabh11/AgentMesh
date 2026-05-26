import type { Config } from 'tailwindcss';
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:       '#0f1724',
        surface:  '#162030',
        card:     '#1c2c42',
        'card-hover': '#223450',
        border:   '#2e4565',
        'border-light': '#3d5a80',
        foreground: '#eaf2ff',
        subtle:   '#ccddf5',
        muted:    '#90aecb',
        'muted-light': '#aec6e0',
        primary:  '#4f8ef7',
        'primary-light': '#76aaff',
        'primary-dark': '#2d6edc',
        violet:   '#8b5cf6',
        accent:   '#f97316',
        success:  '#22c55e',
        warning:  '#f59e0b',
        danger:   '#ef4444',
        cyan:     '#06b6d4',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        glow:         '0 0 24px rgba(79,142,247,0.35)',
        'glow-sm':    '0 0 12px rgba(79,142,247,0.2)',
        'glow-violet':'0 0 20px rgba(139,92,246,0.3)',
        card:         '0 2px 16px rgba(0,0,0,0.25)',
        'card-hover': '0 6px 28px rgba(0,0,0,0.35)',
      },
      backgroundImage: {
        'gradient-primary':  'linear-gradient(135deg,#4f8ef7,#8b5cf6)',
        'gradient-cyan':     'linear-gradient(135deg,#06b6d4,#4f8ef7)',
        'gradient-orange':   'linear-gradient(135deg,#f97316,#ef4444)',
        'gradient-green':    'linear-gradient(135deg,#22c55e,#06b6d4)',
        'gradient-card':     'linear-gradient(135deg,rgba(79,142,247,0.06),rgba(139,92,246,0.03))',
      },
      animation: {
        'fade-in':   'fadeIn 0.2s ease-out',
        'slide-up':  'slideUp 0.3s ease-out',
        'slide-in':  'slideIn 0.25s ease-out',
        shimmer:     'shimmer 1.5s infinite',
      },
      keyframes: {
        fadeIn:  { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(16px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        slideIn: { from: { opacity: '0', transform: 'translateX(-8px)' }, to: { opacity: '1', transform: 'translateX(0)' } },
        shimmer: { from: { backgroundPosition: '-200% 0' }, to: { backgroundPosition: '200% 0' } },
      },
    },
  },
  plugins: [],
} satisfies Config;
