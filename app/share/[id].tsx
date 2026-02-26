import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, Platform, Animated, Dimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, BorderRadius, FontSize, Spacing, Shadow } from '@/app/lib/theme';
import { useApp } from '@/app/lib/store';
import { supabase } from '@/app/lib/supabase';
import ProgressBar from '@/components/ProgressBar';
import ContributeModal from '@/components/ContributeModal';
import ShareSheet from '@/components/ShareSheet';
import SignInPromptModal from '@/components/SignInPromptModal';
import LiveDonationFeed from '@/components/LiveDonationFeed';
import VideoPlayer from '@/components/VideoPlayer';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CTA_COLOR = Colors.primary;

interface ThankYouVideoData {
  id: string;
  video_url: string;
  thumbnail_url?: string;
  message: string;
  user_name: string;
  user_avatar: string;
  created_at: string;
  views: number;
  likes: number;
}

export default function TikTokLandingPage() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { needs, currentUser, contribute, isLoggedIn, isLoading } = useApp();
  const scrollRef = useRef<ScrollView>(null);

  const [showContribute, setShowContribute] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showSignInPrompt, setShowSignInPrompt] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [pulseAnim] = useState(new Animated.Value(1));
  const [thankYouVideo, setThankYouVideo] = useState<ThankYouVideoData | null>(null);

  const need = needs.find(n => n.id === id);
  const topPadding = Platform.OS === 'web' ? 0 : insets.top;

  // Fetch thank-you video for this need
  useEffect(() => {
    if (id) {
      (async () => {
        try {
          const { data, error } = await supabase.functions.invoke('upload-thankyou-video', {
            body: { action: 'get_by_need', needId: id },
          });
          if (!error && data?.success && data.video) {
            setThankYouVideo(data.video);
          }
        } catch {}
      })();
    }
  }, [id]);

  // Inject OG meta tags on web
  useEffect(() => {
    if (Platform.OS === 'web' && need && typeof document !== 'undefined') {
      const setMeta = (property: string, content: string) => {
        let el = document.querySelector(`meta[property="${property}"]`) ||
                 document.querySelector(`meta[name="${property}"]`);
        if (!el) {
          el = document.createElement('meta');
          if (property.startsWith('og:') || property.startsWith('twitter:')) {
            el.setAttribute('property', property);
          } else {
            el.setAttribute('name', property);
          }
          document.head.appendChild(el);
        }
        el.setAttribute('content', content);
      };

      const remaining = need.goalAmount - need.raisedAmount;
      const progress = Math.round((need.raisedAmount / need.goalAmount) * 100);
      const baseUrl = window.location.origin;

      document.title = `Help ${need.userName}: ${need.title} | SpotMe`;
      setMeta('description', `${need.message.substring(0, 150)}... $${remaining} still needed.`);
      setMeta('og:title', `Help ${need.userName}: ${need.title}`);
      setMeta('og:description', `$${remaining} still needed (${progress}% funded). Can you spot them?`);
      setMeta('og:url', `${baseUrl}/share/${need.id}`);
      setMeta('og:site_name', 'SpotMe');
      setMeta('og:type', 'website');
      if (need.photo) setMeta('og:image', need.photo);
      if (need.userAvatar) setMeta('og:image', need.userAvatar);
      setMeta('twitter:card', 'summary_large_image');
      setMeta('twitter:title', `Help ${need.userName}: ${need.title}`);
      setMeta('twitter:description', `$${remaining} still needed. Can you spot them?`);
    }
  }, [need]);

  // Fast fade-in
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1, duration: 300, useNativeDriver: true,
    }).start();
  }, []);

  // CTA pulse
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.02, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  // Loading state
  if (isLoading && !need) {
    return (
      <View style={[styles.container, { paddingTop: topPadding }]}>
        <View style={styles.loadingContainer}>
          <View style={styles.loadingPulse}>
            <MaterialIcons name="favorite" size={32} color={CTA_COLOR} />
          </View>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  if (!need) {
    return (
      <View style={[styles.container, { paddingTop: topPadding }]}>
        <View style={styles.loadingContainer}>
          <MaterialIcons name="search-off" size={48} color={Colors.textLight} />
          <Text style={styles.notFoundTitle}>Need not found</Text>
          <Text style={styles.notFoundSub}>This link may have expired.</Text>
          <TouchableOpacity style={styles.browseCTA} onPress={() => router.push('/(tabs)')}>
            <Text style={styles.browseCTAText}>Browse All Needs</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const progress = need.raisedAmount / need.goalAmount;
  const remaining = need.goalAmount - need.raisedAmount;
  const isComplete = need.status !== 'Collecting';
  const progressPct = Math.round(progress * 100);
  const firstName = (need.userName || 'Someone').split(' ')[0];


  const handleContribute = (amount: number, note?: string) => {
    contribute(need.id, amount, note);
  };

  const handleSpotMe = () => {
    if (!isLoggedIn) {
      setShowSignInPrompt(true);
      return;
    }
    setShowContribute(true);
  };

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        bounces={false}
        contentContainerStyle={styles.scrollContent}
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          {/* ===== HERO ===== */}
          <View style={styles.hero}>
            {need.photo ? (
              <Image source={{ uri: need.photo }} style={styles.heroImage} resizeMode="cover" />
            ) : (
              <View style={[styles.heroImage, styles.heroPlaceholder]}>
                <MaterialIcons name="favorite" size={56} color={CTA_COLOR + '40'} />
              </View>
            )}
            <View style={styles.heroGradient} />
            <View style={[styles.topBar, { paddingTop: topPadding + 8 }]}>
              <TouchableOpacity style={styles.topBtn} onPress={() => router.push('/(tabs)')}>
                <MaterialIcons name="home" size={18} color="#FFF" />
              </TouchableOpacity>
              <Text style={styles.topLogo}>SpotMe</Text>
              <TouchableOpacity style={styles.topBtn} onPress={() => setShowShare(true)}>
                <MaterialIcons name="share" size={18} color="#FFF" />
              </TouchableOpacity>
            </View>
            <View style={styles.heroBottom}>
              <View style={styles.heroProfile}>
                <Image source={{ uri: need.userAvatar }} style={styles.heroAvatar} />
                <View>
                  <Text style={styles.heroName}>{need.userName}</Text>
                  <View style={styles.heroLocationRow}>
                    <MaterialIcons name="place" size={12} color="rgba(255,255,255,0.7)" />
                    <Text style={styles.heroLocation}>{need.userCity}</Text>
                  </View>
                </View>
                {need.userVerified && (
                  <MaterialIcons name="verified" size={18} color="#FFF" />
                )}
              </View>
            </View>
          </View>

          {/* ===== MAIN CONTENT ===== */}
          <View style={styles.mainContent}>
            <Text style={styles.needTitle}>{need.title}</Text>

            {/* PRIMARY CTA */}
            {!isComplete && (
              <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                <TouchableOpacity style={styles.primaryCTA} onPress={handleSpotMe} activeOpacity={0.85}>
                  <View style={styles.ctaInner}>
                    <View style={styles.ctaIconWrap}>
                      <MaterialIcons name="favorite" size={28} color="#FFF" />
                    </View>
                    <View style={styles.ctaTextWrap}>
                      <Text style={styles.ctaMainText}>Spot {firstName}</Text>
                      <Text style={styles.ctaSubText}>${remaining} still needed</Text>
                    </View>
                    <MaterialIcons name="arrow-forward" size={24} color="#FFF" />
                  </View>
                </TouchableOpacity>
              </Animated.View>
            )}

            {isComplete && (
              <View style={styles.completeBadge}>
                <MaterialIcons name="check-circle" size={24} color={Colors.success} />
                <Text style={styles.completeText}>Goal reached! Thank you!</Text>
              </View>
            )}

            {/* ===== THANK YOU VIDEO (if exists) ===== */}
            {thankYouVideo && (
              <View style={styles.thankYouVideoSection}>
                <View style={styles.thankYouVideoHeader}>
                  <MaterialIcons name="videocam" size={18} color={Colors.accent} />
                  <Text style={styles.thankYouVideoLabel}>Thank You Video</Text>
                  <TouchableOpacity
                    onPress={() => router.push(`/thankyou/${thankYouVideo.id}`)}
                    style={styles.thankYouVideoLink}
                  >
                    <Text style={styles.thankYouVideoLinkText}>View full</Text>
                    <MaterialIcons name="open-in-new" size={12} color={CTA_COLOR} />
                  </TouchableOpacity>
                </View>
                <VideoPlayer
                  videoUrl={thankYouVideo.video_url}
                  thumbnailUrl={thankYouVideo.thumbnail_url}
                  compact
                />
                {thankYouVideo.message ? (
                  <View style={styles.thankYouMsgRow}>
                    <Image source={{ uri: thankYouVideo.user_avatar }} style={styles.thankYouMsgAvatar} />
                    <Text style={styles.thankYouMsgText} numberOfLines={3}>
                      "{thankYouVideo.message}"
                    </Text>
                  </View>
                ) : null}
              </View>
            )}

            {/* PROGRESS BAR */}
            <View style={styles.progressSection}>
              <View style={styles.progressNumbers}>
                <Text style={styles.raisedAmount}>${need.raisedAmount}</Text>
                <Text style={styles.goalAmount}>of ${need.goalAmount}</Text>
              </View>
              <ProgressBar progress={progress} height={14} showGlow color={CTA_COLOR} />
              <View style={styles.progressMeta}>
                <View style={styles.progressMetaItem}>
                  <MaterialIcons name="people" size={14} color={CTA_COLOR} />
                  <Text style={styles.progressMetaText}>{need.contributorCount} supporters</Text>
                </View>
                <View style={styles.progressPctBadge}>
                  <Text style={styles.progressPctText}>{progressPct}%</Text>
                </View>
              </View>
            </View>

            {/* QUICK SPOT */}
            {!isComplete && (
              <View style={styles.quickSpotRow}>
                {[1, 5, 10, 25].map(amount => (
                  <TouchableOpacity key={amount} style={styles.quickSpotBtn} onPress={handleSpotMe} activeOpacity={0.7}>
                    <Text style={styles.quickSpotText}>${amount}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* STORY */}
            <View style={styles.storySection}>
              <View style={styles.storyHeader}>
                <MaterialIcons name="format-quote" size={18} color={CTA_COLOR} />
                <Text style={styles.storyLabel}>Their story</Text>
              </View>
              <Text style={styles.storyText}>{need.message}</Text>
            </View>

            {/* LIVE FEED */}
            {need.contributions && need.contributions.length > 0 && (
              <LiveDonationFeed contributions={need.contributions} totalSupporters={need.contributorCount} />
            )}

            {/* TRUST */}
            <View style={styles.trustRow}>
              <MaterialIcons name="verified-user" size={16} color={Colors.secondary} />
              <Text style={styles.trustText}>Protected by SpotMe. 5% fee. Funds go directly to {firstName}.</Text>
            </View>

            {/* SHARE */}
            <TouchableOpacity style={styles.shareCTA} onPress={() => setShowShare(true)} activeOpacity={0.7}>
              <MaterialIcons name="share" size={18} color={CTA_COLOR} />
              <Text style={styles.shareCTAText}>Share this need</Text>
            </TouchableOpacity>

            {/* FOOTER */}
            <View style={styles.footer}>
              <Text style={styles.footerLogo}>SpotMe</Text>
              <Text style={styles.footerTagline}>No tragedy. Just life.</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)')}>
                <Text style={styles.footerLink}>Browse all needs</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={{ height: 100 }} />
        </Animated.View>
      </ScrollView>

      {/* FIXED BOTTOM CTA */}
      {!isComplete && (
        <View style={[styles.fixedCTA, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <TouchableOpacity style={styles.fixedCTABtn} onPress={handleSpotMe} activeOpacity={0.85}>
            <MaterialIcons name="favorite" size={22} color="#FFF" />
            <Text style={styles.fixedCTAText}>Spot {firstName} — ${remaining} needed</Text>
          </TouchableOpacity>
        </View>
      )}
      {isComplete && (
        <View style={[styles.fixedCTA, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.fixedCompleteBanner}>
            <MaterialIcons name="check-circle" size={20} color={Colors.success} />
            <Text style={styles.fixedCompleteText}>Goal reached! Thank you!</Text>
          </View>
        </View>
      )}

      {/* MODALS */}
      <ContributeModal
        visible={showContribute}
        onClose={() => setShowContribute(false)}
        onContribute={handleContribute}
        needTitle={need.title}
        needId={need.id}
        remaining={remaining}
        contributorName={currentUser.name}
      />
      <ShareSheet
        visible={showShare}
        onClose={() => setShowShare(false)}
        needId={need.id}
        needTitle={need.title}
        needMessage={need.message}
        needPhoto={need.photo}
        needRaised={need.raisedAmount}
        needGoal={need.goalAmount}
        userName={need.userName}
        userAvatar={need.userAvatar}
        userCity={need.userCity}
        category={need.category}
        contributorCount={need.contributorCount}
      />
      <SignInPromptModal
        visible={showSignInPrompt}
        onClose={() => setShowSignInPrompt(false)}
        userName={need.userName}
        userAvatar={need.userAvatar}
        needTitle={need.title}
        remaining={remaining}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { flexGrow: 1 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, paddingHorizontal: Spacing.xxl },
  loadingPulse: { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: FontSize.md, color: Colors.textLight, fontWeight: '600' },
  notFoundTitle: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.text },
  notFoundSub: { fontSize: FontSize.md, color: Colors.textSecondary, textAlign: 'center' },
  browseCTA: { backgroundColor: CTA_COLOR, paddingHorizontal: Spacing.xxl, paddingVertical: Spacing.md, borderRadius: BorderRadius.full, marginTop: Spacing.md },
  browseCTAText: { fontSize: FontSize.md, fontWeight: '700', color: '#FFF' },
  hero: { position: 'relative', height: 280 },
  heroImage: { width: '100%', height: '100%' },
  heroPlaceholder: { backgroundColor: Colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  heroGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 160, backgroundColor: 'transparent' },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
  topBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
  topLogo: { fontSize: FontSize.lg, fontWeight: '900', color: '#FFF', letterSpacing: -0.5 },
  heroBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: Spacing.xl, paddingBottom: Spacing.lg, backgroundColor: 'rgba(0,0,0,0.25)', paddingTop: Spacing.xxl },
  heroProfile: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  heroAvatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: '#FFF' },
  heroName: { fontSize: FontSize.lg, fontWeight: '800', color: '#FFF' },
  heroLocationRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 1 },
  heroLocation: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.8)', fontWeight: '500' },
  mainContent: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.xl, gap: Spacing.lg },
  needTitle: { fontSize: 22, fontWeight: '900', color: Colors.text, lineHeight: 28 },
  primaryCTA: { backgroundColor: CTA_COLOR, borderRadius: BorderRadius.xl, overflow: 'hidden', ...Shadow.lg },
  ctaInner: { flexDirection: 'row', alignItems: 'center', padding: Spacing.lg, gap: Spacing.md },
  ctaIconWrap: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  ctaTextWrap: { flex: 1 },
  ctaMainText: { fontSize: FontSize.xl, fontWeight: '900', color: '#FFF' },
  ctaSubText: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.85)', fontWeight: '600', marginTop: 1 },
  completeBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: '#E8F5E8', paddingVertical: Spacing.lg, borderRadius: BorderRadius.xl },
  completeText: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.success },

  // Thank You Video Section
  thankYouVideoSection: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    ...Shadow.md,
  },
  thankYouVideoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  thankYouVideoLabel: {
    flex: 1,
    fontSize: FontSize.md,
    fontWeight: '800',
    color: Colors.text,
  },
  thankYouVideoLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  thankYouVideoLinkText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: CTA_COLOR,
  },
  thankYouMsgRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    padding: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  thankYouMsgAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  thankYouMsgText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    lineHeight: 20,
  },

  progressSection: { gap: Spacing.sm },
  progressNumbers: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm },
  raisedAmount: { fontSize: FontSize.xxl, fontWeight: '900', color: Colors.text },
  goalAmount: { fontSize: FontSize.md, color: Colors.textLight, fontWeight: '600' },
  progressMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  progressMetaText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '600' },
  progressPctBadge: { backgroundColor: Colors.primaryLight, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: BorderRadius.full },
  progressPctText: { fontSize: FontSize.sm, fontWeight: '800', color: CTA_COLOR },
  quickSpotRow: { flexDirection: 'row', gap: Spacing.sm },
  quickSpotBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: BorderRadius.lg, backgroundColor: Colors.primaryLight, borderWidth: 1.5, borderColor: CTA_COLOR + '25', minHeight: 48 },
  quickSpotText: { fontSize: FontSize.lg, fontWeight: '800', color: CTA_COLOR },
  storySection: { backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.xl, gap: Spacing.sm, borderLeftWidth: 4, borderLeftColor: CTA_COLOR, ...Shadow.sm },
  storyHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  storyLabel: { fontSize: FontSize.sm, fontWeight: '700', color: CTA_COLOR, textTransform: 'uppercase', letterSpacing: 0.5 },
  storyText: { fontSize: FontSize.md, color: Colors.textSecondary, lineHeight: 24 },
  trustRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.secondaryLight, padding: Spacing.md, borderRadius: BorderRadius.lg },
  trustText: { flex: 1, fontSize: FontSize.xs, color: Colors.secondaryDark, lineHeight: 16, fontWeight: '500' },
  shareCTA: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: Spacing.md, borderRadius: BorderRadius.full, borderWidth: 1.5, borderColor: CTA_COLOR + '30', backgroundColor: Colors.primaryLight, minHeight: 48 },
  shareCTAText: { fontSize: FontSize.md, fontWeight: '700', color: CTA_COLOR },
  footer: { alignItems: 'center', paddingVertical: Spacing.xl, gap: 4 },
  footerLogo: { fontSize: FontSize.lg, fontWeight: '900', color: CTA_COLOR, letterSpacing: -0.5 },
  footerTagline: { fontSize: FontSize.sm, color: Colors.textLight, fontStyle: 'italic' },
  footerLink: { fontSize: FontSize.sm, fontWeight: '600', color: CTA_COLOR, marginTop: Spacing.sm },
  fixedCTA: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(250,250,248,0.97)', paddingHorizontal: Spacing.xl, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.borderLight },
  fixedCTABtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: CTA_COLOR, paddingVertical: 16, borderRadius: BorderRadius.xl, minHeight: 56, ...Shadow.md },
  fixedCTAText: { fontSize: 17, fontWeight: '800', color: '#FFF' },
  fixedCompleteBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: '#E8F5E8', paddingVertical: 16, borderRadius: BorderRadius.xl, minHeight: 56 },
  fixedCompleteText: { fontSize: FontSize.md, fontWeight: '700', color: Colors.success },
});
