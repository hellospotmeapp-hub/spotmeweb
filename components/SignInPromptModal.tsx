import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Image, Animated, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, BorderRadius, FontSize, Spacing, Shadow } from '@/app/lib/theme';

interface SignInPromptModalProps {
  visible: boolean;
  onClose: () => void;
  userName?: string;
  userAvatar?: string;
  needTitle?: string;
  remaining?: number;
}

export default function SignInPromptModal({
  visible,
  onClose,
  userName,
  userAvatar,
  needTitle,
  remaining,
}: SignInPromptModalProps) {
  const router = useRouter();
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 65,
          friction: 9,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0.9);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  const handleSignIn = () => {
    onClose();
    setTimeout(() => {
      router.push('/auth');
    }, 200);
  };

  const handleSignUp = () => {
    onClose();
    setTimeout(() => {
      router.push('/auth');
    }, 200);
  };

  const firstName = userName?.split(' ')[0] || 'them';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />

        <Animated.View
          style={[
            styles.card,
            {
              opacity: opacityAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Close Button */}
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <MaterialIcons name="close" size={20} color={Colors.textLight} />
          </TouchableOpacity>

          {/* Heart Icon Glow */}
          <View style={styles.iconGlow}>
            <View style={styles.iconCircle}>
              <MaterialIcons name="favorite" size={32} color={Colors.primary} />
            </View>
          </View>

          {/* User Avatar */}
          {userAvatar ? (
            <View style={styles.avatarWrapper}>
              <Image source={{ uri: userAvatar }} style={styles.avatar} />
              <View style={styles.avatarBadge}>
                <MaterialIcons name="favorite" size={12} color={Colors.white} />
              </View>
            </View>
          ) : null}

          {/* Title */}
          <Text style={styles.title}>
            Sign in to spot {firstName}
          </Text>

          {/* Subtitle */}
          <Text style={styles.subtitle}>
            {needTitle
              ? `Join the community and help with "${needTitle}"`
              : `Create an account or sign in to start helping your neighbors`
            }
          </Text>

          {/* Remaining Amount Badge */}
          {remaining !== undefined && remaining > 0 && (
            <View style={styles.remainingBadge}>
              <MaterialIcons name="flag" size={14} color={Colors.primary} />
              <Text style={styles.remainingText}>${remaining} still needed</Text>
            </View>
          )}

          {/* Benefits */}
          <View style={styles.benefitsSection}>
            <View style={styles.benefitRow}>
              <View style={styles.benefitIcon}>
                <MaterialIcons name="verified-user" size={16} color={Colors.secondary} />
              </View>
              <Text style={styles.benefitText}>Secure payments via Stripe</Text>
            </View>
            <View style={styles.benefitRow}>
              <View style={styles.benefitIcon}>
                <MaterialIcons name="receipt-long" size={16} color={Colors.secondary} />
              </View>
              <Text style={styles.benefitText}>Get receipts for every spot</Text>
            </View>
            <View style={styles.benefitRow}>
              <View style={styles.benefitIcon}>
                <MaterialIcons name="notifications-active" size={16} color={Colors.secondary} />
              </View>
              <Text style={styles.benefitText}>Track your impact & get updates</Text>
            </View>
          </View>

          {/* Sign In Button */}
          <TouchableOpacity
            style={styles.signInBtn}
            onPress={handleSignIn}
            activeOpacity={0.8}
          >
            <MaterialIcons name="login" size={20} color={Colors.white} />
            <Text style={styles.signInBtnText}>Sign In</Text>
          </TouchableOpacity>

          {/* Sign Up Button */}
          <TouchableOpacity
            style={styles.signUpBtn}
            onPress={handleSignUp}
            activeOpacity={0.8}
          >
            <MaterialIcons name="person-add" size={20} color={Colors.primary} />
            <Text style={styles.signUpBtnText}>Create Account</Text>
          </TouchableOpacity>

          {/* Maybe Later */}
          <TouchableOpacity style={styles.laterBtn} onPress={onClose}>
            <Text style={styles.laterText}>Maybe later</Text>
          </TouchableOpacity>

          {/* Security Footer */}
          <View style={styles.securityFooter}>
            <MaterialIcons name="lock" size={12} color={Colors.textLight} />
            <Text style={styles.securityText}>Your info is safe. We never share your data.</Text>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xxl,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.overlay,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xxl,
    padding: Spacing.xxl,
    paddingTop: Spacing.xxxl,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    ...Shadow.lg,
  },
  closeBtn: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  iconGlow: {
    marginBottom: Spacing.md,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: Colors.primary + '20',
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: Spacing.md,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    borderColor: Colors.primaryLight,
  },
  avatarBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.surface,
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: '900',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.sm,
  },
  remainingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.lg,
  },
  remainingText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.primary,
  },
  benefitsSection: {
    width: '100%',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  benefitIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.secondaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
    flex: 1,
  },
  signInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.xl,
    width: '100%',
    marginBottom: Spacing.sm,
    ...Shadow.md,
  },
  signInBtnText: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: Colors.white,
  },
  signUpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primaryLight,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.xl,
    width: '100%',
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
  },
  signUpBtnText: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.primary,
  },
  laterBtn: {
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  laterText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textLight,
  },
  securityFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  securityText: {
    fontSize: FontSize.xs,
    color: Colors.textLight,
  },
});
