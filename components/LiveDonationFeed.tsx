import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Animated } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, BorderRadius, FontSize, Spacing, Shadow } from '@/app/lib/theme';

interface DonationEntry {
  id: string;
  userName: string;
  userAvatar: string;
  amount: number;
  note?: string;
  timestamp: string;
}

interface LiveDonationFeedProps {
  contributions: DonationEntry[];
  totalSupporters: number;
  compact?: boolean;
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay === 1) return 'yesterday';
  if (diffDay < 7) return `${diffDay}d ago`;
  return `${Math.floor(diffDay / 7)}w ago`;
}

export default function LiveDonationFeed({ contributions, totalSupporters, compact = false }: LiveDonationFeedProps) {
  const [expanded, setExpanded] = useState(false);
  const heightAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Subtle pulse on the live indicator
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  useEffect(() => {
    Animated.spring(heightAnim, {
      toValue: expanded ? 1 : 0,
      friction: 12,
      tension: 40,
      useNativeDriver: false,
    }).start();
  }, [expanded]);

  const displayedContributions = expanded ? contributions.slice(0, 8) : contributions.slice(0, 3);

  if (contributions.length === 0) return null;

  return (
    <View style={styles.container}>
      {/* Header - always visible */}
      <TouchableOpacity
        style={styles.header}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <View style={styles.headerLeft}>
          <View style={styles.liveIndicator}>
            <Animated.View style={[styles.liveDot, { opacity: pulseAnim }]} />
            <Text style={styles.liveText}>Live</Text>
          </View>
          <Text style={styles.headerTitle}>
            {totalSupporters} {totalSupporters === 1 ? 'supporter' : 'supporters'}
          </Text>
        </View>
        <MaterialIcons
          name={expanded ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
          size={20}
          color={Colors.textLight}
        />
      </TouchableOpacity>

      {/* Recent donations - always show top 3 */}
      <View style={styles.feedList}>
        {displayedContributions.map((entry, index) => (
          <View
            key={entry.id}
            style={[
              styles.feedItem,
              index === displayedContributions.length - 1 && styles.feedItemLast,
            ]}
          >
            <Image source={{ uri: entry.userAvatar }} style={styles.feedAvatar} />
            <View style={styles.feedInfo}>
              <View style={styles.feedNameRow}>
                <Text style={styles.feedName} numberOfLines={1}>{entry.userName}</Text>
                <Text style={styles.feedAmount}>${entry.amount}</Text>
              </View>
              <View style={styles.feedMeta}>
                <Text style={styles.feedTime}>{timeAgo(entry.timestamp)}</Text>
                {entry.note && (
                  <Text style={styles.feedNote} numberOfLines={1}>"{entry.note}"</Text>
                )}
              </View>
            </View>
          </View>
        ))}
      </View>

      {/* Show more/less */}
      {contributions.length > 3 && (
        <TouchableOpacity
          style={styles.toggleBtn}
          onPress={() => setExpanded(!expanded)}
          activeOpacity={0.7}
        >
          <Text style={styles.toggleText}>
            {expanded ? 'Show less' : `View all ${contributions.length} supporters`}
          </Text>
          <MaterialIcons
            name={expanded ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
            size={16}
            color={Colors.primary}
          />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    ...Shadow.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF0F0',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E85D5D',
  },
  liveText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#E85D5D',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.text,
  },
  feedList: {
    paddingHorizontal: Spacing.lg,
  },
  feedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  feedItemLast: {
    borderBottomWidth: 0,
  },
  feedAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  feedInfo: {
    flex: 1,
  },
  feedNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  feedName: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.text,
    flex: 1,
    marginRight: Spacing.sm,
  },
  feedAmount: {
    fontSize: FontSize.sm,
    fontWeight: '800',
    color: Colors.primary,
  },
  feedMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: 2,
  },
  feedTime: {
    fontSize: FontSize.xs,
    color: Colors.textLight,
  },
  feedNote: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    flex: 1,
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  toggleText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.primary,
  },
});
