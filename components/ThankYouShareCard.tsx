import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Animated, Platform, Share } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, BorderRadius, FontSize, Spacing, Shadow } from '@/app/lib/theme';

interface ThankYouShareCardProps {
  amount: number;
  needTitle: string;
  userName: string;
  userAvatar?: string;
  needId?: string;
  donorName?: string;
  onShareTikTok?: () => void;
  onShareInstagram?: () => void;
  onCopyLink?: () => void;
  onDone?: () => void;
}

export default function ThankYouShareCard({
  amount,
  needTitle,
  userName,
  userAvatar,
  needId,
  donorName,
  onShareTikTok,
  onShareInstagram,
  onCopyLink,
  onDone,
}: ThankYouShareCardProps) {
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const confettiAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(confettiAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const getShareUrl = () => {
    const base = Platform.OS === 'web' && typeof window !== 'undefined'
      ? window.location.origin
      : 'https://spotme.app';
    return needId ? `${base}/share/${needId}` : base;
  };

  const getShareText = () => {
    return `I just spotted ${userName} $${amount} for "${needTitle}" on SpotMe! Can you help too? No tragedy, just life. #SpotMe #MutualAid #HelpYourNeighbor`;
  };

  const handleNativeShare = async () => {
    const url = getShareUrl();
    const text = getShareText();
    try {
      if (Platform.OS === 'web' && navigator.share) {
        await navigator.share({ title: `I spotted ${userName}!`, text, url });
      } else {
        await Share.share({ message: `${text}\n${url}` });
      }
    } catch {}
  };

  const handleCopyLink = async () => {
    const url = getShareUrl();
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
    onCopyLink?.();
  };

  const firstName = (userName || 'Someone').split(' ')[0];


  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: opacityAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      {/* Celebration Header */}
      <View style={styles.celebrationHeader}>
        <Animated.View
          style={[
            styles.confettiLeft,
            {
              opacity: confettiAnim,
              transform: [{
                translateX: confettiAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                }),
              }],
            },
          ]}
        >
          <MaterialIcons name="auto-awesome" size={20} color={Colors.accent} />
        </Animated.View>

        <View style={styles.checkCircle}>
          <MaterialIcons name="favorite" size={36} color={Colors.white} />
        </View>

        <Animated.View
          style={[
            styles.confettiRight,
            {
              opacity: confettiAnim,
              transform: [{
                translateX: confettiAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-20, 0],
                }),
              }],
            },
          ]}
        >
          <MaterialIcons name="auto-awesome" size={20} color={Colors.accent} />
        </Animated.View>
      </View>

      {/* Thank You Message */}
      <Text style={styles.title}>You spotted {firstName}!</Text>
      <Text style={styles.amount}>${amount.toFixed(2)}</Text>
      <Text style={styles.subtitle}>for "{needTitle}"</Text>

      {/* Recipient Card */}
      {userAvatar && (
        <View style={styles.recipientCard}>
          <Image source={{ uri: userAvatar }} style={styles.recipientAvatar} />
          <View style={styles.recipientInfo}>
            <Text style={styles.recipientName}>{userName}</Text>
            <Text style={styles.recipientMessage}>will receive ${(amount * 0.95).toFixed(2)}</Text>
          </View>
          <MaterialIcons name="check-circle" size={20} color={Colors.success} />
        </View>
      )}

      {/* Impact Message */}
      <View style={styles.impactCard}>
        <MaterialIcons name="favorite" size={16} color={Colors.primary} />
        <Text style={styles.impactText}>
          Every dollar counts. You just made {firstName}'s day a little brighter.
        </Text>
      </View>

      {/* Share Section */}
      <View style={styles.shareSection}>
        <Text style={styles.shareTitle}>Share your impact</Text>
        <Text style={styles.shareSubtitle}>Help {firstName} reach their goal faster</Text>

        <View style={styles.shareButtons}>
          <TouchableOpacity
            style={[styles.shareBtn, styles.tiktokBtn]}
            onPress={() => {
              if (Platform.OS === 'web') {
                window.open('https://www.tiktok.com/upload', '_blank');
              }
              onShareTikTok?.();
            }}
            activeOpacity={0.8}
          >
            <MaterialIcons name="music-note" size={20} color="#FFF" />
            <Text style={styles.shareBtnText}>TikTok</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.shareBtn, styles.igBtn]}
            onPress={() => {
              if (Platform.OS === 'web') {
                window.open('https://www.instagram.com/', '_blank');
              }
              onShareInstagram?.();
            }}
            activeOpacity={0.8}
          >
            <MaterialIcons name="camera-alt" size={20} color="#FFF" />
            <Text style={styles.shareBtnText}>Instagram</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.shareBtn, styles.moreBtn]}
            onPress={handleNativeShare}
            activeOpacity={0.8}
          >
            <MaterialIcons name="share" size={20} color="#FFF" />
            <Text style={styles.shareBtnText}>More</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.copyLinkBtn} onPress={handleCopyLink} activeOpacity={0.7}>
          <MaterialIcons name="link" size={16} color={Colors.primary} />
          <Text style={styles.copyLinkText}>Copy share link</Text>
        </TouchableOpacity>
      </View>

      {/* Done Button */}
      <TouchableOpacity style={styles.doneBtn} onPress={onDone} activeOpacity={0.8}>
        <Text style={styles.doneBtnText}>Done</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  celebrationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xl,
    marginBottom: Spacing.md,
  },
  confettiLeft: {},
  confettiRight: {},
  checkCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.lg,
  },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: '900',
    color: Colors.text,
    textAlign: 'center',
  },
  amount: {
    fontSize: 40,
    fontWeight: '900',
    color: Colors.primary,
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  recipientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    width: '100%',
  },
  recipientAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  recipientInfo: {
    flex: 1,
  },
  recipientName: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
  },
  recipientMessage: {
    fontSize: FontSize.sm,
    color: Colors.success,
    fontWeight: '600',
    marginTop: 1,
  },
  impactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primaryLight,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    width: '100%',
  },
  impactText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.primaryDark,
    fontWeight: '600',
    lineHeight: 20,
  },
  shareSection: {
    width: '100%',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  shareTitle: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: Colors.text,
  },
  shareSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textLight,
    marginBottom: Spacing.sm,
  },
  shareButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
    width: '100%',
  },
  shareBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  tiktokBtn: {
    backgroundColor: '#000',
  },
  igBtn: {
    backgroundColor: '#E1306C',
  },
  moreBtn: {
    backgroundColor: Colors.primary,
  },
  shareBtnText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: '#FFF',
  },
  copyLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
  },
  copyLinkText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.primary,
  },
  doneBtn: {
    backgroundColor: Colors.surfaceAlt,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.huge,
    borderRadius: BorderRadius.xl,
    marginTop: Spacing.sm,
  },
  doneBtnText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
});
