import { Feather, Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
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
import { ChainLocation, Worker, WorkerRequest, WorkerUpdateRequest } from '@/types';

const MAX_SHEET_HEIGHT = Dimensions.get('window').height * 0.85;
const USERNAME_MIN = 3;
const USERNAME_MAX = 50;
const PASSWORD_MIN = 6;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface WorkerFormResult {
  create?: WorkerRequest;
  update?: WorkerUpdateRequest;
}

interface WorkerFormModalProps {
  visible: boolean;
  /** null puts the form in create mode. */
  worker: Worker | null;
  isSaving: boolean;
  /** Server-side field errors, keyed by `username` or `email`. */
  fieldErrors: Record<string, string>;
  /** Reassignment targets — headquarters only; empty hides the picker. */
  reassignTargets: ChainLocation[];
  /** Warns before creating staff for a location that cannot publish offers yet. */
  isLocationPayoutReady: boolean;
  onClose: () => void;
  onSubmit: (result: WorkerFormResult) => void;
  onFieldChange: (field: string) => void;
}

export default function WorkerFormModal({
  visible,
  worker,
  isSaving,
  fieldErrors,
  reassignTargets,
  isLocationPayoutReady,
  onClose,
  onSubmit,
  onFieldChange,
}: WorkerFormModalProps) {
  const { t } = useTranslation();
  const isEdit = worker != null;

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [assignedLocationId, setAssignedLocationId] = useState<number | null>(null);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (!visible) return;
    setUsername(worker?.username ?? '');
    setEmail(worker?.email ?? '');
    setPassword('');
    setPhone(worker?.phone ?? '');
    setAssignedLocationId(worker?.assignedLocationId ?? null);
    setIsPasswordVisible(false);
    setLocalError(null);
  }, [visible, worker]);

  useEffect(() => {
    if (!visible) {
      setKeyboardHeight(0);
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

  const trimmedUsername = username.trim();
  const isUsernameValid =
    trimmedUsername.length >= USERNAME_MIN && trimmedUsername.length <= USERNAME_MAX;

  const canSubmit = useMemo(() => {
    if (isSaving) return false;
    if (isEdit) return isUsernameValid;
    // Workers can log in immediately; creating them for a location that cannot sell
    // only produces failed offer publishes — block until payout is ready.
    if (!isLocationPayoutReady) return false;
    return (
      isUsernameValid &&
      EMAIL_PATTERN.test(email.trim()) &&
      password.length >= PASSWORD_MIN
    );
  }, [isEdit, isSaving, isUsernameValid, email, password, isLocationPayoutReady]);

  const handleClose = () => {
    if (isSaving) return;
    Keyboard.dismiss();
    onClose();
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    setLocalError(null);

    if (isEdit) {
      // Absent fields are left untouched by the server, so send only what actually changed.
      const update: WorkerUpdateRequest = {};
      if (trimmedUsername !== worker.username) update.username = trimmedUsername;
      if (phone.trim() !== (worker.phone ?? '')) update.phone = phone.trim();
      if (
        assignedLocationId != null &&
        assignedLocationId !== worker.assignedLocationId
      ) {
        update.assignedLocationId = assignedLocationId;
      }
      if (Object.keys(update).length === 0) {
        handleClose();
        return;
      }
      onSubmit({ update });
      return;
    }

    onSubmit({
      create: {
        username: trimmedUsername,
        email: email.trim(),
        password,
        phone: phone.trim() || undefined,
      },
    });
  };

  const generatePassword = () => {
    setPassword(makePassword());
    setIsPasswordVisible(true);
    setLocalError(null);
  };

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
                <Text className="text-lg font-bold text-text-primary">
                  {isEdit ? t('vendor.workers.editTitle') : t('vendor.workers.addTitle')}
                </Text>
                <TouchableOpacity onPress={handleClose} hitSlop={8} disabled={isSaving}>
                  <Ionicons name="close" size={22} color={colors.text.secondary} />
                </TouchableOpacity>
              </View>

              {!isEdit && !isLocationPayoutReady && (
                <View
                  className="rounded-xl px-4 py-3 mb-4 flex-row gap-2.5"
                  style={{ backgroundColor: `${colors.warning}14` }}
                >
                  <Feather name="alert-triangle" size={16} color={colors.warning} />
                  <Text className="text-xs leading-4 flex-1 text-text-primary">
                    {t('vendor.workers.locationNotReadyWarning')}
                  </Text>
                </View>
              )}

              <Label text={`${t('vendor.workers.username')} *`} />
              <Input
                value={username}
                onChangeText={(v) => {
                  setUsername(v);
                  onFieldChange('username');
                }}
                placeholder="milan.novisad"
                autoCapitalize="none"
                hasError={fieldErrors.username != null}
                editable={!isSaving}
              />
              <FieldNote
                error={fieldErrors.username}
                hint={t('vendor.workers.usernameHint')}
              />

              <Label text={`${t('vendor.workers.email')} *`} />
              <Input
                value={email}
                onChangeText={(v) => {
                  setEmail(v);
                  onFieldChange('email');
                }}
                placeholder="milan@example.rs"
                keyboardType="email-address"
                autoCapitalize="none"
                hasError={fieldErrors.email != null}
                /* Email is the login identifier and cannot be changed after creation. */
                editable={!isEdit && !isSaving}
              />
              <FieldNote
                error={fieldErrors.email}
                hint={isEdit ? t('vendor.workers.emailLocked') : undefined}
              />

              {!isEdit && (
                <>
                  <View className="flex-row items-center justify-between mb-1 mt-3">
                    <Text className="text-sm font-medium text-text-primary">
                      {t('vendor.workers.password')} *
                    </Text>
                    <TouchableOpacity onPress={generatePassword} hitSlop={8} activeOpacity={0.7}>
                      <Text className="text-primary text-sm font-semibold">
                        {t('vendor.workers.generate')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <View className="relative">
                    <Input
                      value={password}
                      onChangeText={(v) => {
                        setPassword(v);
                        setLocalError(null);
                      }}
                      placeholder={t('vendor.workers.passwordPlaceholder')}
                      secureTextEntry={!isPasswordVisible}
                      autoCapitalize="none"
                      editable={!isSaving}
                    />
                    <TouchableOpacity
                      className="absolute right-3 top-3"
                      hitSlop={8}
                      onPress={() => setIsPasswordVisible((v) => !v)}
                    >
                      <Feather
                        name={isPasswordVisible ? 'eye-off' : 'eye'}
                        size={18}
                        color={colors.text.secondary}
                      />
                    </TouchableOpacity>
                  </View>
                  <FieldNote hint={t('vendor.workers.passwordHint')} />
                </>
              )}

              <Label text={t('vendor.workers.phone')} />
              <Input
                value={phone}
                onChangeText={setPhone}
                placeholder="+381601234567"
                keyboardType="phone-pad"
                editable={!isSaving}
              />
              <FieldNote hint={t('vendor.workers.phoneHint')} />

              {isEdit && reassignTargets.length > 1 && (
                <>
                  <Label text={t('vendor.workers.assignedLocation')} />
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 6, paddingBottom: 4 }}
                    keyboardShouldPersistTaps="handled"
                  >
                    {reassignTargets.map((loc) => {
                      const isSelected = assignedLocationId === loc.id;
                      return (
                        <TouchableOpacity
                          key={loc.id}
                          onPress={() => setAssignedLocationId(loc.id)}
                          className="rounded-full px-3 py-1.5 border"
                          style={{
                            backgroundColor: isSelected
                              ? colors.primary.DEFAULT
                              : colors.surface,
                            borderColor: isSelected ? colors.primary.DEFAULT : colors.border,
                          }}
                        >
                          <Text
                            className="text-xs font-semibold"
                            style={{ color: isSelected ? '#fff' : colors.text.secondary }}
                          >
                            {loc.locationName}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                  <FieldNote hint={t('vendor.workers.reassignHint')} />
                </>
              )}

              {localError ? (
                <Text className="text-error text-xs mt-2">{localError}</Text>
              ) : null}

              <TouchableOpacity
                onPress={handleSubmit}
                disabled={!canSubmit}
                className="rounded-xl py-4 items-center mt-5 mb-3"
                style={{ backgroundColor: canSubmit ? colors.primary.DEFAULT : colors.border }}
                activeOpacity={0.8}
              >
                {isSaving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text
                    className="font-semibold text-base"
                    style={{ color: canSubmit ? '#fff' : colors.text.secondary }}
                  >
                    {isEdit ? t('common.save') : t('vendor.workers.create')}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity onPress={handleClose} className="py-3 items-center" activeOpacity={0.7}>
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

// ── Helpers ───────────────────────────────────────────────────────────────────

const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

/** Omits look-alike characters so the admin can dictate the password over the phone. */
function makePassword(length = 12): string {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += PASSWORD_ALPHABET[Math.floor(Math.random() * PASSWORD_ALPHABET.length)];
  }
  return out;
}

function Label({ text }: { text: string }) {
  return <Text className="text-sm font-medium text-text-primary mb-1 mt-3">{text}</Text>;
}

function FieldNote({ error, hint }: { error?: string; hint?: string }) {
  if (error) return <Text className="text-error text-xs mt-1">{error}</Text>;
  if (hint) return <Text className="text-text-secondary text-xs mt-1">{hint}</Text>;
  return null;
}

function Input({
  hasError,
  editable = true,
  ...props
}: React.ComponentProps<typeof TextInput> & { hasError?: boolean }) {
  return (
    <TextInput
      className="bg-surface border rounded-xl px-4 py-3 text-text-primary text-base"
      placeholderTextColor={colors.text.secondary}
      editable={editable}
      style={{
        borderColor: hasError
          ? colors.error
          : (props.value?.length ?? 0) > 0
            ? colors.primary.DEFAULT
            : colors.border,
        opacity: editable ? 1 : 0.6,
      }}
      {...props}
    />
  );
}
