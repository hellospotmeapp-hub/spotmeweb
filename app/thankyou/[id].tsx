import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, Platform, Animated, ActivityIndicator, Dimensions, Share,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, BorderRadius, FontSize, Spacing, Shadow } from '@/app/lib/theme';
import { useApp } from '@/app/lib/store';
import { supabase } from '@/app/lib/supabase';
import VideoPlayer from '@/components/VideoPlayer';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CTA_COLOR = Colors.primary;

interface ThankYouVideo {
  id: string;
  need_id: string;
  user_id: string;
  user_name: string;
  user_avatar: string;
  need_title: string;
  video_url: string;
  thumbnail_url?: string;
  duration_seconds: number;
  message: string;
  views: number;
  shares: number;
  likes: number;
  created_at: string;
}

export default function ThankYouVideoPage() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { needs } = useApp();

  const [video, setVideo] = useState<ThankYouVideo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [shareCount, setShareCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));

  const topPadding = Platform.OS === 'web' ? 0 : insets.top;

  // Fetch video data
  useEffect(() => {
    fetchVideo();
  }, [id]);

  // Fade in
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, []);

  // Inject OG meta tags
  useEffect(() => {
    if (Platform.OS === 'web' && video && typeof document !== 'undefined') {
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
      document.title = `${video.user_name}'s Thank You | SpotMe`;
      setMeta('description', video.message?.substring(0, 160) || `Watch ${video.user_name}'s thank you video`);
      setMeta('og:title', `${video.user_name}'s Thank You - ${video.need_title}`);
      setMeta('og:description', video.message || `Watch this heartfelt thank you from ${video.user_name}`);
      setMeta('og:url', `${baseUrl}/thankyou/${video.id}`);
      setMeta('og:site_name', 'SpotMe');
      setMeta('og:type', 'video.other');
      if (video.video_url) {
        setMeta('og:video', video.video_url);
        setMeta('og:video:secure_url', video.video_url);
        setMeta('og:video:type', 'video/mp4');
        setMeta('og:video:width', '720');
        setMeta('og:video:height', '1280');
      }
      if (video.thumbnail_url || video.user_avatar) {
        setMeta('og:image', video.thumbnail_url || video.user_avatar);
      }
      setMeta('twitter:card', 'player');
      setMeta('twitter:title', `${video.user_name}'s Thank You | SpotMe`);
      setMeta('twitter:description', video.message?.substring(0, 200) || '');
    }
  }, [video]);

  const fetchVideo = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('upload-thankyou-video', {
        body: { action: 'get_by_id', videoId: id },
      });
      if (!error && data?.success && data.video) {
        setVideo(data.video);
        setLikeCount(data.video.likes || 0);
        setShareCount(data.video.shares || 0);
      }
    } catch (err) {
      console.log('[SpotMe] Failed to fetch thank-you video:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLike = async () => {
    if (liked) return;
    setLiked(true);
    setLikeCount(prev => prev + 1);
    try {
      await supabase.functions.invoke('upload-thankyou-video', {
        body: { action: 'track_like', videoId: id },
      });
    } catch {}
  };

  const handleShare = async (platform?: string) => {
    setShareCount(prev => prev + 1);
    try {
      await supabase.functions.invoke('upload-thankyou-video', {
        body: { action: 'track_share', videoId: id },
      });
    } catch {}

    const shareUrl = Platform.OS === 'web'
      ? `${window.location.origin}/thankyou/${id}`
      : `https://spotmeone.com/thankyou/${id}`;
    const shareText = video
      ? `${video.user_name}'s heartfelt thank you for "${video.need_title}" on SpotMe`
      : 'Watch this thank you video on SpotMe';

    if (platform === 'tiktok') {
      if (Platform.OS === 'web') {
        window.open(`https://www.tiktok.com/upload?url=${encodeURIComponent(shareUrl)}`, '_blank');
      }
    } else if (platform === 'instagram') {
      if (Platform.OS === 'web') {
        window.open(`https://www.instagram.com/`, '_blank');
      }
    } else if (platform === 'twitter') {
      if (Platform.OS === 'web') {
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`, '_blank');
      }
    } else if (platform === 'copy') {
      if (Platform.OS === 'web') {
        try {
          await navigator.clipboard.writeText(shareUrl);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {}
      }
    } else {
      try {
        await Share.share({ message: `${shareText}\n${shareUrl}`, url: shareUrl });
      } catch {}
    }
  };

  const need = video ? needs.find(n => n.id === video.need_id) : null;

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  // Loading
  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: topPadding }]}>
        <View style={styles.loadingContainer}>
          <View style={styles.loadingPulse}>
            <MaterialIcons name="videocam" size={32} color={CTA_COLOR} />
          </View>
          <Text style={styles.loadingText}>Loading thank you...</Text>
        </View>
      </View>
    );
  }

  // Not found
  if (!video) {
    return (
      <View style={[styles.container, { paddingTop: topPadding }]}>
        <View style={styles.loadingContainer}>
          <MaterialIcons name="videocam-off" size={48} color={Colors.textLight} />
          <Text style={styles.notFoundTitle}>Video not found</Text>
          <Text style={styles.notFoundSub}>This thank you video may have been removed.</Text>
          <TouchableOpacity style={styles.browseCTA} onPress={() => router.replace('/(tabs)')}>

            <Text style={styles.browseCTAText}>Browse Needs</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
        <Animated.View style={{ opacity: fadeAnim }}>
          {/* Top Bar */}
          <View style={[styles.topBar, { paddingTop: topPadding + 8 }]}>
            <TouchableOpacity style={styles.topBtn} onPress={() => router.back()}>
              <MaterialIcons name="arrow-back" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
            <Text style={styles.topLogo}>SpotMe</Text>
            <TouchableOpacity style={styles.topBtn} onPress={() => handleShare()}>
              <MaterialIcons name="share" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Video Player */}
          <View style={styles.videoSection}>
            <VideoPlayer
              videoUrl={video.video_url}
              thumbnailUrl={video.thumbnail_url}
              autoPlay={false}
            />
          </View>

          {/* Content */}
          <View style={styles.content}>
            {/* Profile Row */}
            <TouchableOpacity
              style={styles.profileRow}
              onPress={() => router.push(`/user/${video.user_id}`)}
              activeOpacity={0.7}
            >
              <Image source={{ uri: video.user_avatar }} style={styles.avatar} />
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>{video.user_name}</Text>
                <Text style={styles.profileDate}>{formatDate(video.created_at)}</Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={Colors.textLight} />
            </TouchableOpacity>

            {/* Thank You Label */}
            <View style={styles.thankYouLabel}>
              <MaterialIcons name="auto-awesome" size={18} color={Colors.accent} />
              <Text style={styles.thankYouLabelText}>Thank You Video</Text>
            </View>

            {/* Need Title */}
            <TouchableOpacity
              style={styles.needLink}
              onPress={() => need ? router.push(`/share/${video.need_id}`) : null}
              activeOpacity={0.7}
            >
              <Text style={styles.needLinkLabel}>For:</Text>
              <Text style={styles.needLinkTitle}>{video.need_title}</Text>
              <MaterialIcons name="open-in-new" size={14} color={CTA_COLOR} />
            </TouchableOpacity>

            {/* Message */}
            {video.message ? (
              <View style={styles.messageCard}>
                <MaterialIcons name="format-quote" size={18} color={CTA_COLOR} />
                <Text style={styles.messageText}>{video.message}</Text>
              </View>
            ) : null}

            {/* Stats Row */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <MaterialIcons name="visibility" size={16} color={Colors.textLight} />
                <Text style={styles.statText}>{video.views + 1} views</Text>
              </View>
              <View style={styles.statItem}>
                <MaterialIcons name="favorite" size={16} color={liked ? CTA_COLOR : Colors.textLight} />
                <Text style={[styles.statText, liked && { color: CTA_COLOR }]}>{likeCount} likes</Text>
              </View>
              <View style={styles.statItem}>
                <MaterialIcons name="share" size={16} color={Colors.textLight} />
                <Text style={styles.statText}>{shareCount} shares</Text>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionBtn, liked && styles.actionBtnActive]}
                onPress={handleLike}
                activeOpacity={0.7}
              >
                <MaterialIcons
                  name={liked ? 'favorite' : 'favorite-border'}
                  size={22}
                  color={liked ? '#FFF' : CTA_COLOR}
                />
                <Text style={[styles.actionBtnText, liked && styles.actionBtnTextActive]}>
                  {liked ? 'Liked' : 'Like'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => handleShare()}
                activeOpacity={0.7}
              >
                <MaterialIcons name="share" size={22} color={CTA_COLOR} />
                <Text style={styles.actionBtnText}>Share</Text>
              </TouchableOpacity>
            </View>

            {/* Share to Social */}
            <View style={styles.socialSection}>
              <Text style={styles.socialTitle}>Share this thank you</Text>
              <Text style={styles.socialSubtitle}>
                Help spread the love and inspire others
              </Text>
              <View style={styles.socialRow}>
                <TouchableOpacity
                  style={[styles.socialBtn, { backgroundColor: '#000' }]}
                  onPress={() => handleShare('tiktok')}
                >
                  <MaterialIcons name="music-note" size={20} color="#FFF" />
                  <Text style={styles.socialBtnText}>TikTok</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.socialBtn, { backgroundColor: '#E1306C' }]}
                  onPress={() => handleShare('instagram')}
                >
                  <MaterialIcons name="camera-alt" size={20} color="#FFF" />
                  <Text style={styles.socialBtnText}>Instagram</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.socialBtn, { backgroundColor: '#1DA1F2' }]}
                  onPress={() => handleShare('twitter')}
                >
                  <MaterialIcons name="alternate-email" size={20} color="#FFF" />
                  <Text style={styles.socialBtnText}>X</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.copyLinkBtn}
                onPress={() => handleShare('copy')}
                activeOpacity={0.7}
              >
                <MaterialIcons
                  name={copied ? 'check' : 'link'}
                  size={18}
                  color={copied ? Colors.success : CTA_COLOR}
                />
                <Text style={[styles.copyLinkText, copied && { color: Colors.success }]}>
                  {copied ? 'Link copied!' : 'Copy link'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* View Need CTA */}
            {need && need.status === 'Collecting' && (
              <TouchableOpacity
                style={styles.viewNeedCTA}
                onPress={() => router.push(`/share/${video.need_id}`)}
                activeOpacity={0.85}
              >
                <MaterialIcons name="favorite" size={22} color="#FFF" />
                <Text style={styles.viewNeedCTAText}>
                  Spot {(video.user_name || 'Them').split(' ')[0]} — ${need.goalAmount - need.raisedAmount} needed

                </Text>
              </TouchableOpacity>
            )}

            {/* Trust */}
            <View style={styles.trustRow}>
              <MaterialIcons name="verified-user" size={14} color={Colors.secondary} />
              <Text style={styles.trustText}>
                Real people, real stories. SpotMe helps neighbors with everyday needs.
              </Text>
            </View>

            {/* Footer */}
            <View style={styles.footer}>
              <Text style={styles.footerLogo}>SpotMe</Text>
              <Text style={styles.footerTagline}>No tragedy. Just life.</Text>
              <TouchableOpacity onPress={() => router.replace('/(tabs)')}>

                <Text style={styles.footerLink}>Browse all needs</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ height: 40 }} />
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  loadingPulse: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: FontSize.md,
    color: Colors.textLight,
    fontWeight: '600',
  },
  notFoundTitle: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.text,
  },
  notFoundSub: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  browseCTA: {
    backgroundColor: CTA_COLOR,
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.md,
  },
  browseCTAText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: '#FFF',
  },

  // Top Bar
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  topBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topLogo: {
    fontSize: FontSize.lg,
    fontWeight: '900',
    color: CTA_COLOR,
    letterSpacing: -0.5,
  },

  // Video
  videoSection: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },

  // Content
  content: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.lg,
  },

  // Profile
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: CTA_COLOR + '30',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: Colors.text,
  },
  profileDate: {
    fontSize: FontSize.xs,
    color: Colors.textLight,
    marginTop: 1,
  },

  // Thank You Label
  thankYouLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    alignSelf: 'flex-start',
    backgroundColor: Colors.accentLight,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  thankYouLabelText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: '#B8941E',
  },

  // Need Link
  needLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primaryLight,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  needLinkLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  needLinkTitle: {
    flex: 1,
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
  },

  // Message
  messageCard: {
    flexDirection: 'row',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    borderLeftWidth: 4,
    borderLeftColor: CTA_COLOR,
    ...Shadow.sm,
  },
  messageText: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    lineHeight: 24,
    fontStyle: 'italic',
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: Spacing.sm,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: '600',
  },

  // Actions
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: 14,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.primaryLight,
    borderWidth: 1.5,
    borderColor: CTA_COLOR + '25',
    minHeight: 48,
  },
  actionBtnActive: {
    backgroundColor: CTA_COLOR,
    borderColor: CTA_COLOR,
  },
  actionBtnText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: CTA_COLOR,
  },
  actionBtnTextActive: {
    color: '#FFF',
  },

  // Social
  socialSection: {
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
  },
  socialTitle: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: Colors.text,
  },
  socialSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  socialRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    width: '100%',
  },
  socialBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: 14,
    borderRadius: BorderRadius.xl,
    minHeight: 48,
  },
  socialBtnText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: '#FFF',
  },
  copyLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    borderColor: CTA_COLOR + '30',
    backgroundColor: Colors.primaryLight,
    width: '100%',
    minHeight: 48,
  },
  copyLinkText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: CTA_COLOR,
  },

  // View Need CTA
  viewNeedCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: CTA_COLOR,
    paddingVertical: 16,
    borderRadius: BorderRadius.xl,
    minHeight: 56,
    ...Shadow.md,
  },
  viewNeedCTAText: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: '#FFF',
  },

  // Trust
  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.secondaryLight,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  trustText: {
    flex: 1,
    fontSize: FontSize.xs,
    color: Colors.secondaryDark,
    lineHeight: 16,
    fontWeight: '500',
  },

  // Footer
  footer: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: 4,
  },
  footerLogo: {
    fontSize: FontSize.lg,
    fontWeight: '900',
    color: CTA_COLOR,
    letterSpacing: -0.5,
  },
  footerTagline: {
    fontSize: FontSize.sm,
    color: Colors.textLight,
    fontStyle: 'italic',
  },
  footerLink: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: CTA_COLOR,
    marginTop: Spacing.sm,
  },
});
