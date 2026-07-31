import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { ImageStyle, StyleProp, Text, View } from 'react-native';

import { brandAssets } from '@/config/brandAssets';

type BrandLogoVariant = 'icon' | 'stacked';

const DEFAULT_ICON_SIZE = 72;

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

  if (variant === 'stacked') {
    return (
      <View className={`w-full items-center ${className ?? ''}`} accessibilityRole="header">
        <Image
          source={brandAssets.icon}
          style={[{ width: iconSize, height: iconSize }, style]}
          contentFit="contain"
          accessibilityRole="image"
          accessibilityLabel={appName}
        />
        <Text className="text-primary text-3xl font-bold tracking-tight mt-2 text-center">
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
        accessibilityRole="image"
        accessibilityLabel={appName}
      />
    </View>
  );
}
