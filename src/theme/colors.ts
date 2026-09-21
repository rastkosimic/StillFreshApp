// Mirrors tailwind.config.js color tokens for programmatic use
// (react-native-maps markers, React Navigation theme, chart labels, etc.)
// Do NOT hardcode hex values in component files — import from here or use Tailwind classes.
//
// Palette follows the Još Sveže landing page (https://jossveze.rs/):
// cream canvas, forest green, ink text.

export const colors = {
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
  /** Screen canvas — landing cream-soft */
  background: '#FAF7F1',
  /** Headers, tab bar — landing cream */
  chrome: '#F5F0E6',
  /** Cards, sheets, inputs */
  surface: '#FFFFFF',
  text: {
    primary: '#1A2418',
    secondary: '#5C6B58',
    inverse: '#FFFFFF',
  },
  error: '#C25B52',
  success: '#2E5A27',
  warning: '#E8671A',
  border: '#E4DFD2',
  rating: '#E8671A',
  favorite: '#C25B52',
} as const;
