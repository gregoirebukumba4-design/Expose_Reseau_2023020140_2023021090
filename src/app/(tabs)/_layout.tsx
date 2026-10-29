import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { palette } from '@/components/maintenance-ui';

const tabIcons: Record<string, string> = {
  index: '⌂',
  equipements: '▦',
  maintenance: '◷',
  interventions: '✓',
  techniciens: '♧',
  outils: '⌖',
};

const tabLabels: Record<string, string> = {
  index: 'Accueil',
  equipements: 'Parc',
  maintenance: 'Planning',
  interventions: 'Suivi',
  techniciens: 'Équipe',
  outils: 'Terrain',
};

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: palette.green,
        tabBarInactiveTintColor: palette.muted,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E8EDEE',
          height: 66,
          paddingTop: 7,
          paddingBottom: 7,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '700' },
        tabBarIcon: ({ color }) => (
          <Text style={{ color, fontSize: 20, fontWeight: '700', lineHeight: 22 }}>
            {tabIcons[route.name]}
          </Text>
        ),
        title: tabLabels[route.name],
      })}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="equipements" />
      <Tabs.Screen name="maintenance" />
      <Tabs.Screen name="interventions" />
      <Tabs.Screen name="techniciens" />
      <Tabs.Screen name="outils" />
    </Tabs>
  );
}
