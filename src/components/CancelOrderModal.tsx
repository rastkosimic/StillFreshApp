import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLocation } from '@/hooks/useLocation';
import { colors } from '@/theme/colors';

interface CancelOrderModalProps {
  visible: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: (reason?: string) => Promise<void>;
}

export default function CancelOrderModal({
  visible,
  isSubmitting,
  onClose,
  onConfirm,
}: CancelOrderModalProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { requestPermission } = useLocation();
  const [reason, setReason] = useState('');

  const handleConfirm = async () => {
    await requestPermission();
    await onConfirm(reason.trim() || undefined);
    setReason('');
  };

  const handleClose = () => {
    setReason('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View className="flex-1 justify-center bg-black/40 px-6">
        <View
          className="bg-surface rounded-2xl p-6"
          style={{ marginBottom: insets.bottom }}
        >
          <Text className="text-lg font-bold text-text-primary mb-2">
            {t('customer.cancelOrderTitle')}
          </Text>
          <Text className="text-sm text-text-secondary mb-4">
            {t('customer.cancelOrderDesc')}
          </Text>
          <Text className="text-xs text-text-secondary mb-3">
            {t('customer.cancelLocationRationale')}
          </Text>

          <TextInput
            className="bg-background border border-border rounded-xl px-4 py-3 text-text-primary text-base mb-4"
            placeholder={t('customer.cancelReasonPlaceholder')}
            placeholderTextColor={colors.text.secondary}
            value={reason}
            onChangeText={setReason}
            multiline
          />

          <TouchableOpacity
            onPress={handleConfirm}
            disabled={isSubmitting}
            className="bg-error rounded-xl py-4 items-center mb-3"
            activeOpacity={0.8}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-semibold text-base">
                {t('customer.cancelOrder')}
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
      </View>
    </Modal>
  );
}
