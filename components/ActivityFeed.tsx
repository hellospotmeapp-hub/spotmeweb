import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, BorderRadius, FontSize, Spacing, Shadow } from '@/app/lib/theme';
import { supabase } from '@/app/lib/supabase';

interface ActivityItem {
  id: string;
  type: string;
  userId: string | null;
  userName: string | null;
  userAvatar: string | null;
  needId: string | null;
  needTitle: string | null;
  amount: number | null;
  message: string | null;
  createdAt: string;
}

const ACTIVITY_ICONS: Record<string, { icon: string; color: string; bg: string }> = {
  contribution: { icon: 'favorite', color: Colors.primary, bg: Colors.primaryLight },
  need_created: { icon: 'add-circle', color: Colors.secondary, bg: Colors.secondaryLight },
  goal_met: { icon: 'celebration', color: Colors.success, bg: '#E8F5E8' },
  need_expired: { icon: 'timer-off', color: '#A9A29B', bg: '#F0EDE9' },
  need_edited: { icon: 'edit', color: '#7B9ED9', bg: '#EEF4FF' },
  thank_you: { icon: 'volunteer-activism', color: Colors.accent, bg: Colors.accentLight },
};

function getTimeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'yesterday';
  return `${diffDays}d ago`;
}

interface ActivityFeedProps {
  maxItems?: number;
  showHeader?: boolean;
}

export default function ActivityFeed({ maxItems = 8, showHeader = true }: ActivityFeedProps) {
  const router = useRouter();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  const fetchActivity = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('process-contribution', {
        body: { action: 'fetch_activity', limit: 30 },
      });
      if (!error && data?.success && data.activities) {
        setActivities(data.activities);
      }
    } catch {}
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchActivity();
    // Refresh every 30 seconds
    const interval = setInterval(fetchActivity, 30000);
    return () => clearInterval(interval);
  }, [fetchActivity]);

  const displayedActivities = showAll ? activities : activities.slice(0, maxItems);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading activity...</Text>
      </View>
    );
  }

  if (activities.length === 0) {
    return null; // Don't show section if no activity
  }

  return (
    <View style={styles.container}>
      {showHeader && (
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.liveIndicator}>
              <View style={styles.liveDot} />
            </View>
            <Text style={styles.headerTitle}>Activity Feed</Text>
          </View>
          <Text style={styles.headerCount}>{activities.length} events</Text>
        </View>
      )}

      <View style={styles.feedList}>
        {displayedActivities.map((item, index) => {
          const config = ACTIVITY_ICONS[item.type] || ACTIVITY_ICONS.contribution;
          return (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.feedItem,
                index === 0 && styles.feedItemFirst,
                index === displayedActivities.length - 1 && styles.feedItemLast,
              ]}
              onPress={() => item.needId && router.push(`/need/${item.needId}`)}
              activeOpacity={item.needId ? 0.7 : 1}
            >
              {/* Timeline line */}
              {index < displayedActivities.length - 1 && (
                <View style={styles.timelineLine} />
              )}

              {/* Icon */}
              <View style={[styles.iconCircle, { backgroundColor: config.bg }]}>
                {item.userAvatar ? (
                  <Image source={{ uri: item.userAvatar }} style={styles.avatarSmall} />
                ) : (
                  <MaterialIcons name={config.icon as any} size={16} color={config.color} />
                )}
              </View>

              {/* Content */}
              <View style={styles.feedContent}>
                <Text style={styles.feedMessage} numberOfLines={2}>
                  {item.type === 'contribution' && (
                    <>
                      <Text style={styles.feedBold}>{item.userName || 'Someone'}</Text>
                      {' spotted '}
                      <Text style={[styles.feedBold, { color: Colors.primary }]}>${item.amount}</Text>
                      {item.needTitle ? ` on "${item.needTitle}"` : ''}
                    </>
                  )}
                  {item.type === 'need_created' && (
                    <>
                      <Text style={styles.feedBold}>{item.userName || 'Someone'}</Text>
                      {' posted a new need: '}
                      <Text style={styles.feedBold}>"{item.needTitle}"</Text>
                    </>
                  )}
                  {item.type === 'goal_met' && (
                    <>
                      <Text style={[styles.feedBold, { color: Colors.success }]}>Goal Met!</Text>
                      {item.needTitle ? ` "${item.needTitle}" reached its goal` : ''}
                    </>
                  )}
                  {item.type === 'need_expired' && (
                    <>
                      <Text style={styles.feedBold}>"{item.needTitle || 'A need'}"</Text>
                      {' has expired'}
                    </>
                  )}
                  {item.type === 'need_edited' && (
                    <>
                      <Text style={styles.feedBold}>{item.userName || 'Someone'}</Text>
                      {' updated their need: '}
                      <Text style={styles.feedBold}>"{item.needTitle}"</Text>
                    </>
                  )}
                  {item.type === 'thank_you' && (
                    <>
                      <Text style={styles.feedBold}>{item.userName || 'Someone'}</Text>
                      {' posted a thank you for '}
                      <Text style={styles.feedBold}>"{item.needTitle}"</Text>
                    </>
                  )}
                </Text>
                <Text style={styles.feedTime}>{getTimeAgo(item.createdAt)}</Text>
              </View>

              {/* Arrow */}
              {item.needId && (
                <MaterialIcons name="chevron-right" size={16} color={Colors.textLight} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {activities.length > maxItems && !showAll && (
        <TouchableOpacity style={styles.showMoreBtn} onPress={() => setShowAll(true)}>
          <Text style={styles.showMoreText}>Show all {activities.length} events</Text>
          <MaterialIcons name="expand-more" size={18} color={Colors.primary} />
        </TouchableOpacity>
      )}

      {showAll && activities.length > maxItems && (
        <TouchableOpacity style={styles.showMoreBtn} onPress={() => setShowAll(false)}>
          <Text style={styles.showMoreText}>Show less</Text>
          <MaterialIcons name="expand-less" size={18} color={Colors.primary} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.xxl,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    padding: Spacing.xl,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.xxl,
  },
  loadingText: {
    fontSize: FontSize.sm,
    color: Colors.textLight,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  liveIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#E8F5E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.success,
  },
  headerTitle: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.text,
  },
  headerCount: {
    fontSize: FontSize.sm,
    color: Colors.textLight,
  },
  feedList: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    ...Shadow.sm,
  },
  feedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    position: 'relative',
  },
  feedItemFirst: {
    paddingTop: Spacing.lg,
  },
  feedItemLast: {
    borderBottomWidth: 0,
    paddingBottom: Spacing.lg,
  },
  timelineLine: {
    position: 'absolute',
    left: Spacing.lg + 16,
    top: 44,
    bottom: -4,
    width: 2,
    backgroundColor: Colors.borderLight,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarSmall: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  feedContent: {
    flex: 1,
    gap: 2,
  },
  feedMessage: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  feedBold: {
    fontWeight: '700',
    color: Colors.text,
  },
  feedTime: {
    fontSize: FontSize.xs,
    color: Colors.textLight,
  },
  showMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    marginTop: Spacing.sm,
  },
  showMoreText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.primary,
  },
});
