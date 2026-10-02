import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import { maybeSeedDemo } from '@/lib/farm/demo';
import { PlantsProvider } from '@/lib/store';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  // Demo data must be in place before any screen reads storage (screenshots, App Review).
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    maybeSeedDemo().finally(() => setSeeded(true));
  }, []);

  useEffect(() => {
    if (loaded && seeded) {
      SplashScreen.hideAsync();
    }
  }, [loaded, seeded]);

  if (!loaded || !seeded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <PlantsProvider>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="plant/[id]" options={{ title: '', headerBackTitle: 'Back' }} />
          <Stack.Screen name="plant/new" options={{ presentation: 'modal', title: 'Add Plant' }} />
        </Stack>
      </PlantsProvider>
    </ThemeProvider>
  );
}
