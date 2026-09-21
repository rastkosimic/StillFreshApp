import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';

import VendorAllOffersScreen from '@/screens/vendor/VendorAllOffersScreen';
import VendorAnalyticsScreen from '@/screens/vendor/VendorAnalyticsScreen';
import VendorDashboardScreen from '@/screens/vendor/VendorDashboardScreen';
import VendorProfileScreen from '@/screens/vendor/VendorProfileScreen';
import { useNotificationStore } from '@/stores/notificationStore';
import { colors } from '@/theme/colors';

import { VendorTabParamList } from './types';

const Tab = createBottomTabNavigator<VendorTabParamList>();

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

function tabIcon(active: IoniconsName, inactive: IoniconsName) {
  return ({ color, size, focused }: { color: string; size: number; focused: boolean }) => (
    <Ionicons name={focused ? active : inactive} size={size} color={color} />
  );
}

export default function VendorTabs() {
  const { t } = useTranslation();
  const unreadCount = useNotificationStore((state) => state.unreadCount);

  return (
    <Tab.Navigator
      initialRouteName="VendorDashboard"
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
        name="VendorDashboard"
        component={VendorDashboardScreen}
        options={{
          title: t('navigation.dashboard'),
          tabBarIcon: tabIcon('grid', 'grid-outline'),
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
        }}
      />
      <Tab.Screen
        name="VendorOffers"
        component={VendorAllOffersScreen}
        options={{
          title: t('navigation.offers'),
          tabBarIcon: tabIcon('pricetag', 'pricetag-outline'),
        }}
      />
      <Tab.Screen
        name="Analytics"
        component={VendorAnalyticsScreen}
        options={{
          title: t('navigation.analytics'),
          tabBarIcon: tabIcon('bar-chart', 'bar-chart-outline'),
        }}
      />
      <Tab.Screen
        name="VendorProfile"
        component={VendorProfileScreen}
        options={{
          title: t('navigation.profile'),
          tabBarIcon: tabIcon('person', 'person-outline'),
        }}
      />
    </Tab.Navigator>
  );
}
