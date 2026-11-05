import React from 'react';
import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, FontSize, Spacing, Shadow } from '@/lib/theme';
import { useApp } from '@/lib/store';
import { useResponsive, PAGE_MAX_WIDTH } from '@/lib/responsive';
import WebTopNav from '@/components/WebTopNav';

// Memoize tab icons to prevent re-renders on every tab switch
const TabIcon = React.memo(function TabIcon({ name, color, focused }: { name: string; color: string; focused: boolean }) {
  return (
    <View style={[styles.tabIconContainer, focused && styles.tabIconFocused]}>
      <MaterialIcons name={name as any} size={24} color={color} />
    </View>
  );
});

const NotificationTabIcon = React.memo(function NotificationTabIcon({ color, focused }: { color: string; focused: boolean }) {
  const { unreadNotificationCount } = useApp();
  return (
    <View style={[styles.tabIconContainer, focused && styles.tabIconFocused]}>
      <MaterialIcons name="notifications" size={24} color={color} />
      {unreadNotificationCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
          </Text>
        </View>
      )}
    </View>
  );
});

const CreateTabIcon = React.memo(function CreateTabIcon() {
  return (
    <View style={styles.createButton}>
      <MaterialIcons name="add" size={28} color={Colors.white} />
    </View>
  );
});

export default function TabLayout() {
  // Room for icon + label, plus the device's gesture bar / nav buttons
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 8);
  // Website layout: top navigation + centered pages; phones keep the bottom tabs
  const { isWide } = useResponsive();

  return (
    <Tabs
      tabBar={isWide ? (props) => <WebTopNav {...props} /> : undefined}
      screenOptions={{
        tabBarPosition: isWide ? 'top' : 'bottom',
        sceneStyle: isWide
          ? { width: '100%', maxWidth: PAGE_MAX_WIDTH, alignSelf: 'center', backgroundColor: Colors.background }
          : undefined,
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textLight,
        tabBarStyle: [styles.tabBar, { height: 62 + bottomPad, paddingBottom: bottomPad }],
        tabBarLabelStyle: styles.tabLabel,
        tabBarItemStyle: styles.tabItem,
        // Freeze inactive tabs to prevent background re-renders
        freezeOnBlur: true,
        // Disable lazy loading so tabs are pre-rendered for instant switching
        lazy: false,
        // Disable animations on web for faster transitions
        ...(Platform.OS === 'web' ? { animation: 'none' as any } : {}),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => <TabIcon name="home" color={color} focused={focused} />,
          // Home tab should never freeze
          freezeOnBlur: false,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Browse',
          tabBarIcon: ({ color, focused }) => <TabIcon name="search" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: 'Post',
          tabBarIcon: () => <CreateTabIcon />,
          tabBarLabel: () => null,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Alerts',
          tabBarIcon: ({ color, focused }) => <NotificationTabIcon color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => <TabIcon name="person" color={color} focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.surface,
    borderTopWidth: 0,
    paddingTop: 6,
    // Web-safe shadow
    ...(Platform.OS === 'web'
      ? {
          boxShadow: '0 -2px 16px rgba(0,0,0,0.08)' as any,
          position: 'sticky' as any,
          bottom: 0,
          zIndex: 100,
        }
      : Shadow.lg),
  },
  tabLabel: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    marginTop: 2,
  },
  tabItem: {
    paddingTop: 4,
    // Ensure minimum touch target size for mobile web
    ...(Platform.OS === 'web' ? { minHeight: 48 } : {}),
  },
  tabIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 32,
  },
  tabIconFocused: {
    // subtle focus state
  },
  createButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    ...Shadow.md,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -6,
    backgroundColor: Colors.error,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.white,
  },
});
