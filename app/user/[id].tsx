import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, BorderRadius, FontSize, Spacing, Shadow } from '@/app/lib/theme';
import { useApp } from '@/app/lib/store';
import { MOCK_USERS } from '@/app/lib/data';
import { supabase } from '@/app/lib/supabase';
import ProgressBar from '@/components/ProgressBar';
import ShareSheet from '@/components/ShareSheet';
import VideoPlayer from '@/components/VideoPlayer';

interface ThankYouVideoData {
  id: string;
  need_id: string;
  video_url: string;
  thumbnail_url?: string;
  need_title: string;
  message: string;
  user_name: string;
  user_avatar: string;
  created_at: string;
  views: number;
  likes: number;
}

export default function PublicProfilePage() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { needs, currentUser, isLoggedIn } = useApp();
  const [showShare, setShowShare] = useState(false);
  const [thankYouVideos, setThankYouVideos] = useState<ThankYouVideoData[]>([]);

  const topPadding = Platform.OS === 'web' ? 0 : insets.top;

  const user = id === currentUser.id || id === 'current'
    ? currentUser
    : MOCK_USERS.find(u => u.id === id);

  // Fetch thank-you videos for this user
  useEffect(() => {
    if (id) {
      (async () => {
        try {
          const { data, error } = await supabase.functions.invoke('upload-thankyou-video', {
            body: { action: 'get_by_user', userId: id },
          });
          if (!error && data?.success && data.videos?.length > 0) {
            setThankYouVideos(data.videos);
          }
        } catch {}
      })();
    }
  }, [id]);

  // Inject OG meta tags
  useEffect(() => {
    if (Platform.OS === 'web' && user && typeof document !== 'undefined') {
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

      const baseUrl = window.location.origin;
      document.title = `${user.name} on SpotMe`;
      setMeta('og:title', `${user.name} on SpotMe`);
      setMeta('og:description', user.bio || `Check out ${user.name}'s profile. Help your neighbors with everyday needs.`);
      setMeta('og:url', `${baseUrl}/user/${id}`);
      setMeta('og:site_name', 'SpotMe');
      if (user.avatar) setMeta('og:image', user.avatar);
      setMeta('twitter:card', 'summary');
      setMeta('twitter:title', `${user.name} on SpotMe`);
    }
  }, [user, id]);

  const userNeeds = needs.filter(n => n.userId === id || (id === 'current' && n.userId === currentUser.id));
  const activeNeeds = userNeeds.filter(n => n.status === 'Collecting');
  const completedNeeds = userNeeds.filter(n => n.status !== 'Collecting');

  if (!user) {
    return (
      <View style={[styles.container, { paddingTop: topPadding }]}>
        <View style={styles.notFound}>
          <View style={styles.notFoundIcon}>
            <MaterialIcons name="person-off" size={48} color={Colors.textLight} />
          </View>
          <Text style={styles.notFoundTitle}>Profile not found</Text>
          <Text style={styles.notFoundSubtitle}>This user may not exist or the link is incorrect.</Text>
          <TouchableOpacity style={styles.notFoundBtn} onPress={() => router.replace('/(tabs)')}>

            <Text style={styles.notFoundBtnText}>Browse Needs</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
        {/* Header */}
        <View style={[styles.header, Platform.OS === 'web' ? { paddingTop: 16 } : {}]}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={22} color={Colors.textSecondary} />
          </TouchableOpacity>
          <View style={styles.headerBrand}>
            <Text style={styles.headerLogo}>SpotMe</Text>
          </View>
          <TouchableOpacity style={styles.headerBtn} onPress={() => setShowShare(true)}>
            <MaterialIcons name="share" size={22} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Profile Hero */}
        <View style={styles.profileHero}>
          <View style={styles.profileBg}>
            <View style={styles.profileBgCircle1} />
            <View style={styles.profileBgCircle2} />
          </View>
          <View style={styles.avatarWrapper}>
            <Image source={{ uri: user.avatar }} style={styles.avatar} />
            {user.verified && (
              <View style={styles.verifiedBadge}>
                <MaterialIcons name="verified" size={20} color={Colors.primary} />
              </View>
            )}
          </View>
          <Text style={styles.userName}>{user.name}</Text>
          {user.city ? (
            <View style={styles.locationRow}>
              <MaterialIcons name="place" size={14} color={Colors.textLight} />
              <Text style={styles.locationText}>{user.city}</Text>
            </View>
          ) : null}
          {user.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}
          <Text style={styles.memberSince}>
            Member since {new Date(user.joinedDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </Text>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <MaterialIcons name="trending-up" size={22} color={Colors.primary} />
            <Text style={styles.statNumber}>${user.totalRaised}</Text>
            <Text style={styles.statLabel}>Raised</Text>
          </View>
          <View style={styles.statCard}>
            <MaterialIcons name="favorite" size={22} color={Colors.secondary} />
            <Text style={styles.statNumber}>${user.totalGiven}</Text>
            <Text style={styles.statLabel}>Given</Text>
          </View>
          <View style={styles.statCard}>
            <MaterialIcons name="list-alt" size={22} color={Colors.accent} />
            <Text style={styles.statNumber}>{userNeeds.length}</Text>
            <Text style={styles.statLabel}>Needs</Text>
          </View>
        </View>

        {/* ===== THANK YOU VIDEOS ===== */}
        {thankYouVideos.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Thank You Videos</Text>
              <View style={[styles.sectionBadge, { backgroundColor: Colors.accentLight }]}>
                <Text style={[styles.sectionBadgeText, { color: '#B8941E' }]}>{thankYouVideos.length}</Text>
              </View>
            </View>
            {thankYouVideos.map(video => (
              <TouchableOpacity
                key={video.id}
                style={styles.thankYouVideoCard}
                onPress={() => router.push(`/thankyou/${video.id}`)}
                activeOpacity={0.8}
              >
                <View style={styles.thankYouVideoPreview}>
                  <VideoPlayer
                    videoUrl={video.video_url}
                    thumbnailUrl={video.thumbnail_url}
                    compact
                  />
                </View>
                <View style={styles.thankYouVideoInfo}>
                  <View style={styles.thankYouVideoLabelRow}>
                    <MaterialIcons name="videocam" size={14} color={Colors.accent} />
                    <Text style={styles.thankYouVideoLabelText}>Thank You</Text>
                  </View>
                  <Text style={styles.thankYouVideoNeedTitle} numberOfLines={1}>
                    {video.need_title}
                  </Text>
                  {video.message ? (
                    <Text style={styles.thankYouVideoMsg} numberOfLines={2}>
                      "{video.message}"
                    </Text>
                  ) : null}
                  <View style={styles.thankYouVideoStats}>
                    <MaterialIcons name="visibility" size={12} color={Colors.textLight} />
                    <Text style={styles.thankYouVideoStatText}>{video.views} views</Text>
                    <MaterialIcons name="favorite" size={12} color={Colors.textLight} />
                    <Text style={styles.thankYouVideoStatText}>{video.likes} likes</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Active Needs */}
        {activeNeeds.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Active Needs</Text>
              <View style={styles.sectionBadge}>
                <Text style={styles.sectionBadgeText}>{activeNeeds.length}</Text>
              </View>
            </View>
            {activeNeeds.map(need => {
              const progress = need.raisedAmount / need.goalAmount;
              const remaining = need.goalAmount - need.raisedAmount;
              return (
                <TouchableOpacity
                  key={need.id}
                  style={styles.needCard}
                  onPress={() => router.push(`/share/${need.id}`)}
                  activeOpacity={0.8}
                >
                  {need.photo && <Image source={{ uri: need.photo }} style={styles.needPhoto} />}
                  <View style={styles.needContent}>
                    <View style={styles.needCategoryRow}>
                      <View style={styles.needCategoryBadge}>
                        <Text style={styles.needCategoryText}>{need.category}</Text>
                      </View>
                    </View>
                    <Text style={styles.needTitle} numberOfLines={2}>{need.title}</Text>
                    <Text style={styles.needMessage} numberOfLines={2}>{need.message}</Text>
                    <View style={styles.needProgressSection}>
                      <ProgressBar progress={progress} height={8} />
                      <View style={styles.needProgressRow}>
                        <Text style={styles.needRaised}>${need.raisedAmount} raised</Text>
                        <Text style={styles.needRemaining}>${remaining} to go</Text>
                      </View>
                    </View>
                    <View style={styles.needFooter}>
                      <View style={styles.needSupporters}>
                        <MaterialIcons name="people" size={14} color={Colors.textLight} />
                        <Text style={styles.needSupportersText}>{need.contributorCount} supporters</Text>
                      </View>
                      <View style={styles.needSpotBtn}>
                        <MaterialIcons name="favorite" size={14} color={Colors.white} />
                        <Text style={styles.needSpotBtnText}>Spot</Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Completed Needs */}
        {completedNeeds.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Completed</Text>
              <View style={[styles.sectionBadge, { backgroundColor: Colors.secondaryLight }]}>
                <Text style={[styles.sectionBadgeText, { color: Colors.secondary }]}>{completedNeeds.length}</Text>
              </View>
            </View>
            {completedNeeds.map(need => (
              <TouchableOpacity
                key={need.id}
                style={styles.completedCard}
                onPress={() => router.push(`/need/${need.id}`)}
                activeOpacity={0.8}
              >
                {need.photo && <Image source={{ uri: need.photo }} style={styles.completedPhoto} />}
                <View style={styles.completedContent}>
                  <Text style={styles.completedTitle} numberOfLines={1}>{need.title}</Text>
                  <Text style={styles.completedAmount}>${need.raisedAmount} raised</Text>
                  <View style={styles.completedBadge}>
                    <MaterialIcons name="check-circle" size={12} color={Colors.success} />
                    <Text style={styles.completedBadgeText}>{need.status}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* No Needs */}
        {userNeeds.length === 0 && thankYouVideos.length === 0 && (
          <View style={styles.emptySection}>
            <MaterialIcons name="inbox" size={48} color={Colors.borderLight} />
            <Text style={styles.emptyTitle}>No needs posted yet</Text>
            <Text style={styles.emptySubtitle}>{user.name} hasn't posted any needs.</Text>
          </View>
        )}

        {/* Share CTA */}
        <View style={styles.shareCTA}>
          <Text style={styles.shareCTATitle}>Share {user.name.split(' ')[0]}'s profile</Text>
          <Text style={styles.shareCTASubtitle}>Help them reach their goals faster</Text>
          <TouchableOpacity style={styles.shareCTABtn} onPress={() => setShowShare(true)} activeOpacity={0.7}>
            <MaterialIcons name="share" size={18} color={Colors.white} />
            <Text style={styles.shareCTABtnText}>Share Profile</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerLogo}>SpotMe</Text>
          <Text style={styles.footerTagline}>No tragedy. Just life.</Text>
          <TouchableOpacity onPress={() => router.replace('/(tabs)')}>

            <Text style={styles.footerLink}>Browse all needs</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      <ShareSheet
        visible={showShare}
        onClose={() => setShowShare(false)}
        type="profile"
        userId={id}
        userName={user.name}
        userAvatar={user.avatar}
        userCity={user.city}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xxxl, gap: Spacing.md },
  notFoundIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  notFoundTitle: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.text },
  notFoundSubtitle: { fontSize: FontSize.md, color: Colors.textSecondary, textAlign: 'center' },
  notFoundBtn: { backgroundColor: Colors.primary, paddingHorizontal: Spacing.xxl, paddingVertical: Spacing.md, borderRadius: BorderRadius.full, marginTop: Spacing.sm },
  notFoundBtnText: { fontSize: FontSize.md, fontWeight: '700', color: Colors.white },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
  headerBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  headerBrand: { alignItems: 'center' },
  headerLogo: { fontSize: FontSize.lg, fontWeight: '900', color: Colors.primary, letterSpacing: -0.5 },
  profileHero: { alignItems: 'center', paddingBottom: Spacing.xl, position: 'relative' },
  profileBg: { position: 'absolute', top: 0, left: 0, right: 0, height: 120, backgroundColor: Colors.primaryLight, overflow: 'hidden' },
  profileBgCircle1: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: Colors.primary + '10', top: -80, right: -40 },
  profileBgCircle2: { position: 'absolute', width: 140, height: 140, borderRadius: 70, backgroundColor: Colors.primary + '08', bottom: -60, left: -20 },
  avatarWrapper: { position: 'relative', marginTop: 60 },
  avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 4, borderColor: Colors.background, ...Shadow.md },
  verifiedBadge: { position: 'absolute', bottom: 2, right: 2, backgroundColor: Colors.white, borderRadius: 14, padding: 2 },
  userName: { fontSize: FontSize.xxl, fontWeight: '900', color: Colors.text, marginTop: Spacing.md },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  locationText: { fontSize: FontSize.sm, color: Colors.textLight },
  bio: { fontSize: FontSize.md, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, marginTop: Spacing.sm, paddingHorizontal: Spacing.xxxl },
  memberSince: { fontSize: FontSize.xs, color: Colors.textLight, marginTop: Spacing.sm },
  statsRow: { flexDirection: 'row', paddingHorizontal: Spacing.lg, gap: Spacing.md, marginBottom: Spacing.lg },
  statCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.lg, alignItems: 'center', gap: Spacing.xs, ...Shadow.sm },
  statNumber: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.text },
  statLabel: { fontSize: FontSize.xs, color: Colors.textLight },
  section: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.xl },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.text },
  sectionBadge: { backgroundColor: Colors.primaryLight, paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.sm },
  sectionBadgeText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.primary },

  // Thank You Video Cards
  thankYouVideoCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    marginBottom: Spacing.md,
    ...Shadow.sm,
  },
  thankYouVideoPreview: {
    width: '100%',
  },
  thankYouVideoInfo: {
    padding: Spacing.lg,
    gap: Spacing.xs,
  },
  thankYouVideoLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  thankYouVideoLabelText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  thankYouVideoNeedTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
  },
  thankYouVideoMsg: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  thankYouVideoStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.xs,
  },
  thankYouVideoStatText: {
    fontSize: FontSize.xs,
    color: Colors.textLight,
    marginRight: Spacing.sm,
  },

  needCard: { backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, overflow: 'hidden', marginBottom: Spacing.md, ...Shadow.sm },
  needPhoto: { width: '100%', height: 160 },
  needContent: { padding: Spacing.lg, gap: Spacing.sm },
  needCategoryRow: { flexDirection: 'row' },
  needCategoryBadge: { backgroundColor: Colors.primaryLight, paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.sm },
  needCategoryText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.primary },
  needTitle: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.text },
  needMessage: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  needProgressSection: { gap: Spacing.xs },
  needProgressRow: { flexDirection: 'row', justifyContent: 'space-between' },
  needRaised: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.primary },
  needRemaining: { fontSize: FontSize.xs, color: Colors.textLight },
  needFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.xs },
  needSupporters: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  needSupportersText: { fontSize: FontSize.xs, color: Colors.textLight },
  needSpotBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primary, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full },
  needSpotBtnText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.white },
  completedCard: { flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, overflow: 'hidden', marginBottom: Spacing.sm, ...Shadow.sm },
  completedPhoto: { width: 70, height: 70 },
  completedContent: { flex: 1, padding: Spacing.md, justifyContent: 'center', gap: 4 },
  completedTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.text },
  completedAmount: { fontSize: FontSize.xs, color: Colors.textSecondary },
  completedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  completedBadgeText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.success },
  emptySection: { alignItems: 'center', paddingVertical: Spacing.huge, gap: Spacing.md },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textSecondary },
  emptySubtitle: { fontSize: FontSize.sm, color: Colors.textLight },
  shareCTA: { alignItems: 'center', paddingVertical: Spacing.xxl, paddingHorizontal: Spacing.xl, gap: Spacing.sm },
  shareCTATitle: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.text },
  shareCTASubtitle: { fontSize: FontSize.sm, color: Colors.textSecondary },
  shareCTABtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.primary, paddingHorizontal: Spacing.xxl, paddingVertical: Spacing.md, borderRadius: BorderRadius.full, marginTop: Spacing.sm },
  shareCTABtnText: { fontSize: FontSize.md, fontWeight: '700', color: Colors.white },
  footer: { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.xs },
  footerLogo: { fontSize: FontSize.xl, fontWeight: '900', color: Colors.primary, letterSpacing: -0.5 },
  footerTagline: { fontSize: FontSize.sm, color: Colors.textLight, fontStyle: 'italic' },
  footerLink: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.primary, marginTop: Spacing.sm },
});
