import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, Shadow } from '@/app/lib/theme';
import { useApp } from '@/app/lib/store';

function TabIcon({ name, color, focused }: { name: string; color: string; focused: boolean }) {
  return (
    <View style={[styles.tabIconContainer, focused && styles.tabIconFocused]}>
      <MaterialIcons name={name as any} size={24} color={color} />
    </View>
  );
}

function NotificationTabIcon({ color, focused }: { color: string; focused: boolean }) {
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
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textLight,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
        tabBarItemStyle: styles.tabItem,
        // Disable animations on web for faster transitions
        ...(Platform.OS === 'web' ? { animation: 'none' as any } : {}),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => <TabIcon name="home" color={color} focused={focused} />,
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
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.createButton}>
              <MaterialIcons name="add" size={28} color={Colors.white} />
            </View>
          ),
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
    height: Platform.OS === 'web' ? 68 : 85,
    paddingTop: Spacing.sm,
    // Web-safe shadow
    ...(Platform.OS === 'web'
      ? {
          boxShadow: '0 -2px 16px rgba(0,0,0,0.08)' as any,
          position: 'sticky' as any,
          bottom: 0,
          zIndex: 100,
        }
      : Shadow.lg),
    // Safe area bottom padding handled by the tab bar on native
    ...(Platform.OS === 'web'
      ? { paddingBottom: 8 }
      : {}),
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
    marginBottom: Platform.OS === 'web' ? 8 : 20,
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
