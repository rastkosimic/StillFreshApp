import { Feather } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

import { OFFER_ITEM_LIMITS } from '@/config/offerItems';
import { colors } from '@/theme/colors';
import { tidyItemName } from '@/utils/offerItems';

interface SaveToListOption {
  value: boolean;
  onChange: (value: boolean) => void;
  /** Shown instead of the switch when the product list cannot take another entry. */
  unavailableHint?: string | null;
}

interface ProductNameModalProps {
  visible: boolean;
  title: string;
  /** Name to start from; empty when adding. */
  initialName: string;
  submitLabel: string;
  isSaving: boolean;
  /** Already translated message from the last failed save, if any. */
  errorMessage: string | null;
  /** Already translated note shown under the field. */
  hint?: string;
  /** When given, the vendor chooses whether the name is also kept in their product list. */
  saveToList?: SaveToListOption;
  onNameEdited?: () => void;
  onClose: () => void;
  onSubmit: (name: string) => void;
}

/**
 * Bottom sheet for typing one product name. Lifts with the keyboard so the field and the
 * save button stay visible (same pattern as ProfileFieldEditModal).
 */
export default function ProductNameModal({
  visible,
  title,
  initialName,
  submitLabel,
  isSaving,
  errorMessage,
  hint,
  saveToList,
  onNameEdited,
  onClose,
  onSubmit,
}: ProductNameModalProps) {
  const { t } = useTranslation();
  const { height: windowHeight } = useWindowDimensions();
  const [name, setName] = useState(initialName);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Each opening starts from the given name, and each closing forgets the keyboard lift.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setName(initialName);
    } else {
      setKeyboardHeight(0);
    }
  }

  useEffect(() => {
    if (!visible) return;

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showListener = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hideListener = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showListener.remove();
      hideListener.remove();
    };
  }, [visible]);

  const tidyName = tidyItemName(name);
  const canSubmit = tidyName.length > 0 && !isSaving;

  const handleClose = () => {
    if (isSaving) return;
    Keyboard.dismiss();
    onClose();
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit(tidyName);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View className="flex-1 justify-end bg-black/40">
        <Pressable className="flex-1" onPress={handleClose} disabled={isSaving} />

        <View style={{ marginBottom: keyboardHeight, maxHeight: windowHeight * 0.85 }}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <View
              className="bg-surface rounded-t-2xl px-6 pt-5"
              style={{ paddingBottom: keyboardHeight > 0 ? 12 : 16 }}
            >
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-lg font-bold text-text-primary flex-1 mr-3">{title}</Text>
                <TouchableOpacity
                  onPress={handleClose}
                  hitSlop={8}
                  disabled={isSaving}
                  accessibilityRole="button"
                  accessibilityLabel={t('common.close')}
                >
                  <Feather name="x" size={22} color={colors.text.secondary} />
                </TouchableOpacity>
              </View>

              <TextInput
                className={`bg-surface border rounded-xl px-4 py-3 text-text-primary text-base ${
                  errorMessage != null ? 'border-error' : 'border-border'
                }`}
                value={name}
                onChangeText={(text) => {
                  setName(text);
                  onNameEdited?.();
                }}
                placeholder={t('vendor.products.namePlaceholder')}
                placeholderTextColor={colors.text.secondary}
                maxLength={OFFER_ITEM_LIMITS.maxNameLength}
                editable={!isSaving}
                autoFocus
                autoCapitalize="sentences"
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
              />

              <View className="flex-row justify-between mt-1 mb-3">
                <Text className="text-error text-xs flex-1 mr-3">{errorMessage ?? ''}</Text>
                <Text className="text-xs text-text-secondary">
                  {name.length}/{OFFER_ITEM_LIMITS.maxNameLength}
                </Text>
              </View>

              {hint != null && (
                <Text className="text-xs text-text-secondary leading-4 mb-4">{hint}</Text>
              )}

              {saveToList != null &&
                (saveToList.unavailableHint != null ? (
                  <Text className="text-xs text-text-secondary leading-4 mb-4">
                    {saveToList.unavailableHint}
                  </Text>
                ) : (
                  <View className="flex-row items-center gap-3 mb-4">
                    <View className="flex-1">
                      <Text className="text-sm font-medium text-text-primary">
                        {t('vendor.offer.contentsSaveToList')}
                      </Text>
                      <Text className="text-xs text-text-secondary leading-4 mt-0.5">
                        {t('vendor.offer.contentsSaveToListHint')}
                      </Text>
                    </View>
                    <Switch
                      value={saveToList.value}
                      onValueChange={saveToList.onChange}
                      disabled={isSaving}
                      trackColor={{ false: colors.border, true: colors.primary[300] }}
                      thumbColor={saveToList.value ? colors.primary.DEFAULT : colors.surface}
                    />
                  </View>
                ))}

              <TouchableOpacity
                onPress={handleSubmit}
                className={`rounded-xl py-4 items-center mb-3 ${
                  canSubmit || isSaving ? 'bg-primary' : 'bg-border'
                }`}
                activeOpacity={0.8}
                disabled={!canSubmit}
              >
                {isSaving ? (
                  <ActivityIndicator color={colors.text.inverse} />
                ) : (
                  <Text
                    className={`font-semibold text-base ${
                      canSubmit ? 'text-white' : 'text-text-secondary'
                    }`}
                  >
                    {submitLabel}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleClose}
                className="py-3 items-center"
                activeOpacity={0.7}
                disabled={isSaving}
              >
                <Text className="text-text-secondary font-semibold text-base">
                  {t('common.cancel')}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
