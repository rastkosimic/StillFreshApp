// Mirrors tailwind.config.js color tokens for programmatic use
// (react-native-maps markers, React Navigation theme, chart labels, etc.)
// Do NOT hardcode hex values in component files — import from here or use Tailwind classes.

export const colors = {
  primary: {
    DEFAULT: '#2C5F2E',
    50:  '#EAF2EA',
    100: '#C9E0CA',
    200: '#A3C9A5',
    300: '#7DB280',
    400: '#5E9B61',
    500: '#2C5F2E',
    600: '#245226',
    700: '#1C431E',
    800: '#143316',
    900: '#0B220C',
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
  background: '#F4F4F2',
  surface: '#FFFFFF',
  text: {
    primary: '#1A1A1A',
    secondary: '#757575',
    inverse: '#FFFFFF',
  },
  error: '#E53935',
  success: '#2C5F2E',
  warning: '#F5A623',
  border: '#E5E5E5',
  rating: '#F5A623',
  favorite: '#E53935',
} as const;
