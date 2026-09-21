import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Dimensions,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { colors } from '@/theme/colors';

const MAX_SHEET_HEIGHT = Dimensions.get('window').height * 0.85;

const REASON_PRESETS = [
  'vendor.orderDetail.reasonOutOfStock',
  'vendor.orderDetail.reasonUnableToFulfill',
  'vendor.orderDetail.reasonQualityIssue',
] as const;

interface RejectOrderModalProps {
  visible: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}

export default function RejectOrderModal({
  visible,
  isSubmitting,
  onClose,
  onConfirm,
}: RejectOrderModalProps) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (!visible) {
      setKeyboardHeight(0);
      setReason('');
      setSelectedPreset(null);
      setValidationError(null);
      return;
    }
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showListener = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideListener = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => {
      showListener.remove();
      hideListener.remove();
    };
  }, [visible]);

  const handleClose = () => {
    if (isSubmitting) return;
    Keyboard.dismiss();
    onClose();
  };

  const handlePreset = (key: string) => {
    const label = t(key);
    setSelectedPreset(key);
    setReason(label);
    setValidationError(null);
  };

  const handleConfirm = async () => {
    const trimmed = reason.trim();
    if (trimmed.length === 0) {
      setValidationError(t('vendor.orderDetail.cancelReasonRequired'));
      return;
    }
    await onConfirm(trimmed);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View className="flex-1 justify-end bg-black/40">
        <Pressable className="flex-1" onPress={handleClose} disabled={isSubmitting} />
        <View style={{ marginBottom: keyboardHeight, maxHeight: MAX_SHEET_HEIGHT }}>
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
              <Text className="text-lg font-bold text-text-primary mb-2">
                {t('vendor.orderDetail.cancelOrderTitle')}
              </Text>
              <Text className="text-sm text-text-secondary mb-4">
                {t('vendor.orderDetail.cancelOrderDesc')}
              </Text>

              <Text className="text-sm font-medium text-text-primary mb-2">
                {t('vendor.orderDetail.cancelReasonLabel')}
              </Text>

              <View className="flex-row flex-wrap gap-2 mb-3">
                {REASON_PRESETS.map((key) => {
                  const isActive = selectedPreset === key;
                  return (
                    <TouchableOpacity
                      key={key}
                      onPress={() => handlePreset(key)}
                      disabled={isSubmitting}
                      className={`rounded-full px-4 py-1.5 ${
                        isActive ? 'bg-primary' : 'bg-surface border border-border'
                      }`}
                      activeOpacity={0.8}
                    >
                      <Text
                        className={`text-sm font-semibold ${
                          isActive ? 'text-white' : 'text-text-primary'
                        }`}
                      >
                        {t(key)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TextInput
                className={`bg-background border rounded-xl px-4 py-3 text-text-primary text-base mb-2 min-h-[88px] ${
                  validationError != null ? 'border-error' : 'border-border'
                }`}
                placeholder={t('vendor.orderDetail.cancelReasonPlaceholder')}
                placeholderTextColor={colors.text.secondary}
                value={reason}
                onChangeText={(text) => {
                  setReason(text);
                  setSelectedPreset(null);
                  if (validationError != null) setValidationError(null);
                }}
                multiline
                textAlignVertical="top"
                editable={!isSubmitting}
              />

              {validationError != null && (
                <Text className="text-error text-xs mb-3">{validationError}</Text>
              )}

              <TouchableOpacity
                onPress={() => void handleConfirm()}
                disabled={isSubmitting}
                className="bg-error rounded-xl py-4 items-center mb-3 mt-1"
                activeOpacity={0.8}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white font-semibold text-base">
                    {t('vendor.orderDetail.cancelOrder')}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleClose}
                disabled={isSubmitting}
                className="py-3 items-center"
                activeOpacity={0.7}
              >
                <Text className="text-text-secondary font-semibold text-base">
                  {t('common.back')}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
