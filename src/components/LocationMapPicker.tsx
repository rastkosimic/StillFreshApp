import { Feather } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Modal, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';

import BackButton from '@/components/BackButton';
import { colors } from '@/theme/colors';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

interface LocationMapPickerProps {
  /** Geocoded or previously saved position; null renders the empty prompt. */
  value: Coordinates | null;
  onChange: (coords: Coordinates) => void;
  /** Shows a spinner over the preview while an address is being geocoded. */
  isResolving?: boolean;
  /** Fallback centre for the full-screen picker when no coordinate exists yet. */
  fallbackCenter: Coordinates;
  editable?: boolean;
}

const PREVIEW_DELTA = { latitudeDelta: 0.008, longitudeDelta: 0.008 };
const PICKER_DELTA = { latitudeDelta: 0.012, longitudeDelta: 0.012 };

/**
 * Latitude and longitude are mandatory when creating a location, so the address form
 * geocodes what the user typed and then asks them to confirm the pin here. The inline
 * preview is deliberately non-interactive — it lives inside a ScrollView, and a pannable map
 * there would swallow the scroll gesture. Adjustment happens in the full-screen picker.
 */
export default function LocationMapPicker({
  value,
  onChange,
  isResolving = false,
  fallbackCenter,
  editable = true,
}: LocationMapPickerProps) {
  const { t } = useTranslation();
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  return (
    <View className="mb-4">
      <Text className="text-text-primary text-sm font-medium mb-1">
        {t('vendor.locationForm.pinLabel')}
      </Text>

      <View
        className="rounded-xl overflow-hidden border"
        style={{ borderColor: value ? colors.primary.DEFAULT : colors.border }}
      >
        {value ? (
          <View style={{ height: 150 }}>
            <MapView
              provider={PROVIDER_GOOGLE}
              style={{ flex: 1 }}
              region={{ ...value, ...PREVIEW_DELTA }}
              scrollEnabled={false}
              zoomEnabled={false}
              rotateEnabled={false}
              pitchEnabled={false}
              toolbarEnabled={false}
              liteMode
            >
              <Marker coordinate={value} pinColor={colors.primary.DEFAULT} />
            </MapView>
          </View>
        ) : (
          <View
            className="items-center justify-center px-6"
            style={{ height: 150, backgroundColor: colors.primary[50] }}
          >
            {isResolving ? (
              <ActivityIndicator color={colors.primary.DEFAULT} />
            ) : (
              <>
                <Feather name="map-pin" size={26} color={colors.primary[300]} />
                <Text className="text-xs text-text-secondary text-center mt-2">
                  {t('vendor.locationForm.pinEmpty')}
                </Text>
              </>
            )}
          </View>
        )}
      </View>

      <View className="flex-row items-center justify-between mt-2">
        <Text className="text-xs text-text-secondary flex-1" numberOfLines={1}>
          {value
            ? `${value.latitude.toFixed(5)}, ${value.longitude.toFixed(5)}`
            : t('vendor.locationForm.pinRequired')}
        </Text>
        {editable && (
          <TouchableOpacity
            onPress={() => setIsPickerOpen(true)}
            activeOpacity={0.7}
            hitSlop={8}
            className="flex-row items-center gap-1"
          >
            <Feather name="crosshair" size={14} color={colors.primary.DEFAULT} />
            <Text className="text-primary text-sm font-semibold">
              {value
                ? t('vendor.locationForm.pinAdjust')
                : t('vendor.locationForm.pinSetManually')}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <FullScreenPicker
        visible={isPickerOpen}
        initial={value ?? fallbackCenter}
        onCancel={() => setIsPickerOpen(false)}
        onConfirm={(coords) => {
          onChange(coords);
          setIsPickerOpen(false);
        }}
      />
    </View>
  );
}

interface FullScreenPickerProps {
  visible: boolean;
  initial: Coordinates;
  onCancel: () => void;
  onConfirm: (coords: Coordinates) => void;
}

/**
 * Uses a fixed centre crosshair read from `onRegionChangeComplete` rather than a draggable
 * marker: dragging a marker on Android competes with the map pan gesture and frequently
 * drops the drag, whereas panning the map under a static pin always works.
 */
function FullScreenPicker({ visible, initial, onCancel, onConfirm }: FullScreenPickerProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [center, setCenter] = useState<Coordinates>(initial);
  const isSettled = useRef(true);

  useEffect(() => {
    if (visible) setCenter(initial);
  }, [visible, initial]);

  const region: Region = { ...initial, ...PICKER_DELTA };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      <View className="flex-1 bg-background">
        <View
          className="bg-surface border-b border-border px-5 pb-3.5 flex-row items-center gap-3"
          style={{ paddingTop: insets.top + 12 }}
        >
          <BackButton onPress={onCancel} />
          <View className="flex-1">
            <Text className="text-[17px] font-semibold text-text-primary">
              {t('vendor.locationForm.pinPickerTitle')}
            </Text>
            <Text className="text-xs text-text-secondary mt-0.5">
              {t('vendor.locationForm.pinPickerHint')}
            </Text>
          </View>
        </View>

        <View className="flex-1">
          <MapView
            provider={PROVIDER_GOOGLE}
            style={{ flex: 1 }}
            initialRegion={region}
            onRegionChange={() => {
              isSettled.current = false;
            }}
            onRegionChangeComplete={(next) => {
              isSettled.current = true;
              setCenter({ latitude: next.latitude, longitude: next.longitude });
            }}
          />

          {/* Static centre pin — the map moves beneath it */}
          <View
            className="absolute inset-0 items-center justify-center"
            pointerEvents="none"
          >
            <Feather name="map-pin" size={36} color={colors.primary.DEFAULT} />
            <View
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: colors.primary.DEFAULT, marginTop: -4 }}
            />
          </View>
        </View>

        <View
          className="bg-surface border-t border-border px-5 pt-4"
          style={{ paddingBottom: insets.bottom + 16 }}
        >
          <Text className="text-xs text-text-secondary text-center mb-3">
            {center.latitude.toFixed(5)}, {center.longitude.toFixed(5)}
          </Text>
          <TouchableOpacity
            className="bg-primary rounded-xl py-4 items-center"
            activeOpacity={0.8}
            onPress={() => onConfirm(center)}
          >
            <Text className="text-white font-semibold text-base">
              {t('vendor.locationForm.pinConfirm')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
