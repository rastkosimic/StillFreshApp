import { Feather } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
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
import { Offer } from '@/types';

interface AnalyticsOfferFilterModalProps {
  visible: boolean;
  offers: Offer[];
  appliedOfferIds: number[];
  onClose: () => void;
  onApply: (offerIds: number[]) => void;
}

export default function AnalyticsOfferFilterModal({
  visible,
  offers,
  appliedOfferIds,
  onClose,
  onApply,
}: AnalyticsOfferFilterModalProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [draftIds, setDraftIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!visible) return;
    if (appliedOfferIds.length > 0) {
      setDraftIds(new Set(appliedOfferIds));
      return;
    }
    setDraftIds(new Set(offers.map((o) => o.id)));
  }, [visible, appliedOfferIds, offers]);

  const allIds = offers.map((o) => o.id);

  const toggleOffer = (offerId: number) => {
    setDraftIds((prev) => {
      const next = new Set(prev);
      if (next.has(offerId)) {
        next.delete(offerId);
      } else {
        next.add(offerId);
      }
      return next;
    });
  };

  const selectAll = () => setDraftIds(new Set(allIds));
  const clearAll = () => setDraftIds(new Set());

  const handleApply = () => {
    const selected = Array.from(draftIds);
    if (selected.length === 0 || selected.length === allIds.length) {
      onApply([]);
    } else {
      onApply(selected);
    }
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <Pressable className="flex-1" onPress={onClose} />
        <View
          className="bg-surface rounded-t-2xl"
          style={{ paddingBottom: Math.max(insets.bottom, 16), maxHeight: '80%' }}
        >
          <View className="flex-row items-center justify-between px-5 pt-5 pb-3 border-b border-border">
            <Text className="text-lg font-bold text-text-primary">
              {t('analytics.offerFilterTitle')}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={8} activeOpacity={0.7}>
              <Feather name="x" size={22} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          <View className="flex-row gap-2 px-5 py-3">
            <TouchableOpacity
              onPress={selectAll}
              activeOpacity={0.7}
              className="flex-1 py-2 rounded-xl bg-primary-50 items-center"
            >
              <Text className="text-sm font-semibold text-primary">
                {t('analytics.offerFilterSelectAll')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={clearAll}
              activeOpacity={0.7}
              className="flex-1 py-2 rounded-xl bg-border items-center"
            >
              <Text className="text-sm font-semibold text-text-primary">
                {t('analytics.offerFilterClear')}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            className="px-5"
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {offers.length === 0 ? (
              <Text className="text-sm text-text-secondary text-center py-8">
                {t('analytics.offerFilterEmpty')}
              </Text>
            ) : (
              offers.map((offer) => {
                const checked = draftIds.has(offer.id);
                return (
                  <TouchableOpacity
                    key={offer.id}
                    onPress={() => toggleOffer(offer.id)}
                    activeOpacity={0.7}
                    className="flex-row items-center py-3 border-b border-border gap-3"
                  >
                    <View
                      className="w-5 h-5 rounded border items-center justify-center"
                      style={{
                        borderColor: checked ? colors.primary.DEFAULT : colors.border,
                        backgroundColor: checked ? colors.primary.DEFAULT : colors.surface,
                      }}
                    >
                      {checked && <Feather name="check" size={14} color={colors.text.inverse} />}
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm font-semibold text-text-primary" numberOfLines={1}>
                        {offer.name}
                      </Text>
                      {!offer.active && (
                        <Text className="text-[11px] text-text-secondary mt-0.5">
                          {t('analytics.offerInactive')}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>

          <View className="px-5 pt-3">
            <TouchableOpacity
              onPress={handleApply}
              activeOpacity={0.8}
              className="bg-primary rounded-xl py-4 items-center"
            >
              <Text className="text-white font-semibold text-base">
                {t('analytics.offerFilterApply')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
