const plugin = require('tailwindcss/plugin');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.tsx', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#2E5A27',
          50:  '#EEF4EC',
          100: '#D4E4D0',
          200: '#A8C8A0',
          300: '#7AAB72',
          400: '#528548',
          500: '#2E5A27',
          600: '#1F3D1B',
          700: '#183016',
          800: '#112410',
          900: '#0A160A',
        },
        accent: {
          DEFAULT: '#B8D94A',
          50:  '#F5FAE8',
          100: '#E7F3C1',
          200: '#D6EB96',
          300: '#C6E36A',
          400: '#B8D94A',
          500: '#A3C438',
          600: '#86A12D',
          700: '#697E22',
          800: '#4D5C18',
          900: '#303A0F',
        },
        background: '#FAF7F1',
        chrome: '#F5F0E6',
        surface: '#FFFFFF',
        'text-primary': '#1A2418',
        'text-secondary': '#5C6B58',
        'text-inverse': '#FFFFFF',
        error: '#C25B52',
        success: '#2E5A27',
        warning: '#E8671A',
        border: '#E4DFD2',
        rating: '#E8671A',
        favorite: '#C25B52',
      },
      fontFamily: {
        sans: ['Figtree_400Regular'],
        display: ['BricolageGrotesque_700Bold'],
      },
      borderRadius: {
        card: '12px',
        button: '8px',
      },
    },
  },
  plugins: [
    // RN needs a dedicated TTF per weight — do not rely on fontWeight with Figtree.
    plugin(({ addUtilities }) => {
      addUtilities({
        '.font-normal': { fontFamily: 'Figtree_400Regular' },
        '.font-medium': { fontFamily: 'Figtree_500Medium' },
        '.font-semibold': { fontFamily: 'Figtree_600SemiBold' },
        '.font-bold': { fontFamily: 'Figtree_700Bold' },
        '.font-extrabold': { fontFamily: 'Figtree_800ExtraBold' },
        '.font-display': { fontFamily: 'BricolageGrotesque_700Bold' },
      });
    }),
  ],
};
