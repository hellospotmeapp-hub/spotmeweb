import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, Animated, Dimensions, ActivityIndicator, Image,
} from 'react-native';

import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, BorderRadius, FontSize, Spacing, Shadow } from '@/app/lib/theme';
import { useApp } from '@/app/lib/store';
import { supabase } from '@/app/lib/supabase';
import { Need } from '@/app/lib/data';
import ProgressBar from '@/components/ProgressBar';
import ContributeModal from '@/components/ContributeModal';
import ShareSheet from '@/components/ShareSheet';
import SignInPromptModal from '@/components/SignInPromptModal';
import LiveDonationFeed from '@/components/LiveDonationFeed';
import VideoPlayer from '@/components/VideoPlayer';
import GracefulImage from '@/components/GracefulImage';


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

export default function ShareLandingPage() {
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
  const [linkCopied, setLinkCopied] = useState(false);

  // ---- DIRECT FETCH: If need not found in local store, fetch from DB ----
  const [fetchedNeed, setFetchedNeed] = useState<Need | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [fetchAttempted, setFetchAttempted] = useState(false);

  const localNeed = needs.find(n => n.id === id);
  const need = localNeed || fetchedNeed;
  const topPadding = Platform.OS === 'web' ? 0 : insets.top;

  // Fetch need from database if not found locally
  useEffect(() => {
    if (!id || localNeed || fetchAttempted) return;

    // Don't fetch for local/mock IDs (n1, n2, mr1, etc.)
    const isLocalId = /^(n\d+|mr\d+|n_|local_)/.test(id);
    if (isLocalId) {
      setFetchAttempted(true);
      return;
    }

    setIsFetching(true);
    (async () => {
      try {
        console.log('[SharePage] Need not in local store, fetching from DB:', id);
        const { data, error } = await supabase.functions.invoke('process-contribution', {
          body: { action: 'fetch_need_by_id', needId: id },
        });
        if (!error && data?.success && data.need) {
          console.log('[SharePage] Fetched need from DB:', data.need.title);
          setFetchedNeed(data.need);
        } else {
          console.log('[SharePage] Need not found in DB:', id);
        }
      } catch (err) {
        console.error('[SharePage] Error fetching need:', err);
      } finally {
        setIsFetching(false);
        setFetchAttempted(true);
      }
    })();
  }, [id, localNeed, fetchAttempted]);

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

  // Inject OG meta tags on web (enhanced version with dynamic OG image)
  useEffect(() => {
    if (Platform.OS === 'web' && need && typeof document !== 'undefined') {
      const setMeta = (property: string, content: string) => {
        let el = document.querySelector(`meta[property="${property}"]`) ||
                 document.querySelector(`meta[name="${property}"]`);
        if (!el) {
          el = document.createElement('meta');
          if (property.startsWith('og:') || property.startsWith('twitter:') || property.startsWith('article:')) {
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
      const firstName = (need.userName || 'Someone').split(' ')[0];

      // Dynamic OG image URL — edge function with storage caching
      const dbUrl = 'https://wadkuixhehslrteepluf.databasepad.com';
      const ogImageUrl = `${dbUrl}/functions/v1/generate-og-image?needId=${need.id}`;

      // Page title
      document.title = `Help ${need.userName}: ${need.title} | SpotMe`;

      // Standard meta
      setMeta('description', `${need.message.substring(0, 150)}... $${remaining} still needed.`);
      setMeta('author', need.userName);

      // Open Graph
      setMeta('og:title', `Help ${need.userName}: ${need.title}`);
      setMeta('og:description', `$${remaining} still needed (${progress}% funded). Can you spot ${firstName}? Every dollar goes directly to them.`);
      setMeta('og:url', `${baseUrl}/share/${need.id}`);
      setMeta('og:site_name', 'SpotMe');
      setMeta('og:type', 'article');
      setMeta('og:locale', 'en_US');
      
      // Always use the dynamic OG image from the edge function (with caching)
      setMeta('og:image', ogImageUrl);
      setMeta('og:image:width', '1200');
      setMeta('og:image:height', '630');
      setMeta('og:image:type', 'image/svg+xml');
      setMeta('og:image:alt', `${need.userName} needs help: ${need.title}`);

      // Twitter Card
      setMeta('twitter:card', 'summary_large_image');
      setMeta('twitter:title', `Help ${need.userName}: ${need.title}`);
      setMeta('twitter:description', `$${remaining} still needed (${progress}% funded). Can you spot them?`);
      setMeta('twitter:image', ogImageUrl);

      // Article meta
      setMeta('article:published_time', need.createdAt);
      setMeta('article:section', need.category);
      setMeta('article:tag', 'SpotMe,MutualAid,HelpYourNeighbor');

      // Canonical URL
      let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
      if (!canonical) {
        canonical = document.createElement('link');
        canonical.rel = 'canonical';
        document.head.appendChild(canonical);
      }
      canonical.href = `${baseUrl}/share/${need.id}`;
    }
  }, [need]);


  // Fast fade-in
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1, duration: 400, useNativeDriver: true,
    }).start();
  }, []);

  // CTA pulse
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.03, duration: 1800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1800, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  // Copy share link
  const handleCopyLink = async () => {
    const baseUrl = Platform.OS === 'web' && typeof window !== 'undefined'
      ? window.location.origin
      : 'https://spotmeone.com';
    const url = `${baseUrl}/share/${id}`;
    if (Platform.OS === 'web') {
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        const ta = document.createElement('textarea');
        ta.value = url;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
    }
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2500);
  };

  // Loading state
  if ((isLoading || isFetching || (!need && !fetchAttempted)) && !need) {
    return (
      <View style={[styles.container, { paddingTop: topPadding }]}>
        <View style={styles.loadingContainer}>
          <View style={styles.loadingPulse}>
            <MaterialIcons name="favorite" size={32} color={CTA_COLOR} />
          </View>
          <Text style={styles.loadingText}>Loading...</Text>
          <Text style={styles.loadingSubtext}>Finding this need for you</Text>
        </View>
      </View>
    );
  }

  // Not found
  if (!need && fetchAttempted) {
    return (
      <View style={[styles.container, { paddingTop: topPadding }]}>
        <View style={styles.loadingContainer}>
          <View style={styles.notFoundIcon}>
            <MaterialIcons name="search-off" size={48} color={Colors.textLight} />
          </View>
          <Text style={styles.notFoundTitle}>Need not found</Text>
          <Text style={styles.notFoundSub}>This link may have expired or been removed.</Text>
          <TouchableOpacity style={styles.browseCTA} onPress={() => router.replace('/(tabs)')}>
            <Text style={styles.browseCTAText}>Browse All Needs</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.replace('/(tabs)')} style={styles.homeLink}>
            <MaterialIcons name="home" size={16} color={Colors.primary} />
            <Text style={styles.homeLinkText}>Go to SpotMe Home</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Safety net
  if (!need) {
    return (
      <View style={[styles.container, { paddingTop: topPadding }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={CTA_COLOR} />
          <Text style={styles.loadingText}>Finding this need...</Text>
        </View>
      </View>
    );
  }

  const progress = need.raisedAmount / need.goalAmount;
  const remaining = need.goalAmount - need.raisedAmount;
  const isComplete = need.status !== 'Collecting';
  const progressPct = Math.round(progress * 100);
  const firstName = (need.userName || 'Someone').split(' ')[0];
  const recentContributors = need.contributions.slice(0, 5);
  const hasMultipleContributors = need.contributorCount > 1;

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
          {/* ===== HERO SECTION ===== */}
          <View style={styles.hero}>
            <GracefulImage uri={need.photo} type="photo" style={styles.heroImage} category={need.category} />

            {/* Gradient overlays */}
            <View style={styles.heroGradientTop} />
            <View style={styles.heroGradientBottom} />

            {/* Top Navigation Bar */}
            <View style={[styles.topBar, { paddingTop: topPadding + 8 }]}>
              <TouchableOpacity style={styles.topBtn} onPress={() => router.replace('/(tabs)')}>
                <MaterialIcons name="home" size={18} color="#FFF" />
              </TouchableOpacity>
              <View style={styles.topLogoContainer}>
                <Text style={styles.topLogo}>SpotMe</Text>
              </View>
              <TouchableOpacity style={styles.topBtn} onPress={() => setShowShare(true)}>
                <MaterialIcons name="share" size={18} color="#FFF" />
              </TouchableOpacity>
            </View>

            {/* Hero Bottom - User Info */}
            <View style={styles.heroBottom}>
              <View style={styles.heroProfile}>
                <GracefulImage uri={need.userAvatar} type="avatar" style={styles.heroAvatar} />
                <View style={styles.heroUserInfo}>
                  <View style={styles.heroNameRow}>
                    <Text style={styles.heroName}>{need.userName}</Text>
                    {need.userVerified && (
                      <MaterialIcons name="verified" size={16} color="#FFF" />
                    )}
                  </View>
                  <View style={styles.heroLocationRow}>
                    <MaterialIcons name="place" size={12} color="rgba(255,255,255,0.8)" />
                    <Text style={styles.heroLocation}>{need.userCity}</Text>
                  </View>
                </View>
              </View>

              {/* Category Badge */}
              <View style={styles.heroCategoryBadge}>
                <Text style={styles.heroCategoryText}>{need.category}</Text>
              </View>
            </View>
          </View>

          {/* ===== MAIN CONTENT ===== */}
          <View style={styles.mainContent}>
            {/* Need Title */}
            <Text style={styles.needTitle}>{need.title}</Text>

            {/* PRIMARY CTA BUTTON */}
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
                <Text style={styles.completeText}>
                  {need.status === 'Goal Met' ? 'Goal reached! Thank you!' : 
                   need.status === 'Paid' ? 'Fully funded and paid out!' :
                   'Goal reached! Payout in progress.'}
                </Text>
              </View>
            )}

            {/* ===== THANK YOU VIDEO ===== */}
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
                    <GracefulImage uri={thankYouVideo.user_avatar} type="avatar" style={styles.thankYouMsgAvatar} />
                    <Text style={styles.thankYouMsgText} numberOfLines={3}>
                      "{thankYouVideo.message}"
                    </Text>
                  </View>
                ) : null}
              </View>
            )}

            {/* ===== PROGRESS SECTION ===== */}
            <View style={styles.progressCard}>
              <View style={styles.progressNumbers}>
                <View>
                  <Text style={styles.raisedAmount}>${need.raisedAmount}</Text>
                  <Text style={styles.raisedLabel}>raised</Text>
                </View>
                <View style={styles.progressDivider} />
                <View style={styles.progressCenter}>
                  <Text style={styles.progressPctLarge}>{progressPct}%</Text>
                  <Text style={styles.progressPctLabel}>funded</Text>
                </View>
                <View style={styles.progressDivider} />
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.goalAmountText}>${need.goalAmount}</Text>
                  <Text style={styles.goalLabel}>goal</Text>
                </View>
              </View>
              <ProgressBar progress={progress} height={16} showGlow color={CTA_COLOR} />
              <View style={styles.progressMeta}>
                <View style={styles.progressMetaItem}>
                  <MaterialIcons name="people" size={14} color={CTA_COLOR} />
                  <Text style={styles.progressMetaText}>{need.contributorCount} supporter{need.contributorCount !== 1 ? 's' : ''}</Text>
                </View>
                {!isComplete && remaining > 0 && (
                  <View style={styles.remainingBadge}>
                    <Text style={styles.remainingText}>${remaining} to go</Text>
                  </View>
                )}
              </View>
            </View>

            {/* ===== QUICK SPOT BUTTONS ===== */}
            {!isComplete && (
              <View style={styles.quickSpotSection}>
                <Text style={styles.quickSpotLabel}>Quick Spot</Text>
                <View style={styles.quickSpotRow}>
                  {[1, 5, 10, 25].map(amount => (
                    <TouchableOpacity key={amount} style={styles.quickSpotBtn} onPress={handleSpotMe} activeOpacity={0.7}>
                      <MaterialIcons name="favorite" size={14} color={CTA_COLOR} />
                      <Text style={styles.quickSpotText}>${amount}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* ===== STORY SECTION ===== */}
            <View style={styles.storySection}>
              <View style={styles.storyHeader}>
                <MaterialIcons name="format-quote" size={20} color={CTA_COLOR} />
                <Text style={styles.storyLabel}>Their Story</Text>
              </View>
              <Text style={styles.storyText}>{need.message}</Text>
            </View>

            {/* ===== RECENT SUPPORTERS ===== */}
            {recentContributors.length > 0 && (
              <View style={styles.supportersSection}>
                <View style={styles.supportersHeader}>
                  <MaterialIcons name="people" size={18} color={Colors.secondary} />
                  <Text style={styles.supportersTitle}>Recent Supporters</Text>
                </View>
                {recentContributors.map((contrib, idx) => (
                  <View key={contrib.id} style={[
                    styles.supporterRow,
                    idx < recentContributors.length - 1 && styles.supporterRowBorder
                  ]}>
                    <GracefulImage uri={contrib.userAvatar} type="avatar" style={styles.supporterAvatar} />
                    <View style={styles.supporterInfo}>
                      <View style={styles.supporterNameRow}>
                        <Text style={styles.supporterName}>{contrib.userName}</Text>
                        <Text style={styles.supporterAmount}>spotted ${contrib.amount}</Text>
                      </View>
                      {contrib.note && (
                        <Text style={styles.supporterNote} numberOfLines={1}>"{contrib.note}"</Text>
                      )}
                    </View>
                  </View>
                ))}
                {need.contributorCount > 5 && (
                  <TouchableOpacity
                    style={styles.viewAllSupporters}
                    onPress={() => router.push(`/need/${need.id}`)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.viewAllText}>View all {need.contributorCount} supporters</Text>
                    <MaterialIcons name="chevron-right" size={18} color={CTA_COLOR} />
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* ===== LIVE FEED ===== */}
            {need.contributions && need.contributions.length > 0 && (
              <LiveDonationFeed contributions={need.contributions} totalSupporters={need.contributorCount} />
            )}

            {/* ===== HOW SPOTME WORKS ===== */}
            <View style={styles.howItWorksSection}>
              <Text style={styles.howItWorksTitle}>How SpotMe Works</Text>
              <View style={styles.howItWorksSteps}>
                <View style={styles.howStep}>
                  <View style={[styles.howStepIcon, { backgroundColor: Colors.primaryLight }]}>
                    <MaterialIcons name="edit" size={20} color={CTA_COLOR} />
                  </View>
                  <Text style={styles.howStepNumber}>1</Text>
                  <Text style={styles.howStepTitle}>Post a Need</Text>
                  <Text style={styles.howStepDesc}>Share what you need help with ($25-$300)</Text>
                </View>
                <View style={styles.howStepConnector} />
                <View style={styles.howStep}>
                  <View style={[styles.howStepIcon, { backgroundColor: Colors.secondaryLight }]}>
                    <MaterialIcons name="favorite" size={20} color={Colors.secondary} />
                  </View>
                  <Text style={styles.howStepNumber}>2</Text>
                  <Text style={styles.howStepTitle}>Get Spotted</Text>
                  <Text style={styles.howStepDesc}>Neighbors chip in small amounts</Text>
                </View>
                <View style={styles.howStepConnector} />
                <View style={styles.howStep}>
                  <View style={[styles.howStepIcon, { backgroundColor: Colors.accentLight }]}>
                    <MaterialIcons name="account-balance-wallet" size={20} color={Colors.accent} />
                  </View>
                  <Text style={styles.howStepNumber}>3</Text>
                  <Text style={styles.howStepTitle}>Get Paid</Text>
                  <Text style={styles.howStepDesc}>100% goes to you. Zero platform fees.</Text>
                </View>
              </View>
            </View>

            {/* ===== TRUST & SAFETY ===== */}
            <View style={styles.trustSection}>
              <View style={styles.trustRow}>
                <View style={styles.trustItem}>
                  <MaterialIcons name="verified-user" size={20} color={Colors.secondary} />
                  <Text style={styles.trustItemText}>Verified Users</Text>
                </View>
                <View style={styles.trustItem}>
                  <MaterialIcons name="lock" size={20} color={Colors.secondary} />
                  <Text style={styles.trustItemText}>Secure Payments</Text>
                </View>
                <View style={styles.trustItem}>
                  <MaterialIcons name="money-off" size={20} color={Colors.secondary} />
                  <Text style={styles.trustItemText}>0% Platform Fee</Text>
                </View>
              </View>
              <Text style={styles.trustNote}>
                Protected by SpotMe. 100% of every dollar goes directly to {firstName}. Payments processed securely by Stripe.
              </Text>
            </View>

            {/* ===== SHARE THIS NEED ===== */}
            <View style={styles.shareSection}>
              <Text style={styles.shareSectionTitle}>Help spread the word</Text>
              <Text style={styles.shareSectionSub}>
                Even if you can't contribute, sharing helps {firstName} reach more people.
              </Text>
              <View style={styles.shareActions}>
                <TouchableOpacity style={styles.shareActionBtn} onPress={handleCopyLink} activeOpacity={0.7}>
                  <MaterialIcons name={linkCopied ? 'check' : 'link'} size={18} color={linkCopied ? Colors.success : CTA_COLOR} />
                  <Text style={[styles.shareActionText, linkCopied && { color: Colors.success }]}>
                    {linkCopied ? 'Link Copied!' : 'Copy Link'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.shareActionBtn} onPress={() => setShowShare(true)} activeOpacity={0.7}>
                  <MaterialIcons name="share" size={18} color={CTA_COLOR} />
                  <Text style={styles.shareActionText}>Share</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.shareActionBtn} onPress={() => {
                  const baseUrl = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : 'https://spotmeone.com';
                  const text = `${need.userName} needs help: "${need.title}". $${remaining} still needed. Can you spot them?\n${baseUrl}/share/${need.id}`;
                  if (Platform.OS === 'web') {
                    window.open(`sms:?body=${encodeURIComponent(text)}`, '_self');
                  }
                }} activeOpacity={0.7}>
                  <MaterialIcons name="sms" size={18} color={CTA_COLOR} />
                  <Text style={styles.shareActionText}>Text</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.shareActionBtn} onPress={() => {
                  const baseUrl = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : 'https://spotmeone.com';
                  const subject = `Help ${need.userName}: ${need.title} on SpotMe`;
                  const body = `Hey!\n\n${need.userName} needs help with "${need.title}" on SpotMe.\n\n$${remaining} is still needed (${progressPct}% funded so far).\n\nEvery dollar goes directly to them — no platform fees.\n\nCheck it out: ${baseUrl}/share/${need.id}`;
                  if (Platform.OS === 'web') {
                    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_self');
                  }
                }} activeOpacity={0.7}>
                  <MaterialIcons name="email" size={18} color={CTA_COLOR} />
                  <Text style={styles.shareActionText}>Email</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* ===== FOOTER ===== */}
            <View style={styles.footer}>
              <Text style={styles.footerLogo}>SpotMe</Text>
              <Text style={styles.footerTagline}>No tragedy. Just life.</Text>
              <Text style={styles.footerDescription}>
                Help your neighbors with everyday needs. Small acts, big impact.
              </Text>
              <View style={styles.footerLinks}>
                <TouchableOpacity onPress={() => router.replace('/(tabs)')}>
                  <Text style={styles.footerLink}>Browse Needs</Text>
                </TouchableOpacity>
                <Text style={styles.footerDot}>·</Text>
                <TouchableOpacity onPress={() => router.push('/about')}>
                  <Text style={styles.footerLink}>About</Text>
                </TouchableOpacity>
                <Text style={styles.footerDot}>·</Text>
                <TouchableOpacity onPress={() => router.push('/guidelines')}>
                  <Text style={styles.footerLink}>Guidelines</Text>
                </TouchableOpacity>
                <Text style={styles.footerDot}>·</Text>
                <TouchableOpacity onPress={() => router.push('/terms')}>
                  <Text style={styles.footerLink}>Terms</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.footerCopy}>Made with care in the USA</Text>
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
          <TouchableOpacity style={styles.fixedShareBtn} onPress={() => setShowShare(true)} activeOpacity={0.7}>
            <MaterialIcons name="share" size={20} color={CTA_COLOR} />
          </TouchableOpacity>
        </View>
      )}
      {isComplete && (
        <View style={[styles.fixedCTA, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.fixedCompleteBanner}>
            <MaterialIcons name="check-circle" size={20} color={Colors.success} />
            <Text style={styles.fixedCompleteText}>Goal reached! Thank you!</Text>
          </View>
          <TouchableOpacity style={styles.fixedShareBtn} onPress={() => setShowShare(true)} activeOpacity={0.7}>
            <MaterialIcons name="share" size={20} color={CTA_COLOR} />
          </TouchableOpacity>
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

  // Loading
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, paddingHorizontal: Spacing.xxl },
  loadingPulse: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: FontSize.lg, color: Colors.text, fontWeight: '700' },
  loadingSubtext: { fontSize: FontSize.sm, color: Colors.textLight },

  // Not Found
  notFoundIcon: { width: 96, height: 96, borderRadius: 48, backgroundColor: Colors.surfaceAlt, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md },
  notFoundTitle: { fontSize: FontSize.xxl, fontWeight: '900', color: Colors.text },
  notFoundSub: { fontSize: FontSize.md, color: Colors.textSecondary, textAlign: 'center' },
  browseCTA: { backgroundColor: CTA_COLOR, paddingHorizontal: Spacing.xxl, paddingVertical: Spacing.lg, borderRadius: BorderRadius.full, marginTop: Spacing.lg, ...Shadow.md },
  browseCTAText: { fontSize: FontSize.md, fontWeight: '700', color: '#FFF' },
  homeLink: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.md },
  homeLinkText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.primary },

  // Hero
  hero: { position: 'relative', height: 320 },
  heroImage: { width: '100%', height: '100%' },
  heroGradientTop: { position: 'absolute', top: 0, left: 0, right: 0, height: 100, backgroundColor: 'rgba(0,0,0,0.3)' },
  heroGradientBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 180, backgroundColor: 'rgba(0,0,0,0.4)' },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, zIndex: 10 },
  topBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
  topLogoContainer: { alignItems: 'center' },
  topLogo: { fontSize: FontSize.lg, fontWeight: '900', color: '#FFF', letterSpacing: -0.5 },
  heroBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: Spacing.xl, paddingBottom: Spacing.lg, paddingTop: Spacing.xxl, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  heroProfile: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flex: 1 },
  heroAvatar: { width: 52, height: 52, borderRadius: 26, borderWidth: 2.5, borderColor: '#FFF' },
  heroUserInfo: { flex: 1 },
  heroNameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  heroName: { fontSize: FontSize.lg, fontWeight: '800', color: '#FFF' },
  heroLocationRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 },
  heroLocation: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.85)', fontWeight: '500' },
  heroCategoryBadge: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: BorderRadius.full, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  heroCategoryText: { fontSize: FontSize.xs, fontWeight: '700', color: '#FFF' },

  // Main Content
  mainContent: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.xl, gap: Spacing.lg },
  needTitle: { fontSize: 24, fontWeight: '900', color: Colors.text, lineHeight: 30 },

  // Primary CTA
  primaryCTA: { backgroundColor: CTA_COLOR, borderRadius: BorderRadius.xl, overflow: 'hidden', ...Shadow.lg },
  ctaInner: { flexDirection: 'row', alignItems: 'center', padding: Spacing.lg, gap: Spacing.md },
  ctaIconWrap: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  ctaTextWrap: { flex: 1 },
  ctaMainText: { fontSize: FontSize.xl, fontWeight: '900', color: '#FFF' },
  ctaSubText: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.85)', fontWeight: '600', marginTop: 2 },
  completeBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: '#E8F5E8', paddingVertical: Spacing.lg, borderRadius: BorderRadius.xl, ...Shadow.sm },
  completeText: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.success },

  // Thank You Video
  thankYouVideoSection: { backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, overflow: 'hidden', ...Shadow.md },
  thankYouVideoHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.lg, paddingBottom: Spacing.sm },
  thankYouVideoLabel: { flex: 1, fontSize: FontSize.md, fontWeight: '800', color: Colors.text },
  thankYouVideoLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  thankYouVideoLinkText: { fontSize: FontSize.sm, fontWeight: '600', color: CTA_COLOR },
  thankYouMsgRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, padding: Spacing.lg, paddingTop: Spacing.sm },
  thankYouMsgAvatar: { width: 28, height: 28, borderRadius: 14 },
  thankYouMsgText: { flex: 1, fontSize: FontSize.sm, color: Colors.textSecondary, fontStyle: 'italic', lineHeight: 20 },

  // Progress Card
  progressCard: { backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.xl, gap: Spacing.md, ...Shadow.md },
  progressNumbers: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  raisedAmount: { fontSize: FontSize.xxl, fontWeight: '900', color: Colors.text },
  raisedLabel: { fontSize: FontSize.xs, color: Colors.textLight, fontWeight: '600' },
  progressDivider: { width: 1, height: 32, backgroundColor: Colors.borderLight },
  progressCenter: { alignItems: 'center' },
  progressPctLarge: { fontSize: FontSize.xxl, fontWeight: '900', color: CTA_COLOR },
  progressPctLabel: { fontSize: FontSize.xs, color: Colors.textLight, fontWeight: '600' },
  goalAmountText: { fontSize: FontSize.xxl, fontWeight: '900', color: Colors.text },
  goalLabel: { fontSize: FontSize.xs, color: Colors.textLight, fontWeight: '600' },
  progressMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  progressMetaText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '600' },
  remainingBadge: { backgroundColor: Colors.primaryLight, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: BorderRadius.full },
  remainingText: { fontSize: FontSize.sm, fontWeight: '800', color: CTA_COLOR },

  // Quick Spot
  quickSpotSection: { gap: Spacing.sm },
  quickSpotLabel: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  quickSpotRow: { flexDirection: 'row', gap: Spacing.sm },
  quickSpotBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 14, borderRadius: BorderRadius.lg, backgroundColor: Colors.primaryLight, borderWidth: 1.5, borderColor: CTA_COLOR + '25', minHeight: 48 },
  quickSpotText: { fontSize: FontSize.lg, fontWeight: '800', color: CTA_COLOR },

  // Story
  storySection: { backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.xl, gap: Spacing.md, borderLeftWidth: 4, borderLeftColor: CTA_COLOR, ...Shadow.sm },
  storyHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  storyLabel: { fontSize: FontSize.sm, fontWeight: '700', color: CTA_COLOR, textTransform: 'uppercase', letterSpacing: 0.5 },
  storyText: { fontSize: FontSize.md, color: Colors.textSecondary, lineHeight: 24 },

  // Supporters
  supportersSection: { backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.xl, gap: Spacing.md, ...Shadow.sm },
  supportersHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  supportersTitle: { fontSize: FontSize.md, fontWeight: '800', color: Colors.text },
  supporterRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm },
  supporterRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  supporterAvatar: { width: 36, height: 36, borderRadius: 18 },
  supporterInfo: { flex: 1 },
  supporterNameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  supporterName: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.text },
  supporterAmount: { fontSize: FontSize.sm, fontWeight: '600', color: CTA_COLOR },
  supporterNote: { fontSize: FontSize.xs, color: Colors.textSecondary, fontStyle: 'italic', marginTop: 2 },
  viewAllSupporters: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, paddingTop: Spacing.md },
  viewAllText: { fontSize: FontSize.sm, fontWeight: '600', color: CTA_COLOR },

  // How It Works
  howItWorksSection: { backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.xl, gap: Spacing.lg, ...Shadow.sm },
  howItWorksTitle: { fontSize: FontSize.lg, fontWeight: '900', color: Colors.text, textAlign: 'center' },
  howItWorksSteps: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  howStep: { flex: 1, alignItems: 'center', gap: Spacing.xs },
  howStepIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  howStepNumber: { fontSize: FontSize.xs, fontWeight: '900', color: Colors.textLight },
  howStepTitle: { fontSize: FontSize.sm, fontWeight: '800', color: Colors.text, textAlign: 'center' },
  howStepDesc: { fontSize: FontSize.xs, color: Colors.textSecondary, textAlign: 'center', lineHeight: 16 },
  howStepConnector: { width: 20, height: 1, backgroundColor: Colors.borderLight, marginTop: 24 },

  // Trust
  trustSection: { backgroundColor: Colors.secondaryLight, borderRadius: BorderRadius.xl, padding: Spacing.xl, gap: Spacing.md },
  trustRow: { flexDirection: 'row', justifyContent: 'space-around' },
  trustItem: { alignItems: 'center', gap: Spacing.xs },
  trustItemText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.secondaryDark },
  trustNote: { fontSize: FontSize.xs, color: Colors.textSecondary, textAlign: 'center', lineHeight: 18 },

  // Share Section
  shareSection: { backgroundColor: Colors.primaryLight, borderRadius: BorderRadius.xl, padding: Spacing.xl, gap: Spacing.md, borderWidth: 1, borderColor: CTA_COLOR + '20' },
  shareSectionTitle: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.text, textAlign: 'center' },
  shareSectionSub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  shareActions: { flexDirection: 'row', justifyContent: 'space-around', marginTop: Spacing.sm },
  shareActionBtn: { alignItems: 'center', gap: Spacing.xs },
  shareActionText: { fontSize: FontSize.xs, fontWeight: '700', color: CTA_COLOR },

  // Footer
  footer: { alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.xs, marginTop: Spacing.md },
  footerLogo: { fontSize: FontSize.xl, fontWeight: '900', color: CTA_COLOR, letterSpacing: -0.5 },
  footerTagline: { fontSize: FontSize.sm, color: Colors.textLight, fontStyle: 'italic' },
  footerDescription: { fontSize: FontSize.xs, color: Colors.textLight, textAlign: 'center', marginTop: Spacing.sm, lineHeight: 18, paddingHorizontal: Spacing.xl },
  footerLinks: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.md, flexWrap: 'wrap', justifyContent: 'center' },
  footerLink: { fontSize: FontSize.sm, fontWeight: '600', color: CTA_COLOR },
  footerDot: { color: Colors.textLight },
  footerCopy: { fontSize: FontSize.xs, color: Colors.textLight, marginTop: Spacing.md },

  // Fixed CTA
  fixedCTA: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(250,250,248,0.97)', paddingHorizontal: Spacing.xl, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.borderLight, flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  fixedCTABtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: CTA_COLOR, paddingVertical: 16, borderRadius: BorderRadius.xl, minHeight: 56, ...Shadow.md },
  fixedCTAText: { fontSize: 17, fontWeight: '800', color: '#FFF' },
  fixedShareBtn: { width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: CTA_COLOR + '30' },
  fixedCompleteBanner: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: '#E8F5E8', paddingVertical: 16, borderRadius: BorderRadius.xl, minHeight: 56 },
  fixedCompleteText: { fontSize: FontSize.md, fontWeight: '700', color: Colors.success },
});
