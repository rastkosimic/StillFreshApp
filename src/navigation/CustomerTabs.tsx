import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';

import CustomerHomeScreen from '@/screens/customer/CustomerHomeScreen';
import CustomerProfileScreen from '@/screens/customer/CustomerProfileScreen';
import FavoritesScreen from '@/screens/customer/FavoritesScreen';
import OrdersScreen from '@/screens/customer/OrdersScreen';
import { colors } from '@/theme/colors';

import { CustomerTabParamList } from './types';

const Tab = createBottomTabNavigator<CustomerTabParamList>();

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

function tabIcon(active: IoniconsName, inactive: IoniconsName) {
  return ({ color, size }: { color: string; size: number }) => (
    <Ionicons name={active} size={size} color={color} />
  );
}

export default function CustomerTabs() {
  const { t } = useTranslation();

  return (
    <Tab.Navigator
      initialRouteName="CustomerHome"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary.DEFAULT,
        tabBarInactiveTintColor: colors.text.secondary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
      }}
    >
      <Tab.Screen
        name="CustomerHome"
        component={CustomerHomeScreen}
        options={{
          title: t('customer.discover'),
          tabBarIcon: tabIcon('compass', 'compass-outline'),
        }}
      />
      <Tab.Screen
        name="Favorites"
        component={FavoritesScreen}
        options={{
          title: t('customer.favourites'),
          tabBarIcon: tabIcon('heart', 'heart-outline'),
        }}
      />
      <Tab.Screen
        name="Orders"
        component={OrdersScreen}
        options={{
          title: t('customer.basket'),
          tabBarIcon: tabIcon('bag', 'bag-outline'),
        }}
      />
      <Tab.Screen
        name="CustomerProfile"
        component={CustomerProfileScreen}
        options={{
          title: t('navigation.profile'),
          tabBarIcon: tabIcon('person', 'person-outline'),
        }}
      />
    </Tab.Navigator>
  );
}
