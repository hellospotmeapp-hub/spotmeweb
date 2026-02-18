import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Animated } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, BorderRadius, FontSize, Spacing, Shadow, CategoryColors } from '@/app/lib/theme';
import { useApp } from '@/app/lib/store';
import { CATEGORIES, NEED_PHOTOS } from '@/app/lib/data';

const GOAL_PRESETS = [25, 50, 75, 100, 150, 200, 250, 300];
const MAX_GOAL = 300;

export default function CreateScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { createNeed, isLoggedIn } = useApp();
  
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState('');
  const [goalAmount, setGoalAmount] = useState(50);
  const [customGoal, setCustomGoal] = useState('');
  const [isCustomGoal, setIsCustomGoal] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Animation for the max banner
  const bannerAnim = useRef(new Animated.Value(0)).current;
  const bannerShown = useRef(false);

  const categories = CATEGORIES.filter(c => c.name !== 'All');

  const getGoal = () => {
    if (isCustomGoal) {
      const parsed = parseInt(customGoal) || 0;
      return Math.min(parsed, MAX_GOAL);
    }
    return goalAmount;
  };

  const isAtMax = getGoal() >= MAX_GOAL;

  // Animate banner in/out when hitting max
  useEffect(() => {
    if (isAtMax && !bannerShown.current) {
      bannerShown.current = true;
      Animated.spring(bannerAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      }).start();
    } else if (!isAtMax && bannerShown.current) {
      bannerShown.current = false;
      Animated.timing(bannerAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [isAtMax]);

  const canProceed = () => {
    switch (step) {
      case 1: return category.length > 0;
      case 2: return title.trim().length >= 3 && message.trim().length >= 10;
      case 3: return getGoal() >= 25 && getGoal() <= MAX_GOAL;
      default: return false;
    }
  };

  const handleCustomGoalChange = (text: string) => {
    // Only allow numeric input
    const numeric = text.replace(/[^0-9]/g, '');
    // Cap at MAX_GOAL
    const parsed = parseInt(numeric) || 0;
    if (parsed > MAX_GOAL) {
      setCustomGoal(String(MAX_GOAL));
    } else {
      setCustomGoal(numeric);
    }
  };

  const handleSubmit = () => {
    if (!isLoggedIn) {
      router.push('/auth');
      return;
    }

    const randomPhoto = NEED_PHOTOS[Math.floor(Math.random() * NEED_PHOTOS.length)];

    createNeed({
      title: title.trim(),
      message: message.trim(),
      category,
      goalAmount: getGoal(),
      photo: randomPhoto,
    });

    setSubmitted(true);
  };

  const handleReset = () => {
    setStep(1);
    setTitle('');
    setMessage('');
    setCategory('');
    setGoalAmount(50);
    setCustomGoal('');
    setIsCustomGoal(false);
    setSubmitted(false);
    bannerShown.current = false;
    bannerAnim.setValue(0);
  };

  const topPadding = Platform.OS === 'web' ? 0 : insets.top;

  if (submitted) {
    return (
      <View style={[styles.container, { paddingTop: topPadding }]}>
        <View style={styles.successContainer}>
          <View style={styles.successIcon}>
            <MaterialIcons name="check-circle" size={64} color={Colors.success} />
          </View>
          <Text style={styles.successTitle}>Need Posted!</Text>
          <Text style={styles.successMessage}>
            Your need is now live. The community can start spotting you right away.
          </Text>

          {/* Encouraging message about posting more */}
          <View style={styles.successInfoBanner}>
            <View style={styles.successInfoIconWrap}>
              <MaterialIcons name="auto-awesome" size={22} color={Colors.accent} />
            </View>
            <Text style={styles.successInfoText}>
              Have more to cover? You can always post additional needs — there's no limit to how many you can create!
            </Text>
          </View>

          <TouchableOpacity style={styles.successButton} onPress={() => router.push('/(tabs)')}>
            <MaterialIcons name="home" size={20} color={Colors.white} />
            <Text style={styles.successButtonText}>View Feed</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.postAnotherButton} onPress={handleReset}>
            <MaterialIcons name="add-circle-outline" size={20} color={Colors.primary} />
            <Text style={styles.postAnotherButtonText}>Post Another Need</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const Wrapper = Platform.OS === 'web' ? View : KeyboardAvoidingView;
  const wrapperProps = Platform.OS === 'web' ? {} : { behavior: 'padding' as const };

  return (
    <Wrapper
      style={[styles.container, { paddingTop: topPadding }]}
      {...wrapperProps}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Post a Need</Text>
        <Text style={styles.headerSubtitle}>Step {step} of 3</Text>
      </View>

      {/* Progress Steps */}
      <View style={styles.stepsRow}>
        {[1, 2, 3].map(s => (
          <View key={s} style={styles.stepContainer}>
            <View style={[styles.stepDot, s <= step && styles.stepDotActive, s < step && styles.stepDotComplete]}>
              {s < step ? (
                <MaterialIcons name="check" size={14} color={Colors.white} />
              ) : (
                <Text style={[styles.stepNumber, s <= step && styles.stepNumberActive]}>{s}</Text>
              )}
            </View>
            <Text style={[styles.stepLabel, s <= step && styles.stepLabelActive]}>
              {s === 1 ? 'Category' : s === 2 ? 'Details' : 'Goal'}
            </Text>
          </View>
        ))}
        <View style={styles.stepLine}>
          <View style={[styles.stepLineFill, { width: `${((step - 1) / 2) * 100}%` }]} />
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Step 1: Category */}
        {step === 1 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>What do you need help with?</Text>
            <Text style={styles.stepDescription}>Choose the category that best fits your need.</Text>
            
            <View style={styles.categoryGrid}>
              {categories.map(cat => {
                const isSelected = category === cat.name;
                const color = CategoryColors[cat.name] || Colors.textSecondary;
                return (
                  <TouchableOpacity
                    key={cat.name}
                    style={[
                      styles.categoryCard,
                      isSelected && { borderColor: color, backgroundColor: color + '15' },
                    ]}
                    onPress={() => setCategory(cat.name)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.categoryIconBg, { backgroundColor: color + '20' }]}>
                      <MaterialIcons name={cat.icon as any} size={28} color={color} />
                    </View>
                    <Text style={[styles.categoryName, isSelected && { color, fontWeight: '800' }]}>
                      {cat.name}
                    </Text>
                    {isSelected && (
                      <View style={[styles.checkBadge, { backgroundColor: color }]}>
                        <MaterialIcons name="check" size={14} color={Colors.white} />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Step 2: Details */}
        {step === 2 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Tell your story</Text>
            <Text style={styles.stepDescription}>Be honest and specific. People connect with real stories.</Text>

            <Text style={styles.inputLabel}>Title</Text>
            <TextInput
              style={styles.textInput}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g., Electric bill is due Friday"
              placeholderTextColor={Colors.textLight}
              maxLength={60}
            />
            <Text style={styles.charCount}>{title.length}/60</Text>

            <Text style={styles.inputLabel}>Your message</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={message}
              onChangeText={setMessage}
              placeholder="Explain your situation in a sentence or two. What happened and how will this help?"
              placeholderTextColor={Colors.textLight}
              multiline
              maxLength={200}
              textAlignVertical="top"
            />
            <Text style={styles.charCount}>{message.length}/200</Text>

            <View style={styles.tipCard}>
              <MaterialIcons name="lightbulb" size={20} color={Colors.accent} />
              <Text style={styles.tipText}>
                Tip: Needs with specific, honest stories get funded 3x faster than vague ones.
              </Text>
            </View>
          </View>
        )}

        {/* Step 3: Goal */}
        {step === 3 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Set your goal</Text>
            <Text style={styles.stepDescription}>How much do you need? Keep it between $25 and $300.</Text>

            <View style={styles.goalDisplay}>
              <Text style={styles.goalDollar}>$</Text>
              <Text style={styles.goalNumber}>{getGoal()}</Text>
            </View>

            {/* $300 Max Info Banner */}
            {isAtMax && (
              <Animated.View
                style={[
                  styles.maxBanner,
                  {
                    opacity: bannerAnim,
                    transform: [{
                      translateY: bannerAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-10, 0],
                      }),
                    }, {
                      scale: bannerAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.95, 1],
                      }),
                    }],
                  },
                ]}
              >
                <View style={styles.maxBannerIconWrap}>
                  <MaterialIcons name="info-outline" size={22} color="#5B8DEF" />
                </View>
                <View style={styles.maxBannerContent}>
                  <Text style={styles.maxBannerTitle}>That's the max for a single request</Text>
                  <Text style={styles.maxBannerText}>
                    But no worries! You can always post another need if you have more to cover. There's no limit to how many needs you can create.
                  </Text>
                </View>
              </Animated.View>
            )}

            <View style={styles.goalGrid}>
              {GOAL_PRESETS.map(amount => (
                <TouchableOpacity
                  key={amount}
                  style={[
                    styles.goalButton,
                    !isCustomGoal && goalAmount === amount && styles.goalButtonSelected,
                    amount === MAX_GOAL && !isCustomGoal && goalAmount === amount && styles.goalButtonMax,
                  ]}
                  onPress={() => { setGoalAmount(amount); setIsCustomGoal(false); }}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.goalButtonText,
                    !isCustomGoal && goalAmount === amount && styles.goalButtonTextSelected,
                  ]}>
                    ${amount}
                  </Text>
                  {amount === MAX_GOAL && (
                    <Text style={styles.goalMaxLabel}>max</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.customGoalToggle, isCustomGoal && styles.customGoalToggleActive]}
              onPress={() => setIsCustomGoal(!isCustomGoal)}
              activeOpacity={0.7}
            >
              <MaterialIcons name="edit" size={18} color={isCustomGoal ? Colors.primary : Colors.textSecondary} />
              <Text style={[styles.customGoalToggleText, isCustomGoal && { color: Colors.primary }]}>
                Enter custom amount
              </Text>
            </TouchableOpacity>

            {isCustomGoal && (
              <View style={styles.customGoalInput}>
                <Text style={styles.customDollar}>$</Text>
                <TextInput
                  style={styles.customGoalField}
                  value={customGoal}
                  onChangeText={handleCustomGoalChange}
                  keyboardType="numeric"
                  placeholder="Enter amount (25-300)"
                  placeholderTextColor={Colors.textLight}
                  maxLength={3}
                  autoFocus
                />
                <View style={styles.customGoalMaxHint}>
                  <Text style={styles.customGoalMaxHintText}>max $300</Text>
                </View>
              </View>
            )}

            {getGoal() > 0 && (
              <View style={styles.feeInfo}>
                <Text style={styles.feeInfoText}>
                  Platform fee: 5% on contributions
                </Text>
                <Text style={styles.feeInfoText}>
                  You'll receive up to ${Math.round(getGoal() * 0.95)} after fees
                </Text>
              </View>
            )}

            {/* Summary */}
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Summary</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Category</Text>
                <Text style={styles.summaryValue}>{category}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Title</Text>
                <Text style={styles.summaryValue} numberOfLines={1}>{title}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Goal</Text>
                <View style={styles.summaryGoalWrap}>
                  <Text style={styles.summaryValue}>${getGoal()}</Text>
                  {isAtMax && (
                    <View style={styles.summaryMaxBadge}>
                      <Text style={styles.summaryMaxBadgeText}>MAX</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={[styles.bottomBar, { paddingBottom: Platform.OS === 'web' ? Spacing.md : insets.bottom + Spacing.md }]}>
        {step > 1 && (
          <TouchableOpacity style={styles.backButton} onPress={() => setStep(step - 1)} activeOpacity={0.7}>
            <MaterialIcons name="arrow-back" size={20} color={Colors.textSecondary} />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.nextButton, !canProceed() && styles.nextButtonDisabled, step === 1 && { flex: 1 }]}
          onPress={() => step < 3 ? setStep(step + 1) : handleSubmit()}
          disabled={!canProceed()}
          activeOpacity={0.8}
        >
          <Text style={styles.nextButtonText}>
            {step < 3 ? 'Continue' : 'Post Need'}
          </Text>
          <MaterialIcons name={step < 3 ? 'arrow-forward' : 'check'} size={20} color={Colors.white} />
        </TouchableOpacity>
      </View>
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    ...(Platform.OS === 'web' ? { paddingTop: 16 } : {}),
  },
  headerTitle: {
    fontSize: FontSize.xxl,
    fontWeight: '900',
    color: Colors.text,
  },
  headerSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textLight,
    fontWeight: '600',
  },
  stepsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xxxl,
    marginBottom: Spacing.xxl,
    position: 'relative',
  },
  stepContainer: {
    alignItems: 'center',
    gap: 4,
    zIndex: 1,
  },
  stepDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.border,
  },
  stepDotActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  stepDotComplete: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  stepNumber: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.textLight,
  },
  stepNumberActive: {
    color: Colors.primary,
  },
  stepLabel: {
    fontSize: FontSize.xs,
    color: Colors.textLight,
  },
  stepLabelActive: {
    color: Colors.primary,
    fontWeight: '600',
  },
  stepLine: {
    position: 'absolute',
    left: 60,
    right: 60,
    top: 15,
    height: 2,
    backgroundColor: Colors.border,
    zIndex: 0,
  },
  stepLineFill: {
    height: '100%',
    backgroundColor: Colors.primary,
  },
  content: {
    flex: 1,
  },
  stepContent: {
    paddingHorizontal: Spacing.xl,
  },
  stepTitle: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  stepDescription: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.xxl,
    lineHeight: 20,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  categoryCard: {
    width: '47%',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 2,
    borderColor: 'transparent',
    ...Shadow.sm,
    position: 'relative',
  },
  categoryIconBg: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryName: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  checkBadge: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputLabel: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textInput: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    fontSize: FontSize.md,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.sm,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: FontSize.xs,
    color: Colors.textLight,
    textAlign: 'right',
    marginTop: Spacing.xs,
    marginBottom: Spacing.xl,
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: Colors.accentLight,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.md,
  },
  tipText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  goalDisplay: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginBottom: Spacing.xxl,
  },
  goalDollar: {
    fontSize: FontSize.xxl,
    fontWeight: '700',
    color: Colors.primary,
    marginTop: 8,
  },
  goalNumber: {
    fontSize: 64,
    fontWeight: '900',
    color: Colors.text,
    lineHeight: 72,
  },

  // ---- $300 Max Info Banner ----
  maxBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#EEF4FF',
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: '#D4E2FC',
    gap: Spacing.md,
  },
  maxBannerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#D4E2FC',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  maxBannerContent: {
    flex: 1,
  },
  maxBannerTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: '#2D5BA9',
    marginBottom: 4,
  },
  maxBannerText: {
    fontSize: FontSize.sm,
    color: '#4A6FA5',
    lineHeight: 20,
  },

  goalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  goalButton: {
    width: '23%',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    ...Shadow.sm,
  },
  goalButtonSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  goalButtonMax: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  goalButtonText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  goalButtonTextSelected: {
    color: Colors.primary,
  },
  goalMaxLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  customGoalToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.md,
  },
  customGoalToggleActive: {},
  customGoalToggleText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  customGoalInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    borderWidth: 2,
    borderColor: Colors.primary,
    marginBottom: Spacing.lg,
  },
  customDollar: {
    fontSize: FontSize.xxl,
    fontWeight: '700',
    color: Colors.primary,
  },
  customGoalField: {
    flex: 1,
    fontSize: FontSize.xxl,
    fontWeight: '700',
    color: Colors.text,
    paddingVertical: Spacing.md,
    marginLeft: Spacing.xs,
  },
  customGoalMaxHint: {
    backgroundColor: Colors.surfaceAlt,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  customGoalMaxHintText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.textLight,
  },
  feeInfo: {
    backgroundColor: Colors.surfaceAlt,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    gap: Spacing.xs,
    marginBottom: Spacing.xl,
  },
  feeInfoText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  summaryCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    gap: Spacing.md,
    ...Shadow.sm,
  },
  summaryTitle: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: FontSize.sm,
    color: Colors.textLight,
  },
  summaryValue: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
    maxWidth: '60%',
  },
  summaryGoalWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  summaryMaxBadge: {
    backgroundColor: '#EEF4FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#D4E2FC',
  },
  summaryMaxBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#5B8DEF',
    letterSpacing: 0.5,
  },
  bottomBar: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    backgroundColor: Colors.surface,
    gap: Spacing.md,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 -2px 16px rgba(0,0,0,0.08)' as any }
      : Shadow.lg),
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.surfaceAlt,
  },
  backButtonText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  nextButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.primary,
    ...Shadow.md,
  },
  nextButtonDisabled: {
    opacity: 0.5,
  },
  nextButtonText: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.white,
  },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxxl,
    gap: Spacing.lg,
  },
  successIcon: {
    marginBottom: Spacing.md,
  },
  successTitle: {
    fontSize: FontSize.xxxl,
    fontWeight: '900',
    color: Colors.text,
  },
  successMessage: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },

  // ---- Success screen info banner ----
  successInfoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.accentLight,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginTop: Spacing.sm,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: '#F0E4C0',
    width: '100%',
  },
  successInfoIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F0E4C0',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  successInfoText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: '#7A6B3E',
    lineHeight: 20,
  },

  successButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xxxl,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.xl,
    marginTop: Spacing.lg,
    width: '100%',
    ...Shadow.md,
  },
  successButtonText: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.white,
  },

  // ---- Post Another Need button (prominent) ----
  postAnotherButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: Spacing.xxxl,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.xl,
    width: '100%',
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  postAnotherButtonText: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.primary,
  },
});
