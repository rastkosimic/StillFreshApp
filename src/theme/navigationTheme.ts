import { Theme } from '@react-navigation/native';
import { colors } from './colors';

export const navigationTheme: Theme = {
  dark: false,
  colors: {
    primary: colors.primary.DEFAULT,
    background: colors.background,
    card: colors.surface,
    text: colors.text.primary,
    border: colors.border,
    notification: colors.error,
  },
  fonts: {
    regular: { fontFamily: 'System', fontWeight: '400' },
    medium: { fontFamily: 'System', fontWeight: '500' },
    bold: { fontFamily: 'System', fontWeight: '700' },
    heavy: { fontFamily: 'System', fontWeight: '900' },
  },
};
