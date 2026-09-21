import { Theme } from '@react-navigation/native';
import { colors } from './colors';

export const navigationTheme: Theme = {
  dark: false,
  colors: {
    primary: colors.primary.DEFAULT,
    background: colors.background,
    card: colors.chrome,
    text: colors.text.primary,
    border: colors.border,
    notification: colors.error,
  },
  fonts: {
    regular: { fontFamily: 'Figtree_400Regular', fontWeight: '400' },
    medium: { fontFamily: 'Figtree_500Medium', fontWeight: '500' },
    bold: { fontFamily: 'Figtree_700Bold', fontWeight: '700' },
    heavy: { fontFamily: 'Figtree_800ExtraBold', fontWeight: '800' },
  },
};
