import { useEffect } from 'react';
import { Platform } from 'react-native';
import { SQLiteProvider } from 'expo-sqlite';
import { AndroidImportance, setNotificationChannelAsync, setNotificationHandler } from 'expo-notifications';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { initializeDatabase } from '@/lib/database';

setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function RootLayout() {
  useEffect(() => {
    async function prepareNotifications() {
      if (Platform.OS === 'android') {
        await setNotificationChannelAsync('maintenance', {
          name: 'Rappels de maintenance',
          importance: AndroidImportance.DEFAULT,
        });
      }
    }

    void prepareNotifications().catch((error: unknown) => {
      console.error('Configuration du canal de notifications impossible', error);
    });
  }, []);

  return (
    <SQLiteProvider databaseName="maintenance.db" onInit={initializeDatabase}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </SQLiteProvider>
  );
}
