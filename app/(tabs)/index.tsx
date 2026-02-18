import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, RefreshControl, Platform, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, BorderRadius, FontSize, Spacing, Shadow } from '@/app/lib/theme';
import { useApp } from '@/app/lib/store';
import { HERO_IMAGE, CATEGORIES } from '@/app/lib/data';
import { smartSplit } from '@/app/lib/smartSplit';
import NeedCard from '@/components/NeedCard';
import ContributeModal from '@/components/ContributeModal';
import ShareCard from '@/components/ShareCard';
import MamaRechargeCard from '@/components/MamaRechargeCard';


export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { needs, contribute, selectedCategory, setSelectedCategory, isLoggedIn, currentUser, unreadNotificationCount, refreshNeeds, isLoading } = useApp();
  const [refreshing, setRefreshing] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [contributeModal, setContributeModal] = useState<{ visible: boolean; needId: string; title: string; remaining: number }>({
    visible: false, needId: '', title: '', remaining: 0,
  });


  const activeNeeds = needs.filter(n => n.status === 'Collecting');
  const filteredNeeds = selectedCategory === 'All'
    ? activeNeeds
    : activeNeeds.filter(n => n.category === selectedCategory);
  
  const almostThereNeeds = activeNeeds
    .filter(n => n.raisedAmount / n.goalAmount >= 0.7 && n.raisedAmount < n.goalAmount)
    .sort((a, b) => (b.raisedAmount / b.goalAmount) - (a.raisedAmount / a.goalAmount));

  // Smart Split preview for the Spread the Love card
  const spreadPreview = useMemo(() => {
    return smartSplit(30, needs, 'closest');
  }, [needs]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

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

  // On web, use env(safe-area-inset-top) via CSS, on native use insets
  const topPadding = Platform.OS === 'web' ? 0 : insets.top;

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.logo}>SpotMe</Text>
          <Text style={styles.tagline}>No tragedy. Just life.</Text>
        </View>
        <View style={styles.topBarRight}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => router.push('/settings')}
            accessibilityLabel="Settings"
            accessibilityRole="button"
          >
            <MaterialIcons name="settings" size={22} color={Colors.textSecondary} />
          </TouchableOpacity>
          {!isLoggedIn ? (
            <TouchableOpacity
              style={styles.signInButton}
              onPress={() => router.push('/auth')}
              accessibilityLabel="Sign In"
              accessibilityRole="button"
            >
              <Text style={styles.signInText}>Sign In</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/profile')}
              accessibilityLabel="Profile"
              accessibilityRole="button"
            >
              <Image source={{ uri: currentUser.avatar }} style={styles.topAvatar} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          Platform.OS !== 'web' ? (
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
          ) : undefined
        }
        style={Platform.OS === 'web' ? { flex: 1 } : undefined}
      >
        {/* Hero Section */}
        <View style={styles.heroContainer}>
          <Image source={{ uri: HERO_IMAGE }} style={styles.heroImage} />
          <View style={styles.heroOverlay}>
            <Text style={styles.heroTitle}>Small acts.{'\n'}Big impact.</Text>
            <Text style={styles.heroSubtitle}>
              Help your neighbors with everyday needs.{'\n'}Every dollar counts.
            </Text>
            <TouchableOpacity
              style={styles.heroCTA}
              onPress={() => router.push('/(tabs)/create')}
              activeOpacity={0.8}
              accessibilityLabel="Post a Need"
              accessibilityRole="button"
            >
              <MaterialIcons name="add-circle" size={20} color={Colors.white} />
              <Text style={styles.heroCTAText}>Post a Need</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Welcome Walkthrough Banner */}
        <TouchableOpacity
          style={styles.walkthroughBanner}
          onPress={() => router.push('/welcome')}
          activeOpacity={0.8}
          accessibilityLabel="Watch the SpotMe walkthrough"
          accessibilityRole="button"
        >
          <View style={styles.walkthroughIcon}>
            <MaterialIcons name="play-circle-filled" size={20} color={Colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.walkthroughTitle}>New here? Watch our walkthrough</Text>
            <Text style={styles.walkthroughSubtitle}>See how SpotMe works in 45 seconds</Text>
          </View>
          <MaterialIcons name="chevron-right" size={20} color={Colors.textLight} />
        </TouchableOpacity>


        {/* Stats Row */}

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{needs.length}</Text>
            <Text style={styles.statLabel}>Active Needs</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              ${needs.reduce((sum, n) => sum + n.raisedAmount, 0).toLocaleString()}
            </Text>
            <Text style={styles.statLabel}>Raised</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              {needs.reduce((sum, n) => sum + n.contributorCount, 0)}
            </Text>
            <Text style={styles.statLabel}>Spots Given</Text>
          </View>
        </View>

        {/* Spread the Love Card */}
        <TouchableOpacity
          style={styles.spreadCard}
          onPress={() => router.push('/spread')}
          activeOpacity={0.85}
          accessibilityLabel="Spread the Love - One payment helps multiple people"
          accessibilityRole="button"
        >
          <View style={styles.spreadGradient}>
            {/* Decorative circles */}
            <View style={[styles.spreadCircle, styles.spreadCircle1]} />
            <View style={[styles.spreadCircle, styles.spreadCircle2]} />
            <View style={[styles.spreadCircle, styles.spreadCircle3]} />
            
            <View style={styles.spreadContent}>
              <View style={styles.spreadIconRow}>
                <View style={styles.spreadIconCircle}>
                  <MaterialIcons name="favorite" size={24} color={Colors.primary} />
                </View>
                <View style={styles.spreadBadge}>
                  <MaterialIcons name="auto-awesome" size={12} color={Colors.accent} />
                  <Text style={styles.spreadBadgeText}>Smart Split</Text>
                </View>
              </View>

              <Text style={styles.spreadTitle}>Spread the Love</Text>
              <Text style={styles.spreadSubtitle}>
                One payment. Multiple smiles. Help {spreadPreview.totalPeople} people
                {spreadPreview.goalsCompleted > 0 && ` and complete ${spreadPreview.goalsCompleted} ${spreadPreview.goalsCompleted === 1 ? 'goal' : 'goals'}`} with just $30.
              </Text>

              {/* Mini avatars preview */}
              <View style={styles.spreadPreviewRow}>
                <View style={styles.spreadAvatars}>
                  {spreadPreview.allocations.slice(0, 4).map((alloc, i) => (
                    <Image
                      key={alloc.needId}
                      source={{ uri: alloc.userAvatar }}
                      style={[styles.spreadAvatar, { marginLeft: i > 0 ? -8 : 0, zIndex: 4 - i }]}
                    />
                  ))}
                  {spreadPreview.allocations.length > 4 && (
                    <View style={[styles.spreadAvatarMore, { marginLeft: -8 }]}>
                      <Text style={styles.spreadAvatarMoreText}>+{spreadPreview.allocations.length - 4}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.spreadCTAButton}>
                  <Text style={styles.spreadCTAText}>Spread Now</Text>
                  <MaterialIcons name="arrow-forward" size={16} color={Colors.white} />
                </View>
              </View>
            </View>
          </View>
        </TouchableOpacity>

        {/* Mama Recharge Card */}
        <MamaRechargeCard />


        {/* Almost There Section */}
        {almostThereNeeds.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Almost There</Text>
                <Text style={styles.sectionSubtitle}>These needs are close to their goal</Text>
              </View>
              <MaterialIcons name="local-fire-department" size={24} color={Colors.accent} />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
              {almostThereNeeds.map(need => (
                <TouchableOpacity
                  key={need.id}
                  style={styles.almostCard}
                  onPress={() => router.push(`/need/${need.id}`)}
                  activeOpacity={0.8}
                >
                  {need.photo && <Image source={{ uri: need.photo }} style={styles.almostImage} />}
                  <View style={styles.almostContent}>
                    <Text style={styles.almostTitle} numberOfLines={1}>{need.title}</Text>
                    <View style={styles.almostProgress}>
                      <View style={styles.almostTrack}>
                        <View style={[styles.almostFill, { width: `${(need.raisedAmount / need.goalAmount) * 100}%` }]} />
                      </View>
                      <Text style={styles.almostPercent}>
                        {Math.round((need.raisedAmount / need.goalAmount) * 100)}%
                      </Text>
                    </View>
                    <Text style={styles.almostRemaining}>
                      ${need.goalAmount - need.raisedAmount} to go
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Categories */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Browse by Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesRow}>
            {CATEGORIES.map(cat => {
              const isSelected = selectedCategory === cat.name;
              return (
                <TouchableOpacity
                  key={cat.name}
                  style={[styles.categoryChip, isSelected && styles.categoryChipSelected]}
                  onPress={() => setSelectedCategory(cat.name)}
                  activeOpacity={0.7}
                  accessibilityLabel={`Filter by ${cat.name}`}
                  accessibilityRole="button"
                >
                  <MaterialIcons
                    name={cat.icon as any}
                    size={18}
                    color={isSelected ? Colors.white : Colors.textSecondary}
                  />
                  <Text style={[styles.categoryChipText, isSelected && styles.categoryChipTextSelected]}>
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Feed */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {selectedCategory === 'All' ? 'Latest Needs' : selectedCategory}
            </Text>
            <Text style={styles.needCount}>{filteredNeeds.length} needs</Text>
          </View>
        </View>

        {filteredNeeds.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="search-off" size={48} color={Colors.textLight} />
            <Text style={styles.emptyTitle}>No needs in this category</Text>
            <Text style={styles.emptySubtitle}>Try browsing a different category</Text>
          </View>
        ) : (
          filteredNeeds.map(need => (
            <NeedCard
              key={need.id}
              need={need}
              onContribute={handleQuickContribute}
            />
          ))
        )}

        {/* Web Footer */}
        {Platform.OS === 'web' && (
          <View style={styles.webFooter}>
            <Text style={styles.webFooterLogo}>SpotMe</Text>
            <Text style={styles.webFooterTagline}>No tragedy. Just life.</Text>
            <View style={styles.webFooterLinks}>
              <TouchableOpacity onPress={() => router.push('/guidelines')}>
                <Text style={styles.webFooterLink}>Guidelines</Text>
              </TouchableOpacity>
              <Text style={styles.webFooterDot}>·</Text>
              <TouchableOpacity onPress={() => router.push('/settings')}>
                <Text style={styles.webFooterLink}>Settings</Text>
              </TouchableOpacity>
              <Text style={styles.webFooterDot}>·</Text>
              <TouchableOpacity>
                <Text style={styles.webFooterLink}>Privacy</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.webFooterCopy}>© 2026 SpotMe. All rights reserved.</Text>
          </View>
        )}

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
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    ...(Platform.OS === 'web' ? {
      paddingTop: 16,
      position: 'sticky' as any,
      top: 0,
      zIndex: 50,
      backgroundColor: Colors.background,
    } : {}),
  },
  logo: {
    fontSize: FontSize.xxl,
    fontWeight: '900',
    color: Colors.primary,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: FontSize.xs,
    color: Colors.textLight,
    fontStyle: 'italic',
    marginTop: -2,
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signInButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
  },
  signInText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.white,
  },
  topAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  heroContainer: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    height: 220,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(45, 41, 38, 0.55)',
    padding: Spacing.xxl,
    justifyContent: 'flex-end',
  },
  heroTitle: {
    fontSize: FontSize.xxxl,
    fontWeight: '900',
    color: Colors.white,
    lineHeight: 36,
    marginBottom: Spacing.xs,
  },
  heroSubtitle: {
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 20,
    marginBottom: Spacing.lg,
  },
  heroCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    alignSelf: 'flex-start',
    ...Shadow.md,
  },
  heroCTAText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.white,
  },
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
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.text,
  },
  statLabel: {
    fontSize: FontSize.xs,
    color: Colors.textLight,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: Colors.borderLight,
  },

  // Spread the Love Card
  spreadCard: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    ...Shadow.lg,
  },
  spreadGradient: {
    backgroundColor: Colors.primary,
    padding: Spacing.xl,
    position: 'relative',
    overflow: 'hidden',
  },
  spreadCircle: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  spreadCircle1: {
    width: 180,
    height: 180,
    top: -60,
    right: -40,
  },
  spreadCircle2: {
    width: 120,
    height: 120,
    bottom: -30,
    left: -20,
  },
  spreadCircle3: {
    width: 60,
    height: 60,
    top: 20,
    right: 80,
  },
  spreadContent: {
    gap: Spacing.md,
  },
  spreadIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  spreadIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
  },
  spreadBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  spreadBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.white,
  },
  spreadTitle: {
    fontSize: FontSize.xxl,
    fontWeight: '900',
    color: Colors.white,
    letterSpacing: -0.3,
  },
  spreadSubtitle: {
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 20,
  },
  spreadPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.xs,
  },
  spreadAvatars: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  spreadAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  spreadAvatarMore: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  spreadAvatarMoreText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.white,
  },
  spreadCTAButton: {
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
  spreadCTAText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.white,
  },

  section: {
    marginTop: Spacing.xxl,
    paddingHorizontal: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.text,
  },
  sectionSubtitle: {
    fontSize: FontSize.xs,
    color: Colors.textLight,
    marginTop: 2,
  },
  needCount: {
    fontSize: FontSize.sm,
    color: Colors.textLight,
  },
  horizontalScroll: {
    paddingRight: Spacing.lg,
    gap: Spacing.md,
  },
  almostCard: {
    width: 200,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    ...Shadow.sm,
  },
  almostImage: {
    width: '100%',
    height: 110,
  },
  almostContent: {
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  almostTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.text,
  },
  almostProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  almostTrack: {
    flex: 1,
    height: 6,
    backgroundColor: Colors.borderLight,
    borderRadius: 3,
    overflow: 'hidden',
  },
  almostFill: {
    height: '100%',
    backgroundColor: Colors.accent,
    borderRadius: 3,
  },
  almostPercent: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.accent,
  },
  almostRemaining: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  categoriesRow: {
    gap: Spacing.sm,
    paddingRight: Spacing.lg,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  categoryChipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  categoryChipText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  categoryChipTextSelected: {
    color: Colors.white,
  },
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
  // Web Footer
  webFooter: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl,
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing.xxl,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    gap: Spacing.xs,
  },
  webFooterLogo: {
    fontSize: FontSize.xl,
    fontWeight: '900',
    color: Colors.primary,
  },
  webFooterTagline: {
    fontSize: FontSize.sm,
    color: Colors.textLight,
    fontStyle: 'italic',
  },
  webFooterLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  webFooterLink: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: '600',
  },
  webFooterDot: {
    color: Colors.textLight,
  },
  webFooterCopy: {
    fontSize: FontSize.xs,
    color: Colors.textLight,
    marginTop: Spacing.sm,
  },
  // Walkthrough Banner
  walkthroughBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.primaryLight,
    ...Shadow.sm,
  },
  walkthroughIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  walkthroughTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.text,
  },
  walkthroughSubtitle: {
    fontSize: FontSize.xs,
    color: Colors.textLight,
    marginTop: 1,
  },
});
