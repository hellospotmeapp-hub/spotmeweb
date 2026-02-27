import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Platform, Share, Image, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, BorderRadius, FontSize, Spacing, Shadow } from '@/app/lib/theme';
import QRCode from './QRCode';

interface ShareSheetProps {
  visible: boolean;
  onClose: () => void;
  needId?: string;
  needTitle?: string;
  needMessage?: string;
  needPhoto?: string;
  needRaised?: number;
  needGoal?: number;
  userName?: string;
  userAvatar?: string;
  userCity?: string;
  category?: string;
  contributorCount?: number;
  type?: 'need' | 'profile';
  userId?: string;
}

export default function ShareSheet({
  visible, onClose,
  needId, needTitle, needMessage, needPhoto,
  needRaised, needGoal,
  userName, userAvatar, userCity, category,
  contributorCount,
  type = 'need',
  userId,
}: ShareSheetProps) {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'link' | 'qr'>('link');

  const getBaseUrl = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return window.location.origin;
    }
    return 'https://spotmeone.com';
  };


  const getShareUrl = useCallback(() => {
    const base = getBaseUrl();
    if (type === 'profile' && userId) return `${base}/user/${userId}`;
    if (needId) return `${base}/share/${needId}`;
    return base;
  }, [type, userId, needId]);

  const getShareText = useCallback(() => {
    if (type === 'profile' && userName) {
      return `Check out ${userName}'s profile on SpotMe! Help your neighbors with everyday needs. No tragedy, just life.`;
    }
    if (needTitle && userName) {
      const progress = (needRaised != null && needGoal) ? ` (${Math.round((needRaised / needGoal) * 100)}% funded)` : '';
      return `${userName} needs help: "${needTitle}"${progress}. Can you spot them? No tragedy, just life.`;
    }
    return 'SpotMe - Help your neighbors with everyday needs. No tragedy, just life.';
  }, [type, userName, needTitle, needRaised, needGoal]);

  const getTikTokCaption = useCallback(() => {
    if (needTitle && userName) {
      const remaining = (needGoal != null && needRaised != null) ? needGoal - needRaised : (needGoal || 0);
      return `${userName} needs $${remaining} for "${needTitle}" 💛 Can you help? Link in bio! #SpotMe #MutualAid #HelpYourNeighbor #CommunityLove #NoTragedyJustLife`;
    }
    return 'Help your neighbors with everyday needs on SpotMe 💛 #SpotMe #MutualAid #HelpYourNeighbor #CommunityLove';
  }, [needTitle, userName, needGoal, needRaised]);


  const handleShare = async (platform: string) => {
    const url = getShareUrl();
    const text = getShareText();

    switch (platform) {
      case 'copy':
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
          setCopied(true);
          setTimeout(() => setCopied(false), 2500);
        }
        break;

      case 'copy-caption':
        if (Platform.OS === 'web') {
          const caption = getTikTokCaption();
          try {
            await navigator.clipboard.writeText(caption);
          } catch {
            const ta = document.createElement('textarea');
            ta.value = caption;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
          }
          setCopied(true);
          setTimeout(() => setCopied(false), 2500);
        }
        break;

      case 'tiktok':
        if (Platform.OS === 'web') {
          window.open('https://www.tiktok.com/upload', '_blank');
        }
        break;

      case 'instagram':
        if (Platform.OS === 'web') {
          window.open('https://www.instagram.com/', '_blank');
        }
        break;

      case 'twitter':
        if (Platform.OS === 'web') {
          window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
        }
        break;

      case 'facebook':
        if (Platform.OS === 'web') {
          window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
        }
        break;

      case 'whatsapp':
        if (Platform.OS === 'web') {
          window.open(`https://wa.me/?text=${encodeURIComponent(text + '\n' + url)}`, '_blank');
        }
        break;

      case 'native':
        try {
          if (Platform.OS === 'web' && navigator.share) {
            await navigator.share({ title: needTitle || 'SpotMe', text, url });
          } else {
            await Share.share({ message: `${text}\n${url}` });
          }
        } catch {}
        break;
    }
  };

  const progress = (needGoal != null && needGoal > 0 && needRaised != null) ? Math.round((needRaised / needGoal) * 100) : 0;
  const remaining = (needGoal != null && needRaised != null) ? Math.max(0, needGoal - needRaised) : (needGoal || 0);


  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <ScrollView showsVerticalScrollIndicator={false} bounces={false}>

            {/* Header */}
            <View style={styles.header}>
              <View>
                <Text style={styles.headerTitle}>Share {type === 'profile' ? 'Profile' : 'Need'}</Text>
                <Text style={styles.headerSubtitle}>Help spread the word</Text>
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                <MaterialIcons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Preview Card */}
            {needTitle && (
              <View style={styles.previewCard}>
                <View style={styles.previewHeader}>
                  {userAvatar ? (
                    <Image source={{ uri: userAvatar }} style={styles.previewAvatar} />
                  ) : (
                    <View style={[styles.previewAvatar, styles.previewAvatarPlaceholder]}>
                      <MaterialIcons name="person" size={20} color={Colors.textLight} />
                    </View>
                  )}
                  <View style={styles.previewUserInfo}>
                    <Text style={styles.previewUserName} numberOfLines={1}>{userName}</Text>
                    {userCity && <Text style={styles.previewUserCity}>{userCity}</Text>}
                  </View>
                  {category && (
                    <View style={styles.previewBadge}>
                      <Text style={styles.previewBadgeText}>{category}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.previewTitle} numberOfLines={2}>{needTitle}</Text>
                {needMessage && <Text style={styles.previewMessage} numberOfLines={2}>{needMessage}</Text>}
                {needGoal && needRaised !== undefined && (
                  <View style={styles.previewProgress}>
                    <View style={styles.previewTrack}>
                      <View style={[styles.previewFill, { width: `${Math.min(progress, 100)}%` }]} />
                    </View>
                    <View style={styles.previewProgressRow}>
                      <Text style={styles.previewRaised}>${needRaised} raised</Text>
                      <Text style={styles.previewGoal}>of ${needGoal}</Text>
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* Tab Toggle: Link vs QR */}
            <View style={styles.tabRow}>
              <TouchableOpacity
                style={[styles.tabBtn, activeTab === 'link' && styles.tabBtnActive]}
                onPress={() => setActiveTab('link')}
              >
                <MaterialIcons name="link" size={18} color={activeTab === 'link' ? Colors.white : Colors.textSecondary} />
                <Text style={[styles.tabBtnText, activeTab === 'link' && styles.tabBtnTextActive]}>Share Link</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabBtn, activeTab === 'qr' && styles.tabBtnActive]}
                onPress={() => setActiveTab('qr')}
              >
                <MaterialIcons name="qr-code-2" size={18} color={activeTab === 'qr' ? Colors.white : Colors.textSecondary} />
                <Text style={[styles.tabBtnText, activeTab === 'qr' && styles.tabBtnTextActive]}>QR Code</Text>
              </TouchableOpacity>
            </View>

            {activeTab === 'link' ? (
              <>
                {/* Share URL */}
                <View style={styles.urlBox}>
                  <MaterialIcons name="link" size={18} color={Colors.primary} />
                  <Text style={styles.urlText} numberOfLines={1}>{getShareUrl()}</Text>
                  <TouchableOpacity style={styles.copyBtn} onPress={() => handleShare('copy')}>
                    <MaterialIcons name={copied ? 'check' : 'content-copy'} size={16} color={copied ? Colors.success : Colors.primary} />
                    <Text style={[styles.copyBtnText, copied && { color: Colors.success }]}>
                      {copied ? 'Copied!' : 'Copy'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Social Share Grid */}
                <Text style={styles.sectionLabel}>Share to</Text>
                <View style={styles.socialGrid}>
                  <TouchableOpacity style={styles.socialBtn} onPress={() => handleShare('tiktok')} activeOpacity={0.7}>
                    <View style={[styles.socialIcon, { backgroundColor: '#000' }]}>
                      <MaterialIcons name="music-note" size={22} color="#FFF" />
                    </View>
                    <Text style={styles.socialLabel}>TikTok</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.socialBtn} onPress={() => handleShare('instagram')} activeOpacity={0.7}>
                    <View style={[styles.socialIcon, { backgroundColor: '#E1306C' }]}>
                      <MaterialIcons name="camera-alt" size={22} color="#FFF" />
                    </View>
                    <Text style={styles.socialLabel}>Instagram</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.socialBtn} onPress={() => handleShare('twitter')} activeOpacity={0.7}>
                    <View style={[styles.socialIcon, { backgroundColor: '#1DA1F2' }]}>
                      <MaterialIcons name="tag" size={22} color="#FFF" />
                    </View>
                    <Text style={styles.socialLabel}>X</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.socialBtn} onPress={() => handleShare('facebook')} activeOpacity={0.7}>
                    <View style={[styles.socialIcon, { backgroundColor: '#1877F2' }]}>
                      <MaterialIcons name="thumb-up" size={22} color="#FFF" />
                    </View>
                    <Text style={styles.socialLabel}>Facebook</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.socialBtn} onPress={() => handleShare('whatsapp')} activeOpacity={0.7}>
                    <View style={[styles.socialIcon, { backgroundColor: '#25D366' }]}>
                      <MaterialIcons name="chat" size={22} color="#FFF" />
                    </View>
                    <Text style={styles.socialLabel}>WhatsApp</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.socialBtn} onPress={() => handleShare('native')} activeOpacity={0.7}>
                    <View style={[styles.socialIcon, { backgroundColor: Colors.primary }]}>
                      <MaterialIcons name="share" size={22} color="#FFF" />
                    </View>
                    <Text style={styles.socialLabel}>More</Text>
                  </TouchableOpacity>
                </View>

                {/* TikTok Caption Helper */}
                <View style={styles.captionBox}>
                  <View style={styles.captionHeader}>
                    <MaterialIcons name="auto-awesome" size={18} color={Colors.accent} />
                    <Text style={styles.captionTitle}>TikTok Caption (ready to paste)</Text>
                  </View>
                  <Text style={styles.captionText}>{getTikTokCaption()}</Text>
                  <TouchableOpacity style={styles.captionCopyBtn} onPress={() => handleShare('copy-caption')} activeOpacity={0.7}>
                    <MaterialIcons name="content-copy" size={16} color={Colors.primary} />
                    <Text style={styles.captionCopyText}>Copy Caption</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              /* QR Code Tab */
              <View style={styles.qrSection}>
                <View style={styles.qrCard}>
                  <View style={styles.qrBranding}>
                    <Text style={styles.qrLogo}>SpotMe</Text>
                    <Text style={styles.qrTagline}>No tragedy. Just life.</Text>
                  </View>

                  {userAvatar && (
                    <Image source={{ uri: userAvatar }} style={styles.qrAvatar} />
                  )}

                  {needTitle && (
                    <Text style={styles.qrNeedTitle} numberOfLines={2}>"{needTitle}"</Text>
                  )}

                  <QRCode
                    value={getShareUrl()}
                    size={180}
                    label="Scan to help"
                  />

                  {userName && (
                    <Text style={styles.qrUserName}>Help {userName}</Text>
                  )}

                  {remaining > 0 && (
                    <View style={styles.qrAmountBadge}>
                      <Text style={styles.qrAmountText}>${remaining} needed</Text>
                    </View>
                  )}
                </View>

                <Text style={styles.qrHint}>
                  Screenshot this QR code and add it to your TikTok video, bio link, or story!
                </Text>

                <TouchableOpacity style={styles.qrCopyBtn} onPress={() => handleShare('copy')} activeOpacity={0.7}>
                  <MaterialIcons name="link" size={18} color={Colors.white} />
                  <Text style={styles.qrCopyBtnText}>Copy Link Instead</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Hashtag Tips */}
            <View style={styles.hashtagBox}>
              <MaterialIcons name="trending-up" size={16} color={Colors.secondary} />
              <Text style={styles.hashtagText}>
                Top hashtags: #SpotMe #MutualAid #HelpYourNeighbor #CommunityLove #NoTragedyJustLife #PayItForward #SmallActs
              </Text>
            </View>

            <View style={{ height: 20 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { flex: 1, backgroundColor: Colors.overlay },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xxl,
    borderTopRightRadius: BorderRadius.xxl,
    paddingHorizontal: Spacing.xxl,
    paddingBottom: 30,
    maxHeight: '90%',
  },
  handle: { width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginTop: Spacing.md, marginBottom: Spacing.md },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.lg },
  headerTitle: { fontSize: FontSize.xl, fontWeight: '900', color: Colors.text },
  headerSubtitle: { fontSize: FontSize.sm, color: Colors.textLight, marginTop: 2 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },

  // Preview Card
  previewCard: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  previewHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  previewAvatar: { width: 36, height: 36, borderRadius: 18 },
  previewAvatarPlaceholder: { backgroundColor: Colors.borderLight, alignItems: 'center', justifyContent: 'center' },
  previewUserInfo: { flex: 1 },
  previewUserName: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.text },
  previewUserCity: { fontSize: FontSize.xs, color: Colors.textLight },
  previewBadge: { backgroundColor: Colors.primaryLight, paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.sm },
  previewBadgeText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.primary },
  previewTitle: { fontSize: FontSize.md, fontWeight: '800', color: Colors.text },
  previewMessage: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  previewProgress: { gap: Spacing.xs, marginTop: Spacing.xs },
  previewTrack: { height: 6, backgroundColor: Colors.borderLight, borderRadius: 3, overflow: 'hidden' },
  previewFill: { height: '100%' as any, backgroundColor: Colors.primary, borderRadius: 3 },
  previewProgressRow: { flexDirection: 'row', justifyContent: 'space-between' },
  previewRaised: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.primary },
  previewGoal: { fontSize: FontSize.xs, color: Colors.textLight },

  // Tabs
  tabRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, paddingVertical: Spacing.md, borderRadius: BorderRadius.lg, backgroundColor: Colors.surfaceAlt },
  tabBtnActive: { backgroundColor: Colors.primary },
  tabBtnText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textSecondary },
  tabBtnTextActive: { color: Colors.white },

  // URL Box
  urlBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  urlText: { flex: 1, fontSize: FontSize.sm, color: Colors.text, fontWeight: '500' },
  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primaryLight, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: BorderRadius.sm },
  copyBtnText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.primary },

  // Social Grid
  sectionLabel: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textLight, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.md },
  socialGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.lg, justifyContent: 'center', marginBottom: Spacing.xl },
  socialBtn: { alignItems: 'center', gap: Spacing.xs, width: 70 },
  socialIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', ...Shadow.sm },
  socialLabel: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textSecondary },

  // Caption Box
  captionBox: {
    backgroundColor: Colors.accentLight,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.accent + '30',
  },
  captionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  captionTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.text },
  captionText: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  captionCopyBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, alignSelf: 'flex-start', backgroundColor: Colors.white, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.sm, marginTop: Spacing.xs },
  captionCopyText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.primary },

  // QR Section
  qrSection: { alignItems: 'center', gap: Spacing.lg, marginBottom: Spacing.lg },
  qrCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xxl,
    alignItems: 'center',
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadow.md,
    width: '100%',
  },
  qrBranding: { alignItems: 'center', marginBottom: Spacing.xs },
  qrLogo: { fontSize: FontSize.xl, fontWeight: '900', color: Colors.primary, letterSpacing: -0.5 },
  qrTagline: { fontSize: FontSize.xs, color: Colors.textLight, fontStyle: 'italic' },
  qrAvatar: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: Colors.primary },
  qrNeedTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text, textAlign: 'center', maxWidth: 240 },
  qrUserName: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary },
  qrAmountBadge: { backgroundColor: Colors.primaryLight, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full },
  qrAmountText: { fontSize: FontSize.sm, fontWeight: '800', color: Colors.primary },
  qrHint: { fontSize: FontSize.sm, color: Colors.textLight, textAlign: 'center', lineHeight: 20, paddingHorizontal: Spacing.lg },
  qrCopyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: Colors.primary, paddingVertical: Spacing.md, paddingHorizontal: Spacing.xxl, borderRadius: BorderRadius.full },
  qrCopyBtnText: { fontSize: FontSize.md, fontWeight: '700', color: Colors.white },

  // Hashtags
  hashtagBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: Colors.secondaryLight,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  hashtagText: { flex: 1, fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 18 },
});
