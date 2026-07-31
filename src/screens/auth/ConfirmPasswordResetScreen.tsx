import { View, Text } from 'react-native';
import { AuthStackScreenProps } from '@/navigation/types';

type Props = AuthStackScreenProps<'ConfirmPasswordReset'>;

export default function ConfirmPasswordResetScreen(_props: Props) {
  return (
    <View className="flex-1 items-center justify-center bg-background">
      <Text className="text-text-primary text-lg">Confirm Password Reset</Text>
    </View>
  );
}
