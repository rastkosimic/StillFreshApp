import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, Share, Text, TouchableOpacity, View } from 'react-native';

import { colors } from '@/theme/colors';

interface OneTimeCredentialsModalProps {
  visible: boolean;
  title: string;
  description: string;
  username?: string | null;
  password?: string | null;
  /** Secondary line explaining why the credentials email did not arrive. */
  errorDetail?: string | null;
  onDismiss: () => void;
}

/**
 * Shows credentials that exist nowhere else — the backend returns a location's generated
 * password only when the credentials email failed, and a worker's password is never returned
 * at all. Dismissal is gated behind an acknowledgement because closing this loses the value.
 *
 * These values must never reach logs, analytics or crash reports.
 */
export default function OneTimeCredentialsModal({
  visible,
  title,
  description,
  username,
  password,
  errorDetail,
  onDismiss,
}: OneTimeCredentialsModalProps) {
  const { t } = useTranslation();
  const [hasAcknowledged, setHasAcknowledged] = useState(false);

  const onShare = () => {
    const lines = [
      username ? `${t('vendor.credentials.username')}: ${username}` : null,
      password ? `${t('vendor.credentials.password')}: ${password}` : null,
    ].filter(Boolean);
    void Share.share({ message: lines.join('\n') });
  };

  const close = () => {
    setHasAcknowledged(false);
    onDismiss();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => undefined}>
      <View className="flex-1 justify-center bg-black/50 px-6">
        <View className="bg-surface rounded-2xl overflow-hidden">
          <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
            <View className="px-6 pt-6 pb-5">
              <View
                className="w-12 h-12 rounded-full items-center justify-center mb-4"
                style={{ backgroundColor: `${colors.warning}1F` }}
              >
                <Feather name="key" size={22} color={colors.warning} />
              </View>

              <Text className="text-lg font-bold text-text-primary mb-2">{title}</Text>
              <Text className="text-sm text-text-secondary leading-5 mb-1">{description}</Text>
              {errorDetail ? (
                <Text className="text-xs text-text-secondary leading-4 mb-1">{errorDetail}</Text>
              ) : null}

              <View
                className="rounded-xl px-4 py-3 mt-4"
                style={{ backgroundColor: colors.background }}
              >
                {username ? (
                  <CredentialRow label={t('vendor.credentials.username')} value={username} />
                ) : null}
                {password ? (
                  <View className={username ? 'mt-3' : undefined}>
                    <CredentialRow label={t('vendor.credentials.password')} value={password} />
                  </View>
                ) : null}
              </View>

              <TouchableOpacity
                onPress={onShare}
                activeOpacity={0.8}
                className="bg-surface border border-border rounded-xl py-3 items-center flex-row justify-center gap-2 mt-3"
              >
                <Feather name="share-2" size={16} color={colors.primary.DEFAULT} />
                <Text className="text-primary font-semibold text-sm">
                  {t('vendor.credentials.share')}
                </Text>
              </TouchableOpacity>

              <View
                className="rounded-xl px-4 py-3 mt-4 flex-row gap-2"
                style={{ backgroundColor: `${colors.error}12` }}
              >
                <Feather name="alert-triangle" size={16} color={colors.error} />
                <Text className="text-xs leading-4 flex-1" style={{ color: colors.error }}>
                  {t('vendor.credentials.warning')}
                </Text>
              </View>

              <Pressable
                onPress={() => setHasAcknowledged((v) => !v)}
                className="flex-row items-start gap-3 mt-4"
                hitSlop={6}
              >
                <View
                  className="w-5 h-5 rounded items-center justify-center mt-0.5"
                  style={{
                    backgroundColor: hasAcknowledged ? colors.primary.DEFAULT : colors.surface,
                    borderWidth: 1.5,
                    borderColor: hasAcknowledged ? colors.primary.DEFAULT : colors.border,
                  }}
                >
                  {hasAcknowledged && <Feather name="check" size={13} color="#fff" />}
                </View>
                <Text className="text-sm text-text-primary flex-1 leading-5">
                  {t('vendor.credentials.acknowledge')}
                </Text>
              </Pressable>

              <TouchableOpacity
                onPress={close}
                disabled={!hasAcknowledged}
                activeOpacity={0.8}
                className="rounded-xl py-4 items-center mt-5"
                style={{
                  backgroundColor: hasAcknowledged ? colors.primary.DEFAULT : colors.border,
                }}
              >
                <Text
                  className="font-semibold text-base"
                  style={{ color: hasAcknowledged ? '#fff' : colors.text.secondary }}
                >
                  {t('vendor.credentials.done')}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function CredentialRow({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text className="text-[11px] text-text-secondary uppercase tracking-wide font-semibold">
        {label}
      </Text>
      <Text className="text-base font-bold text-text-primary mt-0.5" selectable>
        {value}
      </Text>
    </View>
  );
}
