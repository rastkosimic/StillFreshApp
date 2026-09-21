import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

interface TabBarIconWithBadgeProps {
  name: IoniconsName;
  color: string;
  size: number;
  badge?: number;
}

export default function TabBarIconWithBadge({
  name,
  color,
  size,
  badge,
}: TabBarIconWithBadgeProps) {
  const showBadge = badge != null && badge > 0;

  return (
    <View className="items-center justify-center" style={{ width: size + 10, height: size + 6 }}>
      <Ionicons name={name} size={size} color={color} />
      {showBadge && (
        <View
          className="absolute bg-error rounded-full min-w-[18px] h-[18px] items-center justify-center px-1"
          style={{ top: -2, right: -2 }}
        >
          <Text className="text-text-inverse text-[10px] font-bold">
            {badge > 9 ? '9+' : String(badge)}
          </Text>
        </View>
      )}
    </View>
  );
}
