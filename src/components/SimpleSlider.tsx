import { useRef, useState } from 'react';
import { PanResponder, View } from 'react-native';

interface Props {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onValueChange?: (v: number) => void;
  onSlidingComplete?: (v: number) => void;
  thumbColor?: string;
  minimumTrackColor?: string;
  maximumTrackColor?: string;
}

export default function SimpleSlider({
  value,
  min = 1,
  max = 50,
  step = 1,
  onValueChange,
  onSlidingComplete,
  thumbColor = '#007AFF',
  minimumTrackColor = '#007AFF',
  maximumTrackColor = '#E5E5EA',
}: Props) {
  const trackWidth = useRef(0);
  const startX = useRef(0);
  const [displayValue, setDisplayValue] = useState(value);

  const posToValue = (x: number): number => {
    const ratio = Math.max(0, Math.min(1, x / (trackWidth.current || 1)));
    const raw = ratio * (max - min) + min;
    return Math.round(raw / step) * step;
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        startX.current = e.nativeEvent.locationX;
        const v = posToValue(e.nativeEvent.locationX);
        setDisplayValue(v);
        onValueChange?.(v);
      },
      onPanResponderMove: (_, g) => {
        const x = Math.max(0, Math.min(trackWidth.current, startX.current + g.dx));
        const v = posToValue(x);
        setDisplayValue(v);
        onValueChange?.(v);
      },
      onPanResponderRelease: (_, g) => {
        const x = Math.max(0, Math.min(trackWidth.current, startX.current + g.dx));
        const v = posToValue(x);
        setDisplayValue(v);
        onSlidingComplete?.(v);
      },
    })
  ).current;

  const fillPercent = ((displayValue - min) / (max - min)) * 100;

  return (
    <View
      style={{ height: 36, justifyContent: 'center' }}
      onLayout={(e) => { trackWidth.current = e.nativeEvent.layout.width; }}
      {...panResponder.panHandlers}
    >
      <View style={{ height: 4, borderRadius: 2, backgroundColor: maximumTrackColor }}>
        <View style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: `${fillPercent}%` as unknown as number,
          borderRadius: 2, backgroundColor: minimumTrackColor,
        }} />
      </View>
      <View style={{
        position: 'absolute',
        left: `${fillPercent}%` as unknown as number,
        top: '50%' as unknown as number,
        marginTop: -10,
        marginLeft: -10,
        width: 20, height: 20, borderRadius: 10,
        backgroundColor: thumbColor,
        elevation: 3,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2, shadowRadius: 2,
      }} />
    </View>
  );
}
