import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Stack, useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, BorderRadius, FontSize, Spacing, Shadow } from '@/lib/theme';

// Shown for any URL that doesn't match a screen
export default function NotFoundScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();

  const float = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(float, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(float, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [float]);

  const lift = float.interpolate({ inputRange: [0, 1], outputRange: [0, -10] });

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <Stack.Screen options={{ title: 'Page not found', headerShown: false }} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <TouchableOpacity onPress={() => router.replace('/')} activeOpacity={0.7}>
            <Text style={styles.brand}>SpotMe</Text>
          </TouchableOpacity>

          <View style={styles.art}>
            <View style={[styles.ring, styles.ringOuter]} />
            <View style={[styles.ring, styles.ringInner]} />
            <Animated.View style={[styles.iconBubble, { transform: [{ translateY: lift }] }]}>
              <MaterialIcons name="explore-off" size={44} color={Colors.primary} />
            </Animated.View>
            <View style={[styles.dot, { top: 18, left: 26, backgroundColor: Colors.accent }]} />
            <View style={[styles.dot, { bottom: 24, right: 20, backgroundColor: Colors.secondary }]} />
            <View style={[styles.dot, styles.dotSmall, { top: 40, right: 36, backgroundColor: Colors.primary }]} />
          </View>

          <Text style={styles.code}>404</Text>
          <Text style={styles.title}>This page wandered off</Text>
          <Text style={styles.message}>
            The link may be old, or the page was moved. Everything else is right where you left it.
          </Text>

          {!!pathname && pathname !== '/' && (
            <View style={styles.pathPill}>
              <MaterialIcons name="link-off" size={14} color={Colors.textLight} />
              <Text style={styles.pathText} numberOfLines={1}>{pathname}</Text>
            </View>
          )}

          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace('/')} activeOpacity={0.85}>
            <MaterialIcons name="home" size={20} color={Colors.white} />
            <Text style={styles.primaryText}>Back to Home</Text>
          </TouchableOpacity>

          <View style={styles.row}>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.replace('/(tabs)/search')} activeOpacity={0.8}>
              <MaterialIcons name="search" size={18} color={Colors.primary} />
              <Text style={styles.secondaryText}>Browse needs</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.replace('/(tabs)/create')} activeOpacity={0.8}>
              <MaterialIcons name="add-circle-outline" size={18} color={Colors.primary} />
              <Text style={styles.secondaryText}>Post a need</Text>
            </TouchableOpacity>
          </View>

          {router.canGoBack() && (
            <TouchableOpacity style={styles.backLink} onPress={() => router.back()} activeOpacity={0.7}>
              <MaterialIcons name="arrow-back" size={16} color={Colors.textSecondary} />
              <Text style={styles.backText}>Go back</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.tagline}>No tragedy. Just life.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  card: {
    width: '100%', maxWidth: 460, alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: BorderRadius.xxl,
    paddingVertical: Spacing.xxxl, paddingHorizontal: Spacing.xxl,
    borderWidth: 1, borderColor: Colors.border, ...Shadow.md,
  },
  brand: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.primary, letterSpacing: -0.5 },
  art: { width: 170, height: 170, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.xl },
  ring: { position: 'absolute', borderRadius: BorderRadius.full },
  ringOuter: { width: 170, height: 170, backgroundColor: Colors.primaryLight },
  ringInner: { width: 124, height: 124, backgroundColor: Colors.primary + '22' },
  iconBubble: {
    width: 84, height: 84, borderRadius: 42, backgroundColor: Colors.surface,
    alignItems: 'center', justifyContent: 'center', ...Shadow.md,
  },
  dot: { position: 'absolute', width: 12, height: 12, borderRadius: 6 },
  dotSmall: { width: 8, height: 8, borderRadius: 4 },
  code: { marginTop: Spacing.xl, fontSize: FontSize.sm, fontWeight: '800', color: Colors.primary, letterSpacing: 4 },
  title: { marginTop: Spacing.xs, fontSize: FontSize.xxl, fontWeight: '800', color: Colors.text, textAlign: 'center' },
  message: { marginTop: Spacing.sm, fontSize: FontSize.md, lineHeight: 22, color: Colors.textSecondary, textAlign: 'center', maxWidth: 340 },
  pathPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '100%',
    marginTop: Spacing.lg, paddingHorizontal: Spacing.md, paddingVertical: 6,
    backgroundColor: Colors.surfaceAlt, borderRadius: BorderRadius.full,
  },
  pathText: { fontSize: FontSize.xs, color: Colors.textSecondary, flexShrink: 1 },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    alignSelf: 'stretch', marginTop: Spacing.xxl, paddingVertical: 14,
    backgroundColor: Colors.primary, borderRadius: BorderRadius.lg,
  },
  primaryText: { fontSize: FontSize.md, fontWeight: '700', color: Colors.white },
  row: { flexDirection: 'row', gap: Spacing.sm, alignSelf: 'stretch', marginTop: Spacing.sm },
  secondaryBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderRadius: BorderRadius.lg,
    backgroundColor: Colors.primaryLight, borderWidth: 1, borderColor: Colors.primary + '40',
  },
  secondaryText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.primary },
  backLink: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: Spacing.lg, padding: Spacing.xs },
  backText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary },
  tagline: { marginTop: Spacing.xl, fontSize: FontSize.sm, fontStyle: 'italic', color: Colors.textLight },
});
