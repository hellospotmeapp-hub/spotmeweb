import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, View, StyleSheet } from 'react-native';
import { AppProvider } from './lib/store';
import { Colors } from './lib/theme';
import { errorMonitor } from './lib/errorMonitor';

export default function RootLayout() {
  // Hydration guard: prevent React error #418 on web
  // During SSR, isHydrated=false → renders null
  // During client initial render (hydration), isHydrated=false → renders null (matches server!)
  // After hydration, useEffect fires → isHydrated=true → renders full app
  const [isHydrated, setIsHydrated] = useState(Platform.OS !== 'web');

  useEffect(() => {
    if (Platform.OS === 'web') {
      setIsHydrated(true);
    }
    // Initialize error monitoring
    errorMonitor.init();
  }, []);


  // On web, don't render until client-side hydration is complete
  // The splash screen (from +html.tsx) covers this brief moment
  if (!isHydrated) {
    return null;
  }

  return (
    <AppProvider>
      <StatusBar style="dark" />
      <View style={styles.webContainer}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: Colors.background },
            animation: Platform.OS === 'web' ? 'none' : 'slide_from_right',
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="auth"
            options={{
              presentation: Platform.OS === 'web' ? 'card' : 'modal',
              animation: Platform.OS === 'web' ? 'none' : 'slide_from_bottom',
            }}
          />
          <Stack.Screen name="need/[id]" />
          <Stack.Screen
            name="settings"
            options={{
              presentation: Platform.OS === 'web' ? 'card' : 'modal',
              animation: Platform.OS === 'web' ? 'none' : 'slide_from_bottom',
            }}
          />
          <Stack.Screen
            name="guidelines"
            options={{
              presentation: Platform.OS === 'web' ? 'card' : 'modal',
              animation: Platform.OS === 'web' ? 'none' : 'slide_from_bottom',
            }}
          />
          <Stack.Screen
            name="spread"
            options={{
              presentation: Platform.OS === 'web' ? 'card' : 'modal',
              animation: Platform.OS === 'web' ? 'none' : 'slide_from_bottom',
            }}
          />
          <Stack.Screen
            name="payment-success"
            options={{
              presentation: Platform.OS === 'web' ? 'card' : 'modal',
              animation: Platform.OS === 'web' ? 'none' : 'slide_from_bottom',
            }}
          />
          <Stack.Screen
            name="payment-checkout"
            options={{
              presentation: Platform.OS === 'web' ? 'card' : 'modal',
              animation: Platform.OS === 'web' ? 'none' : 'slide_from_bottom',
            }}
          />
          <Stack.Screen
            name="admin"
            options={{
              presentation: Platform.OS === 'web' ? 'card' : 'modal',
              animation: Platform.OS === 'web' ? 'none' : 'slide_from_bottom',
            }}
          />
          <Stack.Screen
            name="payouts"

            options={{
              presentation: Platform.OS === 'web' ? 'card' : 'modal',
              animation: Platform.OS === 'web' ? 'none' : 'slide_from_bottom',
            }}
          />
          <Stack.Screen
            name="mama-recharge"
            options={{
              presentation: Platform.OS === 'web' ? 'card' : 'modal',
              animation: Platform.OS === 'web' ? 'none' : 'slide_from_bottom',
            }}
          />
          <Stack.Screen
            name="welcome"
            options={{
              presentation: Platform.OS === 'web' ? 'card' : 'modal',
              animation: Platform.OS === 'web' ? 'none' : 'slide_from_bottom',
            }}
          />


        </Stack>
      </View>
    </AppProvider>
  );
}

const styles = StyleSheet.create({
  webContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    ...(Platform.OS === 'web' ? {
      minHeight: '100vh' as any,
      overflow: 'hidden' as any,
    } : {}),
  },
});

