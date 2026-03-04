import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, BorderRadius, FontSize, Spacing } from '@/app/lib/theme';
import { offlineManager, NetworkStatus } from '@/app/lib/offlineManager';

interface OfflineBannerProps {
  pendingCount?: number;
  isSyncing?: boolean;
  onRetrySync?: () => void;
}

export default function OfflineBanner({ pendingCount = 0, isSyncing = false, onRetrySync }: OfflineBannerProps) {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>(offlineManager.status);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [visible, setVisible] = useState(false);
  const [justCameOnline, setJustCameOnline] = useState(false);
  const onlineTimerRef = useRef<any>(null);

  useEffect(() => {
    offlineManager.init();

    const unsubscribe = offlineManager.subscribe((status) => {
      setNetworkStatus(status);
    });

    // Set initial status
    setNetworkStatus(offlineManager.status);

    return () => {
      unsubscribe();
      if (onlineTimerRef.current) clearTimeout(onlineTimerRef.current);
    };
  }, []);

  // Show/hide banner based on network status
  useEffect(() => {
    const isOffline = networkStatus === 'offline';
    const hasPending = pendingCount > 0;
    const shouldShow = isOffline || hasPending || isSyncing;

    if (shouldShow && !visible) {
      setVisible(true);
      setJustCameOnline(false);
      Animated.spring(slideAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 80,
        friction: 12,
      }).start();
    } else if (!shouldShow && visible) {
      // Show "back online" briefly before hiding
      if (networkStatus === 'online' && !hasPending && !isSyncing) {
        setJustCameOnline(true);
        onlineTimerRef.current = setTimeout(() => {
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }).start(() => {
            setVisible(false);
            setJustCameOnline(false);
          });
        }, 2000);
      } else {
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => setVisible(false));
      }
    }
  }, [networkStatus, pendingCount, isSyncing]);

  // Pulse animation for syncing
  useEffect(() => {
    if (isSyncing) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.6, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isSyncing]);

  if (!visible) return null;

  const isOffline = networkStatus === 'offline';

  // Determine banner content
  let icon: string = 'wifi-off';
  let message = 'You\'re offline';
  let subMessage = '';
  let bgColor = '#FFF3E0';
  let borderColor = '#FFE0B2';
  let textColor = '#E65100';
  let iconColor = '#F57C00';

  if (justCameOnline) {
    icon = 'wifi';
    message = 'Back online';
    subMessage = pendingCount > 0 ? 'Syncing your changes...' : '';
    bgColor = '#E8F5E9';
    borderColor = '#C8E6C9';
    textColor = '#2E7D32';
    iconColor = '#43A047';
  } else if (isSyncing) {
    icon = 'sync';
    message = 'Syncing changes...';
    subMessage = `${pendingCount} ${pendingCount === 1 ? 'action' : 'actions'} pending`;
    bgColor = '#E3F2FD';
    borderColor = '#BBDEFB';
    textColor = '#1565C0';
    iconColor = '#1E88E5';
  } else if (isOffline && pendingCount > 0) {
    icon = 'wifi-off';
    message = 'You\'re offline';
    subMessage = `${pendingCount} ${pendingCount === 1 ? 'change' : 'changes'} saved for sync`;
    bgColor = '#FFF3E0';
    borderColor = '#FFE0B2';
    textColor = '#E65100';
    iconColor = '#F57C00';
  } else if (isOffline) {
    icon = 'wifi-off';
    message = 'You\'re offline';
    subMessage = 'Showing cached data';
    bgColor = '#FFF3E0';
    borderColor = '#FFE0B2';
    textColor = '#E65100';
    iconColor = '#F57C00';
  } else if (pendingCount > 0) {
    // Online but has pending actions (sync failed previously)
    icon = 'sync-problem';
    message = `${pendingCount} ${pendingCount === 1 ? 'change' : 'changes'} pending sync`;
    subMessage = 'Tap to retry';
    bgColor = '#FFF8E1';
    borderColor = '#FFECB3';
    textColor = '#F57F17';
    iconColor = '#FFA000';
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: bgColor,
          borderColor: borderColor,
          opacity: slideAnim,
          transform: [{
            translateY: slideAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [-40, 0],
            }),
          }],
        },
      ]}
    >
      <TouchableOpacity
        style={styles.content}
        onPress={!isOffline && pendingCount > 0 && onRetrySync ? onRetrySync : undefined}
        activeOpacity={!isOffline && pendingCount > 0 ? 0.7 : 1}
        disabled={isOffline || pendingCount === 0}
      >
        <Animated.View style={{ opacity: isSyncing ? pulseAnim : 1 }}>
          <MaterialIcons name={icon as any} size={18} color={iconColor} />
        </Animated.View>
        <View style={styles.textContainer}>
          <Text style={[styles.message, { color: textColor }]}>{message}</Text>
          {subMessage ? (
            <Text style={[styles.subMessage, { color: textColor + 'CC' }]}>{subMessage}</Text>
          ) : null}
        </View>
        {!isOffline && pendingCount > 0 && !isSyncing && (
          <View style={[styles.retryButton, { backgroundColor: iconColor + '20' }]}>
            <MaterialIcons name="refresh" size={14} color={iconColor} />
          </View>
        )}
        {isSyncing && (
          <View style={styles.syncDots}>
            <View style={[styles.syncDot, { backgroundColor: iconColor }]} />
            <View style={[styles.syncDot, { backgroundColor: iconColor, opacity: 0.6 }]} />
            <View style={[styles.syncDot, { backgroundColor: iconColor, opacity: 0.3 }]} />
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: Spacing.lg,
    marginTop: Platform.OS === 'web' ? Spacing.xs : Spacing.sm,
    marginBottom: Spacing.xs,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    ...(Platform.OS === 'web' ? {
      position: 'sticky' as any,
      top: 70,
      zIndex: 49,
    } : {}),
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  textContainer: {
    flex: 1,
  },
  message: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  subMessage: {
    fontSize: FontSize.xs,
    marginTop: 1,
  },
  retryButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncDots: {
    flexDirection: 'row',
    gap: 3,
    alignItems: 'center',
  },
  syncDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});
