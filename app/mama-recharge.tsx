import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, BorderRadius, FontSize, Spacing, Shadow } from '@/app/lib/theme';
import { useApp } from '@/app/lib/store';
import { RECHARGE_CATEGORIES, THURSDAY_SPOTLIGHT } from '@/app/lib/data';
import NeedCard from '@/components/NeedCard';
import ContributeModal from '@/components/ContributeModal';

export default function MamaRechargeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { needs, contribute, currentUser } = useApp();
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [contributeModal, setContributeModal] = useState<{ visible: boolean; needId: string; title: string; remaining: number }>({
    visible: false, needId: '', title: '', remaining: 0,
  });

  const spotlight = THURSDAY_SPOTLIGHT;

  // Filter self-care needs
  const selfCareNeeds = useMemo(() => {
    return needs.filter(n => n.category === 'Self-Care');
  }, [needs]);

  const activeRechargeNeeds = selfCareNeeds.filter(n => n.status === 'Collecting');
  const completedRechargeNeeds = selfCareNeeds.filter(n => n.status !== 'Collecting');

  const totalRaised = selfCareNeeds.reduce((sum, n) => sum + n.raisedAmount, 0);
  const totalSupporters = selfCareNeeds.reduce((sum, n) => sum + n.contributorCount, 0);

  const handleQuickContribute = (needId: string, amount: number) => {
    const need = needs.find(n => n.id === needId);
    if (need) {
      setContributeModal({
        visible: true,
        needId: need.id,
        title: need.title,
        remaining: need.goalAmount - need.raisedAmount,
      });
    }
  };

  const handleContribute = (amount: number, note?: string) => {
    contribute(contributeModal.needId, amount, note);
  };

  const topPadding = Platform.OS === 'web' ? 0 : insets.top;

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          accessibilityLabel="Go back"
        >
          <MaterialIcons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <MaterialIcons name="spa" size={20} color={Colors.selfCare} />
          <Text style={styles.headerTitle}>Mama Recharge</Text>
        </View>
        <TouchableOpacity
          style={styles.postButton}
          onPress={() => router.push('/(tabs)/create')}
          accessibilityLabel="Post a recharge request"
        >
          <MaterialIcons name="add" size={20} color={Colors.white} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View style={styles.heroGradient}>
            <View style={[styles.heroCircle, styles.heroCircle1]} />
            <View style={[styles.heroCircle, styles.heroCircle2]} />
            <View style={[styles.heroCircle, styles.heroCircle3]} />
            <View style={[styles.heroCircle, styles.heroCircle4]} />

            <View style={styles.heroContent}>
              <View style={styles.heroIconRow}>
                <View style={styles.heroIcon}>
                  <MaterialIcons name="spa" size={32} color={Colors.selfCare} />
                </View>
              </View>
              <Text style={styles.heroTitle}>Pour into the{'\n'}ones who pour out</Text>
              <Text style={styles.heroSubtitle}>
                A dedicated space for moms to share small self-care requests that support their mental health and well-being.
              </Text>
              <View style={styles.heroTagline}>
                <View style={styles.heroTaglineLine} />
                <Text style={styles.heroTaglineText}>No tragedy required</Text>
                <View style={styles.heroTaglineLine} />
              </View>
            </View>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{selfCareNeeds.length}</Text>
            <Text style={styles.statLabel}>Requests</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>${totalRaised}</Text>
            <Text style={styles.statLabel}>Raised</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{totalSupporters}</Text>
            <Text style={styles.statLabel}>Supporters</Text>
          </View>
        </View>

        {/* Treat Yourself Thursday Spotlight */}
        <View style={styles.section}>
          <View style={styles.thursdayCard}>
            <View style={styles.thursdayHeader}>
              <View style={styles.thursdayBadge}>
                <MaterialIcons name="auto-awesome" size={16} color={Colors.rechargeGold} />
                <Text style={styles.thursdayBadgeText}>Treat Yourself Thursday</Text>
              </View>
              <Text style={styles.thursdayWeek}>Week {spotlight.weekNumber}</Text>
            </View>

            <Text style={styles.thursdayTitle}>This week's spotlight</Text>
            <Text style={styles.thursdayDescription}>
              Each week, the community comes together to rally around one mom and her self-care request.
            </Text>

            {/* Spotlight Mom */}
            <View style={styles.spotlightCard}>
              <Image source={{ uri: spotlight.currentMom.avatar }} style={styles.spotlightAvatar} />
              <View style={styles.spotlightInfo}>
                <Text style={styles.spotlightName}>{spotlight.currentMom.name}</Text>
                <View style={styles.spotlightCity}>
                  <MaterialIcons name="place" size={12} color={Colors.textLight} />
                  <Text style={styles.spotlightCityText}>{spotlight.currentMom.city}</Text>
                </View>
              </View>
            </View>

            <Text style={styles.spotlightRequest}>{spotlight.currentMom.request}</Text>
            <Text style={styles.spotlightMessage}>{spotlight.currentMom.message}</Text>

            {/* Progress */}
            <View style={styles.spotlightProgress}>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${(spotlight.currentMom.raisedAmount / spotlight.currentMom.goalAmount) * 100}%` }]} />
              </View>
              <View style={styles.progressRow}>
                <Text style={styles.progressAmount}>
                  ${spotlight.currentMom.raisedAmount} of ${spotlight.currentMom.goalAmount}
                </Text>
                <Text style={styles.progressPercent}>
                  {Math.round((spotlight.currentMom.raisedAmount / spotlight.currentMom.goalAmount) * 100)}%
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.spotlightCTA}
              onPress={() => router.push(`/need/${spotlight.currentMom.id}`)}
              activeOpacity={0.8}
            >
              <MaterialIcons name="favorite" size={18} color={Colors.white} />
              <Text style={styles.spotlightCTAText}>Support {spotlight.currentMom.name.split(' ')[0]}</Text>
            </TouchableOpacity>

            {/* Thursday stats */}
            <View style={styles.thursdayStats}>
              <View style={styles.thursdayStat}>
                <Text style={styles.thursdayStatNum}>{spotlight.totalMomsSupported}</Text>
                <Text style={styles.thursdayStatLabel}>Moms Supported</Text>
              </View>
              <View style={styles.thursdayStatDivider} />
              <View style={styles.thursdayStat}>
                <Text style={styles.thursdayStatNum}>${spotlight.totalRaised.toLocaleString()}</Text>
                <Text style={styles.thursdayStatLabel}>Total Raised</Text>
              </View>
            </View>
          </View>
        </View>

        {/* What is Mama Recharge */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What is Mama Recharge?</Text>
          <Text style={styles.sectionDescription}>
            A place where moms can post something that would help them feel supported, refreshed, or poured into. This isn't about emergencies. It's about real life and the quiet ways moms give so much of themselves every day.
          </Text>

          {/* Request type cards */}
          <Text style={styles.requestTypesTitle}>Requests might include:</Text>
          <View style={styles.requestGrid}>
            {RECHARGE_CATEGORIES.map(cat => (
              <View key={cat.name} style={styles.requestCard}>
                <View style={[styles.requestIcon, { backgroundColor: cat.color + '20' }]}>
                  <MaterialIcons name={cat.icon as any} size={22} color={cat.color} />
                </View>
                <Text style={styles.requestName}>{cat.name}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Core message */}
        <View style={styles.section}>
          <View style={styles.messageCard}>
            <MaterialIcons name="format-quote" size={28} color={Colors.selfCare} />
            <Text style={styles.messageText}>
              Sometimes life just happens, and moms deserve support too. No judgment. Just community.
            </Text>
            <View style={styles.messageDivider} />
            <View style={styles.messageValues}>
              <View style={styles.messageValue}>
                <MaterialIcons name="favorite" size={16} color={Colors.selfCare} />
                <Text style={styles.messageValueText}>Hopeful</Text>
              </View>
              <View style={styles.messageValue}>
                <MaterialIcons name="emoji-people" size={16} color={Colors.selfCare} />
                <Text style={styles.messageValueText}>Encouraging</Text>
              </View>
              <View style={styles.messageValue}>
                <MaterialIcons name="groups" size={16} color={Colors.selfCare} />
                <Text style={styles.messageValueText}>Community-driven</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Active Recharge Requests */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Active Requests</Text>
              <Text style={styles.sectionSubtitle}>Support a mom's self-care journey</Text>
            </View>
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{activeRechargeNeeds.length}</Text>
            </View>
          </View>
        </View>

        {activeRechargeNeeds.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="spa" size={48} color={Colors.textLight} />
            <Text style={styles.emptyTitle}>No active requests yet</Text>
            <Text style={styles.emptySubtitle}>Be the first to post a Mama Recharge request!</Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => router.push('/(tabs)/create')}
            >
              <Text style={styles.emptyButtonText}>Post a Request</Text>
            </TouchableOpacity>
          </View>
        ) : (
          activeRechargeNeeds.map(need => (
            <NeedCard
              key={need.id}
              need={need}
              onContribute={handleQuickContribute}
            />
          ))
        )}

        {/* Completed Requests */}
        {completedRechargeNeeds.length > 0 && (
          <>
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionTitle}>Funded Requests</Text>
                  <Text style={styles.sectionSubtitle}>Moms who've been supported</Text>
                </View>
                <MaterialIcons name="celebration" size={24} color={Colors.success} />
              </View>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.completedScroll}>
              {completedRechargeNeeds.map(need => (
                <TouchableOpacity
                  key={need.id}
                  style={styles.completedCard}
                  onPress={() => router.push(`/need/${need.id}`)}
                  activeOpacity={0.8}
                >
                  <Image source={{ uri: need.userAvatar }} style={styles.completedAvatar} />
                  <Text style={styles.completedName}>{need.userName.split(' ')[0]}</Text>
                  <Text style={styles.completedTitle} numberOfLines={2}>{need.title}</Text>
                  <View style={styles.completedBadge}>
                    <MaterialIcons name="check-circle" size={14} color={Colors.success} />
                    <Text style={styles.completedBadgeText}>Funded</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}

        {/* Post CTA */}
        <View style={styles.section}>
          <View style={styles.ctaCard}>
            <View style={styles.ctaIcon}>
              <MaterialIcons name="edit" size={28} color={Colors.selfCare} />
            </View>
            <Text style={styles.ctaTitle}>Share your recharge request</Text>
            <Text style={styles.ctaDescription}>
              What's one small thing that would help you feel like yourself again? Post it here and let the community rally around you.
            </Text>
            <TouchableOpacity
              style={styles.ctaButton}
              onPress={() => router.push('/(tabs)/create')}
              activeOpacity={0.8}
            >
              <MaterialIcons name="spa" size={18} color={Colors.white} />
              <Text style={styles.ctaButtonText}>Post a Recharge Request</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      <ContributeModal
        visible={contributeModal.visible}
        onClose={() => setContributeModal(prev => ({ ...prev, visible: false }))}
        onContribute={handleContribute}
        needTitle={contributeModal.title}
        needId={contributeModal.needId}
        remaining={contributeModal.remaining}
        contributorName={currentUser.name}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.background,
    ...(Platform.OS === 'web' ? {
      paddingTop: 16,
      position: 'sticky' as any,
      top: 0,
      zIndex: 50,
    } : {}),
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerTitle: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.text,
  },
  postButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.selfCare,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Hero
  heroSection: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
  },
  heroGradient: {
    backgroundColor: Colors.selfCare,
    padding: Spacing.xxl,
    position: 'relative',
    overflow: 'hidden',
  },
  heroCircle: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  heroCircle1: { width: 200, height: 200, top: -70, right: -50 },
  heroCircle2: { width: 140, height: 140, bottom: -40, left: -30 },
  heroCircle3: { width: 80, height: 80, top: 40, right: 60 },
  heroCircle4: { width: 50, height: 50, bottom: 20, right: 140 },
  heroContent: {
    gap: Spacing.md,
  },
  heroIconRow: {
    marginBottom: Spacing.sm,
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.md,
  },
  heroTitle: {
    fontSize: FontSize.xxxl,
    fontWeight: '900',
    color: Colors.white,
    lineHeight: 36,
  },
  heroSubtitle: {
    fontSize: FontSize.md,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 22,
  },
  heroTagline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  heroTaglineLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  heroTaglineText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.white,
    fontStyle: 'italic',
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    padding: Spacing.xl,
    borderRadius: BorderRadius.xl,
    ...Shadow.sm,
  },
  statItem: { alignItems: 'center' },
  statNumber: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.text },
  statLabel: { fontSize: FontSize.xs, color: Colors.textLight, marginTop: 2 },
  statDivider: { width: 1, height: 30, backgroundColor: Colors.borderLight },

  // Thursday Spotlight
  section: {
    marginTop: Spacing.xxl,
    paddingHorizontal: Spacing.lg,
  },
  thursdayCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    borderWidth: 2,
    borderColor: Colors.rechargeGold + '40',
    ...Shadow.md,
  },
  thursdayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  thursdayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.rechargeGold + '15',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  thursdayBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: '800',
    color: Colors.rechargeGold,
  },
  thursdayWeek: {
    fontSize: FontSize.xs,
    color: Colors.textLight,
    fontWeight: '600',
  },
  thursdayTitle: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  thursdayDescription: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: Spacing.lg,
  },
  spotlightCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  spotlightAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 3,
    borderColor: Colors.selfCare + '40',
  },
  spotlightInfo: {
    flex: 1,
  },
  spotlightName: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
  },
  spotlightCity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 2,
  },
  spotlightCityText: {
    fontSize: FontSize.xs,
    color: Colors.textLight,
  },
  spotlightRequest: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.selfCareDark,
    marginBottom: Spacing.xs,
  },
  spotlightMessage: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
    fontStyle: 'italic',
    marginBottom: Spacing.lg,
  },
  spotlightProgress: {
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  progressTrack: {
    height: 10,
    backgroundColor: Colors.selfCare + '20',
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.selfCare,
    borderRadius: 5,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressAmount: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.text,
  },
  progressPercent: {
    fontSize: FontSize.sm,
    fontWeight: '800',
    color: Colors.selfCare,
  },
  spotlightCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.selfCare,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xl,
    ...Shadow.md,
  },
  spotlightCTAText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.white,
  },
  thursdayStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginTop: Spacing.lg,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  thursdayStat: { alignItems: 'center' },
  thursdayStatNum: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.text },
  thursdayStatLabel: { fontSize: FontSize.xs, color: Colors.textLight, marginTop: 2 },
  thursdayStatDivider: { width: 1, height: 24, backgroundColor: Colors.borderLight },

  // What is section
  sectionTitle: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  sectionDescription: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },
  requestTypesTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  requestGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  requestCard: {
    width: '30%',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    gap: Spacing.sm,
    ...Shadow.sm,
  },
  requestIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestName: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.textSecondary,
    textAlign: 'center',
  },

  // Core message
  messageCard: {
    backgroundColor: Colors.selfCareLight,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.selfCare + '30',
  },
  messageText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.selfCareDark,
    textAlign: 'center',
    lineHeight: 24,
    fontStyle: 'italic',
  },
  messageDivider: {
    width: 40,
    height: 2,
    backgroundColor: Colors.selfCare + '40',
    borderRadius: 1,
  },
  messageValues: {
    flexDirection: 'row',
    gap: Spacing.xl,
  },
  messageValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  messageValueText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.selfCareDark,
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionSubtitle: {
    fontSize: FontSize.xs,
    color: Colors.textLight,
    marginTop: 2,
  },
  countBadge: {
    backgroundColor: Colors.selfCare + '20',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  countBadgeText: {
    fontSize: FontSize.sm,
    fontWeight: '800',
    color: Colors.selfCare,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.huge,
    gap: Spacing.md,
  },
  emptyTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  emptySubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textLight,
  },
  emptyButton: {
    backgroundColor: Colors.selfCare,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.md,
  },
  emptyButtonText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.white,
  },

  // Completed scroll
  completedScroll: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  completedCard: {
    width: 140,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    gap: Spacing.sm,
    ...Shadow.sm,
  },
  completedAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: Colors.success + '30',
  },
  completedName: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.text,
  },
  completedTitle: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E8F5E8',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  completedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.success,
  },

  // CTA Card
  ctaCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xxl,
    alignItems: 'center',
    gap: Spacing.md,
    borderWidth: 2,
    borderColor: Colors.selfCare + '30',
    ...Shadow.sm,
  },
  ctaIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.selfCareLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaTitle: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
  },
  ctaDescription: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.selfCare,
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.sm,
    ...Shadow.md,
  },
  ctaButtonText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.white,
  },
});
