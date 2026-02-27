import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, View, StyleSheet } from 'react-native';
import { AppProvider } from './lib/store';
import { Colors } from './lib/theme';
import { errorMonitor } from './lib/errorMonitor';
import ErrorBoundary from '@/components/ErrorBoundary';
import * as SplashScreen from 'expo-splash-screen';

// Prevent the splash screen from auto-hiding on native
if (Platform.OS !== 'web') {
  SplashScreen.preventAutoHideAsync().catch(() => {});
}

export default function RootLayout() {
  // Hydration guard: prevent React error #418 on web
  const [isHydrated, setIsHydrated] = useState(Platform.OS !== 'web');

  useEffect(() => {
    if (Platform.OS === 'web') {
      setIsHydrated(true);
    } else {
      // Hide splash screen after a brief delay on native
      const timer = setTimeout(() => {
        SplashScreen.hideAsync().catch(() => {});
      }, 500);
      return () => clearTimeout(timer);
    }

    // Initialize error monitoring
    errorMonitor.init();

    // Global error handler to prevent full page reloads on web
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handleError = (event: ErrorEvent) => {
        console.error('[SpotMe] Global error caught:', event.message);
        // Prevent the browser from reloading the page
        event.preventDefault();
        return true;
      };

      const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
        console.error('[SpotMe] Unhandled promise rejection:', event.reason);
        // Prevent the browser from crashing
        event.preventDefault();
        return true;
      };

      window.addEventListener('error', handleError);
      window.addEventListener('unhandledrejection', handleUnhandledRejection);

      return () => {
        window.removeEventListener('error', handleError);
        window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      };
    }
  }, []);


  // On web, don't render until client-side hydration is complete
  if (!isHydrated) {
    return null;
  }

  return (
    <ErrorBoundary
      fallbackTitle="SpotMe hit a snag"
      fallbackMessage="Something went wrong, but your data is safe. Tap below to reload."
    >
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
            <Stack.Screen
              name="about"
              options={{
                presentation: Platform.OS === 'web' ? 'card' : 'modal',
                animation: Platform.OS === 'web' ? 'none' : 'slide_from_bottom',
              }}
            />
            <Stack.Screen
              name="terms"
              options={{
                presentation: Platform.OS === 'web' ? 'card' : 'modal',
                animation: Platform.OS === 'web' ? 'none' : 'slide_from_bottom',
              }}
            />
            <Stack.Screen

              name="share/[id]"
              options={{
                presentation: Platform.OS === 'web' ? 'card' : 'modal',
                animation: Platform.OS === 'web' ? 'none' : 'slide_from_bottom',
              }}
            />
            <Stack.Screen
              name="user/[id]"
              options={{
                presentation: Platform.OS === 'web' ? 'card' : 'modal',
                animation: Platform.OS === 'web' ? 'none' : 'slide_from_bottom',
              }}
            />
            <Stack.Screen
              name="go-live"
              options={{
                presentation: Platform.OS === 'web' ? 'card' : 'modal',
                animation: Platform.OS === 'web' ? 'none' : 'slide_from_bottom',
              }}
            />
            <Stack.Screen
              name="refunds"
              options={{
                presentation: Platform.OS === 'web' ? 'card' : 'modal',
                animation: Platform.OS === 'web' ? 'none' : 'slide_from_bottom',
              }}
            />
            <Stack.Screen
              name="analytics"
              options={{
                presentation: Platform.OS === 'web' ? 'card' : 'modal',
                animation: Platform.OS === 'web' ? 'none' : 'slide_from_bottom',
              }}
            />
            <Stack.Screen
              name="test-payments"
              options={{
                presentation: Platform.OS === 'web' ? 'card' : 'modal',
                animation: Platform.OS === 'web' ? 'none' : 'slide_from_bottom',
              }}
            />
          </Stack>
        </View>
      </AppProvider>
    </ErrorBoundary>
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
