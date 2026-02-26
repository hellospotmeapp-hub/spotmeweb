import React, { useState, useCallback, useMemo, useEffect } from 'react';
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
import MamaRechargeCard from '@/components/MamaRechargeCard';
import SignInPromptModal from '@/components/SignInPromptModal';
import ErrorBoundary from '@/components/ErrorBoundary';

const DEFAULT_AVATAR = 'https://d64gsuwffb70l.cloudfront.net/698fe0b37fe9438e65b48d58_1771037056297_f9a83069.png';

// Check localStorage directly for auth state (web only)
function hasStoredAuth(): boolean {
  if (Platform.OS !== 'web') return false;
  try {
    const raw = localStorage.getItem('spotme_user');
    if (raw) {
      const user = JSON.parse(raw);
      return user && user.id && user.id !== 'guest';
    }
  } catch {}
  return false;
}

function HomeScreenContent() {
  // ALL hooks must be called unconditionally at the top - no early returns before hooks!
  const insets = useSafeAreaInsets();
  const router = useRouter();
  
  // Direct context access - AppProvider always wraps this component
  const appContext = useApp();

  const [refreshing, setRefreshing] = useState(false);
  const [showSignInPrompt, setShowSignInPrompt] = useState(false);
  const [signInPromptNeed, setSignInPromptNeed] = useState<any>(null);
  const [contributeModal, setContributeModal] = useState({ visible: false, needId: '', title: '', remaining: 0 });
  // Prevent flash of "Sign In" button - wait a tick for auth to settle
  const [authSettled, setAuthSettled] = useState(() => Platform.OS === 'web' ? hasStoredAuth() : false);

  useEffect(() => {
    // Give auth state a moment to settle on mount
    const timer = setTimeout(() => setAuthSettled(true), 500);
    return () => clearTimeout(timer);
  }, []);

  // Extract values safely - BEFORE any conditional returns
  const needs = Array.isArray(appContext.needs) ? appContext.needs : [];
  const contribute = appContext.contribute;
  const selectedCategory = appContext.selectedCategory || 'All';
  const setSelectedCategory = appContext.setSelectedCategory;
  const isLoggedIn = appContext.isLoggedIn || false;
  const isLoading = appContext.isLoading || false;
  const currentUser = appContext.currentUser || { name: 'Guest', avatar: '', id: 'guest' };
  const refreshNeeds = appContext.refreshNeeds;

  // All computed values using hooks - called unconditionally
  const safeNeeds = needs;
  
  const activeNeeds = useMemo(() => {
    try { return safeNeeds.filter((n: any) => n && n.status === 'Collecting'); } catch { return []; }
  }, [safeNeeds]);

  const filteredNeeds = useMemo(() => {
    try {
      return selectedCategory === 'All' ? activeNeeds : activeNeeds.filter((n: any) => n && n.category === selectedCategory);
    } catch { return []; }
  }, [activeNeeds, selectedCategory]);

  const almostThereNeeds = useMemo(() => {
    try {
      return activeNeeds
        .filter((n: any) => n && n.goalAmount > 0 && n.raisedAmount / n.goalAmount >= 0.7 && n.raisedAmount < n.goalAmount)
        .sort((a: any, b: any) => (b.raisedAmount / b.goalAmount) - (a.raisedAmount / a.goalAmount));
    } catch { return []; }
  }, [activeNeeds]);

  const spreadPreview = useMemo(() => {
    try { return smartSplit(30, safeNeeds, 'closest'); }
    catch { return { allocations: [], totalAmount: 30, totalPeople: 0, goalsCompleted: 0, fee: 0, netAmount: 30 }; }
  }, [safeNeeds]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { if (refreshNeeds) await refreshNeeds(); } catch {}
    setRefreshing(false);
  }, [refreshNeeds]);

  // NOW we can do conditional rendering (after all hooks)
  if (!appContext) {
    return (
      <View style={[styles.container, { paddingTop: Platform.OS === 'web' ? 0 : insets.top }]}>
        <View style={styles.topBar}>
          <View><Text style={styles.logo}>SpotMe</Text><Text style={styles.tagline}>No tragedy. Just life.</Text></View>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={{ fontSize: 15, color: Colors.textSecondary }}>Loading SpotMe...</Text>
        </View>
      </View>
    );
  }

  const handleQuickContribute = (needId: string, amount: number) => {
    try {
      const need = safeNeeds.find((n: any) => n.id === needId);
      if (!need) return;
      if (!isLoggedIn) {
        setSignInPromptNeed({ userName: need.userName, userAvatar: need.userAvatar, title: need.title, remaining: need.goalAmount - need.raisedAmount });
        setShowSignInPrompt(true);
        return;
      }
      setContributeModal({ visible: true, needId: need.id, title: need.title, remaining: need.goalAmount - need.raisedAmount });
    } catch {}
  };

  const handleContribute = (amount: number, note?: string) => {
    try { if (contribute) contribute(contributeModal.needId, amount, note); } catch {}
  };

  const safeUser = currentUser || { name: 'Guest', avatar: '', id: 'guest' };
  const topPadding = Platform.OS === 'web' ? 0 : insets.top;

  let totalNeeds = 0, totalRaised = 0, totalSpots = 0;
  try {
    totalNeeds = safeNeeds.length;
    totalRaised = safeNeeds.reduce((sum: number, n: any) => sum + (n?.raisedAmount || 0), 0);
    totalSpots = safeNeeds.reduce((sum: number, n: any) => sum + (n?.contributorCount || 0), 0);
  } catch {}

  const safeSpreadPreview = spreadPreview || { allocations: [], totalAmount: 30, totalPeople: 0, goalsCompleted: 0 };
  const safeAllocations = Array.isArray(safeSpreadPreview.allocations) ? safeSpreadPreview.allocations : [];

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.topBar}>
        <View><Text style={styles.logo}>SpotMe</Text><Text style={styles.tagline}>No tragedy. Just life.</Text></View>
        <View style={styles.topBarRight}>
          <TouchableOpacity style={styles.iconButton} onPress={() => { try { router.push('/settings'); } catch {} }}>
            <MaterialIcons name="settings" size={22} color={Colors.textSecondary} />
          </TouchableOpacity>
          {!isLoggedIn && !isLoading && authSettled ? (
            <TouchableOpacity style={styles.signInButton} onPress={() => { try { router.push('/auth'); } catch {} }}>
              <Text style={styles.signInText}>Sign In</Text>
            </TouchableOpacity>
          ) : isLoggedIn ? (
            <TouchableOpacity onPress={() => { try { router.push('/(tabs)/profile'); } catch {} }}>
              <Image source={{ uri: safeUser.avatar || DEFAULT_AVATAR }} style={styles.topAvatar} />
            </TouchableOpacity>
          ) : null}

        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}
        refreshControl={Platform.OS !== 'web' ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} /> : undefined}
        style={Platform.OS === 'web' ? { flex: 1 } : undefined}>

        <View style={styles.heroContainer}>
          <Image source={{ uri: HERO_IMAGE }} style={styles.heroImage} />
          <View style={styles.heroOverlay}>
            <Text style={styles.heroTitle}>Small acts.{'\n'}Big impact.</Text>
            <Text style={styles.heroSubtitle}>Help your neighbors with everyday needs.{'\n'}Every dollar counts.</Text>
            <TouchableOpacity style={styles.heroCTA} onPress={() => { try { router.push('/(tabs)/create'); } catch {} }} activeOpacity={0.8}>
              <MaterialIcons name="add-circle" size={20} color={Colors.white} />
              <Text style={styles.heroCTAText}>Post a Need</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={styles.walkthroughBanner} onPress={() => { try { router.push('/welcome'); } catch {} }} activeOpacity={0.8}>
          <View style={styles.walkthroughIcon}><MaterialIcons name="play-circle-filled" size={20} color={Colors.primary} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.walkthroughTitle}>New here? Watch our walkthrough</Text>
            <Text style={styles.walkthroughSubtitle}>See how SpotMe works in 45 seconds</Text>
          </View>
          <MaterialIcons name="chevron-right" size={20} color={Colors.textLight} />
        </TouchableOpacity>

        <View style={styles.statsRow}>
          <View style={styles.statItem}><Text style={styles.statNumber}>{totalNeeds}</Text><Text style={styles.statLabel}>Active Needs</Text></View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}><Text style={styles.statNumber}>${totalRaised.toLocaleString()}</Text><Text style={styles.statLabel}>Raised</Text></View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}><Text style={styles.statNumber}>{totalSpots}</Text><Text style={styles.statLabel}>Spots Given</Text></View>
        </View>

        <TouchableOpacity style={styles.spreadCard} onPress={() => { try { router.push('/spread'); } catch {} }} activeOpacity={0.85}>
          <View style={styles.spreadGradient}>
            <View style={[styles.spreadCircle, styles.spreadCircle1]} />
            <View style={[styles.spreadCircle, styles.spreadCircle2]} />
            <View style={styles.spreadContent}>
              <View style={styles.spreadIconRow}>
                <View style={styles.spreadIconCircle}><MaterialIcons name="favorite" size={24} color={Colors.primary} /></View>
                <View style={styles.spreadBadge}><MaterialIcons name="auto-awesome" size={12} color={Colors.accent} /><Text style={styles.spreadBadgeText}>Smart Split</Text></View>
              </View>
              <Text style={styles.spreadTitle}>Spread the Love</Text>
              <Text style={styles.spreadSubtitle}>One payment. Multiple smiles. Help {safeSpreadPreview.totalPeople || 0} people with just $30.</Text>
              <View style={styles.spreadPreviewRow}>
                <View style={styles.spreadAvatars}>
                  {safeAllocations.slice(0, 4).map((alloc: any, i: number) => (
                    <Image key={alloc?.needId || i} source={{ uri: alloc?.userAvatar || DEFAULT_AVATAR }} style={[styles.spreadAvatar, { marginLeft: i > 0 ? -8 : 0, zIndex: 4 - i }]} />
                  ))}
                </View>
                <View style={styles.spreadCTAButton}><Text style={styles.spreadCTAText}>Spread Now</Text><MaterialIcons name="arrow-forward" size={16} color={Colors.white} /></View>
              </View>
            </View>
          </View>
        </TouchableOpacity>

        <View style={{ marginHorizontal: Spacing.lg, marginTop: Spacing.lg }}>
          <MamaRechargeCard />
        </View>

        {almostThereNeeds.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View><Text style={styles.sectionTitle}>Almost There</Text><Text style={styles.sectionSubtitle}>These needs are close to their goal</Text></View>
              <MaterialIcons name="local-fire-department" size={24} color={Colors.accent} />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
              {almostThereNeeds.map((need: any) => (
                <TouchableOpacity key={need.id} style={styles.almostCard} onPress={() => { try { router.push(`/need/${need.id}`); } catch {} }} activeOpacity={0.8}>
                  {need.photo && <Image source={{ uri: need.photo }} style={styles.almostImage} />}
                  <View style={styles.almostContent}>
                    <Text style={styles.almostTitle} numberOfLines={1}>{need.title}</Text>
                    <View style={styles.almostProgress}>
                      <View style={styles.almostTrack}><View style={[styles.almostFill, { width: `${Math.min((need.raisedAmount / (need.goalAmount || 1)) * 100, 100)}%` }]} /></View>
                      <Text style={styles.almostPercent}>{Math.round((need.raisedAmount / (need.goalAmount || 1)) * 100)}%</Text>
                    </View>
                    <Text style={styles.almostRemaining}>${need.goalAmount - need.raisedAmount} to go</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Browse by Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesRow}>
            {(CATEGORIES || []).map((cat: any) => {
              const isSelected = selectedCategory === cat.name;
              return (
                <TouchableOpacity key={cat.name} style={[styles.categoryChip, isSelected && styles.categoryChipSelected]} onPress={() => { try { if (setSelectedCategory) setSelectedCategory(cat.name); } catch {} }} activeOpacity={0.7}>
                  <MaterialIcons name={cat.icon as any} size={18} color={isSelected ? Colors.white : Colors.textSecondary} />
                  <Text style={[styles.categoryChipText, isSelected && styles.categoryChipTextSelected]}>{cat.name}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{selectedCategory === 'All' ? 'Latest Needs' : selectedCategory}</Text>
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
          filteredNeeds.map((need: any) => (
            <NeedCard key={need.id} need={need} onContribute={handleQuickContribute} />
          ))
        )}

        {Platform.OS === 'web' && (
          <View style={styles.webFooter}>
            <Text style={styles.webFooterLogo}>SpotMe</Text>
            <Text style={styles.webFooterTagline}>No tragedy. Just life.</Text>
            <View style={styles.webFooterLinks}>
              <TouchableOpacity onPress={() => { try { router.push('/guidelines'); } catch {} }}><Text style={styles.webFooterLink}>Guidelines</Text></TouchableOpacity>
              <Text style={styles.webFooterDot}>·</Text>
              <TouchableOpacity onPress={() => { try { router.push('/settings'); } catch {} }}><Text style={styles.webFooterLink}>Settings</Text></TouchableOpacity>
            </View>
            <Text style={styles.webFooterCopy}>© 2026 SpotMe. All rights reserved.</Text>
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      <ContributeModal visible={contributeModal.visible} onClose={() => setContributeModal(prev => ({ ...prev, visible: false }))} onContribute={handleContribute} needTitle={contributeModal.title} needId={contributeModal.needId} remaining={contributeModal.remaining} contributorName={safeUser.name || 'Guest'} />
      <SignInPromptModal visible={showSignInPrompt} onClose={() => setShowSignInPrompt(false)} userName={signInPromptNeed?.userName} userAvatar={signInPromptNeed?.userAvatar} needTitle={signInPromptNeed?.title} remaining={signInPromptNeed?.remaining} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, ...(Platform.OS === 'web' ? { paddingTop: 16, position: 'sticky' as any, top: 0, zIndex: 50, backgroundColor: Colors.background } : {}) },
  logo: { fontSize: FontSize.xxl, fontWeight: '900', color: Colors.primary, letterSpacing: -0.5 },
  tagline: { fontSize: FontSize.xs, color: Colors.textLight, fontStyle: 'italic', marginTop: -2 },
  topBarRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  iconButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  signInButton: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, backgroundColor: Colors.primary, borderRadius: BorderRadius.full },
  signInText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.white },
  topAvatar: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: Colors.primary },
  heroContainer: { marginHorizontal: Spacing.lg, marginTop: Spacing.sm, borderRadius: BorderRadius.xl, overflow: 'hidden', height: 220 },
  heroImage: { width: '100%', height: '100%' },
  heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(45, 41, 38, 0.55)', padding: Spacing.xxl, justifyContent: 'flex-end' },
  heroTitle: { fontSize: FontSize.xxxl, fontWeight: '900', color: Colors.white, lineHeight: 36, marginBottom: Spacing.xs },
  heroSubtitle: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.85)', lineHeight: 20, marginBottom: Spacing.lg },
  heroCTA: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.primary, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderRadius: BorderRadius.full, alignSelf: 'flex-start', ...Shadow.md },
  heroCTAText: { fontSize: FontSize.md, fontWeight: '700', color: Colors.white },
  statsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', backgroundColor: Colors.surface, marginHorizontal: Spacing.lg, marginTop: Spacing.lg, padding: Spacing.xl, borderRadius: BorderRadius.xl, ...Shadow.sm },
  statItem: { alignItems: 'center' },
  statNumber: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.text },
  statLabel: { fontSize: FontSize.xs, color: Colors.textLight, marginTop: 2 },
  statDivider: { width: 1, height: 30, backgroundColor: Colors.borderLight },
  spreadCard: { marginHorizontal: Spacing.lg, marginTop: Spacing.lg, borderRadius: BorderRadius.xl, overflow: 'hidden', ...Shadow.lg },
  spreadGradient: { backgroundColor: Colors.primary, padding: Spacing.xl, position: 'relative', overflow: 'hidden' },
  spreadCircle: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.08)' },
  spreadCircle1: { width: 180, height: 180, top: -60, right: -40 },
  spreadCircle2: { width: 120, height: 120, bottom: -30, left: -20 },
  spreadContent: { gap: Spacing.md },
  spreadIconRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  spreadIconCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center', ...Shadow.sm },
  spreadBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: BorderRadius.full },
  spreadBadgeText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.white },
  spreadTitle: { fontSize: FontSize.xxl, fontWeight: '900', color: Colors.white, letterSpacing: -0.3 },
  spreadSubtitle: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.85)', lineHeight: 20 },
  spreadPreviewRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.xs },
  spreadAvatars: { flexDirection: 'row', alignItems: 'center' },
  spreadAvatar: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: Colors.primary },
  spreadCTAButton: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' },
  spreadCTAText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.white },
  section: { marginTop: Spacing.xxl, paddingHorizontal: Spacing.lg },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  sectionTitle: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.text },
  sectionSubtitle: { fontSize: FontSize.xs, color: Colors.textLight, marginTop: 2 },
  needCount: { fontSize: FontSize.sm, color: Colors.textLight },
  horizontalScroll: { paddingRight: Spacing.lg, gap: Spacing.md },
  almostCard: { width: 200, backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, overflow: 'hidden', ...Shadow.sm },
  almostImage: { width: '100%', height: 110 },
  almostContent: { padding: Spacing.md, gap: Spacing.xs },
  almostTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.text },
  almostProgress: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  almostTrack: { flex: 1, height: 6, backgroundColor: Colors.borderLight, borderRadius: 3, overflow: 'hidden' },
  almostFill: { height: '100%', backgroundColor: Colors.accent, borderRadius: 3 },
  almostPercent: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.accent },
  almostRemaining: { fontSize: FontSize.xs, color: Colors.textSecondary },
  categoriesRow: { gap: Spacing.sm, paddingRight: Spacing.lg },
  categoryChip: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  categoryChipSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  categoryChipText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary },
  categoryChipTextSelected: { color: Colors.white },
  emptyState: { alignItems: 'center', paddingVertical: Spacing.huge, gap: Spacing.md },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textSecondary },
  emptySubtitle: { fontSize: FontSize.sm, color: Colors.textLight },
  webFooter: { alignItems: 'center', paddingVertical: Spacing.xxxl, paddingHorizontal: Spacing.xl, marginTop: Spacing.xxl, borderTopWidth: 1, borderTopColor: Colors.borderLight, gap: Spacing.xs },
  webFooterLogo: { fontSize: FontSize.xl, fontWeight: '900', color: Colors.primary },
  webFooterTagline: { fontSize: FontSize.sm, color: Colors.textLight, fontStyle: 'italic' },
  webFooterLinks: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.md },
  webFooterLink: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: '600' },
  webFooterDot: { color: Colors.textLight },
  webFooterCopy: { fontSize: FontSize.xs, color: Colors.textLight, marginTop: Spacing.sm },
  walkthroughBanner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginHorizontal: Spacing.lg, marginTop: Spacing.md, backgroundColor: Colors.surface, padding: Spacing.md, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.primaryLight, ...Shadow.sm },
  walkthroughIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  walkthroughTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.text },
  walkthroughSubtitle: { fontSize: FontSize.xs, color: Colors.textLight, marginTop: 1 },
});

export default function HomeScreen() {
  return (
    <ErrorBoundary fallbackTitle="Home couldn't load" fallbackMessage="Tap below to try again. You're still signed in.">
      <HomeScreenContent />
    </ErrorBoundary>
  );
}
