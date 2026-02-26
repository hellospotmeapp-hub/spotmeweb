import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, BorderRadius, FontSize, Spacing, Shadow } from '@/app/lib/theme';
import { Need } from '@/app/lib/data';
import ProgressBar from './ProgressBar';
import CategoryBadge from './CategoryBadge';
import StatusBadge from './StatusBadge';
import ExpirationTimer from './ExpirationTimer';

const DEFAULT_AVATAR = 'https://d64gsuwffb70l.cloudfront.net/698fe0b37fe9438e65b48d58_1771037056297_f9a83069.png';

const NEED_EXPIRATION_MS = 14 * 24 * 60 * 60 * 1000;

// Check if a need is expired by time (client-side check)
function isExpiredByTime(need: Need): boolean {
  if (need.status === 'Expired') return true;
  if (need.status !== 'Collecting') return false;
  const expiresAt = need.expiresAt 
    ? new Date(need.expiresAt).getTime()
    : new Date(need.createdAt).getTime() + NEED_EXPIRATION_MS;
  return Date.now() >= expiresAt;
}

interface NeedCardProps {
  need: Need;
  onContribute?: (needId: string, amount: number) => void;
  compact?: boolean;
}

function getTimeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 0) return 'just now';
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 30) return `${diffDays}d ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
}


export default function NeedCard({ need, onContribute, compact }: NeedCardProps) {
  const router = useRouter();
  const progress = need.raisedAmount / need.goalAmount;
  const expired = isExpiredByTime(need);
  const isComplete = need.status !== 'Collecting' || expired;
  const canContribute = need.status === 'Collecting' && !expired;

  const handlePress = () => {
    router.push(`/need/${need.id}`);
  };

  const handleQuickSpot = (amount: number) => {
    if (onContribute && canContribute) {
      onContribute(need.id, amount);
    }
  };

  // Determine the effective status for display
  const displayStatus = expired && need.status === 'Collecting' ? 'Expired' : need.status;

  if (compact) {
    return (
      <TouchableOpacity style={styles.compactCard} onPress={handlePress} activeOpacity={0.7}>
        {need.photo && (
          <Image source={{ uri: need.photo }} style={styles.compactImage} />
        )}
        <View style={styles.compactContent}>
          <Text style={styles.compactTitle} numberOfLines={1}>{need.title}</Text>
          <ProgressBar progress={progress} height={4} />
          <Text style={styles.compactAmount}>
            ${need.raisedAmount} of ${need.goalAmount}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity style={[styles.card, expired && styles.cardExpired]} onPress={handlePress} activeOpacity={0.85}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.userInfo} onPress={() => router.push(`/user/${need.userId}`)} activeOpacity={0.7}>
          <Image source={{ uri: need.userAvatar || DEFAULT_AVATAR }} style={styles.avatar} />
          <View>
            <View style={styles.nameRow}>
              <Text style={styles.userName}>{need.userName || 'SpotMe User'}</Text>
              {need.userCity ? (
                <View style={styles.cityRow}>
                  <MaterialIcons name="place" size={12} color={Colors.textLight} />
                  <Text style={styles.cityText}>{need.userCity}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.timeText}>{getTimeAgo(need.createdAt)}</Text>
          </View>
        </TouchableOpacity>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.shareBtn}
            onPress={() => router.push(`/share/${need.id}`)}
            activeOpacity={0.7}
          >
            <MaterialIcons name="share" size={16} color={Colors.textLight} />
          </TouchableOpacity>
          <StatusBadge status={displayStatus} />
        </View>
      </View>

      {/* Photo */}
      {need.photo && (
        <View>
          <Image source={{ uri: need.photo }} style={[styles.photo, expired && { opacity: 0.7 }]} />
          {expired && (
            <View style={styles.expiredOverlay}>
              <MaterialIcons name="timer-off" size={16} color={Colors.white} />
              <Text style={styles.expiredOverlayText}>Expired</Text>
            </View>
          )}
        </View>
      )}

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, expired && { color: Colors.textSecondary }]} numberOfLines={2}>{need.title}</Text>
          <CategoryBadge category={need.category} />
        </View>
        
        <Text style={styles.message} numberOfLines={2}>{need.message}</Text>

        {/* Progress Section */}
        <View style={styles.progressSection}>
          <ProgressBar progress={progress} height={10} showGlow={progress >= 0.75 && !expired} />
          <View style={styles.progressInfo}>
            <View style={styles.amountRow}>
              <Text style={styles.raisedAmount}>${need.raisedAmount}</Text>
              <Text style={styles.goalAmount}> of ${need.goalAmount}</Text>
            </View>
            <Text style={styles.contributorText}>
              {need.contributorCount} {need.contributorCount === 1 ? 'person' : 'people'} spotted
            </Text>
          </View>
        </View>

        {/* Expiration Timer Badge */}
        {(need.status === 'Collecting' || need.status === 'Expired' || expired) && (
          <ExpirationTimer
            expiresAt={need.expiresAt}
            createdAt={need.createdAt}
            status={expired ? 'Expired' : need.status}
            compact
          />
        )}

        {/* Quick Contribute Buttons - only for active, non-expired needs */}
        {canContribute && (
          <View style={styles.contributeRow}>
            {[1, 5, 10].map(amount => (
              <TouchableOpacity
                key={amount}
                style={styles.spotButton}
                onPress={() => handleQuickSpot(amount)}
                activeOpacity={0.7}
              >
                <MaterialIcons name="favorite" size={14} color={Colors.primary} />
                <Text style={styles.spotButtonText}>Spot ${amount}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.spotButton, styles.spotButtonCustom]}
              onPress={handlePress}
              activeOpacity={0.7}
            >
              <Text style={styles.spotButtonTextCustom}>Custom</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Expired Banner */}
        {expired && need.raisedAmount > 0 && (
          <View style={styles.expiredBanner}>
            <MaterialIcons name="timer-off" size={18} color={Colors.textLight} />
            <Text style={styles.expiredBannerText}>
              Expired with ${need.raisedAmount} raised
            </Text>
          </View>
        )}

        {expired && need.raisedAmount === 0 && (
          <View style={styles.expiredBanner}>
            <MaterialIcons name="timer-off" size={18} color={Colors.textLight} />
            <Text style={styles.expiredBannerText}>
              This need has expired
            </Text>
          </View>
        )}

        {/* Goal Met Banner */}
        {!expired && need.status === 'Goal Met' && (
          <View style={styles.goalMetBanner}>
            <MaterialIcons name="celebration" size={20} color={Colors.success} />
            <Text style={styles.goalMetText}>Goal Met!</Text>
          </View>
        )}

        {/* Payout Requested Banner */}
        {need.status === 'Payout Requested' && (
          <View style={styles.payoutBanner}>
            <MaterialIcons name="hourglass-top" size={18} color={Colors.accent} />
            <Text style={styles.payoutBannerText}>Payout Processing</Text>
          </View>
        )}

        {/* Paid Banner */}
        {need.status === 'Paid' && (
          <View style={styles.paidBanner}>
            <MaterialIcons name="check-circle" size={18} color={Colors.success} />
            <Text style={styles.paidBannerText}>Paid Out</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    overflow: 'hidden',
    ...Shadow.md,
  },
  cardExpired: {
    opacity: 0.85,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.borderLight,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  userName: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
  },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  cityText: {
    fontSize: FontSize.xs,
    color: Colors.textLight,
  },
  timeText: {
    fontSize: FontSize.xs,
    color: Colors.textLight,
    marginTop: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  shareBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photo: {
    width: '100%',
    height: 200,
    marginTop: Spacing.sm,
  },
  expiredOverlay: {
    position: 'absolute',
    top: Spacing.sm + 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  expiredOverlayText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.white,
  },
  content: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
    flex: 1,
  },
  message: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  progressSection: {
    gap: Spacing.sm,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  raisedAmount: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: Colors.text,
  },
  goalAmount: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  contributorText: {
    fontSize: FontSize.xs,
    color: Colors.textLight,
  },
  contributeRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  spotButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.primaryLight,
  },
  spotButtonText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.primary,
  },
  spotButtonCustom: {
    backgroundColor: Colors.surfaceAlt,
  },
  spotButtonTextCustom: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  goalMetBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    backgroundColor: '#E8F5E8',
    borderRadius: BorderRadius.lg,
  },
  goalMetText: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: Colors.success,
  },
  expiredBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    backgroundColor: '#F0EDE9',
    borderRadius: BorderRadius.lg,
  },
  expiredBannerText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.textLight,
  },
  payoutBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.accentLight,
    borderRadius: BorderRadius.lg,
  },
  payoutBannerText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.accent,
  },
  paidBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    backgroundColor: '#E8F5E8',
    borderRadius: BorderRadius.lg,
  },
  paidBannerText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.success,
  },
  // Compact styles
  compactCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    width: 160,
    ...Shadow.sm,
  },
  compactImage: {
    width: '100%',
    height: 100,
  },
  compactContent: {
    padding: Spacing.sm,
    gap: 4,
  },
  compactTitle: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  compactAmount: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
});
