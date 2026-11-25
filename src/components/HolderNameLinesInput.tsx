import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TextInput, View } from 'react-native';

import { colors } from '@/theme/colors';
import {
  applyHolderLineChange,
  HOLDER_NAME_LINE_COUNT,
  HOLDER_NAME_LINE_MAX,
  type HolderNameLines,
} from '@/utils/formatBankDetails';

type Props = {
  lines: HolderNameLines;
  onChange: (lines: HolderNameLines, overflow: boolean) => void;
  error?: string;
  onFocus?: () => void;
};

/**
 * Payee name as on a dinar payment order: 3 lines, 35 characters each.
 * The screen joins the lines into one string before saving.
 */
export default function HolderNameLinesInput({ lines, onChange, error, onFocus }: Props) {
  const { t } = useTranslation();
  const inputs = useRef<Array<TextInput | null>>([]);

  const onLineChange = (index: number, value: string) => {
    const next = applyHolderLineChange(lines, index, value);
    onChange(next.lines, next.overflow);
    const filledThisLine =
      lines[index].length < HOLDER_NAME_LINE_MAX &&
      next.lines[index].length === HOLDER_NAME_LINE_MAX;
    const pastedForward = value.length > HOLDER_NAME_LINE_MAX;
    if (index >= HOLDER_NAME_LINE_COUNT - 1 || (!filledThisLine && !pastedForward)) return;

    let focusIndex = index + 1;
    if (pastedForward) {
      for (let i = index; i < HOLDER_NAME_LINE_COUNT; i += 1) {
        if (next.lines[i].length > 0) focusIndex = i;
      }
    }
    requestAnimationFrame(() => inputs.current[focusIndex]?.focus());
  };

  return (
    <View>
      <View className="mb-1 flex-row items-center justify-between">
        <Text className="text-[15px] font-medium text-text-primary">
          {t('payment.holderName')}
          <Text className="text-error"> *</Text>
        </Text>
        <Text className="text-[11px] text-text-secondary">
          {lines[0].length}/{HOLDER_NAME_LINE_MAX}
        </Text>
      </View>
      <TextInput
        ref={(node) => {
          inputs.current[0] = node;
        }}
        value={lines[0]}
        onChangeText={(value) => onLineChange(0, value)}
        onFocus={onFocus}
        placeholder={t('payment.holderNamePlaceholder')}
        placeholderTextColor={colors.text.secondary}
        autoCapitalize="words"
        autoCorrect={false}
        returnKeyType="next"
        onSubmitEditing={() => inputs.current[1]?.focus()}
        className="rounded-lg border bg-background px-2.5 py-2 text-[15px] font-normal text-text-primary"
        style={{ borderColor: error ? colors.error : colors.border }}
      />
      {lines.slice(1).map((line, offset) => {
        const index = offset + 1;
        return (
          <View key={index} className="mt-2.5">
            <View className="mb-1 flex-row items-center justify-between">
              <View className="flex-row items-center gap-1.5">
                <Text className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                  {t('payment.holderNameContinuation')}
                </Text>
                <Text className="text-[11px] text-text-secondary">{t('common.optional')}</Text>
              </View>
              <Text className="text-[11px] text-text-secondary">
                {line.length}/{HOLDER_NAME_LINE_MAX}
              </Text>
            </View>
            <TextInput
              ref={(node) => {
                inputs.current[index] = node;
              }}
              value={line}
              onChangeText={(value) => onLineChange(index, value)}
              onFocus={onFocus}
              placeholderTextColor={colors.text.secondary}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType={index < HOLDER_NAME_LINE_COUNT - 1 ? 'next' : 'done'}
              onSubmitEditing={() => {
                if (index < HOLDER_NAME_LINE_COUNT - 1) inputs.current[index + 1]?.focus();
              }}
              className="rounded-lg border bg-background px-2.5 py-2 text-[15px] font-normal text-text-primary"
              style={{ borderColor: error ? colors.error : colors.border }}
            />
          </View>
        );
      })}
      {error ? (
        <Text className="mt-1.5 text-xs leading-4 text-error">{error}</Text>
      ) : null}
    </View>
  );
}
