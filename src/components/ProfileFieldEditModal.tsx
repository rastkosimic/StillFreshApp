import { Ionicons } from '@expo/vector-icons';
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

import { ProfileFieldKey } from '@/hooks/useCustomerProfile';
import { colors } from '@/theme/colors';
import { isValidBirthday } from '@/utils/userHelpers';

const MAX_SHEET_HEIGHT = Dimensions.get('window').height * 0.85;

export type ProfileFieldEditorConfig =
  | {
      field: 'name';
      firstName: string;
      lastName: string;
    }
  | {
      field: Exclude<ProfileFieldKey, 'name'>;
      value: string;
    };

interface ProfileFieldEditModalProps {
  visible: boolean;
  config: ProfileFieldEditorConfig | null;
  isSaving: boolean;
  onClose: () => void;
  onSave: (field: ProfileFieldKey, values: Record<string, string>) => void;
}

export default function ProfileFieldEditModal({
  visible,
  config,
  isSaving,
  onClose,
  onSave,
}: ProfileFieldEditModalProps) {
  const { t } = useTranslation();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [singleValue, setSingleValue] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (config == null) return;

    setValidationError(null);
    if (config.field === 'name') {
      setFirstName(config.firstName);
      setLastName(config.lastName);
      setSingleValue('');
      return;
    }

    setSingleValue(config.value);
    setFirstName('');
    setLastName('');
  }, [config]);

  useEffect(() => {
    if (!visible) {
      setKeyboardHeight(0);
      return;
    }

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

  const handleClose = () => {
    if (isSaving) return;
    Keyboard.dismiss();
    setValidationError(null);
    onClose();
  };

  const handleSave = () => {
    if (config == null || isSaving) return;

    if (config.field === 'name') {
      onSave('name', { firstName, lastName });
      return;
    }

    if (config.field === 'birthday' && !isValidBirthday(singleValue)) {
      setValidationError('customer.profile.birthdayInvalid');
      return;
    }

    const payloadKey =
      config.field === 'phone'
        ? 'phoneNumber'
        : config.field === 'dietaryPreference'
          ? 'dietaryPreference'
          : config.field;

    onSave(config.field, { [payloadKey]: singleValue });
  };

  const titleKey =
    config == null
      ? 'customer.profile.editField'
      : ({
          name: 'customer.profile.name',
          phone: 'customer.profile.phone',
          address: 'customer.profile.address',
          country: 'customer.profile.country',
          birthday: 'customer.profile.birthday',
          dietaryPreference: 'customer.profile.dietaryPreference',
        } satisfies Record<ProfileFieldKey, string>)[config.field];

  const placeholderKey =
    config == null
      ? undefined
      : ({
          phone: 'auth.phone',
          address: 'customer.profile.addressPlaceholder',
          country: 'customer.profile.countryPlaceholder',
          birthday: 'customer.profile.birthdayPlaceholder',
          dietaryPreference: 'customer.profile.dietaryPlaceholder',
        } as Partial<Record<ProfileFieldKey, string>>)[config.field];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View className="flex-1 justify-end bg-black/40">
        <Pressable className="flex-1" onPress={handleClose} disabled={isSaving} />

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
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-lg font-bold text-text-primary">{t(titleKey)}</Text>
                <TouchableOpacity onPress={handleClose} hitSlop={8} disabled={isSaving}>
                  <Ionicons name="close" size={22} color={colors.text.secondary} />
                </TouchableOpacity>
              </View>

              {config?.field === 'name' ? (
                <>
                  <Text className="text-sm font-medium text-text-primary mb-1">
                    {t('customer.profile.firstName')}
                  </Text>
                  <TextInput
                    className="bg-surface border border-border rounded-xl px-4 py-3 text-text-primary text-base mb-3"
                    value={firstName}
                    onChangeText={setFirstName}
                    placeholder={t('customer.profile.firstName')}
                    placeholderTextColor={colors.text.secondary}
                    editable={!isSaving}
                    autoFocus
                    returnKeyType="next"
                  />
                  <Text className="text-sm font-medium text-text-primary mb-1">
                    {t('customer.profile.lastName')}
                  </Text>
                  <TextInput
                    className="bg-surface border border-border rounded-xl px-4 py-3 text-text-primary text-base mb-3"
                    value={lastName}
                    onChangeText={setLastName}
                    placeholder={t('customer.profile.lastName')}
                    placeholderTextColor={colors.text.secondary}
                    editable={!isSaving}
                    returnKeyType="done"
                    onSubmitEditing={handleSave}
                  />
                </>
              ) : (
                <TextInput
                  className={`bg-surface border rounded-xl px-4 py-3 text-text-primary text-base mb-3 ${
                    validationError != null ? 'border-error' : 'border-border'
                  }`}
                  value={singleValue}
                  onChangeText={(text) => {
                    setSingleValue(text);
                    if (validationError != null) setValidationError(null);
                  }}
                  placeholder={placeholderKey != null ? t(placeholderKey) : undefined}
                  placeholderTextColor={colors.text.secondary}
                  editable={!isSaving}
                  autoFocus
                  multiline={config?.field === 'address'}
                  numberOfLines={config?.field === 'address' ? 3 : 1}
                  textAlignVertical={config?.field === 'address' ? 'top' : 'center'}
                  keyboardType={config?.field === 'phone' ? 'phone-pad' : 'default'}
                  autoCapitalize={config?.field === 'country' ? 'characters' : 'sentences'}
                  returnKeyType={config?.field === 'address' ? 'default' : 'done'}
                  onSubmitEditing={config?.field === 'address' ? undefined : handleSave}
                />
              )}

              {validationError != null && (
                <Text className="text-error text-xs mb-3">{t(validationError)}</Text>
              )}

              <TouchableOpacity
                onPress={handleSave}
                className="bg-primary rounded-xl py-4 items-center mb-3"
                activeOpacity={0.8}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white font-semibold text-base">{t('common.save')}</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleClose}
                className="py-3 items-center"
                activeOpacity={0.7}
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
