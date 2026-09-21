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
      className={className ?? 'w-9 h-9 items-center justify-center'}
      style={style}
      activeOpacity={0.7}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Ionicons
        name="chevron-back"
        size={26}
        color={isOverlay ? colors.text.inverse : colors.text.primary}
        style={
          isOverlay
            ? {
                textShadowColor: 'rgba(0,0,0,0.45)',
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 3,
              }
            : undefined
        }
      />
    </TouchableOpacity>
  );
}
