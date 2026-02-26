import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, BorderRadius, FontSize, Spacing } from '@/app/lib/theme';

interface ExpirationTimerProps {
  expiresAt?: string;
  createdAt: string;
  status: string;
  compact?: boolean;
}

function getTimeRemaining(expiresAt: string) {
  const now = new Date().getTime();
  const expires = new Date(expiresAt).getTime();
  const diff = expires - now;

  if (diff <= 0) return { expired: true, days: 0, hours: 0, minutes: 0, total: 0, percent: 0 };

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  return { expired: false, days, hours, minutes, total: diff, percent: 0 };
}

function getElapsedPercent(createdAt: string, expiresAt: string) {
  const created = new Date(createdAt).getTime();
  const expires = new Date(expiresAt).getTime();
  const now = new Date().getTime();
  const total = expires - created;
  const elapsed = now - created;
  if (total <= 0) return 100;
  return Math.min(100, Math.max(0, (elapsed / total) * 100));
}

export default function ExpirationTimer({ expiresAt, createdAt, status, compact }: ExpirationTimerProps) {
  const [timeLeft, setTimeLeft] = useState(() => {
    const exp = expiresAt || new Date(new Date(createdAt).getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();
    return getTimeRemaining(exp);
  });

  const effectiveExpiresAt = expiresAt || new Date(new Date(createdAt).getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();

  useEffect(() => {
    if (status !== 'Collecting') return;

    const update = () => setTimeLeft(getTimeRemaining(effectiveExpiresAt));
    update();
    const interval = setInterval(update, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [effectiveExpiresAt, status]);

  // Don't show for non-collecting statuses
  if (status !== 'Collecting' && status !== 'Expired') return null;

  if (status === 'Expired' || timeLeft.expired) {
    if (compact) {
      return (
        <View style={[styles.compactBadge, styles.expiredBadge]}>
          <MaterialIcons name="timer-off" size={12} color="#A9A29B" />
          <Text style={styles.expiredText}>Expired</Text>
        </View>
      );
    }
    return (
      <View style={styles.expiredCard}>
        <View style={styles.expiredIconWrap}>
          <MaterialIcons name="timer-off" size={24} color="#A9A29B" />
        </View>
        <View style={styles.expiredContent}>
          <Text style={styles.expiredTitle}>This need has expired</Text>
          <Text style={styles.expiredSubtitle}>
            Needs are active for 14 days. The owner can still request a payout for the amount raised.
          </Text>
        </View>
      </View>
    );
  }

  const elapsedPercent = getElapsedPercent(createdAt, effectiveExpiresAt);
  const isUrgent = timeLeft.days <= 2;
  const isWarning = timeLeft.days <= 5 && !isUrgent;
  const timerColor = isUrgent ? Colors.error : isWarning ? Colors.accent : Colors.textSecondary;
  const bgColor = isUrgent ? '#FFF0F0' : isWarning ? Colors.accentLight : Colors.surfaceAlt;
  const barColor = isUrgent ? Colors.error : isWarning ? Colors.accent : Colors.primary;

  if (compact) {
    return (
      <View style={[styles.compactBadge, { backgroundColor: bgColor }]}>
        <MaterialIcons name="timer" size={12} color={timerColor} />
        <Text style={[styles.compactText, { color: timerColor }]}>
          {timeLeft.days > 0 ? `${timeLeft.days}d ${timeLeft.hours}h` : `${timeLeft.hours}h ${timeLeft.minutes}m`}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: bgColor, borderColor: barColor + '30' }]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <MaterialIcons name="timer" size={18} color={timerColor} />
          <Text style={[styles.label, { color: timerColor }]}>Time Remaining</Text>
        </View>
        {isUrgent && (
          <View style={styles.urgentBadge}>
            <MaterialIcons name="warning" size={12} color={Colors.white} />
            <Text style={styles.urgentText}>Ending Soon</Text>
          </View>
        )}
      </View>

      {/* Time display */}
      <View style={styles.timeRow}>
        <View style={styles.timeBlock}>
          <Text style={[styles.timeNumber, { color: timerColor }]}>{timeLeft.days}</Text>
          <Text style={styles.timeUnit}>days</Text>
        </View>
        <Text style={[styles.timeSeparator, { color: timerColor }]}>:</Text>
        <View style={styles.timeBlock}>
          <Text style={[styles.timeNumber, { color: timerColor }]}>{timeLeft.hours}</Text>
          <Text style={styles.timeUnit}>hrs</Text>
        </View>
        <Text style={[styles.timeSeparator, { color: timerColor }]}>:</Text>
        <View style={styles.timeBlock}>
          <Text style={[styles.timeNumber, { color: timerColor }]}>{String(timeLeft.minutes).padStart(2, '0')}</Text>
          <Text style={styles.timeUnit}>min</Text>
        </View>
      </View>

      {/* Progress bar (time elapsed) */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${elapsedPercent}%`, backgroundColor: barColor }]} />
      </View>
      <Text style={styles.progressLabel}>
        {Math.round(elapsedPercent)}% of 14-day window elapsed
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    gap: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  urgentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.error,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  urgentText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.white,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  timeBlock: {
    alignItems: 'center',
    minWidth: 50,
  },
  timeNumber: {
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 34,
  },
  timeUnit: {
    fontSize: FontSize.xs,
    color: Colors.textLight,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timeSeparator: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: -8,
  },
  progressTrack: {
    height: 6,
    backgroundColor: Colors.borderLight,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressLabel: {
    fontSize: FontSize.xs,
    color: Colors.textLight,
    textAlign: 'center',
  },
  // Compact styles
  compactBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  compactText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  expiredBadge: {
    backgroundColor: '#F0EDE9',
  },
  expiredText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: '#A9A29B',
  },
  // Expired card
  expiredCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    backgroundColor: '#F0EDE9',
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: '#E8E4DF',
  },
  expiredIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E8E4DF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  expiredContent: {
    flex: 1,
  },
  expiredTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  expiredSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 19,
  },
});
