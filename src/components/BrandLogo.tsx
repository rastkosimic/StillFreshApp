import { Image } from 'expo-image';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ImageStyle, LayoutChangeEvent, StyleProp, Text, View } from 'react-native';

import { BRAND_ICON_REVISION, brandAssets } from '@/config/brandAssets';

type BrandLogoVariant = 'icon' | 'stacked';

const DEFAULT_ICON_SIZE = 108;

interface BrandLogoProps {
  variant: BrandLogoVariant;
  width?: number;
  height?: number;
  className?: string;
  style?: StyleProp<ImageStyle>;
  accessibilityLabel?: string;
}

export default function BrandLogo({
  variant,
  width,
  height,
  className,
  style,
  accessibilityLabel,
}: BrandLogoProps) {
  const { t } = useTranslation();
  const appName = accessibilityLabel ?? t('auth.appName');
  const iconSize = width ?? height ?? DEFAULT_ICON_SIZE;
  const [wordmarkWidth, setWordmarkWidth] = useState(iconSize);

  const onWordmarkLayout = (event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.width);
    if (next > 0 && next !== wordmarkWidth) {
      setWordmarkWidth(next);
    }
  };

  if (variant === 'stacked') {
    return (
      <View className={`w-full items-center ${className ?? ''}`} accessibilityRole="header">
        <Image
          source={brandAssets.icon}
          style={[{ width: wordmarkWidth, height: wordmarkWidth }, style]}
          contentFit="contain"
          cachePolicy="none"
          recyclingKey={`auth-icon-${BRAND_ICON_REVISION}`}
          accessibilityRole="image"
          accessibilityLabel={appName}
        />
        <Text
          className="text-primary text-3xl font-display tracking-tight mt-2 text-center"
          onLayout={onWordmarkLayout}
        >
          {appName}
        </Text>
      </View>
    );
  }

  return (
    <View className={`w-full items-center ${className ?? ''}`}>
      <Image
        source={brandAssets.icon}
        style={[{ width: iconSize, height: iconSize }, style]}
        contentFit="contain"
        cachePolicy="none"
        recyclingKey={`auth-icon-${BRAND_ICON_REVISION}`}
        accessibilityRole="image"
        accessibilityLabel={appName}
      />
    </View>
  );
}
