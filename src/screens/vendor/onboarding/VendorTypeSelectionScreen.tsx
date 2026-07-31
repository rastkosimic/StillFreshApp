import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { OnboardingStackScreenProps } from '@/navigation/types';
import { setVendorType } from '@/services/vendorService';
import { colors } from '@/theme/colors';
import { VendorType } from '@/types';

type Props = OnboardingStackScreenProps<'VendorTypeSelection'>;

type FeatherName = React.ComponentProps<typeof Feather>['name'];

export default function VendorTypeSelectionScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const [selectedType, setSelectedType] = useState<VendorType | null>(null);
  const [chainName, setChainName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isChain = selectedType === 'CHAIN';
  const total = isChain ? 5 : 4;
  const canContinue = selectedType !== null && (!isChain || chainName.trim().length > 0);

  const onSubmit = async () => {
    if (!selectedType) return;
    setIsSubmitting(true);
    try {
      await setVendorType(selectedType, isChain ? chainName.trim() : undefined);
    } catch (err: unknown) {
      const httpStatus = (err as { status?: number })?.status;
      if (!httpStatus || httpStatus >= 500) {
        Alert.alert(t('common.error'), t('errors.serverError'));
        setIsSubmitting(false);
        return;
      }
      // 4xx = backend rejects re-submission (already set) — navigate forward anyway
    }
    navigation.navigate('OnboardingFlow');
    setIsSubmitting(false);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 52, paddingBottom: 32 }}>

          {/* Progress bar */}
          <ProgressBar current={1} total={total} />


          {/* Title */}
          <Text
            style={{
              fontSize: 28,
              fontWeight: '700',
              color: colors.text.primary,
              marginTop: 28,
              marginBottom: 8,
              lineHeight: 34,
            }}
          >
            {t('vendor.onboarding.typeTitle')}
          </Text>
          <Text
            style={{
              fontSize: 15,
              color: colors.text.secondary,
              lineHeight: 22,
              marginBottom: 28,
            }}
          >
            {t('vendor.onboarding.typeDesc')}
          </Text>

          {/* Type options */}
          <TypeCard
            icon="coffee"
            title={t('vendor.onboarding.typeUnique')}
            description={t('vendor.onboarding.typeUniqueDesc')}
            selected={selectedType === 'UNIQUE'}
            onPress={() => { setSelectedType('UNIQUE'); setChainName(''); }}
          />

          <TypeCard
            icon="git-branch"
            title={t('vendor.onboarding.typeChain')}
            description={t('vendor.onboarding.typeChainDesc')}
            selected={selectedType === 'CHAIN'}
            onPress={() => setSelectedType('CHAIN')}
          />

          {/* Chain name input — slides in when CHAIN is selected */}
          {isChain && (
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: 14,
                overflow: 'hidden',
                marginTop: 4,
                marginBottom: 4,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.06,
                shadowRadius: 3,
                elevation: 2,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  gap: 12,
                }}
              >
                <Text style={{ fontSize: 15, color: colors.text.primary, width: 120 }}>
                  {t('vendor.onboarding.chainName')}
                  <Text style={{ color: colors.error }}> *</Text>
                </Text>
                <TextInput
                  value={chainName}
                  onChangeText={setChainName}
                  placeholder={t('vendor.onboarding.chainNamePlaceholder')}
                  placeholderTextColor="#C7C7CC"
                  style={{
                    flex: 1,
                    fontSize: 15,
                    color: colors.text.primary,
                    textAlign: 'right',
                  }}
                  autoCorrect={false}
                  editable={!isSubmitting}
                  autoFocus
                />
              </View>
            </View>
          )}

          <View style={{ flex: 1 }} />

          {/* Continue button */}
          <TouchableOpacity
            style={{
              borderRadius: 14,
              paddingVertical: 15,
              alignItems: 'center',
              marginTop: 24,
              backgroundColor: canContinue ? colors.primary.DEFAULT : '#E5E5EA',
            }}
            onPress={onSubmit}
            disabled={!canContinue || isSubmitting}
            activeOpacity={0.8}
          >
            {isSubmitting ? (
              <ActivityIndicator color={canContinue ? '#fff' : colors.text.secondary} />
            ) : (
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: '600',
                  color: canContinue ? '#fff' : colors.text.secondary,
                }}
              >
                {t('common.continue')}
              </Text>
            )}
          </TouchableOpacity>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({ current, total }: { current: number; total: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: 4,
            borderRadius: 2,
            backgroundColor:
              i < current - 1
                ? colors.primary.DEFAULT
                : i === current - 1
                  ? colors.accent.DEFAULT
                  : colors.border,
          }}
        />
      ))}
    </View>
  );
}

// ── Type selection card ───────────────────────────────────────────────────────

function TypeCard({
  icon,
  title,
  description,
  selected,
  onPress,
}: {
  icon: FeatherName;
  title: string;
  description: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={{
        backgroundColor: colors.surface,
        borderRadius: 14,
        padding: 16,
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 3,
        elevation: 2,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? colors.primary.DEFAULT : colors.border,
      }}
    >
      {/* Icon */}
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 10,
          backgroundColor: selected ? colors.primary[50] : '#F2F2F7',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Feather
          name={icon}
          size={22}
          color={selected ? colors.primary.DEFAULT : colors.text.secondary}
        />
      </View>

      {/* Text */}
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 15,
            fontWeight: '600',
            color: colors.text.primary,
            marginBottom: 3,
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            fontSize: 13,
            color: colors.text.secondary,
            lineHeight: 18,
          }}
        >
          {description}
        </Text>
      </View>

      {/* Selection indicator */}
      {selected ? (
        <Feather name="check-circle" size={22} color={colors.primary.DEFAULT} />
      ) : (
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 11,
            borderWidth: 1.5,
            borderColor: colors.border,
          }}
        />
      )}
    </TouchableOpacity>
  );
}
