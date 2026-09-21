import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import TabBarIconWithBadge from '@/components/TabBarIconWithBadge';
import CustomerHomeScreen from '@/screens/customer/CustomerHomeScreen';
import CustomerProfileScreen from '@/screens/customer/CustomerProfileScreen';
import FavoritesScreen from '@/screens/customer/FavoritesScreen';
import OrdersScreen from '@/screens/customer/OrdersScreen';
import { useBasketStore } from '@/stores/basketStore';
import { colors } from '@/theme/colors';

import { CustomerTabParamList } from './types';

const Tab = createBottomTabNavigator<CustomerTabParamList>();

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

function tabIcon(active: IoniconsName, inactive: IoniconsName) {
  return ({ color, size, focused }: { color: string; size: number; focused: boolean }) => (
    <Ionicons name={focused ? active : inactive} size={size} color={color} />
  );
}

function tabIconWithBadge(active: IoniconsName, inactive: IoniconsName, badge?: number) {
  return ({ color, size, focused }: { color: string; size: number; focused: boolean }) => (
    <TabBarIconWithBadge
      name={focused ? active : inactive}
      color={color}
      size={size}
      badge={badge}
    />
  );
}

export default function CustomerTabs() {
  const { t } = useTranslation();
  const activeCount = useBasketStore((state) => state.activeCount);
  const fetchActiveCount = useBasketStore((state) => state.fetchActiveCount);

  useEffect(() => {
    void fetchActiveCount();
  }, [fetchActiveCount]);

  return (
    <Tab.Navigator
      initialRouteName="CustomerHome"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary.DEFAULT,
        tabBarInactiveTintColor: colors.text.secondary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarBadgeStyle: {
          backgroundColor: colors.error,
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
          tabBarIcon: tabIconWithBadge('bag', 'bag-outline', activeCount > 0 ? activeCount : undefined),
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
