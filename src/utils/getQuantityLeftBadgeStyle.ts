import { colors } from '@/theme/colors';

export interface QuantityLeftBadgeStyle {
  backgroundColor: string;
  borderColor?: string;
  borderWidth?: number;
  textColor: string;
}

/** Stock-tier colors for "X left" badges per APP_SPEC (red ≤3, yellow 4–5, green >5). */
export function getQuantityLeftBadgeStyle(quantityAvailable: number): QuantityLeftBadgeStyle {
  const quantity = Number(quantityAvailable);

  if (!Number.isFinite(quantity) || quantity <= 3) {
    return {
      backgroundColor: colors.error,
      textColor: colors.text.inverse,
    };
  }

  if (quantity <= 5) {
    return {
      backgroundColor: colors.warning,
      textColor: colors.text.inverse,
    };
  }

  return {
    backgroundColor: colors.primary.DEFAULT,
    textColor: colors.text.inverse,
  };
}
