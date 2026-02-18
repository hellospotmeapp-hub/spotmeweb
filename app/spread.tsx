import React, { useState, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, ActivityIndicator, Image, Animated,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, BorderRadius, FontSize, Spacing, Shadow, CategoryColors } from '@/app/lib/theme';
import { useApp } from '@/app/lib/store';
import { CATEGORIES } from '@/app/lib/data';
import { smartSplit, getImpactMessage, SplitResult, SpreadMode } from '@/app/lib/smartSplit';
import SpreadPreview from '@/components/SpreadPreview';
import { supabase } from '@/app/lib/supabase';

type Step = 'amount' | 'mode' | 'privacy' | 'preview' | 'processing' | 'success';
type PrivacyMode = 'public' | 'anonymous' | 'specific';

const PRESET_AMOUNTS = [10, 20, 30, 50, 75, 100];

const SPREAD_MODES: { key: SpreadMode; icon: string; title: string; description: string; color: string }[] = [
  { key: 'closest', icon: 'trending-up', title: 'Closest to Goal', description: 'Smart Split prioritizes completing goals. Your money helps finish what others started.', color: Colors.primary },
  { key: 'category', icon: 'category', title: 'By Category', description: 'Choose a category and help everyone in it. Bills, Kids, Groceries, and more.', color: Colors.secondary },
  { key: 'random', icon: 'shuffle', title: 'Random Spread', description: 'Spread your love randomly across the community. Let the universe decide.', color: Colors.accent },
];

const PRIVACY_OPTIONS: { key: PrivacyMode; icon: string; title: string; description: string }[] = [
  { key: 'public', icon: 'visibility', title: 'Show who I helped', description: 'Your name and contribution will be visible on each need.' },
  { key: 'anonymous', icon: 'visibility-off', title: 'Keep it anonymous', description: 'Appear as "A kind stranger" on all contributions.' },
  { key: 'specific', icon: 'people', title: 'Choose specific people', description: 'Pick exactly which needs you want to support.' },
];

export default function SpreadTheLoveScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { needs, contribute, currentUser, spreadWithPayment } = useApp();


  const [step, setStep] = useState<Step>('amount');
  const [selectedAmount, setSelectedAmount] = useState<number | null>(30);
  const [customAmount, setCustomAmount] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [spreadMode, setSpreadMode] = useState<SpreadMode>('closest');
  const [selectedCategory, setSelectedCategory] = useState<string>('Bills');
  const [privacyMode, setPrivacyMode] = useState<PrivacyMode>('public');
  const [selectedNeedIds, setSelectedNeedIds] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const successScale = useRef(new Animated.Value(0)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;
  const heartAnims = useRef([...Array(6)].map(() => ({
    translateY: new Animated.Value(0),
    opacity: new Animated.Value(0),
    translateX: new Animated.Value(0),
  }))).current;

  const getAmount = () => isCustom ? (parseFloat(customAmount) || 0) : (selectedAmount || 0);
  const amount = getAmount();

  const splitResult = useMemo<SplitResult>(() => {
    if (amount <= 0) return { allocations: [], totalAmount: 0, totalPeople: 0, goalsCompleted: 0, fee: 0, netAmount: 0 };
    const specificIds = privacyMode === 'specific' ? selectedNeedIds : undefined;
    const category = spreadMode === 'category' ? selectedCategory : undefined;
    return smartSplit(amount, needs, spreadMode, category, specificIds);
  }, [amount, needs, spreadMode, selectedCategory, privacyMode, selectedNeedIds]);

  const eligibleNeeds = useMemo(() => {
    let filtered = needs.filter(n => n.status === 'Collecting');
    if (spreadMode === 'category') filtered = filtered.filter(n => n.category === selectedCategory);
    return filtered.sort((a, b) => (a.goalAmount - a.raisedAmount) - (b.goalAmount - b.raisedAmount));
  }, [needs, spreadMode, selectedCategory]);

  const toggleNeedSelection = (needId: string) => {
    setSelectedNeedIds(prev => prev.includes(needId) ? prev.filter(id => id !== needId) : [...prev, needId]);
  };

  const handleConfirmSpread = async () => {
    if (splitResult.allocations.length === 0) return;
    setStep('processing');
    setProcessing(true);
    setErrorMsg('');

    try {
      const isAnonymous = privacyMode === 'anonymous';
      const contributorName = isAnonymous ? 'A kind stranger' : currentUser.name;

      const { data, error } = await supabase.functions.invoke('process-contribution', {
        body: {
          action: 'spread_the_love',
          allocations: splitResult.allocations.map(a => ({ needId: a.needId, needTitle: a.needTitle, amount: a.amount, userName: a.userName })),
          totalAmount: splitResult.totalAmount,
          contributorName,
          spreadMode,
          isAnonymous,
        },
      });

      if (error) throw new Error(error.message || 'Spread processing failed');

      if (data?.success) {
        for (const allocation of splitResult.allocations) {
          contribute(allocation.needId, allocation.amount, isAnonymous ? 'Spread the Love' : `Spread the Love from ${currentUser.name}`);
        }
        setStep('success');
        animateSuccess();
      } else {
        throw new Error(data?.error || 'Spread failed');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Something went wrong. Please try again.');
      setStep('preview');
    } finally {
      setProcessing(false);
    }
  };

  const animateSuccess = () => {
    Animated.parallel([
      Animated.spring(successScale, { toValue: 1, friction: 4, tension: 50, useNativeDriver: true }),
      Animated.timing(successOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();

    heartAnims.forEach((anim, i) => {
      Animated.sequence([
        Animated.delay(i * 200 + 300),
        Animated.parallel([
          Animated.timing(anim.opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(anim.translateY, { toValue: -120 - Math.random() * 80, duration: 1500, useNativeDriver: true }),
          Animated.timing(anim.translateX, { toValue: (Math.random() - 0.5) * 160, duration: 1500, useNativeDriver: true }),
        ]),
        Animated.timing(anim.opacity, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]).start();
    });
  };

  const goNext = () => {
    switch (step) {
      case 'amount': if (amount > 0 && amount <= 300) setStep('mode'); break;
      case 'mode': setStep('privacy'); break;
      case 'privacy': setStep('preview'); break;
    }
  };

  const goBack = () => {
    switch (step) {
      case 'mode': setStep('amount'); break;
      case 'privacy': setStep('mode'); break;
      case 'preview': setStep('privacy'); break;
      default: router.back(); break;
    }
  };

  const getStepNumber = () => {
    switch (step) { case 'amount': return 1; case 'mode': return 2; case 'privacy': return 3; case 'preview': return 4; default: return 4; }
  };

  const canProceed = () => {
    switch (step) {
      case 'amount': return amount > 0 && amount <= 300;
      case 'mode': return true;
      case 'privacy': return privacyMode === 'specific' ? selectedNeedIds.length > 0 : true;
      case 'preview': return splitResult.allocations.length > 0;
      default: return false;
    }
  };

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    needs.filter(n => n.status === 'Collecting').forEach(n => { counts[n.category] = (counts[n.category] || 0) + 1; });
    return counts;
  }, [needs]);

  const topPadding = Platform.OS === 'web' ? 16 : insets.top;
  const Wrapper = Platform.OS === 'web' ? View : KeyboardAvoidingView;
  const wrapperProps = Platform.OS === 'web' ? {} : { behavior: 'padding' as const };

  return (
    <Wrapper style={[styles.container, { paddingTop: topPadding }]} {...wrapperProps}>
      {step !== 'success' && step !== 'processing' && (
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={goBack}>
            <MaterialIcons name={step === 'amount' ? 'close' : 'arrow-back'} size={24} color={Colors.text} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Spread the Love</Text>
            <View style={styles.stepIndicator}>
              {[1, 2, 3, 4].map(num => (
                <View key={num} style={styles.stepRow}>
                  <View style={[styles.stepDot, num <= getStepNumber() && styles.stepDotActive, num < getStepNumber() && styles.stepDotComplete]}>
                    {num < getStepNumber() ? <MaterialIcons name="check" size={12} color={Colors.white} /> : <Text style={[styles.stepDotText, num <= getStepNumber() && styles.stepDotTextActive]}>{num}</Text>}
                  </View>
                  {num < 4 && <View style={[styles.stepLine, num < getStepNumber() && styles.stepLineActive]} />}
                </View>
              ))}
            </View>
          </View>
          <View style={{ width: 40 }} />
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Amount Step */}
        {step === 'amount' && (
          <View style={styles.stepContent}>
            <View style={styles.stepHeader}>
              <MaterialIcons name="favorite" size={32} color={Colors.primary} />
              <Text style={styles.stepTitle}>How much love?</Text>
              <Text style={styles.stepSubtitle}>Choose an amount to spread across multiple needs.</Text>
            </View>
            <View style={styles.amountDisplay}>
              <Text style={styles.amountDollar}>$</Text>
              <Text style={styles.amountValue}>{amount > 0 ? amount : '0'}</Text>
            </View>
            <View style={styles.presetGrid}>
              {PRESET_AMOUNTS.map(amt => (
                <TouchableOpacity key={amt} style={[styles.presetButton, !isCustom && selectedAmount === amt && styles.presetButtonSelected]} onPress={() => { setSelectedAmount(amt); setIsCustom(false); }} activeOpacity={0.7}>
                  <Text style={[styles.presetButtonText, !isCustom && selectedAmount === amt && styles.presetButtonTextSelected]}>${amt}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={[styles.customToggle, isCustom && styles.customToggleActive]} onPress={() => setIsCustom(true)} activeOpacity={0.7}>
              <MaterialIcons name="edit" size={18} color={isCustom ? Colors.primary : Colors.textSecondary} />
              <Text style={[styles.customToggleText, isCustom && styles.customToggleTextActive]}>Enter custom amount</Text>
            </TouchableOpacity>
            {isCustom && (
              <View style={styles.customInputRow}>
                <Text style={styles.customDollar}>$</Text>
                <TextInput style={styles.customInput} value={customAmount} onChangeText={setCustomAmount} keyboardType="numeric" placeholder="Max $300" placeholderTextColor={Colors.textLight} maxLength={6} autoFocus />
              </View>
            )}
            {amount > 0 && (
              <View style={styles.quickPreview}>
                <MaterialIcons name="auto-awesome" size={18} color={Colors.accent} />
                <Text style={styles.quickPreviewText}>
                  Smart Split: ${amount} across {splitResult.totalPeople} {splitResult.totalPeople === 1 ? 'person' : 'people'}
                  {splitResult.goalsCompleted > 0 && <Text style={{ color: Colors.success, fontWeight: '700' }}> completing {splitResult.goalsCompleted} {splitResult.goalsCompleted === 1 ? 'goal' : 'goals'}</Text>}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Mode Step */}
        {step === 'mode' && (
          <View style={styles.stepContent}>
            <View style={styles.stepHeader}>
              <MaterialIcons name="auto-awesome" size={32} color={Colors.accent} />
              <Text style={styles.stepTitle}>How to spread?</Text>
              <Text style={styles.stepSubtitle}>Choose how your ${amount} is distributed.</Text>
            </View>
            <View style={styles.modeCards}>
              {SPREAD_MODES.map(mode => (
                <TouchableOpacity key={mode.key} style={[styles.modeCard, spreadMode === mode.key && { borderColor: mode.color, borderWidth: 2 }]} onPress={() => setSpreadMode(mode.key)} activeOpacity={0.7}>
                  <View style={[styles.modeIconBg, { backgroundColor: mode.color + '20' }]}>
                    <MaterialIcons name={mode.icon as any} size={28} color={mode.color} />
                  </View>
                  <View style={styles.modeInfo}>
                    <Text style={styles.modeTitle}>{mode.title}</Text>
                    <Text style={styles.modeDescription}>{mode.description}</Text>
                  </View>
                  <View style={[styles.modeRadio, spreadMode === mode.key && { borderColor: mode.color }]}>
                    {spreadMode === mode.key && <View style={[styles.modeRadioInner, { backgroundColor: mode.color }]} />}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
            {spreadMode === 'category' && (
              <View style={styles.categorySection}>
                <Text style={styles.categorySectionTitle}>Choose a category</Text>
                <View style={styles.categoryGrid}>
                  {CATEGORIES.filter(c => c.name !== 'All').map(cat => {
                    const isSelected = selectedCategory === cat.name;
                    const color = CategoryColors[cat.name] || Colors.textSecondary;
                    return (
                      <TouchableOpacity key={cat.name} style={[styles.categoryCard, isSelected && { borderColor: color, borderWidth: 2, backgroundColor: color + '10' }]} onPress={() => setSelectedCategory(cat.name)} activeOpacity={0.7}>
                        <MaterialIcons name={cat.icon as any} size={24} color={color} />
                        <Text style={[styles.categoryName, isSelected && { color, fontWeight: '800' }]}>{cat.name}</Text>
                        <Text style={styles.categoryCount}>{categoryCounts[cat.name] || 0} needs</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}
          </View>
        )}

        {/* Privacy Step */}
        {step === 'privacy' && (
          <View style={styles.stepContent}>
            <View style={styles.stepHeader}>
              <MaterialIcons name="shield" size={32} color={Colors.secondary} />
              <Text style={styles.stepTitle}>Your identity</Text>
              <Text style={styles.stepSubtitle}>Choose how you appear on contributions.</Text>
            </View>
            <View style={styles.privacyCards}>
              {PRIVACY_OPTIONS.map(option => (
                <TouchableOpacity key={option.key} style={[styles.privacyCard, privacyMode === option.key && styles.privacyCardSelected]} onPress={() => { setPrivacyMode(option.key); if (option.key !== 'specific') setSelectedNeedIds([]); }} activeOpacity={0.7}>
                  <View style={[styles.privacyIconBg, privacyMode === option.key && styles.privacyIconBgSelected]}>
                    <MaterialIcons name={option.icon as any} size={24} color={privacyMode === option.key ? Colors.white : Colors.textSecondary} />
                  </View>
                  <View style={styles.privacyInfo}>
                    <Text style={[styles.privacyTitle, privacyMode === option.key && styles.privacyTitleSelected]}>{option.title}</Text>
                    <Text style={styles.privacyDescription}>{option.description}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
            {privacyMode === 'specific' && (
              <View style={styles.specificSection}>
                <Text style={styles.specificTitle}>Choose people ({selectedNeedIds.length} selected)</Text>
                {eligibleNeeds.map(need => {
                  const isSelected = selectedNeedIds.includes(need.id);
                  return (
                    <TouchableOpacity key={need.id} style={[styles.specificCard, isSelected && styles.specificCardSelected]} onPress={() => toggleNeedSelection(need.id)} activeOpacity={0.7}>
                      <Image source={{ uri: need.userAvatar }} style={styles.specificAvatar} />
                      <View style={styles.specificInfo}>
                        <Text style={styles.specificName}>{need.userName}</Text>
                        <Text style={styles.specificNeedTitle} numberOfLines={1}>{need.title}</Text>
                        <Text style={styles.specificRemaining}>${need.goalAmount - need.raisedAmount} remaining</Text>
                      </View>
                      <View style={[styles.specificCheck, isSelected && styles.specificCheckSelected]}>
                        {isSelected && <MaterialIcons name="check" size={16} color={Colors.white} />}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* Preview Step */}
        {step === 'preview' && (
          <View style={styles.stepContent}>
            <View style={styles.stepHeader}>
              <MaterialIcons name="preview" size={32} color={Colors.primary} />
              <Text style={styles.stepTitle}>Preview your spread</Text>
              <Text style={styles.stepSubtitle}>{getImpactMessage(splitResult)}</Text>
            </View>
            <SpreadPreview result={splitResult} isAnonymous={privacyMode === 'anonymous'} />
            {errorMsg ? (
              <View style={styles.errorBanner}>
                <MaterialIcons name="error-outline" size={18} color={Colors.error} />
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            ) : null}
          </View>
        )}

        {/* Processing */}
        {step === 'processing' && (
          <View style={styles.processingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.processingTitle}>Spreading the love...</Text>
            <Text style={styles.processingSubtitle}>Processing {splitResult.allocations.length} contributions</Text>
            <View style={styles.processingDots}>
              {splitResult.allocations.map((alloc) => (
                <View key={alloc.needId} style={styles.processingDot}>
                  <Image source={{ uri: alloc.userAvatar }} style={styles.processingAvatar} />
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Success */}
        {step === 'success' && (
          <View style={styles.successContainer}>
            {heartAnims.map((anim, i) => (
              <Animated.View key={i} style={[styles.floatingHeart, { opacity: anim.opacity, transform: [{ translateY: anim.translateY }, { translateX: anim.translateX }] }]}>
                <MaterialIcons name="favorite" size={20 + Math.random() * 16} color={[Colors.primary, Colors.secondary, Colors.accent, '#E8A0BF', '#B8A9C9', '#7B9ED9'][i]} />
              </Animated.View>
            ))}
            <Animated.View style={[styles.successContent, { opacity: successOpacity, transform: [{ scale: successScale }] }]}>
              <View style={styles.successIconCircle}>
                <MaterialIcons name="favorite" size={48} color={Colors.white} />
              </View>
              <Text style={styles.successTitle}>Love Spread!</Text>
              <Text style={styles.successMessage}>
                You helped {splitResult.totalPeople} {splitResult.totalPeople === 1 ? 'person' : 'people'}
                {splitResult.goalsCompleted > 0 && ` and completed ${splitResult.goalsCompleted} ${splitResult.goalsCompleted === 1 ? 'goal' : 'goals'}`}
              </Text>
              <View style={styles.successSummary}>
                {splitResult.allocations.map(alloc => (
                  <View key={alloc.needId} style={styles.successRow}>
                    <Image source={{ uri: alloc.userAvatar }} style={styles.successAvatar} />
                    <Text style={styles.successName} numberOfLines={1}>{alloc.userName}</Text>
                    <Text style={styles.successAmount}>${alloc.amount.toFixed(2)}</Text>
                    {alloc.willComplete && <MaterialIcons name="check-circle" size={16} color={Colors.success} />}
                  </View>
                ))}
              </View>
              <Text style={styles.successQuote}>"{getImpactMessage(splitResult)}"</Text>
              <TouchableOpacity style={styles.successButton} onPress={() => router.back()} activeOpacity={0.8}>
                <Text style={styles.successButtonText}>Back to Home</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.successSecondaryButton} onPress={() => {
                setStep('amount'); setSelectedAmount(30); setCustomAmount(''); setIsCustom(false); setSelectedNeedIds([]); setErrorMsg('');
                successScale.setValue(0); successOpacity.setValue(0);
                heartAnims.forEach(a => { a.translateY.setValue(0); a.opacity.setValue(0); a.translateX.setValue(0); });
              }} activeOpacity={0.7}>
                <MaterialIcons name="favorite" size={18} color={Colors.primary} />
                <Text style={styles.successSecondaryText}>Spread More Love</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        )}
      </ScrollView>

      {step !== 'success' && step !== 'processing' && (
        <View style={[styles.bottomBar, { paddingBottom: Platform.OS === 'web' ? Spacing.md : insets.bottom + Spacing.md }]}>
          {step === 'preview' ? (
            <TouchableOpacity style={[styles.actionButton, styles.confirmButton, !canProceed() && styles.actionButtonDisabled]} onPress={handleConfirmSpread} activeOpacity={0.8} disabled={!canProceed() || processing}>
              <MaterialIcons name="favorite" size={20} color={Colors.white} />
              <Text style={styles.actionButtonText}>Spread ${amount} to {splitResult.totalPeople} {splitResult.totalPeople === 1 ? 'person' : 'people'}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.actionButton, !canProceed() && styles.actionButtonDisabled]} onPress={goNext} activeOpacity={0.8} disabled={!canProceed()}>
              <Text style={styles.actionButtonText}>Continue</Text>
              <MaterialIcons name="arrow-forward" size={20} color={Colors.white} />
            </TouchableOpacity>
          )}
        </View>
      )}
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.text },
  stepIndicator: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.sm },
  stepRow: { flexDirection: 'row', alignItems: 'center' },
  stepDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.borderLight, alignItems: 'center', justifyContent: 'center' },
  stepDotActive: { backgroundColor: Colors.primary },
  stepDotComplete: { backgroundColor: Colors.success },
  stepDotText: { fontSize: 11, fontWeight: '700', color: Colors.textLight },
  stepDotTextActive: { color: Colors.white },
  stepLine: { width: 32, height: 2, backgroundColor: Colors.borderLight, marginHorizontal: 4 },
  stepLineActive: { backgroundColor: Colors.success },
  scrollContent: { paddingBottom: 120 },
  stepContent: { padding: Spacing.xl, gap: Spacing.xl },
  stepHeader: { alignItems: 'center', gap: Spacing.sm },
  stepTitle: { fontSize: FontSize.xxl, fontWeight: '900', color: Colors.text, textAlign: 'center' },
  stepSubtitle: { fontSize: FontSize.md, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, paddingHorizontal: Spacing.lg },
  amountDisplay: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', paddingVertical: Spacing.lg },
  amountDollar: { fontSize: 32, fontWeight: '700', color: Colors.primary, marginTop: 8 },
  amountValue: { fontSize: 64, fontWeight: '900', color: Colors.text },
  presetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, justifyContent: 'center' },
  presetButton: { width: '30%', paddingVertical: Spacing.lg, borderRadius: BorderRadius.xl, backgroundColor: Colors.surface, alignItems: 'center', borderWidth: 2, borderColor: 'transparent', ...Shadow.sm },
  presetButtonSelected: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  presetButtonText: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.textSecondary },
  presetButtonTextSelected: { color: Colors.primary },
  customToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: Spacing.md, borderRadius: BorderRadius.lg, backgroundColor: Colors.surfaceAlt },
  customToggleActive: { backgroundColor: Colors.primaryLight },
  customToggleText: { fontSize: FontSize.md, fontWeight: '600', color: Colors.textSecondary },
  customToggleTextActive: { color: Colors.primary },
  customInputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, paddingHorizontal: Spacing.xl, borderWidth: 2, borderColor: Colors.primary, ...Shadow.sm },
  customDollar: { fontSize: FontSize.xxl, fontWeight: '700', color: Colors.primary },
  customInput: { flex: 1, fontSize: FontSize.xxl, fontWeight: '700', color: Colors.text, paddingVertical: Spacing.lg, marginLeft: Spacing.xs, ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {}) },
  quickPreview: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.accentLight, padding: Spacing.lg, borderRadius: BorderRadius.lg },
  quickPreviewText: { flex: 1, fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  modeCards: { gap: Spacing.md },
  modeCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.lg, borderWidth: 2, borderColor: 'transparent', ...Shadow.sm },
  modeIconBg: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  modeInfo: { flex: 1 },
  modeTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text, marginBottom: 2 },
  modeDescription: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 18 },
  modeRadio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  modeRadioInner: { width: 12, height: 12, borderRadius: 6 },
  categorySection: { gap: Spacing.md },
  categorySectionTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  categoryCard: { width: '31%', backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.md, alignItems: 'center', gap: Spacing.xs, borderWidth: 2, borderColor: 'transparent', ...Shadow.sm },
  categoryName: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.text, textAlign: 'center' },
  categoryCount: { fontSize: 10, color: Colors.textLight },
  privacyCards: { gap: Spacing.md },
  privacyCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.lg, borderWidth: 2, borderColor: 'transparent', ...Shadow.sm },
  privacyCardSelected: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  privacyIconBg: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  privacyIconBgSelected: { backgroundColor: Colors.primary },
  privacyInfo: { flex: 1 },
  privacyTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text, marginBottom: 2 },
  privacyTitleSelected: { color: Colors.primary },
  privacyDescription: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 18 },
  specificSection: { gap: Spacing.md },
  specificTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  specificCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.md, borderWidth: 2, borderColor: 'transparent', ...Shadow.sm },
  specificCardSelected: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  specificAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.borderLight },
  specificInfo: { flex: 1 },
  specificName: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  specificNeedTitle: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 1 },
  specificRemaining: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: '600', marginTop: 2 },
  specificCheck: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  specificCheckSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: '#FFF0F0', padding: Spacing.md, borderRadius: BorderRadius.lg },
  errorText: { flex: 1, fontSize: FontSize.sm, color: Colors.error, fontWeight: '600' },
  bottomBar: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.md, backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.borderLight, ...(Platform.OS === 'web' ? { boxShadow: '0 -2px 16px rgba(0,0,0,0.08)' as any } : Shadow.lg) },
  actionButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: Colors.primary, paddingVertical: Spacing.lg, borderRadius: BorderRadius.xl, ...Shadow.md },
  confirmButton: { backgroundColor: Colors.success },
  actionButtonDisabled: { opacity: 0.5 },
  actionButtonText: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.white },
  processingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 100, gap: Spacing.lg },
  processingTitle: { fontSize: FontSize.xxl, fontWeight: '900', color: Colors.text, marginTop: Spacing.lg },
  processingSubtitle: { fontSize: FontSize.md, color: Colors.textSecondary },
  processingDots: { flexDirection: 'row', gap: -8, marginTop: Spacing.lg },
  processingDot: { borderWidth: 2, borderColor: Colors.white, borderRadius: 22 },
  processingAvatar: { width: 40, height: 40, borderRadius: 20 },
  successContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: Spacing.xl },
  floatingHeart: { position: 'absolute', bottom: '40%' },
  successContent: { alignItems: 'center', gap: Spacing.md, width: '100%' },
  successIconCircle: { width: 88, height: 88, borderRadius: 44, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', ...Shadow.lg, marginBottom: Spacing.md },
  successTitle: { fontSize: FontSize.hero, fontWeight: '900', color: Colors.text },
  successMessage: { fontSize: FontSize.md, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  successSummary: { width: '100%', backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.lg, gap: Spacing.md, marginTop: Spacing.md, ...Shadow.sm },
  successRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  successAvatar: { width: 32, height: 32, borderRadius: 16 },
  successName: { flex: 1, fontSize: FontSize.sm, fontWeight: '600', color: Colors.text },
  successAmount: { fontSize: FontSize.md, fontWeight: '800', color: Colors.primary },
  successQuote: { fontSize: FontSize.sm, color: Colors.textSecondary, fontStyle: 'italic', textAlign: 'center', marginTop: Spacing.md, paddingHorizontal: Spacing.lg, lineHeight: 20 },
  successButton: { width: '100%', backgroundColor: Colors.primary, paddingVertical: Spacing.lg, borderRadius: BorderRadius.xl, alignItems: 'center', marginTop: Spacing.xl, ...Shadow.md },
  successButtonText: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.white },
  successSecondaryButton: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.md },
  successSecondaryText: { fontSize: FontSize.md, fontWeight: '700', color: Colors.primary },
});
