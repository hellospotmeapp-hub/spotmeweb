import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, BorderRadius, FontSize, Spacing, Shadow } from '@/app/lib/theme';
import { THURSDAY_SPOTLIGHT } from '@/app/lib/data';

export default function MamaRechargeCard() {
  const router = useRouter();
  const spotlight = THURSDAY_SPOTLIGHT;
  const progress = spotlight.currentMom.raisedAmount / spotlight.currentMom.goalAmount;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push('/mama-recharge')}
      activeOpacity={0.85}
      accessibilityLabel="Mama Recharge - Support moms with self-care"
      accessibilityRole="button"
    >
      <View style={styles.gradient}>
        {/* Decorative elements */}
        <View style={[styles.circle, styles.circle1]} />
        <View style={[styles.circle, styles.circle2]} />
        <View style={[styles.circle, styles.circle3]} />

        <View style={styles.content}>
          {/* Header row */}
          <View style={styles.headerRow}>
            <View style={styles.iconCircle}>
              <MaterialIcons name="spa" size={24} color={Colors.selfCare} />
            </View>
            <View style={styles.badge}>
              <MaterialIcons name="auto-awesome" size={12} color={Colors.rechargeGold} />
              <Text style={styles.badgeText}>Treat Yourself Thursday</Text>
            </View>
          </View>

          {/* Title */}
          <Text style={styles.title}>Mama Recharge</Text>
          <Text style={styles.subtitle}>
            No tragedy required. Sometimes life just happens, and moms deserve support too.
          </Text>

          {/* Spotlight preview */}
          <View style={styles.spotlightRow}>
            <Image source={{ uri: spotlight.currentMom.avatar }} style={styles.spotlightAvatar} />
            <View style={styles.spotlightInfo}>
              <Text style={styles.spotlightName}>{spotlight.currentMom.name}</Text>
              <Text style={styles.spotlightRequest} numberOfLines={1}>
                {spotlight.currentMom.request}
              </Text>
              {/* Mini progress bar */}
              <View style={styles.miniProgress}>
                <View style={styles.miniTrack}>
                  <View style={[styles.miniFill, { width: `${progress * 100}%` }]} />
                </View>
                <Text style={styles.miniPercent}>{Math.round(progress * 100)}%</Text>
              </View>
            </View>
          </View>

          {/* CTA */}
          <View style={styles.ctaRow}>
            <View style={styles.statsRow}>
              <Text style={styles.statText}>{spotlight.totalMomsSupported} moms supported</Text>
            </View>
            <View style={styles.ctaButton}>
              <Text style={styles.ctaText}>Explore</Text>
              <MaterialIcons name="arrow-forward" size={16} color={Colors.white} />
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    ...Shadow.lg,
  },
  gradient: {
    backgroundColor: Colors.selfCare,
    padding: Spacing.xl,
    position: 'relative',
    overflow: 'hidden',
  },
  circle: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  circle1: {
    width: 160,
    height: 160,
    top: -50,
    right: -30,
  },
  circle2: {
    width: 100,
    height: 100,
    bottom: -20,
    left: -15,
  },
  circle3: {
    width: 50,
    height: 50,
    top: 30,
    right: 100,
  },
  content: {
    gap: Spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  badgeText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.white,
  },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: '900',
    color: Colors.white,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 20,
  },
  spotlightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
  },
  spotlightAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  spotlightInfo: {
    flex: 1,
    gap: 3,
  },
  spotlightName: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.white,
  },
  spotlightRequest: {
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.85)',
  },
  miniProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: 2,
  },
  miniTrack: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  miniFill: {
    height: '100%',
    backgroundColor: Colors.white,
    borderRadius: 2,
  },
  miniPercent: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.white,
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.xs,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  statText: {
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  ctaText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.white,
  },
});
