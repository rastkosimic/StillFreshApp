import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LayoutChangeEvent, Text, TouchableOpacity, View } from 'react-native';

import { OfferItem } from '@/types';
import { ChipLayout, countVisibleChips, formatOfferItemLabel } from '@/utils/offerItems';

const CHIP_GAP = 6;
const CHIP_MIN_HEIGHT = 28;
const MAX_COLLAPSED_ROWS = 2;
/** Space held for the chips until they have been measured, so the layout below does not jump. */
const UNMEASURED_MAX_HEIGHT = MAX_COLLAPSED_ROWS * CHIP_MIN_HEIGHT + CHIP_GAP;

interface Measurement {
  layouts: ChipLayout[];
  containerWidth: number;
  overflowChipWidth: number;
}

interface OfferContentsProps {
  /** Offer contents as listed by the vendor; nothing is rendered when empty or missing. */
  items?: OfferItem[] | null;
}

/**
 * What is in the bag, as chips ("2× Kroasan") directly under the offer name. Shows at most
 * two rows; the last chip then reads "+N" and opens the rest in place.
 */
export default function OfferContents({ items }: OfferContentsProps) {
  const { t } = useTranslation();
  // Both are remembered together with the labels they belong to, so a changed offer starts
  // over (unmeasured, collapsed) without a reset effect racing the new measurement.
  const [measured, setMeasured] = useState<{ key: string; value: Measurement } | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const labels = useMemo(() => (items ?? []).map(formatOfferItemLabel), [items]);
  const labelsKey = labels.join('\n');
  const measurement = measured?.key === labelsKey ? measured.value : null;
  const expanded = expandedKey === labelsKey;

  if (labels.length === 0) return null;

  const visibleCount =
    measurement == null
      ? labels.length
      : countVisibleChips(
          measurement.layouts,
          measurement.containerWidth,
          measurement.overflowChipWidth,
          CHIP_GAP,
          MAX_COLLAPSED_ROWS,
        );
  const hiddenCount = labels.length - visibleCount;
  const shownLabels = expanded ? labels : labels.slice(0, visibleCount);

  return (
    <View className="mt-2.5" accessibilityLabel={t('customer.bagContents')}>
      <ChipMeasurer
        key={labelsKey}
        labels={labels}
        overflowLabel={`+${labels.length}`}
        onMeasured={(value) => setMeasured({ key: labelsKey, value })}
      />

      <View
        className="flex-row flex-wrap overflow-hidden"
        style={{
          gap: CHIP_GAP,
          maxHeight: measurement == null ? UNMEASURED_MAX_HEIGHT : undefined,
        }}
      >
        {shownLabels.map((label, index) => (
          <Chip key={`${index}-${label}`} label={label} />
        ))}

        {!expanded && hiddenCount > 0 && (
          <TouchableOpacity
            onPress={() => setExpandedKey(labelsKey)}
            activeOpacity={0.7}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('customer.bagContentsShowAll', { count: hiddenCount })}
          >
            <Chip label={`+${hiddenCount}`} outlined />
          </TouchableOpacity>
        )}

        {expanded && hiddenCount > 0 && (
          <TouchableOpacity
            onPress={() => setExpandedKey(null)}
            activeOpacity={0.7}
            hitSlop={8}
            accessibilityRole="button"
          >
            <Chip label={t('customer.readLess')} outlined />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function Chip({ label, outlined }: { label: string; outlined?: boolean }) {
  return (
    <View
      className={`rounded-full px-3 py-1 justify-center border ${
        outlined ? 'bg-surface border-primary-200' : 'bg-primary-50 border-primary-50'
      }`}
      style={{ minHeight: CHIP_MIN_HEIGHT, maxWidth: '100%' }}
    >
      <Text className="text-[13px] font-semibold text-primary" numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/**
 * Invisible copy of every chip plus the widest "+N" chip, laid out without a row limit, to
 * learn where the rows break. Reports once everything has a size, and again if the available
 * width changes.
 */
function ChipMeasurer({
  labels,
  overflowLabel,
  onMeasured,
}: {
  labels: string[];
  overflowLabel: string;
  onMeasured: (measurement: Measurement) => void;
}) {
  const layouts = useRef<(ChipLayout | undefined)[]>([]);
  const containerWidth = useRef<number | null>(null);
  const overflowChipWidth = useRef<number | null>(null);

  const report = () => {
    if (containerWidth.current == null || overflowChipWidth.current == null) return;
    const all: ChipLayout[] = [];
    for (let i = 0; i < labels.length; i++) {
      const layout = layouts.current[i];
      if (layout == null) return;
      all.push(layout);
    }
    onMeasured({
      layouts: all,
      containerWidth: containerWidth.current,
      overflowChipWidth: overflowChipWidth.current,
    });
  };

  const onContainerLayout = (event: LayoutChangeEvent) => {
    containerWidth.current = event.nativeEvent.layout.width;
    report();
  };

  const onChipLayout = (index: number, event: LayoutChangeEvent) => {
    const { x, y, width } = event.nativeEvent.layout;
    layouts.current[index] = { x, y, width };
    report();
  };

  const onOverflowChipLayout = (event: LayoutChangeEvent) => {
    overflowChipWidth.current = event.nativeEvent.layout.width;
    report();
  };

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className="absolute left-0 right-0 top-0 opacity-0 flex-row flex-wrap"
      style={{ gap: CHIP_GAP }}
      onLayout={onContainerLayout}
    >
      {labels.map((label, index) => (
        <View
          key={`${index}-${label}`}
          style={{ maxWidth: '100%' }}
          onLayout={(event) => onChipLayout(index, event)}
        >
          <Chip label={label} />
        </View>
      ))}
      <View className="absolute left-0 top-0" onLayout={onOverflowChipLayout}>
        <Chip label={overflowLabel} outlined />
      </View>
    </View>
  );
}
