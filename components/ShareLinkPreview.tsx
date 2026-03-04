import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Share, Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, BorderRadius, FontSize, Spacing, Shadow } from '@/app/lib/theme';

interface ShareLinkPreviewProps {
  needId: string;
  needTitle: string;
  needMessage?: string;
  needPhoto?: string;
  needRaised: number;
  needGoal: number;
  userName: string;
  userAvatar?: string;
  userCity?: string;
  category?: string;
  contributorCount?: number;
  compact?: boolean;
  onSharePress?: () => void;
}

export default function ShareLinkPreview({
  needId, needTitle, needMessage, needPhoto,
  needRaised, needGoal, userName, userAvatar,
  userCity, category, contributorCount,
  compact, onSharePress,
}: ShareLinkPreviewProps) {
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const getBaseUrl = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return window.location.origin;
    }
    return 'https://spotmeone.com';
  };

  const shareUrl = `${getBaseUrl()}/share/${needId}`;
  const progress = needGoal > 0 ? Math.round((needRaised / needGoal) * 100) : 0;
  const remaining = Math.max(0, needGoal - needRaised);

  const getShareText = useCallback(() => {
    const pctText = progress > 0 ? ` (${progress}% funded)` : '';
    return `${userName} needs help: "${needTitle}"${pctText}. $${remaining} still needed. Can you spot them?\n\n${shareUrl}`;
  }, [userName, needTitle, progress, remaining, shareUrl]);

  const handleCopyLink = async () => {
    if (Platform.OS === 'web') {
      try {
        await navigator.clipboard.writeText(shareUrl);
      } catch {
        const ta = document.createElement('textarea');
        ta.value = shareUrl;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleNativeShare = async () => {
    const text = getShareText();
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title: `Help ${userName} on SpotMe`, text, url: shareUrl });
      } else {
        await Share.share({ message: text });
      }
    } catch {}
  };

  const handleSMS = () => {
    const text = getShareText();
    const smsUrl = Platform.OS === 'web'
      ? `sms:?body=${encodeURIComponent(text)}`
      : `sms:&body=${encodeURIComponent(text)}`;
    if (Platform.OS === 'web') {
      window.open(smsUrl, '_self');
    }
  };

  const handleEmail = () => {
    const subject = `Help ${userName}: ${needTitle} on SpotMe`;
    const body = `Hey!\n\n${userName} needs help with "${needTitle}" on SpotMe.\n\n$${remaining} is still needed (${progress}% funded so far).\n\nEvery dollar goes directly to them — no platform fees.\n\nCheck it out: ${shareUrl}\n\n— Sent via SpotMe`;
    const mailUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    if (Platform.OS === 'web') {
      window.open(mailUrl, '_self');
    }
  };

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <TouchableOpacity style={styles.compactCopyBtn} onPress={handleCopyLink} activeOpacity={0.7}>
          <MaterialIcons name={copied ? 'check' : 'link'} size={16} color={copied ? Colors.success : Colors.primary} />
          <Text style={[styles.compactCopyText, copied && { color: Colors.success }]}>
            {copied ? 'Link Copied!' : 'Copy Share Link'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.compactShareBtn} onPress={onSharePress || handleNativeShare} activeOpacity={0.7}>
          <MaterialIcons name="share" size={16} color={Colors.white} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Link URL Bar */}
      <View style={styles.urlBar}>
        <MaterialIcons name="link" size={16} color={Colors.primary} />
        <Text style={styles.urlText} numberOfLines={1}>{shareUrl}</Text>
        <TouchableOpacity style={styles.copyBtn} onPress={handleCopyLink} activeOpacity={0.7}>
          <MaterialIcons name={copied ? 'check' : 'content-copy'} size={14} color={copied ? Colors.success : Colors.primary} />
          <Text style={[styles.copyBtnText, copied && { color: Colors.success }]}>
            {copied ? 'Copied!' : 'Copy'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Social Preview Toggle */}
      <TouchableOpacity
        style={styles.previewToggle}
        onPress={() => setShowPreview(!showPreview)}
        activeOpacity={0.7}
      >
        <MaterialIcons name="visibility" size={16} color={Colors.textSecondary} />
        <Text style={styles.previewToggleText}>
          {showPreview ? 'Hide social preview' : 'Preview how it looks on social media'}
        </Text>
        <MaterialIcons name={showPreview ? 'expand-less' : 'expand-more'} size={18} color={Colors.textSecondary} />
      </TouchableOpacity>

      {/* Social Media Preview Card */}
      {showPreview && (
        <View style={styles.socialPreview}>
          <Text style={styles.socialPreviewLabel}>Social Media Preview</Text>
          <View style={styles.ogCard}>
            {needPhoto && (
              <Image source={{ uri: needPhoto }} style={styles.ogImage} />
            )}
            <View style={styles.ogContent}>
              <Text style={styles.ogSiteName}>spotmeone.com</Text>
              <Text style={styles.ogTitle} numberOfLines={2}>Help {userName}: {needTitle}</Text>
              <Text style={styles.ogDescription} numberOfLines={2}>
                ${remaining} still needed ({progress}% funded). Can you spot them?
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Quick Share Actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity style={styles.quickAction} onPress={handleSMS} activeOpacity={0.7}>
          <View style={[styles.quickActionIcon, { backgroundColor: '#34C759' }]}>
            <MaterialIcons name="sms" size={18} color="#FFF" />
          </View>
          <Text style={styles.quickActionLabel}>Text</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.quickAction} onPress={handleEmail} activeOpacity={0.7}>
          <View style={[styles.quickActionIcon, { backgroundColor: '#5856D6' }]}>
            <MaterialIcons name="email" size={18} color="#FFF" />
          </View>
          <Text style={styles.quickActionLabel}>Email</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.quickAction} onPress={() => {
          if (Platform.OS === 'web') {
            window.open(`https://wa.me/?text=${encodeURIComponent(getShareText())}`, '_blank');
          }
        }} activeOpacity={0.7}>
          <View style={[styles.quickActionIcon, { backgroundColor: '#25D366' }]}>
            <MaterialIcons name="chat" size={18} color="#FFF" />
          </View>
          <Text style={styles.quickActionLabel}>WhatsApp</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.quickAction} onPress={onSharePress || handleNativeShare} activeOpacity={0.7}>
          <View style={[styles.quickActionIcon, { backgroundColor: Colors.primary }]}>
            <MaterialIcons name="share" size={18} color="#FFF" />
          </View>
          <Text style={styles.quickActionLabel}>More</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.md,
  },
  urlBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  urlText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.text,
    fontWeight: '500',
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  copyBtnText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.primary,
  },
  previewToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.xs,
  },
  previewToggleText: {
    flex: 1,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  socialPreview: {
    gap: Spacing.sm,
  },
  socialPreviewLabel: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  ogCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadow.sm,
  },
  ogImage: {
    width: '100%',
    height: 140,
  },
  ogContent: {
    padding: Spacing.md,
    gap: 4,
  },
  ogSiteName: {
    fontSize: FontSize.xs,
    color: Colors.textLight,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  ogTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
    lineHeight: 20,
  },
  ogDescription: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  quickAction: {
    alignItems: 'center',
    gap: Spacing.xs,
  },
  quickActionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
  },
  quickActionLabel: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  // Compact styles
  compactContainer: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  compactCopyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: Colors.primary + '25',
  },
  compactCopyText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.primary,
  },
  compactShareBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
  },
});
