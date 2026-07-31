import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import { LEGAL_URLS, openLegalUrl, termsUrlForRole } from '@/config/legal';

type Props = {
  checked: boolean;
  onToggle: () => void;
  /** Determines which terms document the link opens. Omit for customer signup. */
  role?: string | null;
  /** Highlight the box in the error color (e.g. tried to continue without accepting). */
  error?: boolean;
  disabled?: boolean;
};

/**
 * Signup consent row: a checkbox plus the sentence
 * "Prihvatam Uslove korišćenja i Politiku privatnosti." where the two document
 * names are tappable and open the hosted legal pages in an in-app browser.
 */
export default function LegalAcceptanceCheckbox({
  checked,
  onToggle,
  role,
  error,
  disabled,
}: Props) {
  const { t } = useTranslation();
  const termsUrl = termsUrlForRole(role);

  return (
    <TouchableOpacity
      onPress={onToggle}
      activeOpacity={0.7}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      className="flex-row items-start"
    >
      <View
        className={`w-5 h-5 rounded-md border items-center justify-center mt-0.5 ${
          checked
            ? 'bg-primary border-primary'
            : error
              ? 'border-error'
              : 'border-border'
        }`}
      >
        {checked && <Ionicons name="checkmark" size={14} color="#fff" />}
      </View>
      <Text className="flex-1 ml-3 text-sm text-text-secondary leading-5">
        {t('legal.acceptIntro')}
        <Text
          className="text-primary font-semibold"
          suppressHighlighting
          onPress={() => void openLegalUrl(termsUrl)}
        >
          {t('legal.acceptTermsLink')}
        </Text>
        {t('legal.acceptAnd')}
        <Text
          className="text-primary font-semibold"
          suppressHighlighting
          onPress={() => void openLegalUrl(LEGAL_URLS.privacy)}
        >
          {t('legal.acceptPrivacyLink')}
        </Text>
        {t('legal.acceptOutro')}
      </Text>
    </TouchableOpacity>
  );
}
