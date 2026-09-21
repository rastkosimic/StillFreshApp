import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/theme/colors';
import { ChainLocation } from '@/types';

interface AnalyticsLocationFilterModalProps {
  visible: boolean;
  locations: ChainLocation[];
  selectedLocationId: number | null;
  onClose: () => void;
  onSelect: (locationId: number) => void;
}

export default function AnalyticsLocationFilterModal({
  visible,
  locations,
  selectedLocationId,
  onClose,
  onSelect,
}: AnalyticsLocationFilterModalProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const sorted = [...locations].sort((a, b) => {
    if (a.isHeadquarters && !b.isHeadquarters) return -1;
    if (!a.isHeadquarters && b.isHeadquarters) return 1;
    return a.locationName.localeCompare(b.locationName);
  });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <Pressable className="flex-1" onPress={onClose} />
        <View
          className="bg-surface rounded-t-2xl"
          style={{ paddingBottom: Math.max(insets.bottom, 16), maxHeight: '70%' }}
        >
          <View className="flex-row items-center justify-between px-5 pt-5 pb-3 border-b border-border">
            <Text className="text-lg font-bold text-text-primary">
              {t('analytics.locationFilterTitle')}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={8} activeOpacity={0.7}>
              <Feather name="x" size={22} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          <ScrollView className="px-5" showsVerticalScrollIndicator={false}>
            {sorted.length === 0 ? (
              <Text className="text-sm text-text-secondary text-center py-8">
                {t('analytics.noChainLocations')}
              </Text>
            ) : (
              sorted.map((location) => {
                const isSelected = location.id === selectedLocationId;
                return (
                  <TouchableOpacity
                    key={location.id}
                    onPress={() => {
                      onSelect(location.id);
                      onClose();
                    }}
                    activeOpacity={0.7}
                    className="flex-row items-center py-3.5 border-b border-border gap-3"
                  >
                    <View
                      className="w-5 h-5 rounded-full border items-center justify-center"
                      style={{
                        borderColor: isSelected ? colors.primary.DEFAULT : colors.border,
                        backgroundColor: isSelected ? colors.primary.DEFAULT : colors.surface,
                      }}
                    >
                      {isSelected && (
                        <View className="w-2 h-2 rounded-full bg-white" />
                      )}
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm font-semibold text-text-primary" numberOfLines={1}>
                        {location.locationName}
                      </Text>
                      {location.isHeadquarters && (
                        <Text className="text-[11px] text-primary font-medium mt-0.5">
                          {t('analytics.headquartersLocation')}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
