import { Ionicons } from '@expo/vector-icons';
import { StyleProp, TouchableOpacity, ViewStyle } from 'react-native';

import { colors } from '@/theme/colors';

type BackButtonVariant = 'default' | 'overlay';

interface BackButtonProps {
  onPress: () => void;
  variant?: BackButtonVariant;
  className?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export default function BackButton({
  onPress,
  variant = 'default',
  className,
  style,
  accessibilityLabel,
}: BackButtonProps) {
  const isOverlay = variant === 'overlay';

  return (
    <TouchableOpacity
      onPress={onPress}
      className={
        className ??
        (isOverlay
          ? 'w-9 h-9 rounded-full items-center justify-center'
          : 'w-9 h-9 rounded-full bg-background items-center justify-center')
      }
      style={isOverlay ? [{ backgroundColor: 'rgba(255,255,255,0.82)' }, style] : style}
      activeOpacity={0.7}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Ionicons name="chevron-back" size={20} color={colors.text.primary} />
    </TouchableOpacity>
  );
}
