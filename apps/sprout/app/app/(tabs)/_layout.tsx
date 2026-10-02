import { SymbolView } from 'expo-symbols';
import { Tabs } from 'expo-router';

import { useClientOnlyValue } from '@/components/useClientOnlyValue';
import { useTheme } from '@/components/ui';

export default function TabLayout() {
  const t = useTheme();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: t.accent,
        tabBarInactiveTintColor: t.muted,
        tabBarStyle: { backgroundColor: t.card, borderTopColor: t.line },
        headerStyle: { backgroundColor: t.bg },
        headerShadowVisible: false,
        headerTitleStyle: { color: t.text, fontWeight: '700' },
        // Disable the static render of the header on web to prevent a hydration error.
        headerShown: useClientOnlyValue(false, true),
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          headerShown: false,
          tabBarButtonTestID: 'tab-home',
          tabBarIcon: ({ color }) => <SymbolView name={{ ios: 'drop.fill', android: 'water_drop', web: 'water_drop' }} tintColor={color} size={24} />,
        }}
      />
      <Tabs.Screen
        name="plants"
        options={{
          title: 'My Plants',
          tabBarButtonTestID: 'tab-plants',
          tabBarIcon: ({ color }) => <SymbolView name={{ ios: 'leaf.fill', android: 'eco', web: 'eco' }} tintColor={color} size={24} />,
        }}
      />
      <Tabs.Screen
        name="upcoming"
        options={{
          title: 'Upcoming',
          tabBarButtonTestID: 'tab-upcoming',
          tabBarIcon: ({ color }) => <SymbolView name={{ ios: 'calendar', android: 'calendar_month', web: 'calendar_month' }} tintColor={color} size={24} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarButtonTestID: 'tab-settings',
          tabBarIcon: ({ color }) => <SymbolView name={{ ios: 'gearshape.fill', android: 'settings', web: 'settings' }} tintColor={color} size={24} />,
        }}
      />
    </Tabs>
  );
}
