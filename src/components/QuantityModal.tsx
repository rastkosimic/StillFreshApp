import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Modal,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/theme/colors';

interface QuantityModalProps {
  visible: boolean;
  maxQuantity: number;
  unitPrice: number;
  currency: string;
  onClose: () => void;
  onConfirm: (quantity: number) => void;
}

export default function QuantityModal({
  visible,
  maxQuantity,
  onClose,
  onConfirm,
}: QuantityModalProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = () => {
    if (quantity < 1 || quantity > maxQuantity) {
      setError(t('customer.quantityInvalid', { max: maxQuantity }));
      return;
    }
    setError(null);
    onConfirm(quantity);
  };

  const handleClose = () => {
    setQuantity(1);
    setError(null);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View className="flex-1 justify-end bg-black/40">
        <View
          className="bg-surface rounded-t-2xl px-6 pt-5"
          style={{ paddingBottom: insets.bottom + 20 }}
        >
          <Text className="text-lg font-bold text-text-primary mb-4">
            {t('customer.quantityModalTitle')}
          </Text>

          <View className="flex-row items-center justify-center gap-6 mb-4">
            <TouchableOpacity
              onPress={() => setQuantity((q) => Math.max(1, q - 1))}
              className="w-11 h-11 rounded-full bg-border items-center justify-center"
              activeOpacity={0.7}
              disabled={quantity <= 1}
            >
              <Text className="text-xl font-bold text-text-primary">−</Text>
            </TouchableOpacity>

            <Text className="text-2xl font-extrabold text-text-primary min-w-[40px] text-center">
              {quantity}
            </Text>

            <TouchableOpacity
              onPress={() => setQuantity((q) => Math.min(maxQuantity, q + 1))}
              className="w-11 h-11 rounded-full bg-primary items-center justify-center"
              activeOpacity={0.7}
              disabled={quantity >= maxQuantity}
            >
              <Text className="text-xl font-bold text-white">+</Text>
            </TouchableOpacity>
          </View>

          <Text className="text-sm text-text-secondary text-center mb-4">
            {t('customer.quantity')}: 1–{maxQuantity}
          </Text>

          {error != null && (
            <Text className="text-error text-xs text-center mb-3">{error}</Text>
          )}

          <TouchableOpacity
            onPress={handleConfirm}
            className="bg-primary rounded-xl py-4 items-center mb-3"
            activeOpacity={0.8}
          >
            <Text className="text-white font-semibold text-base">
              {t('customer.confirmReservation')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleClose} className="py-3 items-center" activeOpacity={0.7}>
            <Text className="text-text-secondary font-semibold text-base">{t('common.cancel')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
