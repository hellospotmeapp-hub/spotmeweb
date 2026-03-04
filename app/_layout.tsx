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

// Shared screen options for modal screens - defined once, reused everywhere
const MODAL_SCREEN_OPTIONS = {
  presentation: Platform.OS === 'web' ? 'card' as const : 'modal' as const,
  animation: Platform.OS === 'web' ? 'none' as const : 'slide_from_bottom' as const,
  // Freeze inactive screens to save memory and prevent background re-renders
  freezeOnBlur: true,
};

export default function RootLayout() {
  // Hydration guard: prevent React error #418 on web
  const [isHydrated, setIsHydrated] = useState(Platform.OS !== 'web');

  useEffect(() => {
    if (Platform.OS === 'web') {
      setIsHydrated(true);
    } else {
      // Hide splash screen quickly - data loads in background
      const timer = setTimeout(() => {
        SplashScreen.hideAsync().catch(() => {});
      }, 150);
      return () => clearTimeout(timer);
    }

    // Initialize error monitoring
    errorMonitor.init();

    // Global error handler to prevent full page reloads on web
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handleError = (event: ErrorEvent) => {
        console.error('[SpotMe] Global error caught:', event.message);
        event.preventDefault();
        return true;
      };

      const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
        console.error('[SpotMe] Unhandled promise rejection:', event.reason);
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
              // Faster native transitions with less overshoot
              animation: Platform.OS === 'web' ? 'none' : 'slide_from_right',
              animationDuration: Platform.OS === 'web' ? 0 : 200,
              // Freeze screens not in focus to reduce memory & CPU
              freezeOnBlur: true,
            }}
          >
            <Stack.Screen name="(tabs)" options={{ freezeOnBlur: false }} />
            <Stack.Screen name="auth" options={MODAL_SCREEN_OPTIONS} />
            <Stack.Screen name="need/[id]" options={{ freezeOnBlur: true }} />
            <Stack.Screen name="settings" options={MODAL_SCREEN_OPTIONS} />
            <Stack.Screen name="guidelines" options={MODAL_SCREEN_OPTIONS} />
            <Stack.Screen name="spread" options={MODAL_SCREEN_OPTIONS} />
            <Stack.Screen name="payment-success" options={MODAL_SCREEN_OPTIONS} />
            <Stack.Screen name="payment-checkout" options={MODAL_SCREEN_OPTIONS} />
            <Stack.Screen name="admin" options={MODAL_SCREEN_OPTIONS} />
            <Stack.Screen name="payouts" options={MODAL_SCREEN_OPTIONS} />
            <Stack.Screen name="mama-recharge" options={MODAL_SCREEN_OPTIONS} />
            <Stack.Screen name="welcome" options={MODAL_SCREEN_OPTIONS} />
            <Stack.Screen name="about" options={MODAL_SCREEN_OPTIONS} />
            <Stack.Screen name="terms" options={MODAL_SCREEN_OPTIONS} />
            <Stack.Screen name="share/[id]" options={MODAL_SCREEN_OPTIONS} />
            <Stack.Screen name="user/[id]" options={MODAL_SCREEN_OPTIONS} />
            <Stack.Screen name="go-live" options={MODAL_SCREEN_OPTIONS} />
            <Stack.Screen name="refunds" options={MODAL_SCREEN_OPTIONS} />
            <Stack.Screen name="analytics" options={MODAL_SCREEN_OPTIONS} />
            <Stack.Screen name="test-payments" options={MODAL_SCREEN_OPTIONS} />
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
