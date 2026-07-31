import { Text, View } from 'react-native';

import StarRating from '@/components/StarRating';

interface RatingCategoryRowProps {
  label: string;
  rating: number;
  onRatingChange?: (rating: number) => void;
  disabled?: boolean;
}

export default function RatingCategoryRow({
  label,
  rating,
  onRatingChange,
  disabled = false,
}: RatingCategoryRowProps) {
  return (
    <View className="flex-row items-center justify-between py-3 border-b border-border">
      <Text className="flex-1 text-base font-medium text-text-primary pr-3">{label}</Text>
      <StarRating
        rating={rating}
        onRatingChange={onRatingChange}
        size={disabled ? 24 : 32}
        disabled={disabled}
      />
    </View>
  );
}
