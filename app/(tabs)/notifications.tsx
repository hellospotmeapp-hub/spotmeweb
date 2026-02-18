import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Platform, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, BorderRadius, FontSize, Spacing, Shadow } from '@/app/lib/theme';
import { useApp } from '@/app/lib/store';

const NOTIFICATION_ICONS: Record<string, { icon: string; color: string; bg: string }> = {
  contribution: { icon: 'favorite', color: Colors.primary, bg: Colors.primaryLight },
  goal_met: { icon: 'celebration', color: Colors.success, bg: '#E8F5E8' },
  milestone: { icon: 'trending-up', color: Colors.accent, bg: Colors.accentLight },
  payout: { icon: 'account-balance-wallet', color: Colors.secondary, bg: Colors.secondaryLight },
  welcome: { icon: 'waving-hand', color: Colors.primary, bg: Colors.primaryLight },
  payment_failed: { icon: 'error-outline', color: Colors.error, bg: '#FFF0F0' },
  payout_ready: { icon: 'check-circle', color: Colors.success, bg: '#E8F5E8' },
  payout_issue: { icon: 'warning', color: '#E8A020', bg: '#FFF8E7' },
};

function getTimeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'yesterday';
  return `${diffDays}d ago`;
}

function getRetryStatusColor(status: string) {
  switch (status) {
    case 'completed': return Colors.success;
    case 'failed': return Colors.error;
    case 'attempted': return Colors.accent;
    case 'scheduled': return '#7B9ED9';
    default: return Colors.textLight;
  }
}

function getRetryStatusIcon(status: string) {
  switch (status) {
    case 'completed': return 'check-circle';
    case 'failed': return 'error';
    case 'attempted': return 'hourglass-top';
    case 'scheduled': return 'schedule';
    default: return 'help-outline';
  }
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    notifications, markNotificationRead, markAllNotificationsRead, unreadNotificationCount,
    failedPayments, fetchFailedPayments, retryPayment, isLoggedIn,
  } = useApp();
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [retryError, setRetryError] = useState('');
  const [expandedPayment, setExpandedPayment] = useState<string | null>(null);

  useEffect(() => {
    if (isLoggedIn) {
      fetchFailedPayments();
    }
  }, [isLoggedIn]);

  const handleNotificationPress = (notifId: string, needId?: string) => {
    markNotificationRead(notifId);
    if (needId) {
      router.push(`/need/${needId}`);
    }
  };

  const handleRetry = async (paymentId: string) => {
    setRetryingId(paymentId);
    setRetryError('');
    try {
      const result = await retryPayment(paymentId);
      if (!result.success) {
        setRetryError(result.error || 'Retry failed');
      }
    } catch (err: any) {
      setRetryError(err.message || 'Retry failed');
    }
    setRetryingId(null);
  };

  const topPadding = Platform.OS === 'web' ? 0 : insets.top;

  const autoRetryPayments = failedPayments.filter(fp => fp.autoRetryScheduled);
  const manualRetryPayments = failedPayments.filter(fp => !fp.autoRetryScheduled);

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Notifications</Text>
          {unreadNotificationCount > 0 && (
            <Text style={styles.subtitle}>{unreadNotificationCount} new</Text>
          )}
        </View>
        {unreadNotificationCount > 0 && (
          <TouchableOpacity onPress={markAllNotificationsRead} style={styles.markAllButton}>
            <MaterialIcons name="done-all" size={18} color={Colors.primary} />
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Auto-Retry Alert Banner */}
        {autoRetryPayments.length > 0 && (
          <View style={styles.autoRetryBanner}>
            <View style={styles.autoRetryHeader}>
              <View style={styles.autoRetryIconWrap}>
                <MaterialIcons name="autorenew" size={20} color="#7B9ED9" />
              </View>
              <View style={styles.autoRetryContent}>
                <Text style={styles.autoRetryTitle}>Auto-Retrying</Text>
                <Text style={styles.autoRetrySubtitle}>
                  {autoRetryPayments.length} payment{autoRetryPayments.length > 1 ? 's are' : ' is'} being automatically retried
                </Text>
              </View>
            </View>
            {autoRetryPayments.map(fp => (
              <View key={fp.id} style={styles.autoRetryCard}>
                <View style={styles.autoRetryCardLeft}>
                  <Text style={styles.autoRetryAmount}>${fp.amount.toFixed(2)}</Text>
                  <Text style={styles.autoRetryNeed} numberOfLines={1}>{fp.needTitle}</Text>
                  <View style={styles.autoRetryMeta}>
                    <MaterialIcons name="replay" size={12} color="#7B9ED9" />
                    <Text style={styles.autoRetryMetaText}>
                      Attempt {(fp.retryCount || 0) + 1} of {fp.maxRetries || 3}
                    </Text>
                  </View>
                </View>
                <View style={styles.autoRetryStatus}>
                  <ActivityIndicator size="small" color="#7B9ED9" />
                  <Text style={styles.autoRetryStatusText}>Retrying</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Failed Payments Banner */}
        {manualRetryPayments.length > 0 && (
          <View style={styles.failedBanner}>
            <View style={styles.failedBannerHeader}>
              <View style={styles.failedBannerIcon}>
                <MaterialIcons name="error-outline" size={22} color={Colors.error} />
              </View>
              <View style={styles.failedBannerContent}>
                <Text style={styles.failedBannerTitle}>
                  {manualRetryPayments.length} Failed Payment{manualRetryPayments.length > 1 ? 's' : ''}
                </Text>
                <Text style={styles.failedBannerSubtitle}>
                  These payments couldn't be processed. Tap retry to try again.
                </Text>
              </View>
            </View>

            {retryError ? (
              <View style={styles.retryErrorBanner}>
                <MaterialIcons name="info-outline" size={14} color={Colors.error} />
                <Text style={styles.retryErrorText}>{retryError}</Text>
              </View>
            ) : null}

            {manualRetryPayments.map(fp => {
              const isExpanded = expandedPayment === fp.id;
              const hasRetries = fp.retries && fp.retries.length > 0;

              return (
                <View key={fp.id} style={styles.failedPaymentCard}>
                  <TouchableOpacity
                    style={styles.failedPaymentMain}
                    onPress={() => setExpandedPayment(isExpanded ? null : fp.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.failedPaymentLeft}>
                      <Text style={styles.failedPaymentAmount}>${fp.amount.toFixed(2)}</Text>
                      <Text style={styles.failedPaymentNeed} numberOfLines={1}>{fp.needTitle}</Text>
                      <Text style={styles.failedPaymentReason} numberOfLines={isExpanded ? 5 : 2}>{fp.failureReason}</Text>
                      <View style={styles.failedPaymentMetaRow}>
                        <Text style={styles.failedPaymentTime}>
                          {fp.failedAt ? getTimeAgo(fp.failedAt) : getTimeAgo(fp.createdAt)}
                        </Text>
                        {(fp.retryCount || 0) > 0 && (
                          <View style={styles.retryCountBadge}>
                            <MaterialIcons name="replay" size={10} color="#7B9ED9" />
                            <Text style={styles.retryCountText}>{fp.retryCount} retries</Text>
                          </View>
                        )}
                        {hasRetries && (
                          <MaterialIcons name={isExpanded ? 'expand-less' : 'expand-more'} size={16} color={Colors.textLight} />
                        )}
                      </View>
                    </View>
                    <TouchableOpacity
                      style={[styles.retryBtn, retryingId === fp.id && styles.retryBtnDisabled]}
                      onPress={() => handleRetry(fp.id)}
                      disabled={retryingId === fp.id}
                      activeOpacity={0.7}
                    >
                      {retryingId === fp.id ? (
                        <ActivityIndicator size="small" color={Colors.white} />
                      ) : (
                        <>
                          <MaterialIcons name="refresh" size={16} color={Colors.white} />
                          <Text style={styles.retryBtnText}>Retry</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </TouchableOpacity>

                  {/* Retry History Timeline */}
                  {isExpanded && hasRetries && (
                    <View style={styles.retryTimeline}>
                      <Text style={styles.retryTimelineTitle}>Retry History</Text>
                      {fp.retries!.map((retry, idx) => (
                        <View key={retry.id} style={styles.retryTimelineItem}>
                          <View style={styles.retryTimelineLine}>
                            <View style={[styles.retryTimelineDot, { backgroundColor: getRetryStatusColor(retry.status) }]}>
                              <MaterialIcons name={getRetryStatusIcon(retry.status) as any} size={10} color={Colors.white} />
                            </View>
                            {idx < fp.retries!.length - 1 && <View style={styles.retryTimelineConnector} />}
                          </View>
                          <View style={styles.retryTimelineContent}>
                            <View style={styles.retryTimelineHeader}>
                              <Text style={styles.retryTimelineLabel}>Attempt #{retry.retryNumber}</Text>
                              <View style={[styles.retryTimelineStatus, { backgroundColor: getRetryStatusColor(retry.status) + '15' }]}>
                                <Text style={[styles.retryTimelineStatusText, { color: getRetryStatusColor(retry.status) }]}>
                                  {retry.status}
                                </Text>
                              </View>
                            </View>
                            {retry.scheduledAt && (
                              <Text style={styles.retryTimelineDetail}>
                                Scheduled: {new Date(retry.scheduledAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </Text>
                            )}
                            {retry.attemptedAt && (
                              <Text style={styles.retryTimelineDetail}>
                                Attempted: {new Date(retry.attemptedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </Text>
                            )}
                            {retry.result && <Text style={styles.retryTimelineResult}>{retry.result}</Text>}
                            {retry.error && <Text style={styles.retryTimelineError}>{retry.error}</Text>}
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Notifications List */}
        {notifications.length === 0 && failedPayments.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="notifications-none" size={64} color={Colors.borderLight} />
            <Text style={styles.emptyTitle}>No notifications yet</Text>
            <Text style={styles.emptySubtitle}>
              When someone spots your need or you reach a milestone, you'll see it here.
            </Text>
          </View>
        ) : (
          notifications.map(notif => {
            const config = NOTIFICATION_ICONS[notif.type] || NOTIFICATION_ICONS.welcome;
            const isPaymentFailed = notif.type === 'payment_failed';
            const isPayoutReady = notif.type === 'payout_ready';
            const isPayoutIssue = notif.type === 'payout_issue';

            return (
              <TouchableOpacity
                key={notif.id}
                style={[
                  styles.notifCard,
                  !notif.read && styles.notifCardUnread,
                  isPaymentFailed && styles.notifCardFailed,
                ]}
                onPress={() => {
                  if (isPayoutReady || isPayoutIssue) {
                    markNotificationRead(notif.id);
                    router.push('/payouts');
                  } else {
                    handleNotificationPress(notif.id, notif.needId);
                  }
                }}
                activeOpacity={0.7}
              >
                {!notif.read && <View style={[styles.unreadDot, isPaymentFailed && { backgroundColor: Colors.error }]} />}
                
                <View style={styles.notifLeft}>
                  {notif.avatar ? (
                    <View style={styles.avatarContainer}>
                      <Image source={{ uri: notif.avatar }} style={styles.avatar} />
                      <View style={[styles.notifIconSmall, { backgroundColor: config.bg }]}>
                        <MaterialIcons name={config.icon as any} size={12} color={config.color} />
                      </View>
                    </View>
                  ) : (
                    <View style={[styles.notifIcon, { backgroundColor: config.bg }]}>
                      <MaterialIcons name={config.icon as any} size={24} color={config.color} />
                    </View>
                  )}
                </View>

                <View style={styles.notifContent}>
                  <Text style={[styles.notifTitle, !notif.read && styles.notifTitleUnread]}>
                    {notif.title}
                  </Text>
                  <Text style={styles.notifMessage} numberOfLines={2}>
                    {notif.message}
                  </Text>
                  {isPaymentFailed && (
                    <View style={styles.failedTag}>
                      <MaterialIcons name="replay" size={12} color={Colors.primary} />
                      <Text style={styles.failedTagText}>Tap to view failed payments</Text>
                    </View>
                  )}
                  {isPayoutReady && (
                    <View style={[styles.failedTag, { backgroundColor: Colors.secondaryLight }]}>
                      <MaterialIcons name="account-balance-wallet" size={12} color={Colors.secondaryDark} />
                      <Text style={[styles.failedTagText, { color: Colors.secondaryDark }]}>View Payout Dashboard</Text>
                    </View>
                  )}
                  {/* Auto-retry indicator on payment_failed notifications */}
                  {isPaymentFailed && notif.message?.includes('auto') && (
                    <View style={[styles.failedTag, { backgroundColor: '#E8F0FF' }]}>
                      <MaterialIcons name="autorenew" size={12} color="#7B9ED9" />
                      <Text style={[styles.failedTagText, { color: '#7B9ED9' }]}>Auto-retry in progress</Text>
                    </View>
                  )}
                  <Text style={styles.notifTime}>{getTimeAgo(notif.timestamp)}</Text>
                </View>

                {(notif.needId || isPayoutReady || isPayoutIssue) && (
                  <MaterialIcons name="chevron-right" size={20} color={Colors.textLight} />
                )}
              </TouchableOpacity>
            );
          })
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
    ...(Platform.OS === 'web' ? { paddingTop: 16 } : {}),
  },
  title: { fontSize: FontSize.xxl, fontWeight: '900', color: Colors.text },
  subtitle: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '600' },
  markAllButton: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full, backgroundColor: Colors.primaryLight,
  },
  markAllText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.primary },

  // Auto-Retry Banner
  autoRetryBanner: {
    marginHorizontal: Spacing.lg, marginBottom: Spacing.md,
    backgroundColor: '#F0F4FF', borderRadius: BorderRadius.xl,
    borderWidth: 1, borderColor: '#7B9ED9' + '30',
    overflow: 'hidden',
  },
  autoRetryHeader: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: '#7B9ED9' + '15',
  },
  autoRetryIconWrap: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#7B9ED9' + '15', alignItems: 'center', justifyContent: 'center',
  },
  autoRetryContent: { flex: 1 },
  autoRetryTitle: { fontSize: FontSize.md, fontWeight: '800', color: '#5A7DB5' },
  autoRetrySubtitle: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  autoRetryCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: '#7B9ED9' + '10',
  },
  autoRetryCardLeft: { flex: 1 },
  autoRetryAmount: { fontSize: FontSize.md, fontWeight: '800', color: Colors.text },
  autoRetryNeed: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 1 },
  autoRetryMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  autoRetryMetaText: { fontSize: FontSize.xs, color: '#7B9ED9', fontWeight: '600' },
  autoRetryStatus: { alignItems: 'center', gap: 4 },
  autoRetryStatusText: { fontSize: 10, color: '#7B9ED9', fontWeight: '600' },

  // Failed Payments Banner
  failedBanner: {
    marginHorizontal: Spacing.lg, marginBottom: Spacing.lg,
    backgroundColor: '#FFF5F5', borderRadius: BorderRadius.xl,
    borderWidth: 1, borderColor: Colors.error + '30',
    overflow: 'hidden',
  },
  failedBannerHeader: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.error + '15',
  },
  failedBannerIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.error + '15', alignItems: 'center', justifyContent: 'center',
  },
  failedBannerContent: { flex: 1 },
  failedBannerTitle: { fontSize: FontSize.md, fontWeight: '800', color: Colors.error },
  failedBannerSubtitle: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  retryErrorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
    backgroundColor: Colors.error + '10',
  },
  retryErrorText: { fontSize: FontSize.xs, color: Colors.error, flex: 1 },
  failedPaymentCard: {
    borderBottomWidth: 1, borderBottomColor: Colors.error + '10',
  },
  failedPaymentMain: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
  },
  failedPaymentLeft: { flex: 1 },
  failedPaymentAmount: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.text },
  failedPaymentNeed: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary, marginTop: 1 },
  failedPaymentReason: { fontSize: FontSize.xs, color: Colors.error, marginTop: 2, lineHeight: 16 },
  failedPaymentMetaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: 4 },
  failedPaymentTime: { fontSize: FontSize.xs, color: Colors.textLight },
  retryCountBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#E8F0FF', paddingHorizontal: 6, paddingVertical: 1, borderRadius: BorderRadius.full,
  },
  retryCountText: { fontSize: 10, fontWeight: '600', color: '#7B9ED9' },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.primary, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.full, ...Shadow.sm,
  },
  retryBtnDisabled: { opacity: 0.6 },
  retryBtnText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.white },

  // Retry Timeline
  retryTimeline: {
    paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md,
    backgroundColor: '#FAFAFA',
  },
  retryTimelineTitle: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textLight, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.sm, marginTop: Spacing.sm },
  retryTimelineItem: { flexDirection: 'row', gap: Spacing.sm },
  retryTimelineLine: { alignItems: 'center', width: 20 },
  retryTimelineDot: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  retryTimelineConnector: { width: 2, flex: 1, backgroundColor: Colors.borderLight, marginVertical: 2 },
  retryTimelineContent: { flex: 1, paddingBottom: Spacing.md },
  retryTimelineHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  retryTimelineLabel: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.text },
  retryTimelineStatus: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: BorderRadius.full },
  retryTimelineStatusText: { fontSize: 10, fontWeight: '700' },
  retryTimelineDetail: { fontSize: FontSize.xs, color: Colors.textLight, marginTop: 2 },
  retryTimelineResult: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2, lineHeight: 16 },
  retryTimelineError: { fontSize: FontSize.xs, color: Colors.error, marginTop: 2, lineHeight: 16 },

  // Notification Cards
  notifCard: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.lg,
    gap: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
    position: 'relative',
  },
  notifCardUnread: { backgroundColor: Colors.primaryLight + '40' },
  notifCardFailed: { backgroundColor: '#FFF5F5' + '60' },
  unreadDot: {
    position: 'absolute', left: Spacing.sm, top: '50%',
    width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary, marginTop: -4,
  },
  notifLeft: {},
  avatarContainer: { position: 'relative' },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  notifIconSmall: {
    position: 'absolute', bottom: -2, right: -2,
    width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.surface,
  },
  notifIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  notifContent: { flex: 1, gap: 2 },
  notifTitle: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  notifTitleUnread: { fontWeight: '800' },
  notifMessage: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 19 },
  notifTime: { fontSize: FontSize.xs, color: Colors.textLight, marginTop: 2 },
  failedTag: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.primaryLight, paddingHorizontal: Spacing.sm, paddingVertical: 2,
    borderRadius: BorderRadius.full, alignSelf: 'flex-start', marginTop: 4,
  },
  failedTagText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.primary },

  // Empty
  emptyState: { alignItems: 'center', paddingVertical: Spacing.huge * 2, paddingHorizontal: Spacing.xxxl, gap: Spacing.md },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textSecondary },
  emptySubtitle: { fontSize: FontSize.sm, color: Colors.textLight, textAlign: 'center', lineHeight: 20 },
});
