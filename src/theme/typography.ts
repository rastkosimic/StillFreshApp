import { Text, TextInput } from 'react-native';

/**
 * StillFresh type system.
 * Display (Bricolage) = Još Sveže wordmark only.
 * UI (Figtree) = all other app text.
 * Loaded names match @expo-google-fonts file registrations.
 */
export const fonts = {
  display: 'BricolageGrotesque_700Bold',
  ui: {
    regular: 'Figtree_400Regular',
    medium: 'Figtree_500Medium',
    semibold: 'Figtree_600SemiBold',
    bold: 'Figtree_700Bold',
    extrabold: 'Figtree_800ExtraBold',
  },
} as const;

type HostDefaults = { defaultProps?: { style?: unknown } };

function prependDefaultFont(component: HostDefaults, fontFamily: string): void {
  const prev = component.defaultProps?.style;
  component.defaultProps = {
    ...component.defaultProps,
    style: prev ? [{ fontFamily }, prev] : { fontFamily },
  };
}

let defaultUiFontApplied = false;

/** Call once after fonts have loaded so unstyled Text/TextInput use Figtree. */
export function applyDefaultUiFont(): void {
  if (defaultUiFontApplied) {
    return;
  }
  prependDefaultFont(Text as unknown as HostDefaults, fonts.ui.regular);
  prependDefaultFont(TextInput as unknown as HostDefaults, fonts.ui.regular);
  defaultUiFontApplied = true;
}
