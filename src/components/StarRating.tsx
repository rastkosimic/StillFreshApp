import { Ionicons } from '@expo/vector-icons';
import { Text, TouchableOpacity, View } from 'react-native';

import { colors } from '@/theme/colors';

interface StarRatingProps {
  rating: number;
  onRatingChange?: (rating: number) => void;
  size?: number;
  disabled?: boolean;
}

export default function StarRating({
  rating,
  onRatingChange,
  size = 28,
  disabled = false,
}: StarRatingProps) {
  return (
    <View className="flex-row items-center" style={{ gap: 4 }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <TouchableOpacity
          key={star}
          onPress={() => !disabled && onRatingChange?.(star)}
          disabled={disabled || onRatingChange == null}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          className="p-1"
        >
          <Ionicons
            name={star <= rating ? 'star' : 'star-outline'}
            size={size}
            color={star <= rating ? colors.rating : colors.border}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
}
