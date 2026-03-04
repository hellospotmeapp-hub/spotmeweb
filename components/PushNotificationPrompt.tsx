import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, Platform, ActivityIndicator, Pressable,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, BorderRadius, FontSize, Spacing, Shadow } from '@/app/lib/theme';

interface PushNotificationPromptProps {
  visible: boolean;
  onClose: () => void;
  onEnable: () => Promise<boolean>;
  contributorName?: string;
  needTitle?: string;
  amount?: number;
}

export default function PushNotificationPrompt({
  visible,
  onClose,
  onEnable,
  contributorName,
  needTitle,
  amount,
}: PushNotificationPromptProps) {
  const [enabling, setEnabling] = useState(false);
  const [result, setResult] = useState<'idle' | 'success' | 'denied'>('idle');
  const mountedRef = useRef(true);
  const timeoutRef = useRef<any>(null);

  // Track mounted state to avoid setState on unmounted component
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // Reset state when modal becomes visible
  useEffect(() => {
    if (visible) {
      setEnabling(false);
      setResult('idle');
    }
  }, [visible]);

  const handleEnable = async () => {
    if (enabling) return; // Prevent double-tap
    setEnabling(true);

    // Safety timeout: if onEnable hangs for more than 15 seconds, force-recover
    timeoutRef.current = setTimeout(() => {
      if (mountedRef.current) {
        console.warn('[PushNotificationPrompt] onEnable timed out after 15s');
        setEnabling(false);
        setResult('denied');
      }
    }, 15000);

    try {
      const success = await onEnable();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      if (!mountedRef.current) return;

      setResult(success ? 'success' : 'denied');
      if (success) {
        setTimeout(() => {
          if (mountedRef.current) {
            setResult('idle');
            onClose();
          }
        }, 2000);
      }
    } catch (err) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      console.error('[PushNotificationPrompt] onEnable error:', err);
      if (mountedRef.current) {
        setResult('denied');
      }
    }
    if (mountedRef.current) {
      setEnabling(false);
    }
  };

  const handleDismiss = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setEnabling(false);
    setResult('idle');
    onClose();
  };

  if (Platform.OS !== 'web') return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleDismiss}>
      <Pressable style={styles.overlay} onPress={handleDismiss}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          {/* Always-visible close button */}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleDismiss}
            activeOpacity={0.6}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <MaterialIcons name="close" size={22} color={Colors.textSecondary} />
          </TouchableOpacity>

          {result === 'success' ? (
            <View style={styles.successContainer}>
              <View style={styles.successIconWrap}>
                <MaterialIcons name="notifications-active" size={48} color={Colors.success} />
              </View>
              <Text style={styles.successTitle}>Notifications Enabled</Text>
              <Text style={styles.successSubtitle}>
                You'll get instant alerts when someone spots your needs.
              </Text>
            </View>
          ) : (
            <>
              {/* Decorative header */}
              <View style={styles.headerDecoration}>
                <View style={[styles.decorCircle, styles.decorCircle1]} />
                <View style={[styles.decorCircle, styles.decorCircle2]} />
                <View style={styles.bellIconWrap}>
                  <View style={styles.bellPulse} />
                  <View style={styles.bellIcon}>
                    <MaterialIcons name="notifications" size={32} color={Colors.white} />
                  </View>
                </View>
              </View>

              {/* Content */}
              <View style={styles.content}>
                <Text style={styles.title}>Never Miss a Spot</Text>

                {contributorName && needTitle && amount ? (
                  <View style={styles.contextCard}>
                    <View style={styles.contextIcon}>
                      <MaterialIcons name="favorite" size={16} color={Colors.primary} />
                    </View>
                    <Text style={styles.contextText}>
                      <Text style={styles.contextBold}>{contributorName}</Text> just spotted{' '}
                      <Text style={styles.contextBold}>${amount}</Text> on "{needTitle}"
                    </Text>
                  </View>
                ) : null}

                <Text style={styles.description}>
                  Get instant push notifications when someone contributes to your needs, when your goal is met, and when payouts are ready.
                </Text>

                {/* Benefits */}
                <View style={styles.benefitsList}>
                  <View style={styles.benefitRow}>
                    <View style={[styles.benefitDot, { backgroundColor: Colors.primary }]}>
                      <MaterialIcons name="bolt" size={14} color={Colors.white} />
                    </View>
                    <Text style={styles.benefitText}>Instant alerts when you receive a spot</Text>
                  </View>
                  <View style={styles.benefitRow}>
                    <View style={[styles.benefitDot, { backgroundColor: Colors.success }]}>
                      <MaterialIcons name="celebration" size={14} color={Colors.white} />
                    </View>
                    <Text style={styles.benefitText}>Know the moment your goal is met</Text>
                  </View>
                  <View style={styles.benefitRow}>
                    <View style={[styles.benefitDot, { backgroundColor: Colors.secondary }]}>
                      <MaterialIcons name="account-balance-wallet" size={14} color={Colors.white} />
                    </View>
                    <Text style={styles.benefitText}>Payout ready & milestone updates</Text>
                  </View>
                </View>

                {result === 'denied' && (
                  <View style={styles.deniedBanner}>
                    <MaterialIcons name="info-outline" size={16} color={Colors.accent} />
                    <Text style={styles.deniedText}>
                      Notifications were blocked. You can enable them in your browser settings.
                    </Text>
                  </View>
                )}

                {/* Actions */}
                {result === 'denied' ? (
                  // When denied, show a clear "Got it" / close button instead of Enable again
                  <>
                    <TouchableOpacity
                      style={styles.gotItButton}
                      onPress={handleDismiss}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.gotItButtonText}>Got it</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.retryLink}
                      onPress={handleEnable}
                      activeOpacity={0.7}
                      disabled={enabling}
                    >
                      <Text style={styles.retryLinkText}>
                        {enabling ? 'Trying...' : 'Try Again'}
                      </Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <TouchableOpacity
                      style={[styles.enableButton, enabling && styles.enableButtonDisabled]}
                      onPress={handleEnable}
                      activeOpacity={0.8}
                      disabled={enabling}
                    >
                      {enabling ? (
                        <ActivityIndicator size="small" color={Colors.white} />
                      ) : (
                        <MaterialIcons name="notifications-active" size={20} color={Colors.white} />
                      )}
                      <Text style={styles.enableButtonText}>
                        {enabling ? 'Enabling...' : 'Enable Notifications'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.skipButton}
                      onPress={handleDismiss}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.skipButtonText}>Maybe Later</Text>
                    </TouchableOpacity>
                  </>
                )}

                <Text style={styles.privacyNote}>
                  <MaterialIcons name="lock" size={10} color={Colors.textLight} /> We only send notifications about your needs. No spam, ever.
                </Text>
              </View>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    backgroundColor: Colors.overlay,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xxl,
    width: '100%',
    maxWidth: 400,
    overflow: 'hidden',
    position: 'relative',
    ...Shadow.lg,
  },

  // Close button - always visible
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
  },

  // Header decoration
  headerDecoration: {
    backgroundColor: Colors.primary,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  decorCircle: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  decorCircle1: { width: 160, height: 160, top: -40, right: -30 },
  decorCircle2: { width: 100, height: 100, bottom: -30, left: -20 },
  bellIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellPulse: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  bellIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Content
  content: {
    padding: Spacing.xxl,
    gap: Spacing.md,
  },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: '900',
    color: Colors.text,
    textAlign: 'center',
  },
  description: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Context card (shows the contribution that triggered the prompt)
  contextCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: Colors.primaryLight,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
  },
  contextIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  contextText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.text,
    lineHeight: 20,
  },
  contextBold: {
    fontWeight: '700',
  },

  // Benefits
  benefitsList: {
    gap: Spacing.md,
    marginTop: Spacing.xs,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  benefitDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.text,
    fontWeight: '500',
  },

  // Denied banner
  deniedBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: Colors.accentLight,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  deniedText: {
    flex: 1,
    fontSize: FontSize.xs,
    color: '#8B7000',
    lineHeight: 16,
  },

  // Buttons
  enableButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.xl,
    marginTop: Spacing.sm,
    ...Shadow.md,
  },
  enableButtonDisabled: {
    opacity: 0.6,
  },
  enableButtonText: {
    fontSize: FontSize.md,
    fontWeight: '800',
    color: Colors.white,
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  skipButtonText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textLight,
  },

  // "Got it" button for denied state — prominent close action
  gotItButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.text,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.xl,
    marginTop: Spacing.sm,
    ...Shadow.md,
  },
  gotItButtonText: {
    fontSize: FontSize.md,
    fontWeight: '800',
    color: Colors.white,
  },

  // "Try Again" link for denied state
  retryLink: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  retryLinkText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.primary,
  },

  privacyNote: {
    fontSize: FontSize.xs,
    color: Colors.textLight,
    textAlign: 'center',
    lineHeight: 16,
    marginTop: Spacing.xs,
  },

  // Success state
  successContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl,
    paddingHorizontal: Spacing.xxl,
    gap: Spacing.md,
  },
  successIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E8F5E8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  successTitle: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.text,
  },
  successSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
