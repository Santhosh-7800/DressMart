/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#131921',
          50: '#f4f5f6',
          100: '#e4e6e9',
          200: '#c5c9d0',
          300: '#9ba2ae',
          400: '#6b7383',
          500: '#4a5261',
          600: '#363c48',
          700: '#262b35',
          800: '#1a1f28',
          900: '#131921',
          950: '#0b0e13',
        },
        accent: {
          DEFAULT: '#FF9900',
          50: '#fff8ec',
          100: '#ffedcc',
          200: '#ffd894',
          300: '#ffbd5c',
          400: '#ffa42e',
          500: '#FF9900',
          600: '#db7d00',
          700: '#b56303',
          800: '#924e0a',
          900: '#78420c',
        },
        surface: {
          DEFAULT: '#F8F8F8',
          dark: '#0f1115',
        },
        card: {
          DEFAULT: '#FFFFFF',
          dark: '#1a1d24',
        },
        // Dedicated palette for the customer account section redesign — additive, so it never
        // touches the meaning of `primary`/`accent` used across the rest of the app.
        'acc-primary': { DEFAULT: '#FF6B00', dark: '#e05f00' },
        'acc-secondary': '#FF8A00',
        'acc-bg': { DEFAULT: '#F8F9FB', dark: '#0f1115' },
        'acc-border': { DEFAULT: '#E5E7EB', dark: '#2a2f3a' },
        'acc-text': { DEFAULT: '#1F2937', dark: '#F3F4F6' },
        'acc-text-secondary': '#6B7280',
        'acc-success': '#16A34A',
        'acc-warning': '#F59E0B',
        'acc-danger': '#DC2626',
        // Dedicated palette for the admin panel's premium redesign — additive, scoped entirely
        // under `.admin-panel` in index.css, so it never touches `primary`/`accent`/`acc-*` used
        // by the customer storefront and account section.
        admin: {
          bg: '#F8FAFC',
          navy: '#111827',
          border: '#E5E7EB',
          text: '#111827',
          'text-secondary': '#6B7280',
          success: '#16A34A',
          warning: '#F59E0B',
          danger: '#DC2626',
          orange: { DEFAULT: '#FF6B00', light: '#FF8A00', hover: '#EA580C' },
          'table-header': '#FFF7ED',
          'table-hover': '#FFF4E6',
          'row-border': '#F1F5F9',
          'icon-inactive': '#9CA3AF',
          'text-inactive': '#D1D5DB',
          'input-border': '#D1D5DB',
          placeholder: '#9CA3AF',
        },
      },
      fontFamily: {
        sans: ['Poppins', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.25rem',
      },
      boxShadow: {
        soft: '0 2px 10px 0 rgba(19, 25, 33, 0.06)',
        card: '0 4px 20px 0 rgba(19, 25, 33, 0.08)',
        popover: '0 8px 30px 0 rgba(19, 25, 33, 0.15)',
      },
      keyframes: {
        'fade-in': { from: { opacity: 0 }, to: { opacity: 1 } },
        'slide-up': { from: { opacity: 0, transform: 'translateY(12px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out',
        'slide-up': 'slide-up 0.35s ease-out',
        shimmer: 'shimmer 1.5s infinite',
      },
    },
  },
  plugins: [],
};
