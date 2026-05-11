import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Platform, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, BorderRadius, FontSize, Spacing } from '@/app/lib/theme';
import { supabase } from '@/app/lib/supabase';

// ── Tier definitions ──────────────────────────────────────────
const TIERS = [
  {
    id: 'micro',
    emoji: '🌱',
    name: 'Micro Spotter',
    tagline: 'Small but mighty',
    amount: 10,
    color: '#E8694A',
    bgColor: '#FFF0EC',
    ctaLabel: 'Start as a Micro Spotter',
    impact: 'Your $10 spots needs throughout the community 🧡',
  },
  {
    id: 'bold',
    emoji: '💜',
    name: 'Bold Spotter',
    tagline: 'Making real waves',
    amount: 30,
    color: '#7B5EA7',
    bgColor: '#F3EEF9',
    ctaLabel: 'Step Up as a Bold Spotter',
    impact: 'Your $30 spots needs throughout the community 🧡',
  },
  {
    id: 'champion',
    emoji: '👑',
    name: 'Champion Spotter',
    tagline: 'Leading the community',
    amount: 40,
    color: '#C9970A',
    bgColor: '#FFF8E1',
    ctaLabel: '🙌 Become a Champion Spotter',
    impact: 'Your $40 spots needs throughout the community 🧡',
    badge: 'CHAMPION',
  },
];

const FEATURES = [
  { icon: '👀', text: 'See exactly which needs you spotted' },
  { icon: '📊', text: 'Monthly impact report' },
  { icon: '🥇', text: 'Spotter badge on your profile' },
  { icon: '🔗', text: 'Shareable impact card for LinkedIn' },
  { icon: '❤️', text: '100% of your $ goes to real people' },
];

const PREVIEW_NEEDS = [
  { initial: 'S', color: '#E8694A', name: 'Sarah M. · Austin TX', need: 'Groceries before payday' },
  { initial: 'J', color: '#7B5EA7', name: 'Jamie L. · Dallas TX', need: 'Electric bill due' },
  { initial: 'M', color: '#5CB85C', name: 'Maria G. · Houston TX', need: "Kids lunch money" },
];

export default function SpotterTiersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const [activeSub, setActiveSub] = useState<any>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  // Check if user already has an active subscription
  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setLoadingStatus(false); return; }
        const { data } = await supabase
          .from('spotters')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .maybeSingle();
        setActiveSub(data);
      } catch {}
      setLoadingStatus(false);
    })();
  }, []);

  const handleSubscribe = async (tier: typeof TIERS[0]) => {
    try {
      setLoadingTier(tier.id);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth');
        return;
      }

      const { data, error } = await supabase.functions.invoke('spotter-subscription', {
        body: {
          action: 'create_spotter_subscription',
          tier: tier.id,
          amount: tier.amount,
          userId: user.id,
          userEmail: user.email || '',
          tierName: tier.name,
        },
      });

      if (error || !data?.url) {
        Alert.alert('Something went wrong', error?.message || data?.error || 'Could not start subscription. Please try again.');
        return;
      }

      if (Platform.OS === 'web') {
        window.location.href = data.url;
      } else {
        router.push({ pathname: '/spotter-success', params: { url: data.url } });
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not start subscription.');
    } finally {
      setLoadingTier(null);
    }
  };

  const handleCancel = async () => {
    if (!activeSub) return;
    Alert.alert(
      'Cancel Subscription',
      "You'll keep your Spotter status until the end of the billing period. Cancel?",
      [
        { text: 'Keep Subscription', style: 'cancel' },
        {
          text: 'Cancel', style: 'destructive', onPress: async () => {
            try {
              const { error } = await supabase.functions.invoke('spotter-subscription', {
                body: { action: 'cancel_spotter_subscription', spotterId: activeSub.id },
              });
              if (error) { Alert.alert('Error', error.message); return; }
              setActiveSub(null);
              Alert.alert('Cancelled', 'Your subscription has been cancelled. Thank you for spotting needs!');
            } catch (err: any) {
              Alert.alert('Error', err.message);
            }
          }
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header bar */}
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <MaterialIcons name="close" size={24} color={Colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.heroHeart}>🧡</Text>
          <Text style={styles.heroTitle}>Become a{'\n'}Community Spotter</Text>
          <Text style={styles.heroSub}>Your contribution supports needs throughout the community</Text>
        </View>

        {/* Active subscription banner */}
        {loadingStatus ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 16 }} />
        ) : activeSub ? (
          <View style={styles.activeBanner}>
            <Text style={styles.activeBannerText}>
              🥇 You're an active {activeSub.tier.charAt(0).toUpperCase() + activeSub.tier.slice(1)} Spotter — thank you!
            </Text>
            <TouchableOpacity onPress={handleCancel}>
              <Text style={styles.cancelLink}>Cancel subscription</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Choose amount label */}
        <Text style={styles.sectionLabel}>CHOOSE YOUR AMOUNT</Text>

        {/* Tier cards */}
        {TIERS.map((tier) => (
          <View key={tier.id} style={[styles.card, activeSub?.tier === tier.id && styles.cardActive]}>
            {tier.badge && (
              <View style={[styles.badge, { backgroundColor: tier.color }]}>
                <Text style={styles.badgeText}>🔥 {tier.badge}</Text>
              </View>
            )}
            {/* Tier header row */}
            <View style={styles.cardHeader}>
              <View style={[styles.emojiCircle, { backgroundColor: tier.bgColor }]}>
                <Text style={styles.tierEmoji}>{tier.emoji}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.tierName}>{tier.name}</Text>
                <Text style={styles.tierTagline}>{tier.tagline}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.tierPrice, { color: tier.color }]}>${tier.amount}</Text>
                <Text style={styles.tierPer}>/month</Text>
              </View>
            </View>

            {/* Impact callout */}
            <View style={[styles.impactBox, { backgroundColor: tier.bgColor }]}>
              <Text style={[styles.impactText, { color: tier.color }]}>{tier.impact}</Text>
            </View>

            {/* Features */}
            <View style={styles.featureList}>
              {FEATURES.map((f, i) => (
                <View key={i} style={styles.featureRow}>
                  <Text style={styles.featureIcon}>{f.icon}</Text>
                  <Text style={styles.featureText}>{f.text}</Text>
                </View>
              ))}
            </View>

            {/* CTA button */}
            <TouchableOpacity
              style={[styles.ctaBtn, { backgroundColor: tier.color }, (loadingTier === tier.id || !!activeSub) && styles.ctaBtnDisabled]}
              onPress={() => !activeSub && handleSubscribe(tier)}
              disabled={!!loadingTier || !!activeSub}
            >
              {loadingTier === tier.id ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.ctaBtnText}>
                  {activeSub?.tier === tier.id ? '✓ Current Plan' : tier.ctaLabel}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        ))}

        {/* Monthly preview */}
        <View style={styles.previewCard}>
          <Text style={styles.previewTitle}>👀 Every month you'll see this:</Text>
          {PREVIEW_NEEDS.map((n, i) => (
            <View key={i} style={styles.previewRow}>
              <View style={[styles.previewAvatar, { backgroundColor: n.color }]}>
                <Text style={styles.previewInitial}>{n.initial}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.previewName}>{n.name}</Text>
                <Text style={styles.previewNeed}>{n.need}</Text>
              </View>
              <Text style={styles.previewSpotted}>Need spotted 🧡</Text>
            </View>
          ))}
          <Text style={styles.previewFootnote}>I'll just spot one at a time — that's ok too 🧡</Text>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>Cancel anytime · Powered by Stripe</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  hero: {
    backgroundColor: '#E8694A',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xxl,
    paddingBottom: 36,
    alignItems: 'center',
  },
  heroHeart: { fontSize: 40, marginBottom: 12 },
  heroTitle: {
    fontSize: 30, fontWeight: '800', color: '#fff',
    textAlign: 'center', lineHeight: 36, marginBottom: 12,
  },
  heroSub: {
    fontSize: 15, color: 'rgba(255,255,255,0.9)',
    textAlign: 'center', lineHeight: 22,
  },
  activeBanner: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    backgroundColor: '#E8F5E9',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
  },
  activeBannerText: {
    fontSize: FontSize.sm, color: '#2E7D32', fontWeight: '600', textAlign: 'center',
  },
  cancelLink: {
    fontSize: FontSize.xs, color: Colors.textSecondary,
    marginTop: 6, textDecorationLine: 'underline',
  },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: Colors.textLight,
    letterSpacing: 1.5, textAlign: 'center',
    marginTop: 24, marginBottom: 12,
  },
  card: {
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardActive: { borderColor: '#E8694A' },
  badge: {
    position: 'absolute', top: -12, right: 16,
    paddingHorizontal: 12, paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  emojiCircle: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  tierEmoji: { fontSize: 22 },
  tierName: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  tierTagline: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  tierPrice: { fontSize: 26, fontWeight: '800' },
  tierPer: { fontSize: 11, color: Colors.textSecondary },
  impactBox: {
    borderRadius: BorderRadius.md,
    padding: Spacing.sm + 4,
    marginBottom: 14,
    alignItems: 'center',
  },
  impactText: { fontSize: FontSize.sm, fontWeight: '600', textAlign: 'center' },
  featureList: { marginBottom: 16 },
  featureRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  featureIcon: { fontSize: 16, width: 24 },
  featureText: { fontSize: FontSize.sm, color: Colors.text, flex: 1 },
  ctaBtn: {
    borderRadius: BorderRadius.lg,
    paddingVertical: 15,
    alignItems: 'center',
  },
  ctaBtnDisabled: { opacity: 0.6 },
  ctaBtnText: { color: '#fff', fontSize: FontSize.md, fontWeight: '700' },
  previewCard: {
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  previewTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.text, marginBottom: 14 },
  previewRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  previewAvatar: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  previewInitial: { color: '#fff', fontWeight: '700', fontSize: 15 },
  previewName: { fontSize: FontSize.xs, color: Colors.textSecondary },
  previewNeed: { fontSize: FontSize.sm, color: Colors.text, fontWeight: '500' },
  previewSpotted: { fontSize: 11, color: '#5CB85C', fontWeight: '600' },
  previewFootnote: {
    fontSize: 12, color: Colors.textSecondary,
    textAlign: 'center', marginTop: 8,
  },
  footer: {
    fontSize: 12, color: Colors.textLight,
    textAlign: 'center', marginBottom: 8,
  },
});
