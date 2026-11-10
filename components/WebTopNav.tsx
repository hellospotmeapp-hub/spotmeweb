import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { Colors, BorderRadius, FontSize, Spacing } from '@/lib/theme';
import { PAGE_MAX_WIDTH } from '@/lib/responsive';
import { useApp } from '@/lib/store';
import GracefulImage from './GracefulImage';

const NAV_ICONS: Record<string, string> = {
  index: 'home',
  search: 'search',
  notifications: 'notifications',
  profile: 'person',
};

// Website header used instead of the bottom tab bar on wide screens
export default function WebTopNav({ state, descriptors, navigateToTab }: BottomTabBarProps) {
  const router = useRouter();
  const { isLoggedIn, currentUser, unreadNotificationCount } = useApp();
  const activeName = state.routes[state.index]?.name;

  const go = (name: string) => {
    const route = state.routes.find((r) => r.name === name);
    if (route) navigateToTab(route.key);
  };

  return (
    <View style={styles.bar}>
      <View style={styles.inner}>
        <TouchableOpacity onPress={() => go('index')} activeOpacity={0.8} accessibilityRole="link">
          <Text style={styles.logo}>SpotMe</Text>
          <Text style={styles.tagline}>No tragedy. Just life.</Text>
        </TouchableOpacity>

        <View style={styles.links}>
          {state.routes.filter((r) => NAV_ICONS[r.name]).map((route) => {
            const active = route.name === activeName;
            const title = descriptors[route.key]?.options.title ?? route.name;
            return (
              <TouchableOpacity
                key={route.key}
                style={[styles.link, active && styles.linkActive]}
                onPress={() => go(route.name)}
                activeOpacity={0.7}
                accessibilityRole="link"
                accessibilityState={{ selected: active }}
              >
                <MaterialIcons name={NAV_ICONS[route.name] as any} size={20} color={active ? Colors.primary : Colors.textSecondary} />
                <Text style={[styles.linkText, active && styles.linkTextActive]}>{title}</Text>
                {route.name === 'notifications' && unreadNotificationCount > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.postBtn} onPress={() => go('create')} activeOpacity={0.85}>
            <MaterialIcons name="add-circle" size={18} color={Colors.white} />
            <Text style={styles.postBtnText}>Post a Need</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/settings')} accessibilityLabel="Settings">
            <MaterialIcons name="settings" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
          {isLoggedIn ? (
            <TouchableOpacity onPress={() => go('profile')} accessibilityLabel="Your profile">
              <GracefulImage uri={currentUser.avatar} type="avatar" style={styles.avatar} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.signInBtn} onPress={() => router.push('/auth')} activeOpacity={0.85}>
              <Text style={styles.signInText}>Sign In</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    paddingHorizontal: Spacing.xl,
    boxShadow: '0 2px 12px rgba(0,0,0,0.04)' as any,
    zIndex: 100,
  },
  inner: {
    width: '100%',
    maxWidth: PAGE_MAX_WIDTH,
    alignSelf: 'center',
    height: 68,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.lg,
  },
  logo: { fontSize: 24, fontWeight: '800', color: Colors.primary, letterSpacing: -0.5 },
  tagline: { fontSize: 11, color: Colors.textLight, fontStyle: 'italic', marginTop: -2 },
  links: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  link: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: BorderRadius.full,
  },
  linkActive: { backgroundColor: Colors.primaryLight },
  linkText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary },
  linkTextActive: { color: Colors.primary },
  badge: {
    minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4,
    backgroundColor: Colors.error, alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { fontSize: 10, fontWeight: '800', color: Colors.white },
  actions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  postBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.primary, paddingHorizontal: Spacing.lg, paddingVertical: 10, borderRadius: BorderRadius.full,
  },
  postBtnText: { color: Colors.white, fontWeight: '700', fontSize: FontSize.sm },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  signInBtn: {
    borderWidth: 1.5, borderColor: Colors.primary, paddingHorizontal: Spacing.lg, paddingVertical: 8, borderRadius: BorderRadius.full,
  },
  signInText: { color: Colors.primary, fontWeight: '700', fontSize: FontSize.sm },
});
