import type { Config } from 'tailwindcss';
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: '#d9e2ec',
        background: '#f7fafc',
        foreground: '#15202b',
        primary: '#146c94',
        accent: '#d9480f',
      },
    },
  },
  plugins: [],
} satisfies Config;
