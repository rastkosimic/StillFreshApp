import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import RatingCategoryRow from '@/components/RatingCategoryRow';
import { submitRating } from '@/services/ratingService';
import { colors } from '@/theme/colors';
import { RatingRequest } from '@/types';

const SCREEN_HEIGHT = Dimensions.get('window').height;

interface InitialRatings {
  collectionProcessRating: number;
  qualityRating: number;
  quantityRating: number;
  varietyRating: number;
}

interface RatingSubmissionModalProps {
  visible: boolean;
  vendorId: number;
  orderId: number | string;
  vendorName?: string;
  isUpdate?: boolean;
  initialRatings?: InitialRatings | null;
  onClose: () => void;
  onRatingSubmitted: () => void;
}

export default function RatingSubmissionModal({
  visible,
  vendorId,
  orderId,
  vendorName,
  isUpdate = false,
  initialRatings = null,
  onClose,
  onRatingSubmitted,
}: RatingSubmissionModalProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [collectionRating, setCollectionRating] = useState(0);
  const [qualityRating, setQualityRating] = useState(0);
  const [quantityRating, setQuantityRating] = useState(0);
  const [varietyRating, setVarietyRating] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    if (initialRatings != null) {
      setCollectionRating(initialRatings.collectionProcessRating);
      setQualityRating(initialRatings.qualityRating);
      setQuantityRating(initialRatings.quantityRating);
      setVarietyRating(initialRatings.varietyRating);
    } else {
      setCollectionRating(0);
      setQualityRating(0);
      setQuantityRating(0);
      setVarietyRating(0);
    }
    setError(null);
  }, [visible, initialRatings]);

  const totalRating =
    collectionRating > 0 && qualityRating > 0 && quantityRating > 0 && varietyRating > 0
      ? (collectionRating + qualityRating + quantityRating + varietyRating) / 4
      : 0;

  const canSubmit =
    collectionRating > 0 && qualityRating > 0 && quantityRating > 0 && varietyRating > 0;

  const resetForm = () => {
    setCollectionRating(0);
    setQualityRating(0);
    setQuantityRating(0);
    setVarietyRating(0);
    setError(null);
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const request: RatingRequest = {
        vendorId,
        collectionProcessRating: collectionRating,
        qualityRating,
        quantityRating,
        varietyRating,
        orderId: Number(orderId),
      };

      await submitRating(request);
      resetForm();
      onRatingSubmitted();
      onClose();
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : t('ratings.submitFailed');
      setError(errorMessage);

      if (errorMessage.includes('log in') || errorMessage.includes('Unauthorized')) {
        Alert.alert(t('common.error'), errorMessage, [
          { text: t('common.ok'), onPress: onClose },
        ]);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    resetForm();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View className="flex-1 justify-end bg-black/40">
        <Pressable className="flex-1" onPress={handleClose} />
        <View style={{ maxHeight: SCREEN_HEIGHT * 0.85 }}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <View
              className="bg-surface rounded-t-2xl px-6 pt-5"
              style={{ paddingBottom: insets.bottom + 16 }}
            >
              <View className="mb-5">
                <Text className="text-2xl font-bold text-text-primary mb-2">
                  {isUpdate ? t('ratings.updateYourRating') : t('ratings.rateYourExperience')}
                </Text>
                {vendorName != null && vendorName.length > 0 && (
                  <Text className="text-base font-semibold text-text-primary mb-1">
                    {vendorName}
                  </Text>
                )}
                <Text className="text-sm text-text-secondary">
                  {t('ratings.helpOthers')}
                </Text>
              </View>

              <RatingCategoryRow
                label={t('ratings.collectionProcess')}
                rating={collectionRating}
                onRatingChange={setCollectionRating}
              />
              <RatingCategoryRow
                label={t('ratings.foodQuality')}
                rating={qualityRating}
                onRatingChange={setQualityRating}
              />
              <RatingCategoryRow
                label={t('ratings.foodQuantity')}
                rating={quantityRating}
                onRatingChange={setQuantityRating}
              />
              <RatingCategoryRow
                label={t('ratings.foodVariety')}
                rating={varietyRating}
                onRatingChange={setVarietyRating}
              />

              {totalRating > 0 && (
                <View className="flex-row items-center justify-between mt-5 p-4 bg-background rounded-xl">
                  <Text className="text-base font-semibold text-text-primary">
                    {t('ratings.overallRating')}
                  </Text>
                  <View className="flex-row items-center" style={{ gap: 4 }}>
                    <Text className="text-xl font-bold text-text-primary">
                      {totalRating.toFixed(1)}
                    </Text>
                    <Text style={{ fontSize: 18, color: colors.rating }}>★</Text>
                  </View>
                </View>
              )}

              {error != null && (
                <View className="mt-4 p-3 bg-error/10 rounded-xl">
                  <Text className="text-error text-sm text-center">{error}</Text>
                </View>
              )}

              <View className="flex-row gap-3 mt-6 pt-4 border-t border-border">
                <TouchableOpacity
                  onPress={handleClose}
                  disabled={isSubmitting}
                  className="flex-1 bg-background border border-border rounded-xl py-4 items-center"
                  activeOpacity={0.8}
                >
                  <Text className="text-text-primary font-semibold text-base">
                    {t('ratings.skip')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSubmit}
                  disabled={!canSubmit || isSubmitting}
                  className={`flex-1 bg-primary rounded-xl py-4 items-center ${
                    !canSubmit || isSubmitting ? 'opacity-50' : ''
                  }`}
                  activeOpacity={0.8}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text className="text-white font-semibold text-base">
                      {isUpdate ? t('ratings.updateRating') : t('ratings.submitRating')}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
