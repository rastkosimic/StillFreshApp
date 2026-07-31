import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, View } from 'react-native';

import { getVendorRatingSummary } from '@/services/ratingService';
import { colors } from '@/theme/colors';
import { VendorRatingSummary } from '@/types';

interface VendorRatingBadgeProps {
  vendorId: number;
  size?: 'small' | 'medium';
}

export default function VendorRatingBadge({ vendorId, size = 'small' }: VendorRatingBadgeProps) {
  const [summary, setSummary] = useState<VendorRatingSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!vendorId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const data = await getVendorRatingSummary(vendorId);
        if (!cancelled) {
          setSummary(data);
        }
      } catch {
        if (!cancelled) {
          setSummary(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [vendorId]);

  const iconSize = size === 'small' ? 10 : 12;
  const textClass = size === 'small' ? 'text-xs' : 'text-sm';

  if (loading) {
    return (
      <View className="absolute top-2 right-2 bg-surface rounded-full px-2 py-0.5">
        <ActivityIndicator size="small" color={colors.rating} />
      </View>
    );
  }

  if (!summary || summary.totalRatings === 0) {
    return null;
  }

  return (
    <View
      className="absolute top-2 right-2 bg-surface rounded-full px-2 py-0.5 flex-row items-center"
      style={{ gap: 2 }}
    >
      <Ionicons name="star" size={iconSize} color={colors.rating} />
      <Text className={`text-text-primary font-bold ${textClass}`}>
        {summary.averageRating.toFixed(1)}
      </Text>
    </View>
  );
}
